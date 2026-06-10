import { Request, Response, NextFunction } from 'express';
import { getDb } from '../config/db';
import { AppError } from '../utils/AppError';
import { generateAccountNumber } from '../utils/helpers';
import { auditLog } from '../utils/audit';

// GET /accounts
export async function listAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId  = (req as any).user.id;
    const { rows } = await getDb().query(
      `SELECT id, account_number, routing_number, account_type, status,
              balance, available_balance, daily_limit, nickname, opened_at, created_at
       FROM accounts WHERE user_id=$1 ORDER BY created_at ASC`,
      [userId]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /accounts
export async function openAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId      = (req as any).user.id;
    const { accountType } = req.body;
    const accountNumber   = generateAccountNumber();

    const { rows: [acct] } = await getDb().query(
      `INSERT INTO accounts (user_id, account_number, account_type, status, opened_at)
       VALUES ($1,$2,$3,'active',NOW())
       RETURNING id, account_number, account_type, status, balance`,
      [userId, accountNumber, accountType]
    );

    await auditLog({ actorId: userId, action: 'account.open', entityType: 'account', entityId: acct.id });
    res.status(201).json(acct);
  } catch (e) { next(e); }
}

// GET /accounts/:id
export async function getAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId  = (req as any).user.id;
    const { rows } = await getDb().query(
      `SELECT id, account_number, routing_number, account_type, status,
              balance, available_balance, daily_limit, nickname, opened_at
       FROM accounts WHERE id=$1 AND user_id=$2`,
      [req.params.id, userId]
    );
    if (!rows.length) throw new AppError('Account not found', 404);
    res.json(rows[0]);
  } catch (e) { next(e); }
}

// GET /accounts/:id/transactions
export async function listTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId   = (req as any).user.id;
    const accountId = req.params.id;

    // Verify ownership
    const { rowCount } = await getDb().query(
      'SELECT 1 FROM accounts WHERE id=$1 AND user_id=$2',
      [accountId, userId]
    );
    if (!rowCount) throw new AppError('Account not found', 404);

    const { rows } = await getDb().query(
      `SELECT id, reference_id, from_account_id, to_account_id,
              tx_type, status, amount, fee, description, created_at
       FROM transactions
       WHERE from_account_id=$1 OR to_account_id=$1
       ORDER BY created_at DESC LIMIT 50`,
      [accountId]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /accounts/:id/freeze
export async function freezeAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId  = (req as any).user.id;
    const { rowCount } = await getDb().query(
      `UPDATE accounts SET status='frozen' WHERE id=$1 AND user_id=$2 AND status='active'`,
      [req.params.id, userId]
    );
    if (!rowCount) throw new AppError('Account not found or already frozen', 404);
    await auditLog({ actorId: userId, action: 'account.freeze', entityId: req.params.id });
    res.json({ message: 'Account frozen' });
  } catch (e) { next(e); }
}

// POST /accounts/:id/unfreeze
export async function unfreezeAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId  = (req as any).user.id;
    const { rowCount } = await getDb().query(
      `UPDATE accounts SET status='active' WHERE id=$1 AND user_id=$2 AND status='frozen'`,
      [req.params.id, userId]
    );
    if (!rowCount) throw new AppError('Account not found or not frozen', 404);
    await auditLog({ actorId: userId, action: 'account.unfreeze', entityId: req.params.id });
    res.json({ message: 'Account unfrozen' });
  } catch (e) { next(e); }
}
