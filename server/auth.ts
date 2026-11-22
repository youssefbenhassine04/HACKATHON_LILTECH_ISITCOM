/**
 * server/auth.ts
 * Server-side authentication: bcrypt password checks, opaque session tokens
 * stored (hashed) in PostgreSQL, httpOnly cookies and role guards.
 */

import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  SESSION_TTL_HOURS,
  COOKIE_SECURE,
  LOGIN_MAX_FAILURES,
  LOGIN_LOCKOUT_MS,
} from './config.js';
import { pool, isPostgresConnected } from './db.js';
import { isBcryptHash, verifyPassword } from './passwords.js';

/** Real bcrypt hash used only to equalize timing when a username does not exist. */
const DUMMY_HASH = '$2b$12$sla8nOatYvzObNz92wdoCOyOsdVzLYp/kZ15pi/OSFwfei4qXMeJy';

export type Role = 'agent' | 'chef' | 'admin';

export interface SessionUser {
  username: string;
  fullName: string;
  role: Role;
  badgeNumber: string | null;
}

export interface UserRecord extends SessionUser {
  passwordHash: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
      sessionToken?: string;
      clientIp?: string;
    }
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  agent: 'عون',
  chef: 'رئيس فرقة',
  admin: 'رئيس مركز',
};

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function sessionCookieOptions(maxAge: number = SESSION_TTL_MS) {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, { ...sessionCookieOptions(0), maxAge: undefined });
}

/** Creates a session row and returns the raw token (only ever sent to the client). */
export async function createSession(username: string, req: Request): Promise<string> {
  if (!isPostgresConnected || !pool) throw new Error('قاعدة البيانات غير متصلة');
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query(
    `INSERT INTO sessions (token_hash, username, expires_at, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [hashToken(token), username, expiresAt, req.clientIp ?? null, (req.get('user-agent') ?? '').slice(0, 400)]
  );
  return token;
}

export async function findSessionUser(token: string): Promise<(SessionUser & { expiresAt: string }) | null> {
  if (!isPostgresConnected || !pool) return null;
  const result = await pool.query(
    `SELECT u.username, u.full_name AS "fullName", u.role, u.badge_number AS "badgeNumber", s.expires_at AS "expiresAt"
     FROM sessions s
     JOIN users u ON u.username = s.username
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [hashToken(token)]
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  return {
    username: row.username,
    fullName: row.fullName,
    role: row.role as Role,
    badgeNumber: row.badgeNumber ?? null,
    expiresAt: row.expiresAt,
  };
}

export async function deleteSession(token: string): Promise<void> {
  if (!isPostgresConnected || !pool) return;
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

export async function deleteSessionsForUser(username: string): Promise<void> {
  if (!isPostgresConnected || !pool) return;
  await pool.query('DELETE FROM sessions WHERE username = $1', [username]);
}

export async function cleanupExpiredSessions(): Promise<void> {
  if (!isPostgresConnected || !pool) return;
  await pool.query('DELETE FROM sessions WHERE expires_at < NOW()').catch(() => {});
}

/**
 * Looks up a user by username and verifies the password. Returns null for both
 * "no such user" and "wrong password" so callers cannot enumerate accounts.
 */
export async function verifyUserCredentials(username: string, password: string): Promise<UserRecord | null> {
  if (!isPostgresConnected || !pool) throw new Error('قاعدة البيانات غير متصلة');
  const result = await pool.query(
    `SELECT username, full_name AS "fullName", role, badge_number AS "badgeNumber", password_hash AS "passwordHash"
     FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
    [username]
  );
  if (result.rowCount === 0) {
    // Compare against a dummy hash so response timing does not reveal existence.
    await verifyPassword(password, DUMMY_HASH);
    return null;
  }
  const row = result.rows[0];
  if (!isBcryptHash(row.passwordHash)) return null;
  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok) return null;
  return {
    username: row.username,
    fullName: row.fullName,
    role: row.role as Role,
    badgeNumber: row.badgeNumber ?? null,
    passwordHash: row.passwordHash,
  };
}

export function toSessionUser(user: UserRecord): SessionUser {
  return {
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    badgeNumber: user.badgeNumber,
  };
}

// ==================== LOCKOUT ====================

interface FailureState {
  count: number;
  lockedUntil: number;
}

const failures = new Map<string, FailureState>();

function sweepFailures(): void {
  const now = Date.now();
  for (const [key, state] of failures) {
    if (state.lockedUntil > 0 && state.lockedUntil <= now) failures.delete(key);
  }
}

export function isAccountLocked(username: string): boolean {
  const state = failures.get(username.toLowerCase());
  if (!state) return false;
  if (state.lockedUntil > Date.now()) return true;
  if (state.lockedUntil > 0) failures.delete(username.toLowerCase());
  return false;
}

export function registerLoginFailure(username: string): void {
  sweepFailures();
  const key = username.toLowerCase();
  const state = failures.get(key) ?? { count: 0, lockedUntil: 0 };
  state.count += 1;
  if (state.count >= LOGIN_MAX_FAILURES) {
    state.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
    state.count = 0;
  }
  failures.set(key, state);
}

export function resetLoginFailures(username: string): void {
  failures.delete(username.toLowerCase());
}

// ==================== MIDDLEWARE ====================

/** Attaches the session user when a valid cookie is present. Never rejects. */
export async function attachSession(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof token === 'string' && token.length > 20) {
    try {
      const session = await findSessionUser(token);
      if (session) {
        req.user = {
          username: session.username,
          fullName: session.fullName,
          role: session.role,
          badgeNumber: session.badgeNumber,
        };
        req.sessionToken = token;
      }
    } catch {
      // Treat lookup failures as "not authenticated".
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'يجب تسجيل الدخول للوصول إلى هذه البيانات' });
    return;
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'يجب تسجيل الدخول للوصول إلى هذه البيانات' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'لا تملك الصلاحية الكافية لتنفيذ هذا الإجراء' });
      return;
    }
    next();
  };
}

export function canEditViolation(user: SessionUser, owner: string, reviewStatus: string): boolean {
  if (user.role === 'admin' || user.role === 'chef') return true;
  return user.role === 'agent' && owner === user.username && reviewStatus === 'under_review';
}

export { SESSION_TTL_HOURS };
