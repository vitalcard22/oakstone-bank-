import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import * as c from '../controllers/auth.controller';

const r = Router();

r.post('/register',
body('email').isEmail().normalizeEmail(),
body('password').isLength({ min: 8 }).matches(/[A-Z]/).matches(/[0-9]/),
body('firstName').trim().notEmpty(),
body('lastName').trim().notEmpty(),
// KYC fields are optional at the validator level (the form enforces them);
// this keeps the endpoint backward-compatible and lets the controller store what's present.
body('ssn').optional().matches(/^\d{3}-?\d{2}-?\d{4}$/).withMessage('Invalid SSN format'),
body('zip').optional().matches(/^\d{5}(-\d{4})?$/).withMessage('Invalid ZIP'),
body('dob').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid date of birth'),
validate, c.register);

r.post('/login',
body('email').isEmail().normalizeEmail(),
body('password').notEmpty(),
validate, c.login);

r.post('/login/verify-code', c.completeLoginCode);

r.post('/mfa/complete', c.completeMfa);
r.post('/refresh', c.refreshToken);
r.post('/logout', authenticate, c.logout);
r.get ('/me', authenticate, c.getMe);
r.patch('/me', authenticate, c.updateMe);
r.get('/login-history', authenticate, c.getLoginHistory);
r.post('/kyc', authenticate, c.submitKyc);
r.post('/mfa/setup', authenticate, c.setupMfa);
r.post('/mfa/verify', authenticate, c.verifyMfa);
r.post('/forgot-password', body('email').isEmail(), validate, c.forgotPassword);
r.post('/reset-password', c.resetPassword);
r.get('/verify-email', c.verifyEmail);
r.post('/verify-email', c.verifyEmail);

export default r;
