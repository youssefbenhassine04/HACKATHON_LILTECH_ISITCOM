/**
 * server/config.ts
 * Central security & runtime configuration. Everything security-sensitive is
 * read from the environment here so it can be reviewed in one place.
 */

import dotenv from 'dotenv';

dotenv.config();

const DEV = 'development';

function str(value: string | undefined, fallback: string): string {
  const v = value?.trim();
  return v ? v : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function num(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const NODE_ENV = str(process.env.NODE_ENV, DEV);
export const isProduction = NODE_ENV === 'production';
export const isTest = NODE_ENV === 'test';

export const PORT = num(process.env.PORT, 3001);

/** Only trust X-Forwarded-* when the API actually runs behind a proxy. */
export const TRUST_PROXY = bool(process.env.TRUST_PROXY, false);

/** HTTPS: enable with cert/key files (see `npm run cert:dev`). */
export const HTTPS_ENABLED = bool(process.env.HTTPS_ENABLED, false);
export const HTTPS_KEY_PATH = str(process.env.HTTPS_KEY_PATH, '.certs/dev-key.pem');
export const HTTPS_CERT_PATH = str(process.env.HTTPS_CERT_PATH, '.certs/dev-cert.pem');
/** Optional plain-HTTP listener that redirects every request to HTTPS. */
export const HTTP_REDIRECT_PORT = num(process.env.HTTP_REDIRECT_PORT, 0);

export const COOKIE_SECURE = HTTPS_ENABLED || isProduction;

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'https://localhost:5173',
  'https://127.0.0.1:5173',
  'https://localhost:3001',
  'https://127.0.0.1:3001',
];

/** Browser origins allowed to call the API with credentials. */
export const ALLOWED_ORIGINS = str(process.env.ALLOWED_ORIGINS, isProduction ? '' : DEV_ORIGINS.join(','))
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

export const SESSION_TTL_HOURS = num(process.env.SESSION_TTL_HOURS, 8);
export const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;

/** `__Host-` prefix is only valid over HTTPS, so dev uses a plain name. */
export const SESSION_COOKIE_NAME = COOKIE_SECURE ? '__Host-pm_session' : 'pm_session';
export const CSRF_COOKIE_NAME = COOKIE_SECURE ? '__Host-pm_csrf' : 'pm_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

export const BCRYPT_ROUNDS = Math.min(14, Math.max(10, num(process.env.BCRYPT_ROUNDS, 12)));

/** Dedicated non-superuser role the API uses for all data queries. */
export const DB_APP_ROLE = str(process.env.DB_APP_ROLE, 'police_app');

/** Runtime database reconfiguration is a sensitive operation. */
export const ALLOW_DB_RECONNECT = bool(process.env.ALLOW_DB_RECONNECT, !isProduction);
/** Demo data reset is destructive; disabled in production unless opted in. */
export const ALLOW_DEMO_RESET = bool(process.env.ALLOW_DEMO_RESET, !isProduction);

export const BODY_LIMIT = str(process.env.BODY_LIMIT, '12mb');

export const RATE_LIMITS = {
  global: { windowMs: 15 * 60 * 1000, limit: num(process.env.RATE_LIMIT_GLOBAL, 600) },
  login: { windowMs: 15 * 60 * 1000, limit: num(process.env.RATE_LIMIT_LOGIN, 8) },
  write: { windowMs: 15 * 60 * 1000, limit: num(process.env.RATE_LIMIT_WRITE, 150) },
  dbAdmin: { windowMs: 60 * 60 * 1000, limit: num(process.env.RATE_LIMIT_DB_ADMIN, 10) },
};

/** Lock an account for this long after too many failed passwords. */
export const LOGIN_MAX_FAILURES = num(process.env.LOGIN_MAX_FAILURES, 5);
export const LOGIN_LOCKOUT_MS = num(process.env.LOGIN_LOCKOUT_MINUTES, 15) * 60 * 1000;

export const MAX_PHOTO_BYTES = num(process.env.MAX_PHOTO_BYTES, 2_000_000);
export const MAX_PHOTOS_PER_CATEGORY = num(process.env.MAX_PHOTOS_PER_CATEGORY, 10);
