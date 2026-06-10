import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../config/db';
import { AppError } from '../utils/AppError';
import { auditLog } from '../utils/audit';
import { calcMonthlyPayment } from '../utils/helpers';

// GET /admin/dashboard
export async function getDashboard(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const db = getDb();
    const [users, accounts, txVolume, fraudOpen, kycPending, cardApps, loanApps] = await Promise.all([
      db.query('SELECT COUNT(*) AS total FROM users WHERE role=\'customer\''),
      db.query('SELECT COUNT(*) AS total FROM accounts WHERE status=\'active\''),
      db.query('SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE created_at > NOW()-INTERVAL \'24 hours\' AND status=\'completed\''),
      db.query('SELECT COUNT(*) AS total FROM fraud_alerts WHERE is_resolved=FALSE'),
      db.query('SELECT COUNT(*) AS total FROM users WHERE kyc_status=\'pending\''),
      db.query('SELECT COUNT(*) AS total FROM card_applications WHERE status=\'fee_paid\''),
      db.query('SELECT COUNT(*) AS total FROM loan_applications WHERE status=\'submitted\''),
    ]);

    res.json({
      totalUsers:       parseInt(users.rows[0].total),
      activeAccounts:   parseInt(accounts.rows[0].total),
      todayVolume:      parseFloat(txVolume.rows[0].total).toFixed(2),
      openFraudAlerts:  parseInt(fraudOpen.rows[0].total),
      kycPending:       parseInt(kycPending.rows[0].total),
      pendingCardApps:  parseInt(cardApps.rows[0].total),
      pendingLoanApps:  parseInt(loanApps.rows[0].total),
    });
  } catch (e) { next(e); }
}

// GET /admin/users
export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const search = req.query.search as string ?? '';
    const { rows } = await getDb().query(
      `SELECT id, email, first_name, last_name, phone, role, kyc_status, is_active, created_at
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
      `SELECT id, email, first_name, last_name, kyc_status, created_at
       FROM users WHERE kyc_status='pending' ORDER BY created_at ASC LIMIT 50`
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /admin/kyc/:userId/approve
export async function approveKyc(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await getDb().query(
      `UPDATE users SET kyc_status='approved', kyc_reviewed_at=NOW(), kyc_reviewed_by=$1 WHERE id=$2`,
      [(req as any).user.id, req.params.userId]
    );
    await auditLog({ actorId: (req as any).user.id, action: 'admin.kyc.approve', entityId: req.params.userId });
    res.json({ message: 'KYC approved' });
  } catch (e) { next(e); }
}

// POST /admin/kyc/:userId/reject
export async function rejectKyc(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { reason } = req.body;
    await getDb().query(
      `UPDATE users SET kyc_status='rejected', kyc_reviewed_at=NOW(), kyc_reviewed_by=$1 WHERE id=$2`,
      [(req as any).user.id, req.params.userId]
    );
    await auditLog({ actorId: (req as any).user.id, action: 'admin.kyc.reject', entityId: req.params.userId, metadata: { reason } });
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
      `UPDATE card_fee_config SET application_fee=$1, fee_enabled=$2, updated_by=$3, updated_at=NOW()
       WHERE card_type=$4`,
      [applicationFee, feeEnabled, (req as any).user.id, req.params.cardType]
    );
    await auditLog({ actorId: (req as any).user.id, action: 'admin.card_fee.update', metadata: { cardType: req.params.cardType, applicationFee, feeEnabled } });
    res.json({ message: 'Fee updated' });
  } catch (e) { next(e); }
}

// GET /admin/card-applications
export async function listCardApplications(req: Request, res: Response, next: NextFunction): Promise<void> {
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
    const adminId = (req as any).user.id;

    const { rows: [app] } = await getDb().query(
      `UPDATE card_applications SET status='approved', credit_limit=$1, apr=$2,
       reviewed_by=$3, reviewed_at=NOW() WHERE id=$4 RETURNING user_id, card_type`,
      [creditLimit, apr, adminId, req.params.id]
    );
    if (!app) throw new AppError('Application not found', 404);

    // Issue the card
    const last4 = Math.floor(1000 + Math.random() * 9000).toString();
    const expM  = new Date().getMonth() + 1;
    const expY  = new Date().getFullYear() + 4;

    await getDb().query(
      `INSERT INTO credit_cards (id,application_id,user_id,card_type,card_last4,expiry_month,expiry_year,credit_limit,apr,annual_fee)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,(SELECT annual_fee FROM card_fee_config WHERE card_type=$4))`,
      [uuid(), req.params.id, app.user_id, app.card_type, last4, expM, expY, creditLimit, apr]
    );

    await auditLog({ actorId: adminId, action: 'admin.card.approve', entityId: req.params.id });
    res.json({ message: 'Card application approved and card issued' });
  } catch (e) { next(e); }
}

// POST /admin/card-applications/:id/reject
export async function rejectCardApp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { reason } = req.body;
    await getDb().query(
      `UPDATE card_applications SET status='rejected', review_notes=$1, reviewed_by=$2, reviewed_at=NOW() WHERE id=$3`,
      [reason, (req as any).user.id, req.params.id]
    );
    res.json({ message: 'Application rejected' });
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
    const adminId = (req as any).user.id;

    const { rows: [la] } = await getDb().query(
      `UPDATE loan_applications SET status='approved', reviewed_by=$1, reviewed_at=NOW()
       WHERE id=$2 RETURNING user_id, loan_type, requested_amount`,
      [adminId, req.params.id]
    );
    if (!la) throw new AppError('Application not found', 404);

    const monthlyPayment = calcMonthlyPayment(parseFloat(la.requested_amount), parseFloat(interestRate), parseInt(termMonths));

    await getDb().query(
      `INSERT INTO loans (id,application_id,user_id,loan_type,principal,interest_rate,term_months,monthly_payment,outstanding_balance,status,disbursed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$5,'active',NOW())`,
      [uuid(), req.params.id, la.user_id, la.loan_type, la.requested_amount, interestRate, termMonths, monthlyPayment.toFixed(2)]
    );

    await auditLog({ actorId: adminId, action: 'admin.loan.approve', entityId: req.params.id });
    res.json({ message: 'Loan approved and disbursed' });
  } catch (e) { next(e); }
}

// POST /admin/loan-applications/:id/reject
export async function rejectLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await getDb().query(
      `UPDATE loan_applications SET status='rejected', review_notes=$1, reviewed_by=$2, reviewed_at=NOW() WHERE id=$3`,
      [req.body.reason, (req as any).user.id, req.params.id]
    );
    res.json({ message: 'Loan rejected' });
  } catch (e) { next(e); }
}

// GET /admin/transactions
export async function listAllTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, flagged } = req.query;
    let query = `SELECT id, reference_id, tx_type, status, amount, fee, risk_score, flagged, created_at FROM transactions WHERE 1=1`;
    const params: any[] = [];
    if (status) { params.push(status); query += ` AND status=$${params.length}`; }
    if (flagged === 'true') query += ' AND flagged=TRUE';
    query += ' ORDER BY created_at DESC LIMIT 200';
    const { rows } = await getDb().query(query, params);
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /admin/transactions/:id/flag
export async function flagTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await getDb().query(
      'UPDATE transactions SET flagged=TRUE, flagged_reason=$1 WHERE id=$2',
      [req.body.reason ?? 'Manually flagged by admin', req.params.id]
    );
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
export async function getAuditLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await getDb().query(
      `SELECT al.*, u.email FROM audit_log al LEFT JOIN users u ON u.id=al.actor_id
       ORDER BY al.created_at DESC LIMIT 200`
    );
    res.json(rows);
  } catch (e) { next(e); }
}
