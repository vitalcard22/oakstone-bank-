import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import * as c from '../controllers/loan.controller';

const r = Router();
r.use(authenticate);

r.post('/apply',
  body('loanType').isIn(['personal','auto','mortgage','business']),
  body('requestedAmount').isFloat({ min: 1000 }),
  body('termMonths').isInt({ min: 6, max: 360 }),
  validate, c.applyForLoan);

r.get('/',             c.listLoans);
r.get('/applications', c.listLoanApplications);

export default r;
