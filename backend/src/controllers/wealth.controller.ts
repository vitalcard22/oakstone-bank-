import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../config/db';
import { AppError } from '../utils/AppError';
import { generateRef } from '../utils/helpers';
import { auditLog } from '../utils/audit';
import { emitToUser } from '../services/websocket';

// Server-authoritative terms (months -> annual %). The client cannot set its own rate.
const FD_TERMS: Record<number, number> = { 3: 4.50, 6: 4.85, 12: 5.20, 24: 5.45 };
const MIN_DEPOSIT = 500;

const money = (n: number) =>
  `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function notify(userId: string, title: string, body: string): Promise<void> {
  try {
    await getDb().query('INSERT INTO notifications (user_id, title, body) VALUES ($1,$2,$3)', [userId, title, body]);
  } catch (e) { console.error('[notify] fixed-deposit:', e); }
}

function maturityValue(principal: number, rate: number, months: number): number {
  return +(principal * (1 + (rate / 100) * (months / 12))).toFixed(2);
}

// ─────────────────────────── USER ───────────────────────────

// GET /wealth/fixed-deposits
export async function listFixedDeposits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const { rows } = await getDb().query(
      `SELECT fd.id, fd.principal, fd.term_months, fd.interest_rate, fd.status,
              fd.reject_reason, fd.maturity_date, fd.maturity_value,
              fd.created_at, fd.approved_at, a.account_number
       FROM fixed_deposits fd
       JOIN accounts a ON a.id = fd.account_id
       WHERE fd.user_id = $1
       ORDER BY fd.created_at DESC`,
      [userId]
    );
    const terms = Object.entries(FD_TERMS).map(([months, rate]) => ({ months: Number(months), rate }));
    res.json({ terms, minDeposit: MIN_DEPOSIT, deposits: rows });
  } catch (e) { next(e); }
}

// POST /wealth/fixed-deposits   { accountId, principal, termMonths }
export async function applyFixedDeposit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const { accountId, principal, termMonths } = req.body;
    const amt = parseFloat(principal);
    const term = parseInt(termMonths, 10);

    if (!accountId) throw new AppError('Please choose a funding account', 400);
    if (!FD_TERMS[term]) throw new AppError('Invalid term selected', 400);
    if (isNaN(amt) || amt < MIN_DEPOSIT) throw new AppError(`Minimum deposit is ${money(MIN_DEPOSIT)}`, 400);

    const { rows: [acct] } = await getDb().query(
      'SELECT available_balance FROM accounts WHERE id=$1 AND user_id=$2',
      [accountId, userId]
    );
    if (!acct) throw new AppError('Funding account not found', 404);
    if (parseFloat(acct.available_balance) < amt) {
      throw new AppError('Insufficient available balance in the funding account', 400);
    }

    const rate = FD_TERMS[term];
    const { rows: [fd] } = await getDb().query(
      `INSERT INTO fixed_deposits (user_id, account_id, principal, term_months, interest_rate, status)
       VALUES ($1,$2,$3,$4,$5,'pending') RETURNING id`,
      [userId, accountId, amt, term, rate]
    );
    await notify(userId, 'Fixed Deposit submitted',
      `Your ${term}-month fixed deposit of ${money(amt)} is under review.`);
    res.status(201).json({ id: fd.id, message: 'Application submitted for review' });
  } catch (e) { next(e); }
}

// ─────────────────────────── ADMIN ───────────────────────────

// GET /wealth/admin/fixed-deposits?status=pending
export async function adminListFixedDeposits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = (req.query.status as string) || '';
    const params: any[] = [];
    let where = '';
    if (status) { params.push(status); where = 'WHERE fd.status = $1'; }
    const { rows } = await getDb().query(
      `SELECT fd.id, fd.principal, fd.term_months, fd.interest_rate, fd.status,
              fd.reject_reason, fd.maturity_date, fd.maturity_value, fd.created_at, fd.approved_at,
              a.account_number,
              TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS user_name,
              u.email
       FROM fixed_deposits fd
       JOIN accounts a ON a.id = fd.account_id
       JOIN users u    ON u.id = fd.user_id
       ${where}
       ORDER BY (fd.status='pending') DESC, fd.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /wealth/admin/fixed-deposits/:id/approve
export async function adminApproveFixedDeposit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db = getDb();
  const client = await (db as any).connect();
  try {
    const adminId = (req as any).user.id;
    const { id } = req.params;
    await client.query('BEGIN');

    const { rows: [fd] } = await client.query('SELECT * FROM fixed_deposits WHERE id=$1 FOR UPDATE', [id]);
    if (!fd) throw new AppError('Fixed deposit not found', 404);
    if (fd.status !== 'pending') throw new AppError('This deposit is not pending', 400);

    const { rows: [acct] } = await client.query(
      'SELECT balance, available_balance FROM accounts WHERE id=$1 FOR UPDATE', [fd.account_id]
    );
    if (!acct) throw new AppError('Funding account not found', 404);
    const principal = parseFloat(fd.principal);
    if (parseFloat(acct.balance) < principal) throw new AppError('Funding account has insufficient balance', 400);

    await client.query(
      'UPDATE accounts SET balance=balance-$1, available_balance=available_balance-$1 WHERE id=$2',
      [principal, fd.account_id]
    );

    const term = fd.term_months;
    const rate = parseFloat(fd.interest_rate);
    const matVal = maturityValue(principal, rate, term);
    const maturityDate = new Date(); maturityDate.setMonth(maturityDate.getMonth() + term);

    await client.query(
      `UPDATE fixed_deposits SET status='active', approved_at=NOW(), maturity_date=$1, maturity_value=$2 WHERE id=$3`,
      [maturityDate, matVal, id]
    );

    await client.query(
      `INSERT INTO transactions
         (id, reference_id, from_account_id, tx_type, status, amount, description, metadata, processed_at, created_at, updated_at)
       VALUES ($1,$2,$3,'withdrawal','completed',$4,$5,$6,NOW(),NOW(),NOW())`,
      [uuid(), generateRef(), fd.account_id, principal,
       `Fixed Deposit opened (${term} months @ ${rate}%)`,
       JSON.stringify({ product: 'fixed_deposit', fixedDepositId: id, termMonths: term, rate })]
    );

    await client.query('COMMIT');

    await notify(fd.user_id, 'Fixed Deposit active',
      `Your ${term}-month deposit of ${money(principal)} is now active. Matures ${maturityDate.toISOString().slice(0, 10)} at ${money(matVal)}.`);
    emitToUser(fd.user_id, 'transaction', { type: 'fixed_deposit_approved', amount: principal });
    await auditLog({ actorId: adminId, action: 'admin.fixed_deposit.approve', entityId: id });

    res.json({ message: 'Fixed deposit approved and funded' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
}

// POST /wealth/admin/fixed-deposits/:id/payout  — mature an active deposit and return principal + interest
export async function adminPayoutFixedDeposit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db = getDb();
  const client = await (db as any).connect();
  try {
    const adminId = (req as any).user.id;
    const { id } = req.params;
    await client.query('BEGIN');

    const { rows: [fd] } = await client.query('SELECT * FROM fixed_deposits WHERE id=$1 FOR UPDATE', [id]);
    if (!fd) throw new AppError('Fixed deposit not found', 404);
    if (fd.status !== 'active') throw new AppError('Only active deposits can be paid out', 400);

    const payout = parseFloat(fd.maturity_value);
    const principal = parseFloat(fd.principal);

    await client.query(
      'UPDATE accounts SET balance=balance+$1, available_balance=available_balance+$1 WHERE id=$2',
      [payout, fd.account_id]
    );
    await client.query(`UPDATE fixed_deposits SET status='matured' WHERE id=$1`, [id]);

    await client.query(
      `INSERT INTO transactions
         (id, reference_id, to_account_id, tx_type, status, amount, description, metadata, processed_at, created_at, updated_at)
       VALUES ($1,$2,$3,'deposit','completed',$4,$5,$6,NOW(),NOW(),NOW())`,
      [uuid(), generateRef(), fd.account_id, payout,
       `Fixed Deposit matured (${fd.term_months} months @ ${parseFloat(fd.interest_rate)}%)`,
       JSON.stringify({ product: 'fixed_deposit', fixedDepositId: id, principal, interest: +(payout - principal).toFixed(2) })]
    );

    await client.query('COMMIT');

    await notify(fd.user_id, 'Fixed Deposit matured',
      `Your ${fd.term_months}-month deposit has matured. ${money(payout)} (principal + interest) has been credited to your account.`);
    emitToUser(fd.user_id, 'transaction', { type: 'fixed_deposit_matured', amount: payout });
    await auditLog({ actorId: adminId, action: 'admin.fixed_deposit.payout', entityId: id });

    res.json({ message: 'Fixed deposit paid out' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
}

// POST /wealth/admin/fixed-deposits/:id/reject   { reason }
export async function adminRejectFixedDeposit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = (req as any).user.id;
    const { id } = req.params;
    const { reason } = req.body;

    const { rows: [fd] } = await getDb().query('SELECT * FROM fixed_deposits WHERE id=$1', [id]);
    if (!fd) throw new AppError('Fixed deposit not found', 404);
    if (fd.status !== 'pending') throw new AppError('This deposit is not pending', 400);

    await getDb().query(
      `UPDATE fixed_deposits SET status='rejected', reject_reason=$1 WHERE id=$2`,
      [reason || 'Not approved', id]
    );
    await notify(fd.user_id, 'Fixed Deposit declined',
      `Your fixed deposit application was declined.${reason ? ' Reason: ' + reason : ''}`);
    await auditLog({ actorId: adminId, action: 'admin.fixed_deposit.reject', entityId: id });

    res.json({ message: 'Fixed deposit rejected' });
  } catch (e) { next(e); }
}
