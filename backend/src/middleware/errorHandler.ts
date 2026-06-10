import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  // PostgreSQL unique violation
  if (err.code === '23505') {
    res.status(409).json({ error: 'Already exists' });
    return;
  }
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
}
