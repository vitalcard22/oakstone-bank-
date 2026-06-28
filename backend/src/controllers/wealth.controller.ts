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
    const userId = (req as any).user.id;
    const { id } = req.params;
    const amt = parseFloat(req.body.amount);
    if (isNaN(amt) || amt <= 0) throw new AppError('Enter a valid amount', 400);
    await client.query('BEGIN');

    const { rows: [g] } = await client.query(
      'SELECT * FROM savings_goals WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, userId]
    );
    if (!g) throw new AppError('Goal not found', 404);

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
  const db = getDb();
  const client = await (db as any).connect();
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const amt = parseFloat(req.body.amount);
    if (isNaN(amt) || amt <= 0) throw new AppError('Enter a valid amount', 400);
    await client.query('BEGIN');

    const { rows: [g] } = await client.query(
      'SELECT * FROM savings_goals WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, userId]
    );
    if (!g) throw new AppError('Goal not found', 404);
    if (parseFloat(g.saved_amount) < amt) throw new AppError('You cannot withdraw more than you have saved', 400);

    await client.query(
      'UPDATE accounts SET balance=balance+$1, available_balance=available_balance+$1 WHERE id=$2',
      [amt, g.account_id]
    );
    const newSaved = +(parseFloat(g.saved_amount) - amt).toFixed(2);
    const status = newSaved >= parseFloat(g.target_amount) ? 'completed' : 'active';
    await client.query('UPDATE savings_goals SET saved_amount=$1, status=$2 WHERE id=$3', [newSaved, status, id]);
    await client.query(
      `INSERT INTO transactions (id, reference_id, to_account_id, tx_type, status, amount, description, metadata, processed_at, created_at, updated_at)
       VALUES ($1,$2,$3,'deposit','completed',$4,$5,$6,NOW(),NOW(),NOW())`,
      [uuid(), generateRef(), g.account_id, amt, `Savings goal withdrawal: ${g.name}`,
       JSON.stringify({ product: 'savings_goal', savingsGoalId: id })]
    );
    await client.query('COMMIT');
    res.json({ message: 'Withdrawn to your account', saved: newSaved });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
}

// DELETE /wealth/savings-goals/:id  — returns any saved funds, then removes the goal
export async function deleteSavingsGoal(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db = getDb();
  const client = await (db as any).connect();
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    await client.query('BEGIN');

    const { rows: [g] } = await client.query(
      'SELECT * FROM savings_goals WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, userId]
    );
    if (!g) throw new AppError('Goal not found', 404);

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
    res.json({
      isa: isa ? {
        balance: isa.balance, interest_rate: isa.interest_rate,
        allowance_used: isa.allowance_used, account_number: null,
      } : null,
      config: { allowance: ISA_ALLOWANCE, rate: ISA_RATE, taxYear: currentTaxYear() },
    });
  } catch (e) { next(e); }
}

// POST /wealth/isa/contribute   { accountId, amount }
export async function contributeIsa(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db = getDb();
  const client = await (db as any).connect();
  try {
    const userId = (req as any).user.id;
    const { accountId } = req.body;
    const amt = parseFloat(req.body.amount);
    if (isNaN(amt) || amt <= 0) throw new AppError('Enter a valid amount', 400);
    if (!accountId) throw new AppError('Please choose a funding account', 400);
    await client.query('BEGIN');

    let { rows: [isa] } = await client.query('SELECT * FROM isa_accounts WHERE user_id=$1 FOR UPDATE', [userId]);
    if (isa && isa.tax_year !== currentTaxYear()) {
      await client.query('UPDATE isa_accounts SET allowance_used=0, tax_year=$1 WHERE id=$2', [currentTaxYear(), isa.id]);
      isa.allowance_used = 0;
    }
    const used = isa ? parseFloat(isa.allowance_used) : 0;
    if (used + amt > ISA_ALLOWANCE) {
      throw new AppError(`That exceeds your annual Roth IRA limit. You have ${money(ISA_ALLOWANCE - used)} remaining.`, 400);
    }

    const { rows: [acct] } = await client.query('SELECT available_balance FROM accounts WHERE id=$1 AND user_id=$2 FOR UPDATE', [accountId, userId]);
    if (!acct) throw new AppError('Funding account not found', 404);
    if (parseFloat(acct.available_balance) < amt) throw new AppError('Insufficient available balance', 400);

    await client.query('UPDATE accounts SET balance=balance-$1, available_balance=available_balance-$1 WHERE id=$2', [amt, accountId]);

    if (!isa) {
      const r = await client.query(
        `INSERT INTO isa_accounts (user_id, account_id, balance, interest_rate, allowance_used, tax_year)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [userId, accountId, amt, ISA_RATE, amt, currentTaxYear()]
      );
      isa = r.rows[0];
    } else {
      await client.query('UPDATE isa_accounts SET balance=balance+$1, allowance_used=allowance_used+$1, account_id=COALESCE(account_id,$2) WHERE id=$3', [amt, accountId, isa.id]);
    }

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

// POST /wealth/isa/withdraw   { amount }
export async function withdrawIsa(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db = getDb();
  const client = await (db as any).connect();
  try {
    const userId = (req as any).user.id;
    const amt = parseFloat(req.body.amount);
    if (isNaN(amt) || amt <= 0) throw new AppError('Enter a valid amount', 400);
    await client.query('BEGIN');

    const { rows: [isa] } = await client.query('SELECT * FROM isa_accounts WHERE user_id=$1 FOR UPDATE', [userId]);
    if (!isa) throw new AppError('No Roth IRA found', 404);
    if (parseFloat(isa.balance) < amt) throw new AppError('You cannot withdraw more than your ISA balance', 400);
    if (!isa.account_id) throw new AppError('No linked account to withdraw to', 400);

    await client.query('UPDATE accounts SET balance=balance+$1, available_balance=available_balance+$1 WHERE id=$2', [amt, isa.account_id]);
    await client.query('UPDATE isa_accounts SET balance=balance-$1 WHERE id=$2', [amt, isa.id]);
    await client.query(
      `INSERT INTO transactions (id, reference_id, to_account_id, tx_type, status, amount, description, metadata, processed_at, created_at, updated_at)
       VALUES ($1,$2,$3,'deposit','completed',$4,'Roth IRA withdrawal',$5,NOW(),NOW(),NOW())`,
      [uuid(), generateRef(), isa.account_id, amt, JSON.stringify({ product: 'isa' })]
    );
    await client.query('COMMIT');
    res.json({ message: 'Withdrawn to your account' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
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

// POST /wealth/retirement/withdraw   { amount }
export async function withdrawRetirement(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db = getDb();
  const client = await (db as any).connect();
  try {
    const userId = (req as any).user.id;
    const amt = parseFloat(req.body.amount);
    if (isNaN(amt) || amt <= 0) throw new AppError('Enter a valid amount', 400);
    await client.query('BEGIN');

    const { rows: [plan] } = await client.query('SELECT * FROM retirement_plans WHERE user_id=$1 FOR UPDATE', [userId]);
    if (!plan || plan.status !== 'active') throw new AppError('No active 401(k) found', 400);
    if (parseFloat(plan.balance) < amt) throw new AppError('You cannot withdraw more than your 401(k) balance', 400);

    await client.query('UPDATE accounts SET balance=balance+$1, available_balance=available_balance+$1 WHERE id=$2', [amt, plan.account_id]);
    await client.query('UPDATE retirement_plans SET balance=balance-$1 WHERE id=$2', [amt, plan.id]);
    await client.query(
      `INSERT INTO transactions (id, reference_id, to_account_id, tx_type, status, amount, description, metadata, processed_at, created_at, updated_at)
       VALUES ($1,$2,$3,'deposit','completed',$4,'401(k) withdrawal',$5,NOW(),NOW(),NOW())`,
      [uuid(), generateRef(), plan.account_id, amt, JSON.stringify({ product: 'retirement_401k' })]
    );
    await client.query('COMMIT');
    res.json({ message: 'Withdrawn to your account' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
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
