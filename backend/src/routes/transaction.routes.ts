import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import * as c from '../controllers/transaction.controller';

const r = Router();
r.use(authenticate);

// Fee schedule & limits for the send-money forms
r.get('/config', c.getTransferConfig);

// Confirm a Zelle recipient's name before sending
r.get('/zelle/lookup', c.zelleLookup);

r.post('/transfer',
  body('fromAccountId').isUUID(),
  body('toAccountNumber').notEmpty(),
  body('amount').isFloat({ min: 0.01 }),
  validate, c.internalTransfer);

r.post('/zelle',
  body('fromAccountId').isUUID(),
  body('identifier').notEmpty(),
  body('amount').isFloat({ min: 1, max: 2500 }),
  validate, c.zelleTransfer);

r.post('/ach',
  body('fromAccountId').isUUID(),
  body('routingNumber').isLength({ min: 9, max: 9 }),
  body('externalAccountNumber').notEmpty(),
  body('amount').isFloat({ min: 0.01 }),
  body('direction').isIn(['debit','credit']),
  validate, c.achTransfer);

r.post('/wire',
  body('fromAccountId').isUUID(),
  body('amount').isFloat({ min: 100 }),
  validate, c.wireTransfer);

r.post('/wire/confirm',
  body('challengeToken').notEmpty(),
  body('code').notEmpty(),
  validate, c.confirmWire);

r.get('/history', c.getTransactionHistory);
r.get('/:id', c.getTransaction);

export default r;
