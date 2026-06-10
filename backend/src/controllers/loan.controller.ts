import { Request, Response, NextFunction } from 'express';
import { getDb } from '../config/db';
import { AppError } from '../utils/AppError';
import { auditLog } from '../utils/audit';

// POST /loans/apply
export async function applyForLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const { loanType, requestedAmount, termMonths, purpose, annualIncome } = req.body;

    const { rows: [app] } = await getDb().query(
      `INSERT INTO loan_applications (user_id, loan_type, requested_amount, term_months, purpose, annual_income, status)
       VALUES ($1,$2,$3,$4,$5,$6,'submitted')
       RETURNING id, loan_type, requested_amount, term_months, status, created_at`,
      [userId, loanType, requestedAmount, termMonths, purpose ?? null, annualIncome ?? null]
    );

    await auditLog({ actorId: userId, action: 'loan.apply', entityId: app.id });
    res.status(201).json(app);
  } catch (e) { next(e); }
}

// GET /loans
export async function listLoans(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId  = (req as any).user.id;
    const { rows } = await getDb().query(
      `SELECT id, loan_type, principal, interest_rate, term_months,
              monthly_payment, outstanding_balance, status, next_payment_date, disbursed_at
       FROM loans WHERE user_id=$1 ORDER BY disbursed_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

// GET /loans/applications
export async function listLoanApplications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId  = (req as any).user.id;
    const { rows } = await getDb().query(
      `SELECT id, loan_type, requested_amount, term_months, status, review_notes, created_at
       FROM loan_applications WHERE user_id=$1 ORDER BY created_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (e) { next(e); }
}
