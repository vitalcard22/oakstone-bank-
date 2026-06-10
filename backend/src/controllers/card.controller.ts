import { Request, Response, NextFunction } from 'express';
import { getDb } from '../config/db';
import { AppError } from '../utils/AppError';
import { auditLog } from '../utils/audit';

// GET /cards/fee-config
export async function getFeeConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await getDb().query(
      'SELECT card_type, application_fee, fee_enabled, annual_fee, apr_min, apr_max FROM card_fee_config'
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /cards/apply
export async function applyForCard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId    = (req as any).user.id;
    const { cardType } = req.body;

    const { rows: [cfg] } = await getDb().query(
      'SELECT application_fee, fee_enabled FROM card_fee_config WHERE card_type=$1',
      [cardType]
    );
    if (!cfg) throw new AppError('Card type not found', 404);

    const { rows: [app] } = await getDb().query(
      `INSERT INTO card_applications (user_id, card_type, application_fee, status)
       VALUES ($1,$2,$3,'pending_fee')
       RETURNING id, card_type, status, application_fee`,
      [userId, cardType, cfg.application_fee]
    );

    res.status(201).json({
      applicationId:  app.id,
      cardType:       app.card_type,
      status:         app.status,
      applicationFee: app.application_fee,
      feeEnabled:     cfg.fee_enabled,
    });
  } catch (e) { next(e); }
}

// POST /cards/:appId/pay-fee
export async function payApplicationFee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId     = (req as any).user.id;
    const { appId }  = req.params;
    const { paymentAccountId } = req.body;

    const { rows: [app] } = await getDb().query(
      'SELECT id, application_fee, status FROM card_applications WHERE id=$1 AND user_id=$2',
      [appId, userId]
    );
    if (!app) throw new AppError('Application not found', 404);
    if (app.status !== 'pending_fee') throw new AppError('Fee already paid', 400);

    // Deduct fee from account
    const { rowCount } = await getDb().query(
      `UPDATE accounts
       SET balance=balance-$1, available_balance=available_balance-$1
       WHERE id=$2 AND user_id=$3 AND status='active' AND available_balance >= $1`,
      [app.application_fee, paymentAccountId, userId]
    );
    if (!rowCount) throw new AppError('Insufficient funds or account not found', 400);

    await getDb().query(
      `UPDATE card_applications SET status='fee_paid', fee_paid_at=NOW() WHERE id=$1`,
      [appId]
    );

    await auditLog({ actorId: userId, action: 'card.fee_paid', entityId: appId });
    res.json({ message: 'Fee paid. Application is now under review.', status: 'fee_paid' });
  } catch (e) { next(e); }
}

// GET /cards/applications
export async function listApplications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId  = (req as any).user.id;
    const { rows } = await getDb().query(
      `SELECT id, card_type, status, application_fee, fee_paid_at, credit_limit, apr, created_at
       FROM card_applications WHERE user_id=$1 ORDER BY created_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// GET /cards
export async function listCards(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId  = (req as any).user.id;
    const { rows } = await getDb().query(
      `SELECT id, card_type, card_last4, expiry_month, expiry_year,
              status, credit_limit, balance, apr, annual_fee, issued_at
       FROM credit_cards WHERE user_id=$1 ORDER BY issued_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// POST /cards/:id/freeze
export async function freezeCard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const { rowCount } = await getDb().query(
      `UPDATE credit_cards SET status='frozen', frozen_at=NOW()
       WHERE id=$1 AND user_id=$2 AND status='active'`,
      [req.params.id, userId]
    );
    if (!rowCount) throw new AppError('Card not found or already frozen', 404);
    res.json({ message: 'Card frozen' });
  } catch (e) { next(e); }
}

// POST /cards/:id/unfreeze
export async function unfreezeCard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const { rowCount } = await getDb().query(
      `UPDATE credit_cards SET status='active', frozen_at=NULL
       WHERE id=$1 AND user_id=$2 AND status='frozen'`,
      [req.params.id, userId]
    );
    if (!rowCount) throw new AppError('Card not found or not frozen', 404);
    res.json({ message: 'Card unfrozen' });
  } catch (e) { next(e); }
}
