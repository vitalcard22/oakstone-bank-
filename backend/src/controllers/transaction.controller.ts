import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../config/db';
import { AppError } from '../utils/AppError';
import { generateRef } from '../utils/helpers';
import { auditLog } from '../utils/audit';
import { runFraudCheck } from '../services/fraud';
import { emitToUser, emitAdmin } from '../services/websocket';

// Persist an in-app notification (non-fatal — never blocks the transaction).
const fmtMoney = (n: number) =>
  `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function notify(userId: string, title: string, body: string): Promise<void> {
  if (!userId) return;
  try {
    await getDb().query(
      `INSERT INTO notifications (user_id, title, body) VALUES ($1,$2,$3)`,
      [userId, title, body]
    );
  } catch (e) {
    console.error('[notify] failed:', e);
  }
}

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

// Per-transaction maximums and fees by transfer type (single source of truth,
// also exposed to the frontend via GET /transactions/config).
const TX_LIMITS: Record<string, number> = { transfer: 1000000, zelle: 2500, ach: 25000, wire: 50000 };
const TX_FEES:   Record<string, number> = { transfer: 0, zelle: 0, ach: 0, wire: 30 };
const WIRE_MIN = 100;

// GET /transactions/config — limits & fee schedule for the send-money forms
export async function getTransferConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ limits: TX_LIMITS, fees: TX_FEES, wireMin: WIRE_MIN });
  } catch (e) { next(e); }
}

// GET /transactions/zelle/lookup?identifier=... — confirm a Zelle recipient's name before sending
export async function zelleLookup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const identifier = String(req.query.identifier ?? '').trim();
    if (!identifier) throw new AppError('identifier required', 400);
    const { rows: [r] } = await getDb().query(
      `SELECT u.first_name, u.last_name
       FROM users u
       JOIN accounts a ON a.user_id=u.id AND a.status='active' AND a.account_type='checking'
       WHERE (u.email=$1 OR u.phone=$1) AND u.id!=$2
       LIMIT 1`,
      [identifier, userId]
    );
    if (!r) { res.json({ found: false }); return; }
    res.json({ found: true, name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() });
  } catch (e) { next(e); }
}

// POST /transactions/transfer — internal by recipient account number
export async function internalTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db     = getDb();
  const client = await (db as any).connect();
  try {
    const userId = (req as any).user.id;
    await ensureCanSendMoney(userId);

    await client.query('BEGIN');

    const { fromAccountId, toAccountNumber, amount, description, recipientName } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) throw new AppError('Invalid amount', 400);
    if (amt > TX_LIMITS.transfer) throw new AppError(`Amount exceeds the internal transfer limit of $${TX_LIMITS.transfer.toLocaleString()}`, 400);
    if (!toAccountNumber || String(toAccountNumber).trim().length < 4) {
      throw new AppError('A valid recipient account number is required', 400);
    }

    // Verify ownership of from account
    const { rows: [from] } = await client.query(
      'SELECT balance, available_balance, status FROM accounts WHERE id=$1 AND user_id=$2 FOR UPDATE',
      [fromAccountId, userId]
    );
    if (!from) throw new AppError('Source account not found', 404);
    if (from.status !== 'active') throw new AppError('Account is not active', 400);
    if (parseFloat(from.available_balance) < amt) throw new AppError('Insufficient funds', 400);

    // Resolve destination by ACCOUNT NUMBER — recipient validation
    const { rows: [to] } = await client.query(
      'SELECT id, status FROM accounts WHERE account_number=$1 FOR UPDATE',
      [String(toAccountNumber).trim()]
    );
    if (!to) throw new AppError('Destination account not found. Please check the account number and try again.', 404);
    if (to.status !== 'active') throw new AppError('Destination account is not active', 400);

    const toAccountId = to.id;
    if (toAccountId === fromAccountId) throw new AppError('Cannot transfer to the same account', 400);

    // If the user supplied a recipient name and left the memo blank, record it.
    const memo = description || (recipientName ? `Transfer to ${String(recipientName).trim()}` : null);

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
      [txId, refId, fromAccountId, toAccountId, amt, memo, fraud.score, fraud.flagged, req.ip]
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
    await notify(userId, 'Transfer sent', `You sent ${fmtMoney(amt)} to account ****${String(toAccountNumber).slice(-4)}.`);

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
    if (amt > TX_LIMITS.zelle) throw new AppError(`Amount exceeds the Zelle limit of $${TX_LIMITS.zelle.toLocaleString()}`, 400);

    // Find recipient's active checking account — recipient validation
    const { rows: [recipient] } = await client.query(
      `SELECT u.id AS recipient_id, a.id AS account_id
       FROM users u
       JOIN accounts a ON a.user_id=u.id AND a.status='active' AND a.account_type='checking'
       WHERE (u.email=$1 OR u.phone=$1) AND u.id!=$2
       LIMIT 1`,
      [identifier, userId]
    );
    if (!recipient) throw new AppError('Recipient not found on Oakstones. They must have an active Oakstones account to receive Zelle.', 404);

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
    await notify(userId, 'Zelle sent', `You sent ${fmtMoney(amt)} via Zelle to ${identifier}.`);
    await notify(recipient.recipient_id, 'Money received', `You received ${fmtMoney(amt)} via Zelle.`);

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

    const { fromAccountId, routingNumber, externalAccountNumber, accountType, accountHolderName, amount, direction } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) throw new AppError('Invalid amount', 400);
    if (!routingNumber || !/^\d{9}$/.test(String(routingNumber))) throw new AppError('Valid 9-digit routing number is required', 400);
    if (!externalAccountNumber || String(externalAccountNumber).trim().length < 4) throw new AppError('Valid external account number is required', 400);
    if (amt > TX_LIMITS.ach) throw new AppError(`Amount exceeds the ACH limit of $${TX_LIMITS.ach.toLocaleString()}`, 400);

    // Verify ownership and balance on the Oakstones side
    const { rows: [from] } = await client.query(
      'SELECT available_balance, status FROM accounts WHERE id=$1 AND user_id=$2 FOR UPDATE',
      [fromAccountId, userId]
    );
    if (!from) throw new AppError('Source account not found', 404);
    if (from.status !== 'active') throw new AppError('Account is not active', 400);

    // 'debit'  = money leaves Oakstones (outbound) -> debit this account
    // 'credit' = money comes into Oakstones (inbound)  -> credit this account
    const isOutbound = direction !== 'credit';
    if (isOutbound) {
      if (parseFloat(from.available_balance) < amt) throw new AppError('Insufficient funds', 400);
      await client.query(
        'UPDATE accounts SET balance=balance-$1, available_balance=available_balance-$1 WHERE id=$2',
        [amt, fromAccountId]
      );
    } else {
      await client.query(
        'UPDATE accounts SET balance=balance+$1, available_balance=available_balance+$1 WHERE id=$2',
        [amt, fromAccountId]
      );
    }

    const refId = generateRef();
    const txId  = uuid();

    await client.query(
      `INSERT INTO transactions (id,reference_id,from_account_id,tx_type,status,amount,metadata,ip_address)
       VALUES ($1,$2,$3,'ach','completed',$4,$5,$6)`,
      [txId, refId, fromAccountId, amt,
        JSON.stringify({ routingNumber, externalAccountNumber, accountType, accountHolderName, direction }), req.ip]
    );

    await client.query('COMMIT');

    await auditLog({ actorId: userId, action: 'transaction.ach', entityId: txId });
    emitToUser(userId, 'transaction', { type: 'ach', amount: amt, refId, status: 'completed' });
    await notify(userId, 'ACH transfer', isOutbound ? `You sent ${fmtMoney(amt)} via ACH.` : `You received ${fmtMoney(amt)} via ACH.`);

    res.status(201).json({
      transactionId: txId,
      referenceId:   refId,
      status:        'completed',
      message:       isOutbound
        ? 'ACH transfer completed. Funds have been debited from your account.'
        : 'ACH transfer completed. Funds have been credited to your account.',
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
    if (amt < WIRE_MIN) throw new AppError(`Minimum wire amount is $${WIRE_MIN}`, 400);
    if (amt > TX_LIMITS.wire) throw new AppError(`Amount exceeds the wire limit of $${TX_LIMITS.wire.toLocaleString()}`, 400);
    if (!recipient || !recipient.name || !recipient.accountNumber || !recipient.bankName) {
      throw new AppError('Recipient name, bank name, and account number are required for a wire transfer', 400);
    }

    const fee = TX_FEES.wire;

    // Verify ownership and reserve funds (amount + fee)
    const { rows: [from] } = await client.query(
      'SELECT available_balance, status FROM accounts WHERE id=$1 AND user_id=$2 FOR UPDATE',
      [fromAccountId, userId]
    );
    if (!from) throw new AppError('Source account not found', 404);
    if (from.status !== 'active') throw new AppError('Account is not active', 400);
    if (parseFloat(from.available_balance) < amt + fee) throw new AppError('Insufficient funds to cover the wire amount plus the wire fee', 400);

    // Debit the full wire amount + fee from the account immediately.
    await client.query(
      'UPDATE accounts SET balance=balance-$1, available_balance=available_balance-$1 WHERE id=$2',
      [amt + fee, fromAccountId]
    );

    const refId = generateRef();
    const txId  = uuid();

    await client.query(
      `INSERT INTO transactions (id,reference_id,from_account_id,tx_type,status,amount,metadata,ip_address)
       VALUES ($1,$2,$3,'wire','completed',$4,$5,$6)`,
      [txId, refId, fromAccountId, amt, JSON.stringify({ recipient, fee }), req.ip]
    );

    // Record the wire fee as its own completed transaction so it shows in history.
    if (fee > 0) {
      await client.query(
        `INSERT INTO transactions (id,reference_id,from_account_id,tx_type,status,amount,description,metadata,ip_address)
         VALUES ($1,$2,$3,'fee','completed',$4,$5,$6,$7)`,
        [uuid(), generateRef(), fromAccountId, fee, 'Wire transfer fee', JSON.stringify({ wireRef: refId }), req.ip]
      );
    }

    await client.query('COMMIT');

    await auditLog({ actorId: userId, action: 'transaction.wire', entityId: txId });
    emitToUser(userId, 'transaction', { type: 'wire', amount: amt, refId, status: 'completed' });
    await notify(userId, 'Wire sent', `You sent ${fmtMoney(amt)} via wire to ${recipient?.name ?? 'recipient'}.`);

    res.status(201).json({ transactionId: txId, referenceId: refId, status: 'completed' });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
}

// GET /transactions/:id
// Signed effect of a transaction on a specific account's balance.
function parseMeta(m: any): any {
  if (!m) return {};
  if (typeof m === 'string') { try { return JSON.parse(m); } catch { return {}; } }
  return m;
}

function txEffect(t: any, accountId: string): number {
  const amt = parseFloat(t.amount);
  if (t.to_account_id === accountId) return amt;            // money in
  if (t.from_account_id === accountId) {
    const meta = parseMeta(t.metadata);
    if (t.tx_type === 'ach' && meta?.direction === 'credit') return amt; // inbound ACH
    return -amt;                                            // money out
  }
  return 0;
}

// Who the money went to / came from, per transaction type.
function counterparty(t: any, outgoing: boolean): { name: string | null; account: string | null } {
  const m = parseMeta(t.metadata);
  switch (t.tx_type) {
    case 'wire':       return { name: m?.recipient?.name ?? null,  account: m?.recipient?.accountNumber ?? null };
    case 'ach':        return { name: m?.accountHolderName ?? null, account: m?.externalAccountNumber ?? null };
    case 'deposit':    return { name: m?.senderName ?? null,        account: m?.externalAccountNumber ?? null };
    case 'withdrawal': return { name: m?.recipientName ?? null,     account: m?.externalAccountNumber ?? null };
    case 'zelle':
    case 'transfer':
      return outgoing
        ? { name: (t.to_owner || '').trim() || null,   account: t.to_account_number ?? null }
        : { name: (t.from_owner || '').trim() || null, account: t.from_account_number ?? null };
    case 'fee':        return { name: 'Oakstones 1 Bank', account: null };
    default:           return { name: null, account: null };
  }
}

// GET /transactions/history — full history with optional account/type/date filters.
// When a single account is selected, a running balance is computed for each row.
export async function getTransactionHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const accountId = (req.query.accountId as string) || '';
    const type = (req.query.type as string) || '';
    const days = parseInt((req.query.days as string) || '0', 10);

    const { rows: accts } = await getDb().query(
      `SELECT id, account_number, account_type, balance
       FROM accounts WHERE user_id=$1 ORDER BY opened_at ASC NULLS LAST`,
      [userId]
    );
    const accountList = accts.map((a: any) => ({
      id: a.id,
      label: `${a.account_type} ****${String(a.account_number).slice(-4)}`,
    }));

    if (accts.length === 0) { res.json({ accounts: [], transactions: [] }); return; }
    if (accountId && !accts.some((a: any) => a.id === accountId)) throw new AppError('Account not found', 404);

    const where = accountId
      ? '(t.from_account_id=$2 OR t.to_account_id=$2)'
      : `(t.from_account_id IN (SELECT id FROM accounts WHERE user_id=$1)
          OR t.to_account_id IN (SELECT id FROM accounts WHERE user_id=$1))`;
    const params: any[] = accountId ? [userId, accountId] : [userId];

    const { rows: txs } = await getDb().query(
      `SELECT t.id, t.reference_id, t.tx_type, t.status, t.amount, t.fee,
              t.description, t.created_at, t.metadata,
              t.from_account_id, t.to_account_id,
              fa.account_number AS from_account_number,
              ta.account_number AS to_account_number,
              TRIM(COALESCE(fu.first_name,'') || ' ' || COALESCE(fu.last_name,'')) AS from_owner,
              TRIM(COALESCE(tu.first_name,'') || ' ' || COALESCE(tu.last_name,'')) AS to_owner
       FROM transactions t
       LEFT JOIN accounts fa ON fa.id = t.from_account_id
       LEFT JOIN accounts ta ON ta.id = t.to_account_id
       LEFT JOIN users   fu ON fu.id::text = fa.user_id::text
       LEFT JOIN users   tu ON tu.id::text = ta.user_id::text
       WHERE ${where}
       ORDER BY t.created_at DESC`,
      params
    );

    // Direction + running balance (running balance only meaningful for a single account).
    if (accountId) {
      const acct = accts.find((a: any) => a.id === accountId);
      let running = parseFloat(acct.balance);
      for (const t of txs) { // newest -> oldest
        const eff = txEffect(t, accountId);
        t.outgoing = eff < 0;
        if (String(t.status) === 'completed') {
          t.balance_after = running;
          running = running - eff;
        } else {
          t.balance_after = null;
        }
      }
    } else {
      const myIds = new Set(accts.map((a: any) => a.id));
      for (const t of txs) {
        t.outgoing = txEffect(t, t.from_account_id && myIds.has(t.from_account_id) ? t.from_account_id : t.to_account_id) < 0;
        t.balance_after = null;
      }
    }

    let out = txs;
    for (const t of out) {
      const cp = counterparty(t, t.outgoing);
      t.counterparty_name = cp.name;
      t.counterparty_account = cp.account;
    }
    if (type) out = out.filter((t: any) => t.tx_type === type);
    if (days > 0) {
      const cutoff = Date.now() - days * 86400000;
      out = out.filter((t: any) => new Date(t.created_at).getTime() >= cutoff);
    }

    // Strip internal fields from the response.
    out = out.map(({ metadata, from_owner, to_owner, ...rest }: any) => rest);

    res.json({ accounts: accountList, transactions: out });
  } catch (e) {
    next(e);
  }
}

export async function getTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const { rows } = await getDb().query(
      `SELECT t.*,
              fa.account_number AS from_account_number,
              fa.account_type   AS from_account_type,
              ta.account_number AS to_account_number,
              ta.account_type   AS to_account_type
       FROM transactions t
       LEFT JOIN accounts fa ON fa.id = t.from_account_id
       LEFT JOIN accounts ta ON ta.id = t.to_account_id
       WHERE t.id=$1 AND (fa.user_id=$2 OR ta.user_id=$2)
       LIMIT 1`,
      [req.params.id, userId]
    );
    if (!rows.length) throw new AppError('Transaction not found', 404);
    res.json(rows[0]);
  } catch (e) { next(e); }
}
