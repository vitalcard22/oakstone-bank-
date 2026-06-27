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

export default r;
