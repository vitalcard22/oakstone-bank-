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
// Application goes straight to 'pending' for admin review. No payment step —
// the application fee (if any) is shown for transparency only and is waived
// manually by admin on approval, since new users start with $0 balance.
export async function applyForCard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId    = (req as any).user.id;
    const { cardType } = req.body;

    const { rows: [cfg] } = await getDb().query(
      'SELECT application_fee, fee_enabled FROM card_fee_config WHERE card_type=$1',
      [cardType]
    );
    if (!cfg) throw new AppError('Card type not found', 404);

    const { rows: [existing] } = await getDb().query(
      `SELECT id FROM card_applications WHERE user_id=$1 AND status IN ('pending','approved') LIMIT 1`,
      [userId]
    );
    if (existing) throw new AppError('You already have a pending or approved card application', 409);

    const { rows: [app] } = await getDb().query(
      `INSERT INTO card_applications (user_id, card_type, application_fee, status)
       VALUES ($1,$2,$3,'pending')
       RETURNING id, card_type, status, application_fee`,
      [userId, cardType, cfg.application_fee]
    );

    await auditLog({ actorId: userId, action: 'card.apply', entityId: app.id });

    res.status(201).json({
      applicationId:  app.id,
      cardType:       app.card_type,
      status:         app.status,
      applicationFee: app.application_fee,
      feeEnabled:     cfg.fee_enabled,
    });
  } catch (e) { next(e); }
}

// GET /cards/applications
export async function listApplications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId  = (req as any).user.id;
    const { rows } = await getDb().query(
      `SELECT id, card_type, status, application_fee, credit_limit, apr, created_at, review_notes
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

// POST /cards/:id/freeze — user freezes own card
export async function freezeCard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const { rowCount } = await getDb().query(
      `UPDATE credit_cards SET status='frozen', frozen_at=NOW()
       WHERE id=$1 AND user_id=$2 AND status='active'`,
      [req.params.id, userId]
    );
    if (!rowCount) throw new AppError('Card not found or already frozen', 404);
    await auditLog({ actorId: userId, action: 'card.freeze', entityId: req.params.id });
    res.json({ message: 'Card frozen' });
  } catch (e) { next(e); }
}

// POST /cards/:id/unfreeze — user unfreezes own card
export async function unfreezeCard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const { rowCount } = await getDb().query(
      `UPDATE credit_cards SET status='active', frozen_at=NULL
       WHERE id=$1 AND user_id=$2 AND status='frozen'`,
      [req.params.id, userId]
    );
    if (!rowCount) throw new AppError('Card not found or not frozen', 404);
    await auditLog({ actorId: userId, action: 'card.unfreeze', entityId: req.params.id });
    res.json({ message: 'Card unfrozen' });
  } catch (e) { next(e); }
}
