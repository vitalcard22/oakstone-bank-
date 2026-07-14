import { Router } from 'express';
import { getRates } from '../controllers/rates.controller';

const r = Router();

// Public: exchange rates vs USD (cached daily). No auth needed — rates are not sensitive.
r.get('/', getRates);

export default r;
