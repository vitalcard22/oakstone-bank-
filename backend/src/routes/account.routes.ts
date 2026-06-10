import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import * as c from '../controllers/account.controller';

const r = Router();
r.use(authenticate);

r.get ('/',             c.listAccounts);
r.post('/',             body('accountType').isIn(['checking','savings','money_market']), validate, c.openAccount);
r.get ('/:id',          c.getAccount);
r.get ('/:id/transactions', c.listTransactions);
r.post('/:id/freeze',   c.freezeAccount);
r.post('/:id/unfreeze', c.unfreezeAccount);

export default r;
