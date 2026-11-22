/**
 * server/security.ts
 * Transport & request hardening: security headers, strict CORS, CSRF
 * double-submit tokens, rate limiting, origin checks and safe error handling.
 */

import crypto from 'crypto';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import {
  ALLOWED_ORIGINS,
  COOKIE_SECURE,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  RATE_LIMITS,
  SESSION_TTL_MS,
} from './config.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// ==================== HEADERS ====================

export function securityHeaders(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        // The UI loads the Cairo typeface from Google Fonts.
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'img-src': ["'self'", 'data:', 'blob:'],
        'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
        // Reverse geocoding used by the location picker.
        'connect-src': ["'self'", 'https://nominatim.openstreetmap.org'],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        // Map preview embeds (OpenStreetMap) and the Google Maps deep link.
        'frame-src': ["'self'", 'https://www.openstreetmap.org', 'https://www.google.com'],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    frameguard: { action: 'deny' },
    // HSTS only makes sense (and is only safe) once the API is served over TLS.
    hsts: COOKIE_SECURE ? { maxAge: 180 * 24 * 60 * 60, includeSubDomains: true, preload: false } : false,
  });
}

// ==================== CORS ====================

export function corsPolicy(): RequestHandler {
  return cors({
    origin(origin, callback) {
      // Same-origin / native clients send no Origin header.
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, '');
      if (ALLOWED_ORIGINS.includes(normalized)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', CSRF_HEADER_NAME, 'X-Requested-With'],
    maxAge: 600,
  });
}

/** Rejects state-changing requests that a browser says came from another site. */
export function originGuard(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();

  if (req.get('sec-fetch-site') === 'cross-site') {
    res.status(403).json({ error: 'طلب من مصدر غير موثوق' });
    return;
  }

  const origin = req.get('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin.replace(/\/$/, ''))) {
    res.status(403).json({ error: 'مصدر الطلب غير مسموح به' });
    return;
  }
  next();
}

// ==================== CLIENT IP ====================

export function clientIp(req: Request, _res: Response, next: NextFunction): void {
  req.clientIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  next();
}

export function isLoopbackRequest(req: Request): boolean {
  const ip = (req.clientIp ?? req.ip ?? '').replace('::ffff:', '');
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
}

// ==================== CSRF (double submit) ====================

function timingSafeEqualText(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function issueCsrfToken(res: Response): string {
  const token = crypto.randomBytes(32).toString('base64url');
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // the SPA must read it to echo it in the header
    secure: COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
  return token;
}

/** Every unsafe request must echo the CSRF cookie in the X-CSRF-Token header. */
export function verifyCsrf(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.get(CSRF_HEADER_NAME);

  if (typeof cookieToken !== 'string' || typeof headerToken !== 'string' || !cookieToken || !headerToken) {
    res.status(403).json({ error: 'رمز الحماية من CSRF مفقود — أعد تحميل الصفحة' });
    return;
  }
  if (!timingSafeEqualText(cookieToken, headerToken)) {
    res.status(403).json({ error: 'رمز الحماية من CSRF غير صالح — أعد تحميل الصفحة' });
    return;
  }
  next();
}

// ==================== RATE LIMITING ====================

function limiter(options: {
  windowMs: number;
  limit: number;
  message: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    keyGenerator: options.keyGenerator ?? ((req) => ipKeyGenerator(req.clientIp ?? 'unknown')),
    // The API may sit behind a proxy; never let a stray header throw.
    validate: { xForwardedForHeader: false, ip: false },
    handler: (_req, res) => {
      res.status(429).json({ error: options.message });
    },
  });
}

export const globalLimiter = limiter({
  ...RATE_LIMITS.global,
  message: 'عدد الطلبات كبير جداً — يرجى المحاولة بعد قليل',
});

export const loginLimiter = limiter({
  ...RATE_LIMITS.login,
  // Only failed attempts count, so normal logins are never blocked.
  skipSuccessfulRequests: true,
  message: 'محاولات دخول كثيرة — يرجى الانتظار 15 دقيقة قبل المحاولة مجدداً',
  keyGenerator: (req) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.toLowerCase().slice(0, 50) : '';
    return `${ipKeyGenerator(req.clientIp ?? 'unknown')}:${username}`;
  },
});

export const writeLimiter = limiter({
  ...RATE_LIMITS.write,
  message: 'عدد عمليات الحفظ كبير جداً — يرجى المحاولة بعد قليل',
});

export const dbAdminLimiter = limiter({
  ...RATE_LIMITS.dbAdmin,
  message: 'عدد محاولات إدارة قاعدة البيانات كبير جداً — يرجى المحاولة لاحقاً',
});

// ==================== CONTENT TYPE ====================

/** Refuses non-JSON bodies on body-carrying write endpoints. */
export function requireJsonContentType(req: Request, res: Response, next: NextFunction): void {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();
  const hasBody =
    (req.headers['transfer-encoding'] !== undefined) || Number(req.headers['content-length'] ?? 0) > 0;
  if (!hasBody) return next();
  if (req.is('application/json')) return next();
  res.status(415).json({ error: 'نوع المحتوى يجب أن يكون application/json' });
}

// ==================== ERRORS ====================

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'المسار المطلوب غير موجود' });
}

const PG_ERRORS: Record<string, { status: number; message: string }> = {
  '23505': { status: 409, message: 'هذه البيانات موجودة مسبقاً' },
  '23503': { status: 400, message: 'مرجع غير موجود (مخالف أو مستخدم غير مسجّل)' },
  '23514': { status: 400, message: 'قيمة غير مسموح بها' },
  '22P02': { status: 400, message: 'صيغة بيانات غير صالحة' },
  '57014': { status: 504, message: 'استغرق الطلب وقتاً أطول من المسموح' },
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return;

  const anyErr = err as { type?: string; status?: number; code?: string; message?: string };

  if (anyErr?.type === 'entity.too.large') {
    res.status(413).json({ error: 'حجم الطلب كبير جداً (الحد الأقصى للصور والبيانات)' });
    return;
  }
  if (anyErr?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'صيغة JSON غير صالحة' });
    return;
  }
  if (anyErr?.type === 'encoding.unsupported' || anyErr?.type === 'charset.unsupported') {
    res.status(415).json({ error: 'ترميز المحتوى غير مدعوم' });
    return;
  }
  if (anyErr?.code && PG_ERRORS[anyErr.code]) {
    const mapped = PG_ERRORS[anyErr.code];
    res.status(mapped.status).json({ error: mapped.message });
    return;
  }

  // Detailed errors go to the server log only, never to the client.
  console.error('❌ خطأ غير معالج:', {
    method: req.method,
    path: req.originalUrl,
    user: req.user?.username ?? null,
    message: anyErr?.message,
  });
  res.status(500).json({ error: 'حدث خطأ غير متوقع في الخادم' });
};
