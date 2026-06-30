import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { getDb } from '../config/db';
import { getRedis, keys } from '../config/redis';
import { AppError } from '../utils/AppError';
import { auditLog } from '../utils/audit';
import { sendApplicationConfirmation, sendPasswordReset, sendEmailVerification, sendApplicationApproved, sendApplicationRejected, sendLoginCode } from '../services/email';

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';
const REFRESH_TTL_SECS = 60 * 60 * 24 * 7;

function signAccess(userId: string, role: string, jti: string): string {
  return jwt.sign({ sub: userId, role, jti }, process.env.JWT_SECRET!, { expiresIn: ACCESS_TTL });
}

function signRefresh(userId: string, jti: string): string {
  return jwt.sign({ sub: userId, jti }, process.env.JWT_REFRESH_SECRET!, { expiresIn: REFRESH_TTL });
}

function last4(v?: string): string | null {
  if (!v) return null;
  const digits = String(v).replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

// POST /auth/register
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const db = getDb();
    const { email, password, firstName, lastName, phone } = req.body;

    const { rowCount } = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (rowCount) throw new AppError('Email already registered', 409);

    const hash = await bcrypt.hash(password, 12);
    const userId = uuid();

    // Lightweight registration: just the login identity. KYC details are collected
    // later via submitKyc(). kyc_status starts at 'pending' = "identity not yet submitted".
    await db.query(
      `INSERT INTO users (id, email, phone, password_hash, first_name, last_name, kyc_status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
      [userId, email, phone ?? null, hash, firstName, lastName]
    );

    // Email verification token (24h)
    const verifyToken = uuid();
    await db.query(
      `UPDATE users SET email_verify_token=$1, email_verify_expires=NOW()+INTERVAL '24 hours' WHERE id=$2`,
      [verifyToken, userId]
    );
    const verifyUrl = `${process.env.FRONTEND_URL ?? ''}/verify-email?token=${verifyToken}`;

    await auditLog({ actorId: userId, action: 'auth.register', entityType: 'user', entityId: userId });
    sendEmailVerification(email, firstName, verifyUrl).catch((e) => console.error('[Email] verification failed:', e?.message));
    res.status(201).json({ message: 'Account created. Please check your email to verify your address, then sign in to complete your identity verification.' });
  } catch (e) {
    next(e);
  }
}

// POST /auth/kyc  (authenticated) — user submits identity details for review
export async function submitKyc(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const db = getDb();
    const userId = (req as any).user.id;
    const {
      middleName, dob, ssn, citizenship,
      street, unit, city, state, zip,
      idType, idNumber, idState,
      accountType, employment, sourceOfFunds, selfie,
    } = req.body;

    const { rows: [u] } = await db.query(
      'SELECT email, first_name, last_name, kyc_status FROM users WHERE id::text=$1::text',
      [userId]
    );
    if (!u) throw new AppError('User not found', 404);
    if (u.kyc_status === 'approved') throw new AppError('Your identity is already verified.', 400);
    if (u.kyc_status === 'under_review') throw new AppError('Your identity verification is already under review.', 400);

    // Save KYC details onto the user record + mark as under review
    await db.query(
      `UPDATE users SET
         middle_name=$1, date_of_birth=$2, ssn_last4=$3, citizenship=$4,
         address_street=$5, address_unit=$6, address_city=$7, address_state=$8, address_zip=$9,
         id_type=$10, id_last4=$11, id_state=$12, employment_status=$13, source_of_funds=$14, account_type_requested=$15,
         kyc_status='under_review', updated_at=NOW()
       WHERE id::text=$16::text`,
      [
        middleName ?? null, dob || null, last4(ssn), citizenship ?? null,
        street ?? null, unit ?? null, city ?? null, state ?? null, zip ?? null,
        idType ?? null, last4(idNumber), idState ?? null, employment ?? null, sourceOfFunds ?? null, accountType ?? null,
        userId,
      ]
    );

    // Create or refresh the KYC application row for the admin queue
    const { rows: existingApp } = await db.query(
      'SELECT id FROM kyc_applications WHERE user_id::text=$1::text ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    if (existingApp.length) {
      await db.query(
        `UPDATE kyc_applications SET status='pending', first_name=$1, last_name=$2, nationality=$3, id_type=$4, id_number=$5,
           address_line1=$6, address_line2=$7, city=$8, state=$9, country=$10, employment_status=$11, source_of_funds=$12,
           selfie_data=$13, submitted_at=NOW(), updated_at=NOW() WHERE id=$14`,
        [u.first_name, u.last_name, citizenship ?? null, idType ?? null, last4(idNumber),
         street ?? null, unit ?? null, city ?? null, state ?? null, citizenship ?? 'US',
         employment ?? null, sourceOfFunds ?? null, selfie ?? null, existingApp[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO kyc_applications (user_id, status, first_name, last_name, nationality, id_type, id_number,
           address_line1, address_line2, city, state, country, employment_status, source_of_funds, selfie_data, submitted_at, created_at, updated_at)
         VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW(), NOW())`,
        [userId, u.first_name, u.last_name, citizenship ?? null, idType ?? null, last4(idNumber),
         street ?? null, unit ?? null, city ?? null, state ?? null, citizenship ?? 'US',
         employment ?? null, sourceOfFunds ?? null, selfie ?? null]
      );
    }

    await auditLog({ actorId: userId, action: 'auth.kyc.submit', entityType: 'user', entityId: userId });
    sendApplicationConfirmation(u.email, u.first_name).catch(() => {});
    res.json({ message: 'Identity verification submitted. We will review it shortly.' });
  } catch (e) {
    next(e);
  }
}

// POST /auth/login
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const db = getDb();
    const redis = getRedis();
    const { email, password } = req.body;

    const { rows } = await db.query(
      `SELECT id, password_hash, role, mfa_enabled, mfa_secret,
       failed_login_attempts, locked_until, is_active
       FROM users WHERE email = $1`,
      [email]
    );

    if (!rows.length) throw new AppError('Invalid credentials', 401);
    const user = rows[0];

    if (!user.is_active) throw new AppError('Account suspended', 403);
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AppError('Account locked. Try again later.', 423);
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const attempts = user.failed_login_attempts + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null;
      await db.query(
        'UPDATE users SET failed_login_attempts=$1, locked_until=$2 WHERE id=$3',
        [attempts, lockUntil, user.id]
      );
      throw new AppError('Invalid credentials', 401);
    }

    await db.query(
      'UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE id=$1',
      [user.id]
    );

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 8);
    await redis.setEx(`logincode:${user.id}`, 600, JSON.stringify({ hash: codeHash, attempts: 0 }));

    const challengeToken = jwt.sign(
      { sub: user.id, role: user.role, type: 'login_code' },
      process.env.JWT_SECRET!,
      { expiresIn: '10m' }
    );

    sendLoginCode(email, code).catch((e) => console.error('[Email] login code failed:', e?.message));
    await auditLog({ actorId: user.id, action: 'auth.login.code_sent', ip: req.ip });
    res.json({ requiresCode: true, challengeToken });
  } catch (e) {
    next(e);
  }
}

// POST /auth/login/verify-code
// Record a successful login for the user's security history (non-blocking).
async function recordLogin(userId: string, req: Request): Promise<void> {
  try {
    await getDb().query(
      'INSERT INTO login_events (user_id, ip, user_agent) VALUES ($1,$2,$3)',
      [userId, req.ip ?? null, (req.headers['user-agent'] as string) ?? null]
    );
  } catch (e) { console.error('[login_events] failed:', e); }
}

export async function completeLoginCode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const db = getDb();
    const redis = getRedis();
    const { challengeToken, code } = req.body;
    if (!challengeToken || !code) throw new AppError('Missing code', 400);

    let payload: any;
    try { payload = jwt.verify(challengeToken, process.env.JWT_SECRET!); }
    catch { throw new AppError('Your code request expired. Please sign in again.', 400); }
    if (payload.type !== 'login_code') throw new AppError('Invalid request', 400);

    const raw = await redis.get(`logincode:${payload.sub}`);
    if (!raw) throw new AppError('Your code expired. Please sign in again.', 400);
    const stored = JSON.parse(raw);

    if (stored.attempts >= 5) {
      await redis.del(`logincode:${payload.sub}`);
      throw new AppError('Too many incorrect attempts. Please sign in again.', 429);
    }

    const ok = await bcrypt.compare(String(code), stored.hash);
    if (!ok) {
      stored.attempts += 1;
      await redis.setEx(`logincode:${payload.sub}`, 600, JSON.stringify(stored));
      throw new AppError('Incorrect code. Please try again.', 401);
    }

    await redis.del(`logincode:${payload.sub}`);
    await db.query('UPDATE users SET last_login_at=NOW(), last_login_ip=$1 WHERE id=$2', [req.ip, payload.sub]);

    const jti = uuid();
    const accessToken = signAccess(payload.sub, payload.role, jti);
    const refreshToken = signRefresh(payload.sub, jti);
    const rtHash = await bcrypt.hash(refreshToken, 8);
    await redis.setEx(keys.session(payload.sub), REFRESH_TTL_SECS, JSON.stringify({ jti, hash: rtHash }));

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_TTL_SECS * 1000,
    });

    await auditLog({ actorId: payload.sub, action: 'auth.login', ip: req.ip });
    await recordLogin(payload.sub, req);
    res.json({ accessToken, user: { id: payload.sub, role: payload.role } });
  } catch (e) {
    next(e);
  }
}

// POST /auth/mfa/complete
export async function completeMfa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { challengeToken, token } = req.body;

    let payload: any;
    try {
      payload = jwt.verify(challengeToken, process.env.JWT_SECRET!);
    } catch {
      throw new AppError('Challenge expired', 400);
    }

    if (payload.type !== 'mfa_challenge') throw new AppError('Invalid challenge', 400);

    const { rows } = await getDb().query(
      'SELECT role, mfa_secret FROM users WHERE id=$1',
      [payload.sub]
    );
    if (!rows.length) throw new AppError('User not found', 404);

    const valid = speakeasy.totp.verify({
      secret: rows[0].mfa_secret,
      encoding: 'base32',
      token,
      window: 1,
    });
    if (!valid) throw new AppError('Invalid MFA code', 400);

    const jti = uuid();
    const accessToken = signAccess(payload.sub, rows[0].role, jti);
    const refreshToken = signRefresh(payload.sub, jti);

    const rtHash = await bcrypt.hash(refreshToken, 8);
    await getRedis().setEx(
      keys.session(payload.sub),
      REFRESH_TTL_SECS,
      JSON.stringify({ jti, hash: rtHash })
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_TTL_SECS * 1000,
    });

    await recordLogin(payload.sub, req);
    res.json({ accessToken, user: { id: payload.sub, role: rows[0].role } });
  } catch (e) {
    next(e);
  }
}

// POST /auth/refresh
export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rt = req.cookies?.refreshToken;
    if (!rt) throw new AppError('No refresh token', 401);

    let payload: any;
    try {
      payload = jwt.verify(rt, process.env.JWT_REFRESH_SECRET!);
    } catch {
      throw new AppError('Invalid refresh token', 401);
    }

    const session = await getRedis().get(keys.session(payload.sub));
    if (!session) throw new AppError('Session expired', 401);

    let valid = false;
    if (session) {
      const { hash } = JSON.parse(session);
      valid = await bcrypt.compare(rt, hash);
    } else {
      const { rows: dbSessions } = await getDb().query(
        `SELECT refresh_hash FROM sessions WHERE user_id=$1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 5`,
        [payload.sub]
      );
      for (const s of dbSessions) {
        if (await bcrypt.compare(rt, s.refresh_hash)) { valid = true; break; }
      }
    }
    if (!valid) throw new AppError('Session expired or invalid', 401);

    const jti = uuid();
    const { rows } = await getDb().query('SELECT role FROM users WHERE id=$1', [payload.sub]);
    const role = rows.length ? rows[0].role : 'customer';
    const accessToken = signAccess(payload.sub, role, jti);
    res.json({ accessToken, user: { id: payload.sub, role } });
  } catch (e) {
    next(e);
  }
}

// POST /auth/logout
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;
    const redis = getRedis();
    await redis.del(keys.session(user.id));
    await redis.setEx(keys.blacklist(user.jti), 900, '1');
    res.clearCookie('refreshToken');
    await auditLog({ actorId: user.id, action: 'auth.logout' });
    res.json({ message: 'Logged out' });
  } catch (e) {
    next(e);
  }
}

// GET /auth/me
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await getDb().query(
      `SELECT id, email, phone, first_name, last_name, role, kyc_status, mfa_enabled, email_verified, is_active, last_login_at, created_at
       FROM users WHERE id=$1`,
      [(req as any).user.id]
    );
    if (!rows.length) throw new AppError('Not found', 404);
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
}

// PATCH /auth/me
export async function updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { firstName, lastName, phone } = req.body;
    await getDb().query(
      'UPDATE users SET first_name=$1, last_name=$2, phone=$3 WHERE id=$4',
      [firstName, lastName, phone, (req as any).user.id]
    );
    res.json({ message: 'Profile updated' });
  } catch (e) {
    next(e);
  }
}

// POST /auth/mfa/setup
export async function setupMfa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const secret = speakeasy.generateSecret({ name: `OakstonesBank`, length: 20 });
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);
    await getRedis().setEx(`mfa_setup:${userId}`, 300, secret.base32);
    res.json({ secret: secret.base32, qrCode });
  } catch (e) {
    next(e);
  }
}

// POST /auth/mfa/verify
export async function verifyMfa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.id;
    const { token } = req.body;
    const secret = await getRedis().get(`mfa_setup:${userId}`);
    if (!secret) throw new AppError('MFA setup expired', 400);

    const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });
    if (!valid) throw new AppError('Invalid code', 400);

    await getDb().query('UPDATE users SET mfa_enabled=TRUE, mfa_secret=$1 WHERE id=$2', [secret, userId]);
    await getRedis().del(`mfa_setup:${userId}`);
    res.json({ message: 'MFA enabled' });
  } catch (e) {
    next(e);
  }
}

// POST /auth/forgot-password
export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body;
    const { rows } = await getDb().query('SELECT id FROM users WHERE email=$1', [email]);
    if (rows.length) {
      const token = uuid();
      await getRedis().setEx(`reset:${token}`, 3600, rows[0].id);
      const resetUrl = `${process.env.FRONTEND_URL ?? ''}/reset-password?token=${token}`;
      sendPasswordReset(email, resetUrl).catch((e) => console.error('[Email] reset failed:', e?.message));
    }
    res.json({ message: 'If that email exists, a reset link was sent.' });
  } catch (e) {
    next(e);
  }
}

// POST /auth/reset-password
export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, newPassword } = req.body;
    const userId = await getRedis().get(`reset:${token}`);
    if (!userId) throw new AppError('Reset link expired or invalid', 400);

    const hash = await bcrypt.hash(newPassword, 12);
    await getDb().query(
      'UPDATE users SET password_hash=$1, failed_login_attempts=0, locked_until=NULL WHERE id=$2',
      [hash, userId]
    );
    await getRedis().del(`reset:${token}`);
    res.json({ message: 'Password reset successful' });
  } catch (e) {
    next(e);
  }
}

// GET/POST /auth/verify-email?token=...
export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = (req.query.token as string) || req.body?.token;
    if (!token) throw new AppError('Missing verification token', 400);
    const { rows } = await getDb().query(
      `SELECT id, email_verify_expires FROM users WHERE email_verify_token=$1`,
      [token]
    );
    if (!rows.length) throw new AppError('Invalid or expired verification link', 400);
    if (rows[0].email_verify_expires && new Date(rows[0].email_verify_expires) < new Date()) {
      throw new AppError('Verification link has expired', 400);
    }
    await getDb().query(
      `UPDATE users SET email_verified=TRUE, email_verify_token=NULL, email_verify_expires=NULL WHERE id=$1`,
      [rows[0].id]
    );
    res.json({ message: 'Email verified successfully' });
  } catch (e) {
    next(e);
  }
}

export async function getLoginHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await getDb().query(
      'SELECT id, ip, user_agent, created_at FROM login_events WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20',
      [(req as any).user.id]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
}
