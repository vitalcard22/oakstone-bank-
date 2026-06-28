import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import { authenticate, requireAdmin } from '../middleware/auth';
import * as c from '../controllers/wealth.controller';

const r = Router();
r.use(authenticate);

// ── user ──
r.get('/fixed-deposits', c.listFixedDeposits);
r.post('/fixed-deposits',
  body('accountId').notEmpty(),
  body('principal').isFloat({ min: 0.01 }),
  body('termMonths').isInt({ min: 1 }),
  validate, c.applyFixedDeposit);

// ── admin ──
r.get('/admin/fixed-deposits', requireAdmin, c.adminListFixedDeposits);
r.post('/admin/fixed-deposits/:id/approve', requireAdmin, c.adminApproveFixedDeposit);
r.post('/admin/fixed-deposits/:id/payout', requireAdmin, c.adminPayoutFixedDeposit);
r.post('/admin/fixed-deposits/:id/reject', requireAdmin,
  body('reason').notEmpty(), validate, c.adminRejectFixedDeposit);

// ── savings goals (user) ──
r.get('/savings-goals', c.listSavingsGoals);
r.post('/savings-goals',
  body('name').notEmpty(),
  body('targetAmount').isFloat({ min: 0.01 }),
  body('accountId').notEmpty(),
  validate, c.createSavingsGoal);
r.post('/savings-goals/:id/contribute', body('amount').isFloat({ min: 0.01 }), validate, c.contributeSavingsGoal);
r.post('/savings-goals/:id/withdraw', body('amount').isFloat({ min: 0.01 }), validate, c.withdrawSavingsGoal);
r.delete('/savings-goals/:id', c.deleteSavingsGoal);

// ── ISA (user) ──
r.get('/isa', c.getIsa);
r.post('/isa/enroll', body('accountId').notEmpty(), validate, c.enrollIsa);
r.get('/admin/isa', requireAdmin, c.adminListIsa);
r.post('/admin/isa/:id/approve', requireAdmin, c.adminApproveIsa);
r.post('/admin/isa/:id/reject', requireAdmin, body('reason').notEmpty(), validate, c.adminRejectIsa);
r.post('/isa/contribute', body('accountId').notEmpty(), body('amount').isFloat({ min: 0.01 }), validate, c.contributeIsa);
r.post('/isa/withdraw', body('amount').isFloat({ min: 0.01 }), validate, c.withdrawIsa);

// ── 401(k) retirement ──
r.get('/retirement', c.getRetirement);
r.post('/retirement/enroll', body('accountId').notEmpty(), validate, c.enrollRetirement);
r.post('/retirement/contribute', body('amount').isFloat({ min: 0.01 }), validate, c.contributeRetirement);
r.post('/retirement/withdraw', body('amount').isFloat({ min: 0.01 }), validate, c.withdrawRetirement);
r.get('/admin/retirement', requireAdmin, c.adminListRetirement);
r.post('/admin/retirement/:id/approve', requireAdmin, c.adminApproveRetirement);
r.post('/admin/retirement/:id/reject', requireAdmin, body('reason').notEmpty(), validate, c.adminRejectRetirement);

// ── investment ──
r.get('/hub', c.getWealthHub);
r.get('/investment', c.getInvestment);
r.post('/investment/enroll', body('accountId').notEmpty(), validate, c.enrollInvestment);
r.post('/investment/buy', body('symbol').notEmpty(), body('shares').isFloat({ min: 0.000001 }), validate, c.buyInvestment);
r.post('/investment/sell', body('symbol').notEmpty(), body('shares').isFloat({ min: 0.000001 }), validate, c.sellInvestment);
r.get('/admin/investment', requireAdmin, c.adminListInvestment);
r.post('/admin/investment/:id/approve', requireAdmin, c.adminApproveInvestment);
r.post('/admin/investment/:id/reject', requireAdmin, body('reason').notEmpty(), validate, c.adminRejectInvestment);

export default r;
