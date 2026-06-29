import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../config/db';
import { sendTransactionAlert } from '../services/email';
import { AppError } from '../utils/AppError';
import { generateRef } from '../utils/helpers';
import { auditLog } from '../utils/audit';
import { emitToUser } from '../services/websocket';

// Server-authoritative terms (months -> annual %). The client cannot set its own rate.
const FD_TERMS: Record<number, number> = { 3: 4.50, 6: 4.85, 12: 5.20, 24: 5.45 };
const MIN_DEPOSIT = 500;

const money = (n: number) =>
  `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function ensureAccountActive(q: any, accountId: string): Promise<void> {
  const { rows } = await q.query('SELECT status FROM accounts WHERE id=$1', [accountId]);
  if (rows.length && rows[0].status !== 'active') {
    throw new AppError('This account is frozen. Please contact support to unfreeze it.', 403);
  }
}

async function ensureHasApprovedCard(userId: string): Promise<void> {
  const { rows } = await getDb().query(
    `SELECT 1 FROM credit_cards cc JOIN card_applications ca ON ca.id = cc.application_id
     WHERE cc.user_id::text = $1::text AND ca.status = 'approved' LIMIT 1`,
    [userId]
  );
  if (!rows.length) {
    throw new AppError('You need an approved card before you can do this. Please apply for a card to unlock transactions.', 403);
  }
}

async function notify(userId: string, title: string, body: string): Promise<void> {
  if (!userId) return;
  try {
    await getDb().query('INSERT INTO notifications (user_id, title, body) VALUES ($1,$2,$3)', [userId, title, body]);
  } catch (e) { console.error('[notify] fixed-deposit:', e); }
  // Email alert (non-blocking — never blocks or fails the transaction)
  (async () => {
    try {
      const { rows: [u] } = await getDb().query('SELECT email FROM users WHERE id=$1', [userId]);
      if (!u?.email) return;
      const { rows: [b] } = await getDb().query('SELECT COALESCE(SUM(available_balance),0) AS bal FROM accounts WHERE user_id=$1', [userId]);
      const balLine = (b && b.bal != null) ? `Available balance: $${Number(b.bal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined;
      await sendTransactionAlert(u.email, title, body, balLine);
    } catch (e: any) { console.error('[notify email] failed:', e?.message); }
  })();
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
    await ensureHasApprovedCard((req as any).user.id);
    const userId = (req as any).user.id;
    const { accountId, principal, termMonths } = req.body;
    const amt = parseFloat(principal);
    const term = parseInt(termMonths, 10);

    if (!accountId) throw new AppError('Please choose a funding account', 400);
    await ensureAccountActive(getDb(), accountId);
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

// ═══════════════════════ SAVINGS GOALS ═══════════════════════

// GET /wealth/savings-goals
export async function listSavingsGoals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const { rows } = await getDb().query(
      `SELECT g.id, g.name, g.icon, g.color, g.target_amount, g.saved_amount,
              g.target_date, g.status, g.created_at, a.account_number
       FROM savings_goals g
       JOIN accounts a ON a.id = g.account_id
       WHERE g.user_id = $1
       ORDER BY g.created_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /wealth/savings-goals   { name, icon, color, targetAmount, targetDate, accountId }
export async function createSavingsGoal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const { name, icon, color, targetAmount, targetDate, accountId } = req.body;
    const target = parseFloat(targetAmount);

    if (!name || !name.trim()) throw new AppError('Goal name is required', 400);
    if (!accountId) throw new AppError('Please choose a linked account', 400);
    if (isNaN(target) || target <= 0) throw new AppError('Enter a valid target amount', 400);

    const { rows: [acct] } = await getDb().query(
      'SELECT id FROM accounts WHERE id=$1 AND user_id=$2', [accountId, userId]
    );
    if (!acct) throw new AppError('Linked account not found', 404);

    const { rows: [g] } = await getDb().query(
      `INSERT INTO savings_goals (user_id, account_id, name, icon, color, target_amount, saved_amount, target_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,0,$7,'active') RETURNING id`,
      [userId, accountId, name.trim(), icon || '🎯', color || 'bg-emerald-500', target, targetDate || null]
    );
    res.status(201).json({ id: g.id, message: 'Savings goal created' });
  } catch (e) { next(e); }
}

// POST /wealth/savings-goals/:id/contribute   { amount }
export async function contributeSavingsGoal(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db = getDb();
  const client = await (db as any).connect();
  try {
    await ensureHasApprovedCard((req as any).user.id);
    const userId = (req as any).user.id;
    const { id } = req.params;
    const amt = parseFloat(req.body.amount);
    if (isNaN(amt) || amt <= 0) throw new AppError('Enter a valid amount', 400);
    await client.query('BEGIN');

    const { rows: [g] } = await client.query(
      'SELECT * FROM savings_goals WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, userId]
    );
    if (!g) throw new AppError('Goal not found', 404);
    await ensureAccountActive(client, g.account_id);

    const { rows: [acct] } = await client.query(
      'SELECT available_balance FROM accounts WHERE id=$1 FOR UPDATE', [g.account_id]
    );
    if (parseFloat(acct.available_balance) < amt) throw new AppError('Insufficient available balance', 400);

    await client.query(
      'UPDATE accounts SET balance=balance-$1, available_balance=available_balance-$1 WHERE id=$2',
      [amt, g.account_id]
    );
    const newSaved = +(parseFloat(g.saved_amount) + amt).toFixed(2);
    const completed = newSaved >= parseFloat(g.target_amount);
    await client.query(
      `UPDATE savings_goals SET saved_amount=$1, status=$2 WHERE id=$3`,
      [newSaved, completed ? 'completed' : 'active', id]
    );
    await client.query(
      `INSERT INTO transactions (id, reference_id, from_account_id, tx_type, status, amount, description, metadata, processed_at, created_at, updated_at)
       VALUES ($1,$2,$3,'withdrawal','completed',$4,$5,$6,NOW(),NOW(),NOW())`,
      [uuid(), generateRef(), g.account_id, amt, `Savings goal: ${g.name}`,
       JSON.stringify({ product: 'savings_goal', savingsGoalId: id })]
    );
    await client.query('COMMIT');

    if (completed) await notify(userId, 'Goal reached! 🎉', `You've fully funded "${g.name}" (${money(parseFloat(g.target_amount))}).`);
    res.json({ message: 'Contribution added', saved: newSaved, completed });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
}

// POST /wealth/savings-goals/:id/withdraw   { amount }
export async function withdrawSavingsGoal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureHasApprovedCard((req as any).user.id);
    const userId = (req as any).user.id;
    const { id } = req.params;
    const amt = parseFloat(req.body.amount);
    if (isNaN(amt) || amt <= 0) throw new AppError('Enter a valid amount', 400);
    const { rows: [g] } = await getDb().query('SELECT * FROM savings_goals WHERE id=$1 AND user_id=$2', [id, userId]);
    if (!g) throw new AppError('Goal not found', 404);
    await ensureAccountActive(getDb(), g.account_id);
    if (parseFloat(g.saved_amount) < amt) throw new AppError('You cannot withdraw more than you have saved', 400);
    const { rows: [p] } = await getDb().query("SELECT COALESCE(SUM(amount),0) AS pending FROM withdrawal_requests WHERE ref_id=$1 AND product='savings' AND status='pending'", [id]);
    if (parseFloat(p.pending) + amt > parseFloat(g.saved_amount)) throw new AppError('You already have pending withdrawal requests for this goal.', 400);
    await getDb().query("INSERT INTO withdrawal_requests (user_id, product, account_id, amount, ref_id, status) VALUES ($1,'savings',$2,$3,$4,'pending')", [userId, g.account_id, amt, id]);
    await notify(userId, 'Withdrawal requested', `Your withdrawal of ${money(amt)} from "${g.name}" is pending approval.`);
    res.json({ message: 'Withdrawal request submitted for approval' });
  } catch (e) { next(e); }
}

// GET /wealth/admin/savings/withdrawals
export async function adminListSavingsWithdrawals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await getDb().query(
      `SELECT w.id, w.amount, w.status, w.reject_reason, w.created_at, a.account_number, g.name AS goal_name,
              TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS user_name, u.email
       FROM withdrawal_requests w JOIN users u ON u.id=w.user_id
       LEFT JOIN accounts a ON a.id=w.account_id LEFT JOIN savings_goals g ON g.id=w.ref_id
       WHERE w.product='savings' ORDER BY (w.status='pending') DESC, w.created_at DESC`);
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /wealth/admin/savings/withdrawals/:id/approve
export async function adminApproveSavingsWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db = getDb();
  const client = await (db as any).connect();
  try {
    const adminId = (req as any).user.id; const { id } = req.params;
    await client.query('BEGIN');
    const { rows: [w] } = await client.query("SELECT * FROM withdrawal_requests WHERE id=$1 AND product='savings' FOR UPDATE", [id]);
    if (!w) throw new AppError('Request not found', 404);
    if (w.status !== 'pending') throw new AppError('This request is not pending', 400);
    const { rows: [g] } = await client.query('SELECT * FROM savings_goals WHERE id=$1 FOR UPDATE', [w.ref_id]);
    if (!g || parseFloat(g.saved_amount) < parseFloat(w.amount)) throw new AppError('Goal no longer has sufficient balance', 400);
    await client.query('UPDATE accounts SET balance=balance+$1, available_balance=available_balance+$1 WHERE id=$2', [w.amount, w.account_id]);
    const newSaved = +(parseFloat(g.saved_amount) - parseFloat(w.amount)).toFixed(2);
    const st = newSaved >= parseFloat(g.target_amount) ? 'completed' : 'active';
    await client.query('UPDATE savings_goals SET saved_amount=$1, status=$2 WHERE id=$3', [newSaved, st, g.id]);
    await client.query(
      `INSERT INTO transactions (id, reference_id, to_account_id, tx_type, status, amount, description, metadata, processed_at, created_at, updated_at)
       VALUES ($1,$2,$3,'deposit','completed',$4,$5,$6,NOW(),NOW(),NOW())`,
      [uuid(), generateRef(), w.account_id, w.amount, `Savings goal withdrawal: ${g.name}`, JSON.stringify({ product: 'savings_goal', savingsGoalId: g.id })]);
    await client.query("UPDATE withdrawal_requests SET status='approved', processed_at=NOW() WHERE id=$1", [id]);
    await client.query('COMMIT');
    await notify(w.user_id, 'Withdrawal approved', `Your withdrawal of ${money(w.amount)} from "${g.name}" has been approved and paid.`);
    await auditLog({ actorId: adminId, action: 'admin.savings.withdrawal.approve', entityId: id });
    res.json({ message: 'Withdrawal approved and paid' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
}

// POST /wealth/admin/savings/withdrawals/:id/reject  { reason }
export async function adminRejectSavingsWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = (req as any).user.id; const { id } = req.params; const { reason } = req.body;
    const { rows: [w] } = await getDb().query("SELECT * FROM withdrawal_requests WHERE id=$1 AND product='savings'", [id]);
    if (!w) throw new AppError('Request not found', 404);
    if (w.status !== 'pending') throw new AppError('This request is not pending', 400);
    await getDb().query("UPDATE withdrawal_requests SET status='rejected', reject_reason=$1, processed_at=NOW() WHERE id=$2", [reason || 'Not approved', id]);
    await notify(w.user_id, 'Withdrawal declined', `Your savings withdrawal of ${money(w.amount)} was declined.${reason ? ' Reason: ' + reason : ''}`);
    await auditLog({ actorId: adminId, action: 'admin.savings.withdrawal.reject', entityId: id });
    res.json({ message: 'Withdrawal rejected' });
  } catch (e) { next(e); }
}

// DELETE /wealth/savings-goals/:id  — returns any saved funds, then removes the goal
export async function deleteSavingsGoal(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db = getDb();
  const client = await (db as any).connect();
  try {
    await ensureHasApprovedCard((req as any).user.id);
    const userId = (req as any).user.id;
    const { id } = req.params;
    await client.query('BEGIN');

    const { rows: [g] } = await client.query(
      'SELECT * FROM savings_goals WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, userId]
    );
    if (!g) throw new AppError('Goal not found', 404);
    await ensureAccountActive(client, g.account_id);

    const saved = parseFloat(g.saved_amount);
    if (saved > 0) {
      await client.query(
        'UPDATE accounts SET balance=balance+$1, available_balance=available_balance+$1 WHERE id=$2',
        [saved, g.account_id]
      );
      await client.query(
        `INSERT INTO transactions (id, reference_id, to_account_id, tx_type, status, amount, description, metadata, processed_at, created_at, updated_at)
         VALUES ($1,$2,$3,'deposit','completed',$4,$5,$6,NOW(),NOW(),NOW())`,
        [uuid(), generateRef(), g.account_id, saved, `Savings goal closed: ${g.name}`,
         JSON.stringify({ product: 'savings_goal', savingsGoalId: id })]
      );
    }
    await client.query('DELETE FROM savings_goals WHERE id=$1', [id]);
    await client.query('COMMIT');
    res.json({ message: 'Goal closed', returned: saved });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
}

// ═══════════════════════ ISA (tax-free savings) ═══════════════════════

const ISA_ALLOWANCE = 7000; // annual Roth IRA contribution limit
const ISA_RATE = 4.75;       // tax-free APY

function currentTaxYear(): number { return new Date().getFullYear(); }

async function loadIsa(userId: string): Promise<any> {
  const { rows: [isa] } = await getDb().query('SELECT * FROM isa_accounts WHERE user_id=$1', [userId]);
  if (!isa) return null;
  // lazily reset the allowance when a new tax year starts
  if (isa.tax_year !== currentTaxYear()) {
    await getDb().query('UPDATE isa_accounts SET allowance_used=0, tax_year=$1 WHERE id=$2', [currentTaxYear(), isa.id]);
    isa.allowance_used = 0; isa.tax_year = currentTaxYear();
  }
  return isa;
}

// GET /wealth/isa
export async function getIsa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const isa = await loadIsa(userId);
    const { rows: [pw] } = await getDb().query(
      "SELECT COALESCE(SUM(amount),0) AS pending FROM withdrawal_requests WHERE user_id=$1 AND product='roth_ira' AND status='pending'", [userId]);
    res.json({
      isa: isa ? {
        status: isa.status, balance: isa.balance, interest_rate: isa.interest_rate,
        allowance_used: isa.allowance_used, reject_reason: isa.reject_reason,
      } : null,
      pendingWithdrawal: Number(pw.pending),
      config: { allowance: ISA_ALLOWANCE, rate: ISA_RATE, taxYear: currentTaxYear() },
    });
  } catch (e) { next(e); }
}

// POST /wealth/isa/contribute   { accountId, amount }
export async function contributeIsa(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db = getDb();
  const client = await (db as any).connect();
  try {
    await ensureHasApprovedCard((req as any).user.id);
    const userId = (req as any).user.id;
    const { accountId } = req.body;
    const amt = parseFloat(req.body.amount);
    if (isNaN(amt) || amt <= 0) throw new AppError('Enter a valid amount', 400);
    if (!accountId) throw new AppError('Please choose a funding account', 400);
    await client.query('BEGIN');

    let { rows: [isa] } = await client.query('SELECT * FROM isa_accounts WHERE user_id=$1 FOR UPDATE', [userId]);
    if (!isa) throw new AppError('You are not enrolled in a Roth IRA', 400);
    if (isa.status !== 'active') throw new AppError('Your Roth IRA enrollment is not active yet', 400);
    if (isa.tax_year !== currentTaxYear()) {
      await client.query('UPDATE isa_accounts SET allowance_used=0, tax_year=$1 WHERE id=$2', [currentTaxYear(), isa.id]);
      isa.allowance_used = 0;
    }
    const used = parseFloat(isa.allowance_used);
    if (used + amt > ISA_ALLOWANCE) {
      throw new AppError(`That exceeds your annual Roth IRA limit. You have ${money(ISA_ALLOWANCE - used)} remaining.`, 400);
    }

    const { rows: [acct] } = await client.query('SELECT available_balance FROM accounts WHERE id=$1 AND user_id=$2 FOR UPDATE', [accountId, userId]);
    if (!acct) throw new AppError('Funding account not found', 404);
    if (parseFloat(acct.available_balance) < amt) throw new AppError('Insufficient available balance', 400);

    await ensureAccountActive(client, accountId);
    await client.query('UPDATE accounts SET balance=balance-$1, available_balance=available_balance-$1 WHERE id=$2', [amt, accountId]);
    await client.query('UPDATE isa_accounts SET balance=balance+$1, allowance_used=allowance_used+$1 WHERE id=$2', [amt, isa.id]);

    await client.query(
      `INSERT INTO transactions (id, reference_id, from_account_id, tx_type, status, amount, description, metadata, processed_at, created_at, updated_at)
       VALUES ($1,$2,$3,'withdrawal','completed',$4,'Roth IRA contribution',$5,NOW(),NOW(),NOW())`,
      [uuid(), generateRef(), accountId, amt, JSON.stringify({ product: 'isa' })]
    );
    await client.query('COMMIT');
    res.json({ message: 'Added to your ISA' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
}

// POST /wealth/isa/withdraw   { amount }  → creates a withdrawal request for admin approval
export async function withdrawIsa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureHasApprovedCard((req as any).user.id);
    const userId = (req as any).user.id;
    const amt = parseFloat(req.body.amount);
    if (isNaN(amt) || amt <= 0) throw new AppError('Enter a valid amount', 400);

    const { rows: [isa] } = await getDb().query('SELECT * FROM isa_accounts WHERE user_id=$1', [userId]);
    if (!isa) throw new AppError('No Roth IRA found', 404);
    if (isa.status !== 'active') throw new AppError('Your Roth IRA is not active', 400);
    if (!isa.account_id) throw new AppError('No linked account to withdraw to', 400);
    await ensureAccountActive(getDb(), isa.account_id);
    if (parseFloat(isa.balance) < amt) throw new AppError('You cannot withdraw more than your Roth IRA balance', 400);

    const { rows: [p] } = await getDb().query(
      "SELECT COALESCE(SUM(amount),0) AS pending FROM withdrawal_requests WHERE user_id=$1 AND product='roth_ira' AND status='pending'", [userId]);
    if (parseFloat(p.pending) + amt > parseFloat(isa.balance)) {
      throw new AppError('You already have pending withdrawal requests covering this balance.', 400);
    }
    await getDb().query(
      "INSERT INTO withdrawal_requests (user_id, product, account_id, amount, status) VALUES ($1,'roth_ira',$2,$3,'pending')",
      [userId, isa.account_id, amt]
    );
    await notify(userId, 'Withdrawal requested', `Your Roth IRA withdrawal of ${money(amt)} is pending approval.`);
    res.json({ message: 'Withdrawal request submitted for approval' });
  } catch (e) { next(e); }
}

// GET /wealth/admin/isa/withdrawals
export async function adminListIsaWithdrawals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await getDb().query(
      `SELECT w.id, w.amount, w.status, w.reject_reason, w.created_at, a.account_number,
              TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS user_name, u.email
       FROM withdrawal_requests w
       JOIN users u ON u.id = w.user_id
       LEFT JOIN accounts a ON a.id = w.account_id
       WHERE w.product='roth_ira'
       ORDER BY (w.status='pending') DESC, w.created_at DESC`
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /wealth/admin/isa/withdrawals/:id/approve  → executes the withdrawal
export async function adminApproveIsaWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db = getDb();
  const client = await (db as any).connect();
  try {
    const adminId = (req as any).user.id; const { id } = req.params;
    await client.query('BEGIN');
    const { rows: [w] } = await client.query("SELECT * FROM withdrawal_requests WHERE id=$1 AND product='roth_ira' FOR UPDATE", [id]);
    if (!w) throw new AppError('Request not found', 404);
    if (w.status !== 'pending') throw new AppError('This request is not pending', 400);
    const { rows: [isa] } = await client.query('SELECT * FROM isa_accounts WHERE user_id=$1 FOR UPDATE', [w.user_id]);
    if (!isa || parseFloat(isa.balance) < parseFloat(w.amount)) throw new AppError('Customer no longer has sufficient Roth IRA balance', 400);

    await client.query('UPDATE accounts SET balance=balance+$1, available_balance=available_balance+$1 WHERE id=$2', [w.amount, w.account_id]);
    await client.query('UPDATE isa_accounts SET balance=balance-$1 WHERE id=$2', [w.amount, isa.id]);
    await client.query(
      `INSERT INTO transactions (id, reference_id, to_account_id, tx_type, status, amount, description, metadata, processed_at, created_at, updated_at)
       VALUES ($1,$2,$3,'deposit','completed',$4,'Roth IRA withdrawal',$5,NOW(),NOW(),NOW())`,
      [uuid(), generateRef(), w.account_id, w.amount, JSON.stringify({ product: 'isa' })]
    );
    await client.query("UPDATE withdrawal_requests SET status='approved', processed_at=NOW() WHERE id=$1", [id]);
    await client.query('COMMIT');
    await notify(w.user_id, 'Withdrawal approved', `Your Roth IRA withdrawal of ${money(w.amount)} has been approved and paid to your account.`);
    await auditLog({ actorId: adminId, action: 'admin.isa.withdrawal.approve', entityId: id });
    res.json({ message: 'Withdrawal approved and paid' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
}

// POST /wealth/admin/isa/withdrawals/:id/reject  { reason }
export async function adminRejectIsaWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = (req as any).user.id; const { id } = req.params; const { reason } = req.body;
    const { rows: [w] } = await getDb().query("SELECT * FROM withdrawal_requests WHERE id=$1 AND product='roth_ira'", [id]);
    if (!w) throw new AppError('Request not found', 404);
    if (w.status !== 'pending') throw new AppError('This request is not pending', 400);
    await getDb().query("UPDATE withdrawal_requests SET status='rejected', reject_reason=$1, processed_at=NOW() WHERE id=$2", [reason || 'Not approved', id]);
    await notify(w.user_id, 'Withdrawal declined', `Your Roth IRA withdrawal of ${money(w.amount)} was declined.${reason ? ' Reason: ' + reason : ''}`);
    await auditLog({ actorId: adminId, action: 'admin.isa.withdrawal.reject', entityId: id });
    res.json({ message: 'Withdrawal rejected' });
  } catch (e) { next(e); }
}

// ═══════════════════ 401(k) RETIREMENT PLAN ═══════════════════

const K401_LIMIT = 23500; // 2025 IRS employee contribution limit

function curYear(): number { return new Date().getFullYear(); }

// GET /wealth/retirement
export async function getRetirement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    let { rows: [plan] } = await getDb().query('SELECT * FROM retirement_plans WHERE user_id=$1', [userId]);
    if (plan && plan.status === 'active' && plan.tax_year !== curYear()) {
      await getDb().query('UPDATE retirement_plans SET contribution_used=0, tax_year=$1 WHERE id=$2', [curYear(), plan.id]);
      plan.contribution_used = 0; plan.tax_year = curYear();
    }
    res.json({
      plan: plan ? {
        status: plan.status, balance: plan.balance, contribution_used: plan.contribution_used,
        reject_reason: plan.reject_reason,
      } : null,
      pendingWithdrawal: (await getDb().query("SELECT COALESCE(SUM(amount),0) AS p FROM withdrawal_requests WHERE user_id=$1 AND product='retirement_401k' AND status='pending'", [userId])).rows[0].p,
      config: { limit: K401_LIMIT, taxYear: curYear() },
    });
  } catch (e) { next(e); }
}

// POST /wealth/retirement/enroll   { accountId }
export async function enrollRetirement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const { accountId } = req.body;
    if (!accountId) throw new AppError('Please choose a funding account', 400);

    const { rows: [acct] } = await getDb().query('SELECT id FROM accounts WHERE id=$1 AND user_id=$2', [accountId, userId]);
    if (!acct) throw new AppError('Account not found', 404);

    const { rows: [existing] } = await getDb().query('SELECT * FROM retirement_plans WHERE user_id=$1', [userId]);
    if (existing && (existing.status === 'pending' || existing.status === 'active')) {
      throw new AppError(existing.status === 'active' ? 'You are already enrolled' : 'Your enrollment is already under review', 400);
    }
    if (existing) {
      await getDb().query(
        `UPDATE retirement_plans SET status='pending', account_id=$1, reject_reason=NULL, tax_year=$2 WHERE id=$3`,
        [accountId, curYear(), existing.id]
      );
    } else {
      await getDb().query(
        `INSERT INTO retirement_plans (user_id, account_id, status, tax_year) VALUES ($1,$2,'pending',$3)`,
        [userId, accountId, curYear()]
      );
    }
    await notify(userId, '401(k) enrollment submitted', 'Your 401(k) enrollment request is under review.');
    res.status(201).json({ message: 'Enrollment requested' });
  } catch (e) { next(e); }
}

// POST /wealth/retirement/contribute   { amount }
export async function contributeRetirement(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db = getDb();
  const client = await (db as any).connect();
  try {
    await ensureHasApprovedCard((req as any).user.id);
    const userId = (req as any).user.id;
    const amt = parseFloat(req.body.amount);
    if (isNaN(amt) || amt <= 0) throw new AppError('Enter a valid amount', 400);
    await client.query('BEGIN');

    const { rows: [plan] } = await client.query('SELECT * FROM retirement_plans WHERE user_id=$1 FOR UPDATE', [userId]);
    if (!plan) throw new AppError('You are not enrolled in a 401(k)', 400);
    if (plan.status !== 'active') throw new AppError('Your 401(k) enrollment is not active yet', 400);

    const used = plan.tax_year === curYear() ? parseFloat(plan.contribution_used) : 0;
    if (used + amt > K401_LIMIT) throw new AppError(`That exceeds your annual 401(k) limit. You have ${money(K401_LIMIT - used)} remaining.`, 400);

    const { rows: [acct] } = await client.query('SELECT available_balance FROM accounts WHERE id=$1 FOR UPDATE', [plan.account_id]);
    if (!acct || parseFloat(acct.available_balance) < amt) throw new AppError('Insufficient available balance', 400);

    await ensureAccountActive(client, plan.account_id);
    await client.query('UPDATE accounts SET balance=balance-$1, available_balance=available_balance-$1 WHERE id=$2', [amt, plan.account_id]);
    await client.query('UPDATE retirement_plans SET balance=balance+$1, contribution_used=$2, tax_year=$3 WHERE id=$4',
      [amt, used + amt, curYear(), plan.id]);
    await client.query(
      `INSERT INTO transactions (id, reference_id, from_account_id, tx_type, status, amount, description, metadata, processed_at, created_at, updated_at)
       VALUES ($1,$2,$3,'withdrawal','completed',$4,'401(k) contribution',$5,NOW(),NOW(),NOW())`,
      [uuid(), generateRef(), plan.account_id, amt, JSON.stringify({ product: 'retirement_401k' })]
    );
    await client.query('COMMIT');
    res.json({ message: 'Contribution added to your 401(k)' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
}

// POST /wealth/retirement/withdraw   { amount }  → request for admin approval
export async function withdrawRetirement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureHasApprovedCard((req as any).user.id);
    const userId = (req as any).user.id;
    const amt = parseFloat(req.body.amount);
    if (isNaN(amt) || amt <= 0) throw new AppError('Enter a valid amount', 400);
    const { rows: [plan] } = await getDb().query('SELECT * FROM retirement_plans WHERE user_id=$1', [userId]);
    if (!plan || plan.status !== 'active') throw new AppError('No active 401(k) found', 400);
    await ensureAccountActive(getDb(), plan.account_id);
    if (parseFloat(plan.balance) < amt) throw new AppError('You cannot withdraw more than your 401(k) balance', 400);
    const { rows: [p] } = await getDb().query("SELECT COALESCE(SUM(amount),0) AS pending FROM withdrawal_requests WHERE user_id=$1 AND product='retirement_401k' AND status='pending'", [userId]);
    if (parseFloat(p.pending) + amt > parseFloat(plan.balance)) throw new AppError('You already have pending withdrawal requests covering this balance.', 400);
    await getDb().query("INSERT INTO withdrawal_requests (user_id, product, account_id, amount, status) VALUES ($1,'retirement_401k',$2,$3,'pending')", [userId, plan.account_id, amt]);
    await notify(userId, 'Withdrawal requested', `Your 401(k) withdrawal of ${money(amt)} is pending approval.`);
    res.json({ message: 'Withdrawal request submitted for approval' });
  } catch (e) { next(e); }
}

// GET /wealth/admin/retirement/withdrawals
export async function adminListRetirementWithdrawals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await getDb().query(
      `SELECT w.id, w.amount, w.status, w.reject_reason, w.created_at, a.account_number,
              TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS user_name, u.email
       FROM withdrawal_requests w JOIN users u ON u.id=w.user_id LEFT JOIN accounts a ON a.id=w.account_id
       WHERE w.product='retirement_401k' ORDER BY (w.status='pending') DESC, w.created_at DESC`);
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /wealth/admin/retirement/withdrawals/:id/approve
export async function adminApproveRetirementWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db = getDb();
  const client = await (db as any).connect();
  try {
    const adminId = (req as any).user.id; const { id } = req.params;
    await client.query('BEGIN');
    const { rows: [w] } = await client.query("SELECT * FROM withdrawal_requests WHERE id=$1 AND product='retirement_401k' FOR UPDATE", [id]);
    if (!w) throw new AppError('Request not found', 404);
    if (w.status !== 'pending') throw new AppError('This request is not pending', 400);
    const { rows: [plan] } = await client.query('SELECT * FROM retirement_plans WHERE user_id=$1 FOR UPDATE', [w.user_id]);
    if (!plan || parseFloat(plan.balance) < parseFloat(w.amount)) throw new AppError('Customer no longer has sufficient 401(k) balance', 400);
    await client.query('UPDATE accounts SET balance=balance+$1, available_balance=available_balance+$1 WHERE id=$2', [w.amount, w.account_id]);
    await client.query('UPDATE retirement_plans SET balance=balance-$1 WHERE id=$2', [w.amount, plan.id]);
    await client.query(
      `INSERT INTO transactions (id, reference_id, to_account_id, tx_type, status, amount, description, metadata, processed_at, created_at, updated_at)
       VALUES ($1,$2,$3,'deposit','completed',$4,'401(k) withdrawal',$5,NOW(),NOW(),NOW())`,
      [uuid(), generateRef(), w.account_id, w.amount, JSON.stringify({ product: 'retirement_401k' })]);
    await client.query("UPDATE withdrawal_requests SET status='approved', processed_at=NOW() WHERE id=$1", [id]);
    await client.query('COMMIT');
    await notify(w.user_id, 'Withdrawal approved', `Your 401(k) withdrawal of ${money(w.amount)} has been approved and paid.`);
    await auditLog({ actorId: adminId, action: 'admin.retirement.withdrawal.approve', entityId: id });
    res.json({ message: 'Withdrawal approved and paid' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
}

// POST /wealth/admin/retirement/withdrawals/:id/reject  { reason }
export async function adminRejectRetirementWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = (req as any).user.id; const { id } = req.params; const { reason } = req.body;
    const { rows: [w] } = await getDb().query("SELECT * FROM withdrawal_requests WHERE id=$1 AND product='retirement_401k'", [id]);
    if (!w) throw new AppError('Request not found', 404);
    if (w.status !== 'pending') throw new AppError('This request is not pending', 400);
    await getDb().query("UPDATE withdrawal_requests SET status='rejected', reject_reason=$1, processed_at=NOW() WHERE id=$2", [reason || 'Not approved', id]);
    await notify(w.user_id, 'Withdrawal declined', `Your 401(k) withdrawal of ${money(w.amount)} was declined.${reason ? ' Reason: ' + reason : ''}`);
    await auditLog({ actorId: adminId, action: 'admin.retirement.withdrawal.reject', entityId: id });
    res.json({ message: 'Withdrawal rejected' });
  } catch (e) { next(e); }
}

// ---- admin ----

// GET /wealth/admin/retirement
export async function adminListRetirement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await getDb().query(
      `SELECT rp.id, rp.status, rp.balance, rp.contribution_used, rp.reject_reason, rp.created_at, rp.approved_at,
              a.account_number,
              TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS user_name, u.email
       FROM retirement_plans rp
       JOIN users u ON u.id = rp.user_id
       LEFT JOIN accounts a ON a.id = rp.account_id
       ORDER BY (rp.status='pending') DESC, rp.created_at DESC`
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /wealth/admin/retirement/:id/approve
export async function adminApproveRetirement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = (req as any).user.id;
    const { id } = req.params;
    const { rows: [plan] } = await getDb().query('SELECT * FROM retirement_plans WHERE id=$1', [id]);
    if (!plan) throw new AppError('Enrollment not found', 404);
    if (plan.status !== 'pending') throw new AppError('This enrollment is not pending', 400);
    await getDb().query(`UPDATE retirement_plans SET status='active', approved_at=NOW() WHERE id=$1`, [id]);
    await notify(plan.user_id, '401(k) enrollment approved', 'You are now enrolled in the Oakstones 401(k). You can start contributing.');
    await auditLog({ actorId: adminId, action: 'admin.retirement.approve', entityId: id });
    res.json({ message: 'Enrollment approved' });
  } catch (e) { next(e); }
}

// POST /wealth/admin/retirement/:id/reject   { reason }
export async function adminRejectRetirement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = (req as any).user.id;
    const { id } = req.params;
    const { reason } = req.body;
    const { rows: [plan] } = await getDb().query('SELECT * FROM retirement_plans WHERE id=$1', [id]);
    if (!plan) throw new AppError('Enrollment not found', 404);
    if (plan.status !== 'pending') throw new AppError('This enrollment is not pending', 400);
    await getDb().query(`UPDATE retirement_plans SET status='rejected', reject_reason=$1 WHERE id=$2`, [reason || 'Not approved', id]);
    await notify(plan.user_id, '401(k) enrollment declined', `Your 401(k) enrollment was declined.${reason ? ' Reason: ' + reason : ''}`);
    await auditLog({ actorId: adminId, action: 'admin.retirement.reject', entityId: id });
    res.json({ message: 'Enrollment rejected' });
  } catch (e) { next(e); }
}

// ═══════════════════ INVESTMENT (live prices via Finnhub) ═══════════════════

const INV_ASSETS = [
  { symbol: 'SPY', name: 'S&P 500 ETF' },
  { symbol: 'VTI', name: 'Total US Market ETF' },
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF' },
  { symbol: 'BND', name: 'Total Bond Market ETF' },
  { symbol: 'GLD', name: 'Gold ETF' },
];
const INV_FALLBACK: Record<string, number> = { SPY: 545, VTI: 270, QQQ: 470, BND: 73, GLD: 215 };
const httpGet: any = (globalThis as any).fetch;

let priceCache: { at: number; data: Record<string, any> } = { at: 0, data: {} };

async function getQuotes(): Promise<Record<string, any>> {
  const now = Date.now();
  if (now - priceCache.at < 30000 && Object.keys(priceCache.data).length) return priceCache.data;
  const key = process.env.FINNHUB_API_KEY;
  const out: Record<string, any> = {};
  await Promise.all(INV_ASSETS.map(async (a) => {
    try {
      if (!key || !httpGet) throw new Error('no key');
      const r = await httpGet(`https://finnhub.io/api/v1/quote?symbol=${a.symbol}&token=${key}`);
      const j: any = await r.json();
      if (j && typeof j.c === 'number' && j.c > 0) {
        out[a.symbol] = { price: j.c, change: j.d ?? 0, pct: j.dp ?? 0, live: true };
      } else throw new Error('bad quote');
    } catch {
      const prev = priceCache.data[a.symbol]?.price ?? INV_FALLBACK[a.symbol];
      out[a.symbol] = { price: prev, change: 0, pct: 0, live: false };
    }
  }));
  priceCache = { at: now, data: out };
  return out;
}

// GET /wealth/investment  (market view is open to everyone; holdings only if active)
export async function getInvestment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const prices = await getQuotes();
    const { rows: [acct] } = await getDb().query('SELECT status, reject_reason FROM investment_accounts WHERE user_id=$1', [userId]);
    let holdings: any[] = [];
    if (acct && acct.status === 'active') {
      const { rows } = await getDb().query('SELECT symbol, shares, avg_price FROM investment_holdings WHERE user_id=$1 AND shares > 0', [userId]);
      holdings = rows.map((h: any) => {
        const px = prices[h.symbol]?.price ?? INV_FALLBACK[h.symbol] ?? 0;
        const value = Number(h.shares) * px;
        const cost = Number(h.shares) * Number(h.avg_price);
        return { symbol: h.symbol, shares: Number(h.shares), avg_price: Number(h.avg_price), price: px, value, gain: value - cost };
      });
    }
    const { rows: pendRows } = await getDb().query("SELECT symbol, COALESCE(SUM(shares),0) AS shares FROM withdrawal_requests WHERE user_id=$1 AND product='investment' AND status='pending' GROUP BY symbol", [userId]);
    const pendingSells: Record<string, number> = {};
    for (const r of pendRows) pendingSells[r.symbol] = Number(r.shares);
    res.json({
      account: acct ? { status: acct.status, reject_reason: acct.reject_reason } : null,
      assets: INV_ASSETS, prices, holdings, pendingSells,
    });
  } catch (e) { next(e); }
}

// POST /wealth/investment/enroll  { accountId }
export async function enrollInvestment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const { accountId } = req.body;
    if (!accountId) throw new AppError('Please choose a funding account', 400);
    const { rows: [acct] } = await getDb().query('SELECT id FROM accounts WHERE id=$1 AND user_id=$2', [accountId, userId]);
    if (!acct) throw new AppError('Account not found', 404);
    const { rows: [existing] } = await getDb().query('SELECT * FROM investment_accounts WHERE user_id=$1', [userId]);
    if (existing && (existing.status === 'pending' || existing.status === 'active')) {
      throw new AppError(existing.status === 'active' ? 'You are already enrolled' : 'Your enrollment is already under review', 400);
    }
    if (existing) {
      await getDb().query(`UPDATE investment_accounts SET status='pending', account_id=$1, reject_reason=NULL WHERE id=$2`, [accountId, existing.id]);
    } else {
      await getDb().query(`INSERT INTO investment_accounts (user_id, account_id, status) VALUES ($1,$2,'pending')`, [userId, accountId]);
    }
    await notify(userId, 'Investment enrollment submitted', 'Your investment account request is under review.');
    res.status(201).json({ message: 'Enrollment requested' });
  } catch (e) { next(e); }
}

async function activeInvAccount(client: any, userId: string): Promise<any> {
  const { rows: [acct] } = await client.query('SELECT * FROM investment_accounts WHERE user_id=$1', [userId]);
  if (!acct || acct.status !== 'active') throw new AppError('Your investment account is not active yet', 400);
  return acct;
}

// POST /wealth/investment/buy  { symbol, shares }
export async function buyInvestment(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db = getDb();
  const client = await (db as any).connect();
  try {
    await ensureHasApprovedCard((req as any).user.id);
    const userId = (req as any).user.id;
    const symbol = String(req.body.symbol || '').toUpperCase();
    const shares = parseFloat(req.body.shares);
    if (!INV_ASSETS.some(a => a.symbol === symbol)) throw new AppError('Unknown asset', 400);
    if (isNaN(shares) || shares <= 0) throw new AppError('Enter a valid number of shares', 400);
    const prices = await getQuotes();
    const px = prices[symbol]?.price;
    if (!px) throw new AppError('Price unavailable, try again shortly', 503);
    const cost = +(shares * px).toFixed(2);

    await client.query('BEGIN');
    const inv = await activeInvAccount(client, userId);
    const { rows: [bank] } = await client.query('SELECT available_balance FROM accounts WHERE id=$1 FOR UPDATE', [inv.account_id]);
    if (!bank || parseFloat(bank.available_balance) < cost) throw new AppError('Insufficient available balance', 400);

    await ensureAccountActive(client, inv.account_id);
    await client.query('UPDATE accounts SET balance=balance-$1, available_balance=available_balance-$1 WHERE id=$2', [cost, inv.account_id]);
    const { rows: [h] } = await client.query('SELECT * FROM investment_holdings WHERE user_id=$1 AND symbol=$2 FOR UPDATE', [userId, symbol]);
    if (h) {
      const newShares = Number(h.shares) + shares;
      const newAvg = ((Number(h.shares) * Number(h.avg_price)) + (shares * px)) / newShares;
      await client.query('UPDATE investment_holdings SET shares=$1, avg_price=$2, updated_at=NOW() WHERE id=$3', [newShares, newAvg, h.id]);
    } else {
      await client.query('INSERT INTO investment_holdings (user_id, symbol, shares, avg_price) VALUES ($1,$2,$3,$4)', [userId, symbol, shares, px]);
    }
    await client.query(
      `INSERT INTO transactions (id, reference_id, from_account_id, tx_type, status, amount, description, metadata, processed_at, created_at, updated_at)
       VALUES ($1,$2,$3,'withdrawal','completed',$4,$5,$6,NOW(),NOW(),NOW())`,
      [uuid(), generateRef(), inv.account_id, cost, `Buy ${shares} ${symbol} @ $${px.toFixed(2)}`, JSON.stringify({ product: 'investment', symbol, shares, price: px })]
    );
    await client.query('COMMIT');
    res.json({ message: `Bought ${shares} ${symbol}` });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
}

// POST /wealth/investment/sell  { symbol, shares }  → request; price executes at approval
export async function sellInvestment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureHasApprovedCard((req as any).user.id);
    const userId = (req as any).user.id;
    const symbol = String(req.body.symbol || '').toUpperCase();
    const shares = parseFloat(req.body.shares);
    if (isNaN(shares) || shares <= 0) throw new AppError('Enter a valid number of shares', 400);
    const { rows: [inv] } = await getDb().query('SELECT * FROM investment_accounts WHERE user_id=$1', [userId]);
    if (!inv || inv.status !== 'active') throw new AppError('Your investment account is not active yet', 400);
    await ensureAccountActive(getDb(), inv.account_id);
    const { rows: [h] } = await getDb().query('SELECT * FROM investment_holdings WHERE user_id=$1 AND symbol=$2', [userId, symbol]);
    if (!h || Number(h.shares) < shares) throw new AppError('You do not own that many shares', 400);
    const { rows: [p] } = await getDb().query("SELECT COALESCE(SUM(shares),0) AS pending FROM withdrawal_requests WHERE user_id=$1 AND product='investment' AND symbol=$2 AND status='pending'", [userId, symbol]);
    if (parseFloat(p.pending) + shares > Number(h.shares)) throw new AppError('You already have pending sell requests covering these shares.', 400);
    await getDb().query("INSERT INTO withdrawal_requests (user_id, product, account_id, symbol, shares, status) VALUES ($1,'investment',$2,$3,$4,'pending')", [userId, inv.account_id, symbol, shares]);
    await notify(userId, 'Sell requested', `Your request to sell ${shares} ${symbol} is pending approval.`);
    res.json({ message: 'Sell request submitted for approval' });
  } catch (e) { next(e); }
}

// GET /wealth/admin/investment/withdrawals
export async function adminListInvestmentWithdrawals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const prices = await getQuotes();
    const { rows } = await getDb().query(
      `SELECT w.id, w.symbol, w.shares, w.status, w.reject_reason, w.created_at, a.account_number,
              TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS user_name, u.email
       FROM withdrawal_requests w JOIN users u ON u.id=w.user_id LEFT JOIN accounts a ON a.id=w.account_id
       WHERE w.product='investment' ORDER BY (w.status='pending') DESC, w.created_at DESC`);
    res.json(rows.map((r: any) => ({ ...r, est_price: prices[r.symbol]?.price ?? INV_FALLBACK[r.symbol] ?? 0, est_proceeds: Number(r.shares) * (prices[r.symbol]?.price ?? INV_FALLBACK[r.symbol] ?? 0) })));
  } catch (e) { next(e); }
}

// POST /wealth/admin/investment/withdrawals/:id/approve  → sells at current live price
export async function adminApproveInvestmentWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db = getDb();
  const client = await (db as any).connect();
  try {
    const adminId = (req as any).user.id; const { id } = req.params;
    const prices = await getQuotes();
    await client.query('BEGIN');
    const { rows: [w] } = await client.query("SELECT * FROM withdrawal_requests WHERE id=$1 AND product='investment' FOR UPDATE", [id]);
    if (!w) throw new AppError('Request not found', 404);
    if (w.status !== 'pending') throw new AppError('This request is not pending', 400);
    const px = prices[w.symbol]?.price;
    if (!px) throw new AppError('Price unavailable, try again shortly', 503);
    const { rows: [h] } = await client.query('SELECT * FROM investment_holdings WHERE user_id=$1 AND symbol=$2 FOR UPDATE', [w.user_id, w.symbol]);
    if (!h || Number(h.shares) < Number(w.shares)) throw new AppError('Customer no longer owns enough shares', 400);
    const proceeds = +(Number(w.shares) * px).toFixed(2);
    const remaining = Number(h.shares) - Number(w.shares);
    await client.query('UPDATE accounts SET balance=balance+$1, available_balance=available_balance+$1 WHERE id=$2', [proceeds, w.account_id]);
    if (remaining > 0.0000001) await client.query('UPDATE investment_holdings SET shares=$1, updated_at=NOW() WHERE id=$2', [remaining, h.id]);
    else await client.query('DELETE FROM investment_holdings WHERE id=$1', [h.id]);
    await client.query(
      `INSERT INTO transactions (id, reference_id, to_account_id, tx_type, status, amount, description, metadata, processed_at, created_at, updated_at)
       VALUES ($1,$2,$3,'deposit','completed',$4,$5,$6,NOW(),NOW(),NOW())`,
      [uuid(), generateRef(), w.account_id, proceeds, `Sell ${w.shares} ${w.symbol} @ $${px.toFixed(2)}`, JSON.stringify({ product: 'investment', symbol: w.symbol, shares: Number(w.shares), price: px })]);
    await client.query("UPDATE withdrawal_requests SET status='approved', amount=$1, processed_at=NOW() WHERE id=$2", [proceeds, id]);
    await client.query('COMMIT');
    await notify(w.user_id, 'Sell approved', `Your sale of ${w.shares} ${w.symbol} executed at $${px.toFixed(2)} — ${money(proceeds)} paid to your account.`);
    await auditLog({ actorId: adminId, action: 'admin.investment.withdrawal.approve', entityId: id });
    res.json({ message: `Sold ${w.shares} ${w.symbol} for ${money(proceeds)}` });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
}

// POST /wealth/admin/investment/withdrawals/:id/reject  { reason }
export async function adminRejectInvestmentWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = (req as any).user.id; const { id } = req.params; const { reason } = req.body;
    const { rows: [w] } = await getDb().query("SELECT * FROM withdrawal_requests WHERE id=$1 AND product='investment'", [id]);
    if (!w) throw new AppError('Request not found', 404);
    if (w.status !== 'pending') throw new AppError('This request is not pending', 400);
    await getDb().query("UPDATE withdrawal_requests SET status='rejected', reject_reason=$1, processed_at=NOW() WHERE id=$2", [reason || 'Not approved', id]);
    await notify(w.user_id, 'Sell declined', `Your request to sell ${w.shares} ${w.symbol} was declined.${reason ? ' Reason: ' + reason : ''}`);
    await auditLog({ actorId: adminId, action: 'admin.investment.withdrawal.reject', entityId: id });
    res.json({ message: 'Sell request rejected' });
  } catch (e) { next(e); }
}

// ---- admin ----
export async function adminListInvestment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await getDb().query(
      `SELECT ia.id, ia.status, ia.reject_reason, ia.created_at, ia.approved_at, a.account_number,
              TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS user_name, u.email
       FROM investment_accounts ia
       JOIN users u ON u.id = ia.user_id
       LEFT JOIN accounts a ON a.id = ia.account_id
       ORDER BY (ia.status='pending') DESC, ia.created_at DESC`
    );
    res.json(rows);
  } catch (e) { next(e); }
}
export async function adminApproveInvestment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = (req as any).user.id; const { id } = req.params;
    const { rows: [a] } = await getDb().query('SELECT * FROM investment_accounts WHERE id=$1', [id]);
    if (!a) throw new AppError('Enrollment not found', 404);
    if (a.status !== 'pending') throw new AppError('This enrollment is not pending', 400);
    await getDb().query(`UPDATE investment_accounts SET status='active', approved_at=NOW() WHERE id=$1`, [id]);
    await notify(a.user_id, 'Investment account approved', 'Your investment account is active. You can now buy and sell.');
    await auditLog({ actorId: adminId, action: 'admin.investment.approve', entityId: id });
    res.json({ message: 'Approved' });
  } catch (e) { next(e); }
}
export async function adminRejectInvestment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = (req as any).user.id; const { id } = req.params; const { reason } = req.body;
    const { rows: [a] } = await getDb().query('SELECT * FROM investment_accounts WHERE id=$1', [id]);
    if (!a) throw new AppError('Enrollment not found', 404);
    if (a.status !== 'pending') throw new AppError('This enrollment is not pending', 400);
    await getDb().query(`UPDATE investment_accounts SET status='rejected', reject_reason=$1 WHERE id=$2`, [reason || 'Not approved', id]);
    await notify(a.user_id, 'Investment enrollment declined', `Your investment account request was declined.${reason ? ' Reason: ' + reason : ''}`);
    await auditLog({ actorId: adminId, action: 'admin.investment.reject', entityId: id });
    res.json({ message: 'Rejected' });
  } catch (e) { next(e); }
}

// ═══════════════════ WEALTH HUB (read-only overview of all products) ═══════════════════

// GET /wealth/hub
export async function getWealthHub(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const db = getDb();

    const [fdR, sgR, isaR, rpR, iaR] = await Promise.all([
      db.query(`SELECT COALESCE(SUM(principal),0) AS total, COUNT(*) AS cnt, MIN(maturity_date) AS next_maturity FROM fixed_deposits WHERE user_id=$1 AND status='active'`, [userId]),
      db.query(`SELECT COALESCE(SUM(saved_amount),0) AS total, COUNT(*) AS cnt FROM savings_goals WHERE user_id=$1`, [userId]),
      db.query(`SELECT balance, allowance_used FROM isa_accounts WHERE user_id=$1`, [userId]),
      db.query(`SELECT status, balance FROM retirement_plans WHERE user_id=$1`, [userId]),
      db.query(`SELECT status FROM investment_accounts WHERE user_id=$1`, [userId]),
    ]);

    // Fixed Deposit
    const fdTotal = Number(fdR.rows[0].total);
    const fdCnt = Number(fdR.rows[0].cnt);
    const nextMat = fdR.rows[0].next_maturity;

    // Savings Goals
    const sgTotal = Number(sgR.rows[0].total);
    const sgCnt = Number(sgR.rows[0].cnt);

    // Roth IRA
    const isa = isaR.rows[0];
    const isaBal = isa ? Number(isa.balance) : 0;
    const isaLeft = isa ? Math.max(0, ISA_ALLOWANCE - Number(isa.allowance_used)) : ISA_ALLOWANCE;

    // 401(k)
    const rp = rpR.rows[0];
    const rpActive = rp && rp.status === 'active';
    const rpBal = rpActive ? Number(rp.balance) : 0;

    // Investment (live value)
    const iaStatus = iaR.rows[0]?.status ?? null;
    let invValue = 0, invGain = 0;
    if (iaStatus === 'active') {
      const prices = await getQuotes();
      const { rows: holdings } = await db.query(`SELECT symbol, shares, avg_price FROM investment_holdings WHERE user_id=$1 AND shares > 0`, [userId]);
      for (const h of holdings) {
        const px = prices[h.symbol]?.price ?? INV_FALLBACK[h.symbol] ?? 0;
        invValue += Number(h.shares) * px;
        invGain += Number(h.shares) * px - Number(h.shares) * Number(h.avg_price);
      }
    }

    const products = [
      { key: 'fixed_deposit', label: 'Fixed Deposit', link: '/fixed-deposit', value: fdTotal,
        started: fdCnt > 0, status: fdCnt > 0 ? `${fdCnt} active${nextMat ? ` · matures ${new Date(nextMat).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''}` : 'Not started' },
      { key: 'savings_goals', label: 'Savings Goals', link: '/savings-goals', value: sgTotal,
        started: sgCnt > 0, status: sgCnt > 0 ? `${sgCnt} goal${sgCnt > 1 ? 's' : ''} in progress` : 'Not started' },
      { key: 'roth_ira', label: 'Roth IRA', link: '/isa', value: isaBal,
        started: !!isa, status: isa ? `${money(isaLeft)} allowance left` : 'Not started' },
      { key: 'retirement_401k', label: '401(k)', link: '/pension', value: rpBal,
        started: !!rp, status: rp ? (rpActive ? 'Active · contributing' : rp.status === 'pending' ? 'Enrollment under review' : 'Enrollment declined') : 'Not started' },
      { key: 'investment', label: 'Investment', link: '/investment', value: invValue, gain: invGain,
        started: iaStatus === 'active', status: iaStatus === 'active' ? `${invGain >= 0 ? '+' : ''}${money(invGain)} return · live` : iaStatus === 'pending' ? 'Enrollment under review' : iaStatus === 'rejected' ? 'Enrollment declined' : 'Not started' },
    ];

    const total = products.reduce((s, p) => s + p.value, 0);
    res.json({ total, products });
  } catch (e) { next(e); }
}

// ── Roth IRA enrollment + admin approval ──

// POST /wealth/isa/enroll   { accountId }
export async function enrollIsa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const { accountId } = req.body;
    if (!accountId) throw new AppError('Please choose a funding account', 400);
    const { rows: [acct] } = await getDb().query('SELECT id FROM accounts WHERE id=$1 AND user_id=$2', [accountId, userId]);
    if (!acct) throw new AppError('Account not found', 404);
    const { rows: [existing] } = await getDb().query('SELECT * FROM isa_accounts WHERE user_id=$1', [userId]);
    if (existing && (existing.status === 'pending' || existing.status === 'active')) {
      throw new AppError(existing.status === 'active' ? 'You are already enrolled' : 'Your enrollment is already under review', 400);
    }
    if (existing) {
      await getDb().query(`UPDATE isa_accounts SET status='pending', account_id=$1, reject_reason=NULL WHERE id=$2`, [accountId, existing.id]);
    } else {
      await getDb().query(
        `INSERT INTO isa_accounts (user_id, account_id, balance, interest_rate, allowance_used, tax_year, status)
         VALUES ($1,$2,0,$3,0,$4,'pending')`,
        [userId, accountId, ISA_RATE, currentTaxYear()]
      );
    }
    await notify(userId, 'Roth IRA enrollment submitted', 'Your Roth IRA enrollment request is under review.');
    res.status(201).json({ message: 'Enrollment requested' });
  } catch (e) { next(e); }
}

// GET /wealth/admin/isa
export async function adminListIsa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await getDb().query(
      `SELECT i.id, i.status, i.balance, i.allowance_used, i.reject_reason, i.created_at, i.approved_at,
              a.account_number,
              TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS user_name, u.email
       FROM isa_accounts i
       JOIN users u ON u.id = i.user_id
       LEFT JOIN accounts a ON a.id = i.account_id
       ORDER BY (i.status='pending') DESC, i.created_at DESC`
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /wealth/admin/isa/:id/approve
export async function adminApproveIsa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = (req as any).user.id; const { id } = req.params;
    const { rows: [isa] } = await getDb().query('SELECT * FROM isa_accounts WHERE id=$1', [id]);
    if (!isa) throw new AppError('Enrollment not found', 404);
    if (isa.status !== 'pending') throw new AppError('This enrollment is not pending', 400);
    await getDb().query(`UPDATE isa_accounts SET status='active', approved_at=NOW() WHERE id=$1`, [id]);
    await notify(isa.user_id, 'Roth IRA enrollment approved', 'Your Roth IRA is active. You can now contribute.');
    await auditLog({ actorId: adminId, action: 'admin.isa.approve', entityId: id });
    res.json({ message: 'Approved' });
  } catch (e) { next(e); }
}

// POST /wealth/admin/isa/:id/reject   { reason }
export async function adminRejectIsa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = (req as any).user.id; const { id } = req.params; const { reason } = req.body;
    const { rows: [isa] } = await getDb().query('SELECT * FROM isa_accounts WHERE id=$1', [id]);
    if (!isa) throw new AppError('Enrollment not found', 404);
    if (isa.status !== 'pending') throw new AppError('This enrollment is not pending', 400);
    await getDb().query(`UPDATE isa_accounts SET status='rejected', reject_reason=$1 WHERE id=$2`, [reason || 'Not approved', id]);
    await notify(isa.user_id, 'Roth IRA enrollment declined', `Your Roth IRA enrollment was declined.${reason ? ' Reason: ' + reason : ''}`);
    await auditLog({ actorId: adminId, action: 'admin.isa.reject', entityId: id });
    res.json({ message: 'Rejected' });
  } catch (e) { next(e); }
}
