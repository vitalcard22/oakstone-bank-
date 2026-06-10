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
  validate, c.register);

r.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate, c.login);

r.post('/mfa/complete',    c.completeMfa);
r.post('/refresh',         c.refreshToken);
r.post('/logout',          authenticate, c.logout);
r.get ('/me',              authenticate, c.getMe);
r.patch('/me',             authenticate, c.updateMe);
r.post('/mfa/setup',       authenticate, c.setupMfa);
r.post('/mfa/verify',      authenticate, c.verifyMfa);
r.post('/forgot-password', body('email').isEmail(), validate, c.forgotPassword);
r.post('/reset-password',  c.resetPassword);

export default r;
