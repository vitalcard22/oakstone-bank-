import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getRedis, keys } from '../config/redis';
import { AppError } from '../utils/AppError';

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = header.slice(7);
    let payload: any;

    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
      throw new AppError('Invalid or expired token', 401);
    }

    const blacklisted = await getRedis().get(keys.blacklist(payload.jti));
    if (blacklisted) throw new AppError('Token revoked', 401);

    (req as any).user = { id: payload.sub, role: payload.role, jti: payload.jti };
    next();
  } catch (e) {
    next(e);
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const role = (req as any).user?.role;
  if (role !== 'admin' && role !== 'super_admin') {
    next(new AppError('Admin access required', 403));
    return;
  }
  next();
}
