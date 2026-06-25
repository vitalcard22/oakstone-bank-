import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import * as c from '../controllers/card.controller';

const r = Router();
r.use(authenticate);

r.get ('/fee-config',     c.getFeeConfig);
r.get ('/applications',   c.listApplications);
r.post('/apply',          body('cardType').isIn(['classic','gold','platinum']), validate, c.applyForCard);
r.get ('/',                c.listCards);
r.post('/:id/freeze',     c.freezeCard);
r.post('/:id/unfreeze',   c.unfreezeCard);

export default r;
