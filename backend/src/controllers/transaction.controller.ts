import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../config/db';
import { AppError } from '../utils/AppError';
import { generateRef } from '../utils/helpers';
import { auditLog } from '../utils/audit';
import { runFraudCheck } from '../services/fraud';
import { emitToUser, emitAdmin } from '../services/websocket';

// Shared check: user must have at least one approved (non-rejected, non-pending) credit card
// before they're allowed to send money out. They can still receive money regardless.
async function ensureCanSendMoney(userId: string): Promise<void> {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT 1 FROM credit_cards cc
     JOIN card_applications ca ON ca.id = cc.application_id
     WHERE cc.user_id::text = $1::text AND ca.status = 'approved'
     LIMIT 1`,
    [userId]
  );
  if (!rows.length) {
    throw new AppError(
      'You need an approved card before you can send money. Please apply for a card to unlock transfers.',
      403
    );
  }
}

// POST /transactions/transfer — internal between own accounts
export async function internalTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db     = getDb();
  const client = await (db as any).connect();
  try {
    const userId = (req as any).user.id;
    await ensureCanSendMoney(userId);

    await client.query('BEGIN');

    const { fromAccountId, toAccountId, amount, description } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) throw new AppError('Invalid amount', 400);

    // Verify ownership of from account
    const { rows: [from] } = await client.query(
      'SELECT balance, available_balance, status FROM accounts WHERE id=$1 AND user_id=$2 FOR UPDATE',
      [fromAccountId, userId]
    );
    if (!from) throw new AppError('Source account not found', 404);
    if (from.status !== 'active') throw new AppError('Account is not active', 400);
    if (parseFloat(from.available_balance) < amt) throw new AppError('Insufficient funds', 400);

    // Verify to account exists and is active — recipient validation
    const { rows: [to] } = await client.query(
      'SELECT status FROM accounts WHERE id=$1 FOR UPDATE',
      [toAccountId]
    );
    if (!to) throw new AppError('Destination account not found. Please check the account details and try again.', 404);
    if (to.status !== 'active') throw new AppError('Destination account is not active', 400);

    // Fraud check
    const fraud = await runFraudCheck({ userId, fromAccountId, toAccountId, amount: amt, ip: req.ip ?? '' });

    // Debit / credit
    await client.query(
      'UPDATE accounts SET balance=balance-$1, available_balance=available_balance-$1 WHERE id=$2',
      [amt, fromAccountId]
    );
    await client.query(
      'UPDATE accounts SET balance=balance+$1, available_balance=available_balance+$1 WHERE id=$2',
      [amt, toAccountId]
    );

    const refId = generateRef();
    const txId  = uuid();
    await client.query(
      `INSERT INTO transactions (id,reference_id,from_account_id,to_account_id,tx_type,status,amount,description,risk_score,flagged,ip_address)
       VALUES ($1,$2,$3,$4,'transfer','completed',$5,$6,$7,$8,$9)`,
      [txId, refId, fromAccountId, toAccountId, amt, description ?? null, fraud.score, fraud.flagged, req.ip]
    );

    if (fraud.flagged) {
      await client.query(
        `INSERT INTO fraud_alerts (id,user_id,tx_id,severity,rule_triggered,risk_score)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [uuid(), userId, txId, fraud.severity, fraud.rule, fraud.score]
      );
      emitAdmin('fraud_alert', { txId, userId, severity: fraud.severity });
    }

    await client.query('COMMIT');

    await auditLog({ actorId: userId, action: 'transaction.transfer', entityId: txId });
    emitToUser(userId, 'transaction', { type: 'transfer', amount: amt, refId, status: 'completed' });

    res.status(201).json({ transactionId: txId, referenceId: refId, status: 'completed' });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
}

// POST /transactions/zelle — instant P2P by email or phone
export async function zelleTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db     = getDb();
  const client = await (db as any).connect();
  try {
    const userId = (req as any).user.id;
    await ensureCanSendMoney(userId);

    await client.query('BEGIN');

    const { fromAccountId, identifier, amount, note } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) throw new AppError('Invalid amount', 400);
    if (!identifier) throw new AppError('Recipient email or phone is required', 400);

    // Find recipient's active checking account — recipient validation
    const { rows: [recipient] } = await client.query(
      `SELECT u.id AS recipient_id, a.id AS account_id
       FROM users u
       JOIN accounts a ON a.user_id=u.id AND a.status='active' AND a.account_type='checking'
       WHERE (u.email=$1 OR u.phone=$1) AND u.id!=$2
       LIMIT 1`,
      [identifier, userId]
    );
    if (!recipient) throw new AppError('Recipient not found on Oakstone. They must have an active Oakstone account to receive Zelle.', 404);

    // Check sender
    const { rows: [from] } = await client.query(
      'SELECT available_balance, status FROM accounts WHERE id=$1 AND user_id=$2 FOR UPDATE',
      [fromAccountId, userId]
    );
    if (!from) throw new AppError('Account not found', 404);
    if (from.status !== 'active') throw new AppError('Account not active', 400);
    if (parseFloat(from.available_balance) < amt) throw new AppError('Insufficient funds', 400);

    const fraud = await runFraudCheck({
      userId, fromAccountId, toAccountId: recipient.account_id,
      amount: amt, ip: req.ip ?? '', txType: 'zelle',
    });

    await client.query(
      'UPDATE accounts SET balance=balance-$1, available_balance=available_balance-$1 WHERE id=$2',
      [amt, fromAccountId]
    );
    await client.query(
      'UPDATE accounts SET balance=balance+$1, available_balance=available_balance+$1 WHERE id=$2',
      [amt, recipient.account_id]
    );

    const refId = generateRef();
    const txId  = uuid();
    await client.query(
      `INSERT INTO transactions (id,reference_id,from_account_id,to_account_id,tx_type,status,amount,description,risk_score,ip_address)
       VALUES ($1,$2,$3,$4,'zelle','completed',$5,$6,$7,$8)`,
      [txId, refId, fromAccountId, recipient.account_id, amt, note ?? null, fraud.score, req.ip]
    );

    await client.query('COMMIT');

    emitToUser(userId, 'transaction', { type: 'zelle_sent', amount: amt, refId });
    emitToUser(recipient.recipient_id, 'transaction', { type: 'zelle_received', amount: amt, refId });

    res.status(201).json({ transactionId: txId, referenceId: refId, status: 'completed' });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
}

// POST /transactions/ach — async ACH transfer (1-3 business days)
export async function achTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db     = getDb();
  const client = await (db as any).connect();
  try {
    const userId = (req as any).user.id;
    await ensureCanSendMoney(userId);

    await client.query('BEGIN');

    const { fromAccountId, routingNumber, externalAccountNumber, amount, direction } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) throw new AppError('Invalid amount', 400);
    if (!routingNumber || !/^\d{9}$/.test(String(routingNumber))) throw new AppError('Valid 9-digit routing number is required', 400);
    if (!externalAccountNumber || String(externalAccountNumber).trim().length < 4) throw new AppError('Valid external account number is required', 400);

    // Verify ownership and balance on the Oakstone side
    const { rows: [from] } = await client.query(
      'SELECT available_balance, status FROM accounts WHERE id=$1 AND user_id=$2 FOR UPDATE',
      [fromAccountId, userId]
    );
    if (!from) throw new AppError('Source account not found', 404);
    if (from.status !== 'active') throw new AppError('Account is not active', 400);

    // For outbound ACH (pulling money out of Oakstone), require sufficient balance and reserve it now
    const isOutbound = direction !== 'credit';
    if (isOutbound) {
      if (parseFloat(from.available_balance) < amt) throw new AppError('Insufficient funds', 400);
      await client.query(
        'UPDATE accounts SET available_balance=available_balance-$1 WHERE id=$2',
        [amt, fromAccountId]
      );
    }

    const refId = generateRef();
    const txId  = uuid();

    await client.query(
      `INSERT INTO transactions (id,reference_id,from_account_id,tx_type,status,amount,metadata,ip_address)
       VALUES ($1,$2,$3,'ach','pending',$4,$5,$6)`,
      [txId, refId, fromAccountId, amt,
        JSON.stringify({ routingNumber, externalAccountNumber, direction }), req.ip]
    );

    await client.query('COMMIT');

    await auditLog({ actorId: userId, action: 'transaction.ach', entityId: txId });

    res.status(202).json({
      transactionId: txId,
      referenceId:   refId,
      status:        'pending',
      message:       'ACH transfer initiated. Funds available in 1-3 business days.',
    });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
}

// POST /transactions/wire — wire transfer
export async function wireTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db     = getDb();
  const client = await (db as any).connect();
  try {
    const userId = (req as any).user.id;
    await ensureCanSendMoney(userId);

    await client.query('BEGIN');

    const { fromAccountId, amount, recipient } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) throw new AppError('Invalid amount', 400);
    if (!recipient || !recipient.name || !recipient.accountNumber || !recipient.bankName) {
      throw new AppError('Recipient name, bank name, and account number are required for a wire transfer', 400);
    }

    // Verify ownership and reserve funds
    const { rows: [from] } = await client.query(
      'SELECT available_balance, status FROM accounts WHERE id=$1 AND user_id=$2 FOR UPDATE',
      [fromAccountId, userId]
    );
    if (!from) throw new AppError('Source account not found', 404);
    if (from.status !== 'active') throw new AppError('Account is not active', 400);
    if (parseFloat(from.available_balance) < amt) throw new AppError('Insufficient funds', 400);

    await client.query(
      'UPDATE accounts SET available_balance=available_balance-$1 WHERE id=$2',
      [amt, fromAccountId]
    );

    const refId = generateRef();
    const txId  = uuid();

    await client.query(
      `INSERT INTO transactions (id,reference_id,from_account_id,tx_type,status,amount,metadata,ip_address)
       VALUES ($1,$2,$3,'wire','pending',$4,$5,$6)`,
      [txId, refId, fromAccountId, amt, JSON.stringify({ recipient }), req.ip]
    );

    await client.query('COMMIT');

    await auditLog({ actorId: userId, action: 'transaction.wire', entityId: txId });

    res.status(202).json({ transactionId: txId, referenceId: refId, status: 'pending' });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
}

// GET /transactions/:id
export async function getTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const { rows } = await getDb().query(
      `SELECT t.* FROM transactions t
       JOIN accounts a ON (a.id=t.from_account_id OR a.id=t.to_account_id)
       WHERE t.id=$1 AND a.user_id=$2 LIMIT 1`,
      [req.params.id, userId]
    );
    if (!rows.length) throw new AppError('Transaction not found', 404);
    res.json(rows[0]);
  } catch (e) { next(e); }
}
