import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../config/db';
import { AppError } from '../utils/AppError';
import { auditLog } from '../utils/audit';
import { calcMonthlyPayment } from '../utils/helpers';
import { sendApplicationApproved, sendApplicationRejected } from '../services/email';

// GET /admin/dashboard
export async function getDashboard(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const db = getDb();
    const [users, txns, kyc, fraud] = await Promise.all([
      db.query('SELECT COUNT(*) FROM users WHERE role=\'customer\''),
      db.query('SELECT COUNT(*), SUM(amount) FROM transactions WHERE status=\'completed\''),
      db.query('SELECT COUNT(*) FROM kyc_applications WHERE status=\'pending\''),
      db.query('SELECT COUNT(*) FROM fraud_alerts WHERE is_resolved=FALSE'),
    ]);
    res.json({
      totalUsers: parseInt(users.rows[0].count),
      totalTransactions: parseInt(txns.rows[0].count),
      totalVolume: parseFloat(txns.rows[0].sum || '0'),
      pendingKyc: parseInt(kyc.rows[0].count),
      openFraudAlerts: parseInt(fraud.rows[0].count),
    });
  } catch (e) { next(e); }
}

// GET /admin/users
export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const search = req.query.search as string || '';
    const { rows } = await getDb().query(
      `SELECT id, email, first_name, last_name, role, is_active, kyc_status, created_at
       FROM users
       WHERE (email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1) AND role='customer'
       ORDER BY created_at DESC LIMIT 100`,
      [`%${search}%`]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// PATCH /admin/users/:id/status
export async function setUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { isActive } = req.body;
    await getDb().query('UPDATE users SET is_active=$1 WHERE id=$2', [isActive, req.params.id]);
    await auditLog({ actorId: (req as any).user.id, action: isActive ? 'admin.user.activate' : 'admin.user.suspend', entityId: req.params.id });
    res.json({ message: 'Status updated' });
  } catch (e) { next(e); }
}

// GET /admin/kyc/queue
export async function kycQueue(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await getDb().query(
      `SELECT k.*, u.email, u.first_name, u.last_name
       FROM kyc_applications k JOIN users u ON u.id::text=k.user_id::text
       WHERE k.status='pending'
       ORDER BY k.created_at ASC`
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /admin/kyc/:userId/approve
export async function approveKyc(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const db = getDb();
    const { rows: [app] } = await db.query(
      'SELECT k.*, u.email, u.first_name FROM kyc_applications k JOIN users u ON u.id::text=k.user_id::text WHERE k.user_id::text=$1::text ORDER BY k.created_at DESC LIMIT 1',
      [req.params.userId]
    );
    if (!app) throw new AppError('Application not found', 404);

    await db.query(
      'UPDATE kyc_applications SET status=\'approved\', reviewed_by=$1::text, reviewed_at=NOW() WHERE user_id::text=$2::text',
      [(req as any).user.id, req.params.userId]
    );
    await db.query('UPDATE users SET kyc_status=\'approved\' WHERE id::text=$1::text', [req.params.userId]);

    // Create default checking account if none exists
    const { rows: existing } = await db.query('SELECT id FROM accounts WHERE user_id::text=$1::text', [req.params.userId]);
    if (!existing.length) {
      const acctNum = `OB${Date.now().toString().slice(-10)}`;
      await db.query(
        `INSERT INTO accounts (id, user_id, account_number, account_type, balance, available_balance, status)
         VALUES (uuid_generate_v4(), $1, $2, 'checking', 0, 0, 'active')`,
        [req.params.userId, acctNum]
      );
    }

    await auditLog({ actorId: (req as any).user.id, action: 'admin.kyc.approve', entityId: req.params.userId });
    sendApplicationApproved(app.email, app.first_name).catch(() => {});
    res.json({ message: 'KYC approved' });
  } catch (e) { next(e); }
}

// POST /admin/kyc/:userId/reject
export async function rejectKyc(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { reason } = req.body;
    const db = getDb();
    const { rows: [app] } = await db.query(
      'SELECT k.*, u.email, u.first_name FROM kyc_applications k JOIN users u ON u.id::text=k.user_id::text WHERE k.user_id::text=$1::text ORDER BY k.created_at DESC LIMIT 1',
      [req.params.userId]
    );
    if (!app) throw new AppError('Application not found', 404);

    await db.query(
      'UPDATE kyc_applications SET status=\'rejected\', review_notes=$1, reviewed_by=$2::text, reviewed_at=NOW() WHERE user_id::text=$3::text',
      [reason, (req as any).user.id, req.params.userId]
    );
    await db.query('UPDATE users SET kyc_status=\'rejected\' WHERE id::text=$1::text', [req.params.userId]);

    await auditLog({ actorId: (req as any).user.id, action: 'admin.kyc.reject', entityId: req.params.userId });
    sendApplicationRejected(app.email, app.first_name, reason).catch(() => {});
    res.json({ message: 'KYC rejected' });
  } catch (e) { next(e); }
}

// GET /admin/card-fees
export async function getCardFees(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await getDb().query('SELECT * FROM card_fee_config ORDER BY card_type');
    res.json(rows);
  } catch (e) { next(e); }
}

// PATCH /admin/card-fees/:cardType
export async function updateCardFee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { applicationFee, feeEnabled } = req.body;
    await getDb().query(
      'UPDATE card_fee_config SET application_fee=$1, fee_enabled=$2, updated_by=$3, updated_at=NOW() WHERE card_type=$4',
      [applicationFee, feeEnabled, (req as any).user.id, req.params.cardType]
    );
    res.json({ message: 'Card fee updated' });
  } catch (e) { next(e); }
}

// GET /admin/card-applications
export async function listCardApplications(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await getDb().query(
      `SELECT ca.*, u.email, u.first_name, u.last_name
       FROM card_applications ca JOIN users u ON u.id=ca.user_id
       ORDER BY ca.created_at DESC LIMIT 100`
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /admin/card-applications/:id/approve
export async function approveCardApp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { creditLimit, apr } = req.body;
    const db = getDb();
    const { rows: [app] } = await db.query('SELECT * FROM card_applications WHERE id=$1', [req.params.id]);
    if (!app) throw new AppError('Application not found', 404);

    await db.query(
      'UPDATE card_applications SET status=\'approved\', credit_limit=$1, apr=$2, reviewed_by=$3, reviewed_at=NOW() WHERE id=$4',
      [creditLimit, apr, (req as any).user.id, req.params.id]
    );

    const last4 = Math.floor(1000 + Math.random() * 9000).toString();
    const expM = new Date().getMonth() + 1;
    const expY = new Date().getFullYear() + 3;
    await db.query(
      `INSERT INTO credit_cards (id, application_id, user_id, card_type, card_last4, expiry_month, expiry_year, credit_limit, apr)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8)`,
      [req.params.id, app.user_id, app.card_type, last4, expM, expY, creditLimit, apr]
    );

    await auditLog({ actorId: (req as any).user.id, action: 'admin.card.approve', entityId: req.params.id });
    res.json({ message: 'Card application approved' });
  } catch (e) { next(e); }
}

// POST /admin/card-applications/:id/reject
export async function rejectCardApp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { reason } = req.body;
    await getDb().query(
      'UPDATE card_applications SET status=\'rejected\', review_notes=$1, reviewed_by=$2, reviewed_at=NOW() WHERE id=$3',
      [reason, (req as any).user.id, req.params.id]
    );
    await auditLog({ actorId: (req as any).user.id, action: 'admin.card.reject', entityId: req.params.id });
    res.json({ message: 'Card application rejected' });
  } catch (e) { next(e); }
}

// GET /admin/loan-applications
export async function listLoanApplications(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await getDb().query(
      `SELECT la.*, u.email, u.first_name, u.last_name
       FROM loan_applications la JOIN users u ON u.id=la.user_id
       ORDER BY la.created_at DESC LIMIT 100`
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /admin/loan-applications/:id/approve
export async function approveLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { interestRate, termMonths } = req.body;
    const db = getDb();
    const { rows: [la] } = await db.query('SELECT * FROM loan_applications WHERE id=$1', [req.params.id]);
    if (!la) throw new AppError('Application not found', 404);

    const monthlyPayment = calcMonthlyPayment(la.requested_amount, interestRate, termMonths);
    const nextPayment = new Date();
    nextPayment.setMonth(nextPayment.getMonth() + 1);

    await db.query(
      'UPDATE loan_applications SET status=\'approved\', reviewed_by=$1, reviewed_at=NOW() WHERE id=$2',
      [(req as any).user.id, req.params.id]
    );
    await db.query(
      `INSERT INTO loans (id, application_id, user_id, loan_type, principal, interest_rate, term_months, monthly_payment, outstanding_balance, next_payment_date, disbursed_at)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $4, $8, NOW())`,
      [uuid(), req.params.id, la.user_id, la.loan_type, la.requested_amount, interestRate, termMonths, monthlyPayment.toFixed(2), nextPayment]
    );

    await auditLog({ actorId: (req as any).user.id, action: 'admin.loan.approve', entityId: req.params.id });
    res.json({ message: 'Loan approved' });
  } catch (e) { next(e); }
}

// POST /admin/loan-applications/:id/reject
export async function rejectLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { reason } = req.body;
    await getDb().query(
      'UPDATE loan_applications SET status=\'rejected\', review_notes=$1, reviewed_by=$2, reviewed_at=NOW() WHERE id=$3',
      [reason, (req as any).user.id, req.params.id]
    );
    await auditLog({ actorId: (req as any).user.id, action: 'admin.loan.reject', entityId: req.params.id });
    res.json({ message: 'Loan rejected' });
  } catch (e) { next(e); }
}

// GET /admin/transactions
export async function listAllTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await getDb().query(
      `SELECT t.*, u.email FROM transactions t
       LEFT JOIN accounts a ON a.id=t.from_account_id
       LEFT JOIN users u ON u.id=a.user_id
       ORDER BY t.created_at DESC LIMIT 200`
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /admin/transactions/:id/flag
export async function flagTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await getDb().query('UPDATE transactions SET flagged=TRUE WHERE id=$1', [req.params.id]);
    await auditLog({ actorId: (req as any).user.id, action: 'admin.transaction.flag', entityId: req.params.id });
    res.json({ message: 'Transaction flagged' });
  } catch (e) { next(e); }
}

// GET /admin/fraud-alerts
export async function listFraudAlerts(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await getDb().query(
      `SELECT fa.*, u.email FROM fraud_alerts fa JOIN users u ON u.id=fa.user_id
       ORDER BY fa.created_at DESC LIMIT 100`
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /admin/fraud-alerts/:id/resolve
export async function resolveFraudAlert(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await getDb().query(
      'UPDATE fraud_alerts SET is_resolved=TRUE, resolved_by=$1, resolved_at=NOW() WHERE id=$2',
      [(req as any).user.id, req.params.id]
    );
    res.json({ message: 'Alert resolved' });
  } catch (e) { next(e); }
}

// GET /admin/audit-log
export async function getAuditLog(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await getDb().query(
      `SELECT al.*, u.email FROM audit_log al LEFT JOIN users u ON u.id=al.actor_id
       ORDER BY al.created_at DESC LIMIT 200`
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// GET /admin/users/:id/accounts
export async function getUserAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await getDb().query(
      'SELECT * FROM accounts WHERE user_id::text=$1::text ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /admin/users/:id/accounts — create a default checking account for a user
export async function createUserAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const db = getDb();
    const userId = req.params.id;

    const { rows: existing } = await db.query('SELECT id FROM accounts WHERE user_id::text=$1::text', [userId]);
    if (existing.length > 0) {
      res.json({ message: 'Account already exists', account: existing[0] });
      return;
    }

    const acctNum = `OB${Date.now().toString().slice(-10)}`;
    const { rows: [account] } = await db.query(
      `INSERT INTO accounts (id, user_id, account_number, account_type, balance, available_balance, status)
       VALUES (uuid_generate_v4(), $1, $2, 'checking', 0, 0, 'active') RETURNING *`,
      [userId, acctNum]
    );

    await auditLog({ actorId: (req as any).user.id, action: 'admin.account.create', entityId: userId });
    res.json({ message: 'Account created successfully', account });
  } catch (e) { next(e); }
}

// GET /admin/users/:id/transactions
export async function getUserTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await getDb().query(
      `SELECT t.* FROM transactions t
       JOIN accounts a ON (a.id=t.from_account_id OR a.id=t.to_account_id)
       WHERE a.user_id::text=$1::text
       ORDER BY t.created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /admin/users/:id/credit
export async function creditAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { accountId, amount, description, date, senderName, bankName, routingNumber, externalAccountNumber, transactionType, reference, notes } = req.body;
    const adminId = (req as any).user.id;
    const txDate = date ? new Date(date) : new Date();

    const { rows: [account] } = await getDb().query('SELECT * FROM accounts WHERE id=$1', [accountId]);
    if (!account) throw new AppError('Account not found', 404);

    await getDb().query(
      'UPDATE accounts SET balance=balance+$1, available_balance=available_balance+$1 WHERE id=$2',
      [parseFloat(amount), accountId]
    );

    const refId = reference || `REF-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const metadata = JSON.stringify({
      admin: adminId,
      manual: true,
      senderName,
      bankName,
      routingNumber,
      externalAccountNumber,
      transactionType,
      notes,
    });

    await getDb().query(
      `INSERT INTO transactions (id,reference_id,to_account_id,tx_type,status,amount,description,metadata,processed_at,created_at,updated_at)
       VALUES (uuid_generate_v4(),$1,$2,'deposit','completed',$3,$4,$5,$6,$6,$6)`,
      [refId, accountId, parseFloat(amount), description || senderName && `Credit from ${senderName}` || 'Admin credit', metadata, txDate]
    );

    await auditLog({ actorId: adminId, action: 'admin.account.credit', entityId: accountId });
    res.json({ message: 'Account credited successfully', referenceId: refId });
  } catch (e) { next(e); }
}

// POST /admin/users/:id/debit
export async function debitAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { accountId, amount, description, date, recipientName, bankName, routingNumber, externalAccountNumber, transactionType, reference, notes } = req.body;
    const adminId = (req as any).user.id;
    const txDate = date ? new Date(date) : new Date();

    const { rows: [account] } = await getDb().query('SELECT * FROM accounts WHERE id=$1', [accountId]);
    if (!account) throw new AppError('Account not found', 404);
    if (parseFloat(account.balance) < parseFloat(amount)) throw new AppError('Insufficient balance', 400);

    await getDb().query(
      'UPDATE accounts SET balance=balance-$1, available_balance=available_balance-$1 WHERE id=$2',
      [parseFloat(amount), accountId]
    );

    const refId = reference || `REF-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const metadata = JSON.stringify({
      admin: adminId,
      manual: true,
      recipientName,
      bankName,
      routingNumber,
      externalAccountNumber,
      transactionType,
      notes,
    });

    await getDb().query(
      `INSERT INTO transactions (id,reference_id,from_account_id,tx_type,status,amount,description,metadata,processed_at,created_at,updated_at)
       VALUES (uuid_generate_v4(),$1,$2,'withdrawal','completed',$3,$4,$5,$6,$6,$6)`,
      [refId, accountId, parseFloat(amount), description || recipientName && `Debit to ${recipientName}` || 'Admin debit', metadata, txDate]
    );

    await auditLog({ actorId: adminId, action: 'admin.account.debit', entityId: accountId });
    res.json({ message: 'Account debited successfully', referenceId: refId });
  } catch (e) { next(e); }
}

// DELETE /admin/users/:id
export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const db = getDb();
    const userId = req.params.id;

    const { rows: [user] } = await db.query('SELECT role FROM users WHERE id=$1', [userId]);
    if (!user) throw new AppError('User not found', 404);
    if (user.role === 'admin') throw new AppError('Cannot delete admin accounts', 403);

    await db.query('DELETE FROM transactions WHERE from_account_id IN (SELECT id FROM accounts WHERE user_id::text=$1::text) OR to_account_id IN (SELECT id FROM accounts WHERE user_id::text=$1::text)', [userId]);
    await db.query('DELETE FROM accounts WHERE user_id=$1', [userId]);
    await db.query('DELETE FROM kyc_applications WHERE user_id=$1', [userId]);
    await db.query('DELETE FROM card_applications WHERE user_id=$1', [userId]);
    await db.query('DELETE FROM loan_applications WHERE user_id=$1', [userId]);
    await db.query('DELETE FROM notifications WHERE user_id=$1', [userId]);
    await db.query('DELETE FROM audit_log WHERE actor_id=$1', [userId]);
    await db.query('DELETE FROM sessions WHERE user_id=$1', [userId]);
    await db.query('DELETE FROM users WHERE id=$1', [userId]);

    await auditLog({ actorId: (req as any).user.id, action: 'admin.user.delete', entityId: userId });
    res.json({ message: 'User deleted successfully' });
  } catch (e) { next(e); }
}

// POST /admin/card-applications/:id/freeze — admin freezes the issued card tied to this application
export async function freezeCardAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const db = getDb();
    const { rowCount } = await db.query(
      `UPDATE credit_cards SET status='frozen', frozen_at=NOW(), frozen_by='admin'
       WHERE application_id=$1 AND status='active'`,
      [req.params.id]
    );
    if (!rowCount) throw new AppError('Card not found or already frozen', 404);
    await auditLog({ actorId: (req as any).user.id, action: 'admin.card.freeze', entityId: req.params.id });
    res.json({ message: 'Card frozen by admin' });
  } catch (e) { next(e); }
}

// POST /admin/card-applications/:id/unfreeze — admin unfreezes the issued card tied to this application
export async function unfreezeCardAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const db = getDb();
    const { rowCount } = await db.query(
      `UPDATE credit_cards SET status='active', frozen_at=NULL, frozen_by=NULL
       WHERE application_id=$1 AND status='frozen'`,
      [req.params.id]
    );
    if (!rowCount) throw new AppError('Card not found or not frozen', 404);
    await auditLog({ actorId: (req as any).user.id, action: 'admin.card.unfreeze', entityId: req.params.id });
    res.json({ message: 'Card unfrozen by admin' });
  } catch (e) { next(e); }
}

// DELETE /admin/card-applications/:id — delete a card application and any issued card,
// regardless of status (works even after approval).
export async function deleteCardApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const db = getDb();
    const { rows: [app] } = await db.query('SELECT id FROM card_applications WHERE id=$1', [req.params.id]);
    if (!app) throw new AppError('Application not found', 404);

    await db.query('DELETE FROM credit_cards WHERE application_id=$1', [req.params.id]);
    await db.query('DELETE FROM card_applications WHERE id=$1', [req.params.id]);

    await auditLog({ actorId: (req as any).user.id, action: 'admin.card.delete', entityId: req.params.id });
    res.json({ message: 'Card application and issued card deleted' });
  } catch (e) { next(e); }
}
