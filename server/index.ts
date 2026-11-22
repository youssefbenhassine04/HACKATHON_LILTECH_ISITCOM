import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import dotenv from 'dotenv';
import {
  initDatabase,
  isPostgresConnected,
  lastConnectionError,
  currentDbUrl,
  testPostgresConnection,
  pool,
  seedPostgres,
  closePool,
  adminQuery,
  audit,
  dbAccessRole,
} from './db.js';
import { ALL_TUNISIAN_MUNICIPALITIES } from '../src/lib/seedData.js';
import {
  PORT,
  TRUST_PROXY,
  HTTPS_ENABLED,
  HTTPS_KEY_PATH,
  HTTPS_CERT_PATH,
  HTTP_REDIRECT_PORT,
  ALLOW_DB_RECONNECT,
  ALLOW_DEMO_RESET,
  isProduction,
} from './config.js';
import {
  attachSession,
  requireAuth,
  requireRole,
  canEditViolation,
  createSession,
  deleteSession,
  deleteSessionsForUser,
  verifyUserCredentials,
  toSessionUser,
  isAccountLocked,
  registerLoginFailure,
  resetLoginFailures,
  setSessionCookie,
  clearSessionCookie,
} from './auth.js';
import { hashPassword, checkPasswordPolicy } from './passwords.js';
import {
  loginSchema,
  userUpsertSchema,
  settingsSchema,
  violatorSchema,
  violationCreateSchema,
  violationUpdateSchema,
  reviewSchema,
  dbUrlSchema,
  idParamsSchema,
  usernameParamsSchema,
  timeframeQuerySchema,
  validateBody,
  validateParams,
  validateQuery,
} from './validation.js';
import {
  securityHeaders,
  corsPolicy,
  originGuard,
  verifyCsrf,
  issueCsrfToken,
  clientIp,
  isLoopbackRequest,
  requireJsonContentType,
  globalLimiter,
  loginLimiter,
  writeLimiter,
  dbAdminLimiter,
  notFoundHandler,
  errorHandler,
} from './security.js';

dotenv.config();

const app = express();

app.disable('x-powered-by');
if (TRUST_PROXY) app.set('trust proxy', 1);

// ---- Transport & abuse protection (order matters) ----
app.use(securityHeaders());
app.use(corsPolicy());
app.use(clientIp);
app.use(globalLimiter);
app.use(express.json({ limit: '12mb', strict: true }));
app.use(cookieParser());
app.use('/api', requireJsonContentType);
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', originGuard);
app.use('/api', attachSession);
app.use('/api', verifyCsrf);

function maskUrl(url: string): string {
  return url.replace(/:[^:@]+@/, ':****@');
}

function logSecurity(event: Record<string, unknown>): void {
  console.warn('🔐', JSON.stringify({ ...event, at: new Date().toISOString() }));
}

/**
 * Allows the very first database setup from the local machine (nobody can log
 * in before a database exists). Afterwards only an admin may change it.
 */
function requireAdminOrBootstrap(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role === 'admin') return next();
  if (!isPostgresConnected && isLoopbackRequest(req)) return next();
  res.status(403).json({ error: 'هذا الإجراء متاح لرئيس المركز فقط' });
}

// ==================== HEALTH ====================

app.get('/api/health', (req, res) => {
  const body: Record<string, unknown> = {
    status: isPostgresConnected ? 'ok' : 'degraded',
    isPostgresConnected,
    engine: isPostgresConnected ? 'PostgreSQL Server' : 'Unavailable (fail-closed)',
    timestamp: new Date().toISOString(),
  };
  // Connection details are only exposed to an authenticated administrator.
  if (req.user?.role === 'admin') {
    body.currentDbUrl = maskUrl(currentDbUrl);
    body.error = lastConnectionError;
    body.dbAccessRole = dbAccessRole;
  }
  res.json(body);
});

// ==================== CSRF / AUTH ====================

app.get('/api/auth/csrf', (_req, res) => {
  res.json({ csrfToken: issueCsrfToken(res) });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/login', loginLimiter, validateBody(loginSchema), async (req, res, next) => {
  const { username, password } = req.body as { username: string; password: string };

  if (!isPostgresConnected) {
    res.status(503).json({ error: 'قاعدة البيانات غير متوفرة — تعذر تسجيل الدخول' });
    return;
  }
  if (isAccountLocked(username)) {
    logSecurity({ event: 'login_locked', username, ip: req.clientIp });
    res.status(429).json({ error: 'تم إيقاف هذا الحساب مؤقتاً بعد محاولات فاشلة متكررة' });
    return;
  }

  try {
    const user = await verifyUserCredentials(username, password);

    if (!user) {
      registerLoginFailure(username);
      await audit({
        actor: username.slice(0, 50),
        action: 'login_failed',
        ip: req.clientIp,
        userAgent: req.get('user-agent'),
      });
      logSecurity({ event: 'login_failed', username, ip: req.clientIp });
      res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
      return;
    }

    resetLoginFailures(username);
    // Rotate the session on every login (prevents session fixation).
    if (req.sessionToken) await deleteSession(req.sessionToken);
    const token = await createSession(user.username, req);
    setSessionCookie(res, token);
    issueCsrfToken(res); // rotate CSRF token alongside the session

    await audit({
      actor: user.username,
      action: 'login_success',
      ip: req.clientIp,
      userAgent: req.get('user-agent'),
      details: { role: user.role },
    });
    res.json({ user: toSessionUser(user) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/logout', requireAuth, async (req, res, next) => {
  try {
    if (req.sessionToken) await deleteSession(req.sessionToken);
    clearSessionCookie(res);
    await audit({ actor: req.user!.username, action: 'logout', ip: req.clientIp });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ==================== USERS ====================

const USER_COLUMNS = 'username, full_name AS "fullName", role, badge_number AS "badgeNumber"';

app.get('/api/users', requireRole('chef', 'admin'), async (_req, res, next) => {
  try {
    const result = await pool!.query(`SELECT ${USER_COLUMNS} FROM users ORDER BY created_at ASC`);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.post('/api/users', requireRole('admin'), writeLimiter, validateBody(userUpsertSchema), async (req, res, next) => {
  const input = req.body as {
    username: string;
    password?: string;
    fullName: string;
    role: 'agent' | 'chef' | 'admin';
    badgeNumber?: string;
  };

  try {
    const existing = await pool!.query('SELECT username, role FROM users WHERE username = $1', [input.username]);

    if (input.password !== undefined) {
      const policy = checkPasswordPolicy(input.password);
      if (!policy.ok) {
        res.status(400).json({ error: policy.message });
        return;
      }
    } else if (existing.rowCount === 0) {
      res.status(400).json({ error: 'كلمة المرور مطلوبة عند إنشاء حساب جديد' });
      return;
    }

    // Never allow the last administrator to lose the admin role.
    if (existing.rowCount > 0 && existing.rows[0].role === 'admin' && input.role !== 'admin') {
      const admins = await pool!.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");
      if (admins.rows[0].count <= 1) {
        res.status(400).json({ error: 'لا يمكن تغيير رتبة آخر رئيس مركز في المنظومة' });
        return;
      }
    }

    const passwordHash = input.password ? await hashPassword(input.password) : null;
    const result = await pool!.query(
      `INSERT INTO users (username, password_hash, full_name, role, badge_number)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         role = EXCLUDED.role,
         badge_number = EXCLUDED.badge_number,
         password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash)
       RETURNING ${USER_COLUMNS}`,
      [input.username, passwordHash, input.fullName, input.role, input.badgeNumber || null]
    );

    if (passwordHash) await deleteSessionsForUser(input.username);

    await audit({
      actor: req.user!.username,
      action: existing.rowCount > 0 ? 'user_updated' : 'user_created',
      target: input.username,
      ip: req.clientIp,
      details: { role: input.role, passwordChanged: Boolean(passwordHash) },
    });

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

app.delete(
  '/api/users/:username',
  requireRole('admin'),
  writeLimiter,
  validateParams(usernameParamsSchema),
  async (req, res, next) => {
    const username = String(req.params.username);
    try {
      if (username === req.user!.username) {
        res.status(400).json({ error: 'لا يمكنك حذف حسابك المتصل به حالياً' });
        return;
      }
      const target = await pool!.query('SELECT role FROM users WHERE username = $1', [username]);
      if (target.rowCount === 0) {
        res.status(404).json({ error: 'الحساب غير موجود' });
        return;
      }
      if (target.rows[0].role === 'admin') {
        const admins = await pool!.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");
        if (admins.rows[0].count <= 1) {
          res.status(400).json({ error: 'لا يمكن حذف آخر رئيس مركز في المنظومة' });
          return;
        }
      }
      await pool!.query('DELETE FROM users WHERE username = $1', [username]);
      await audit({ actor: req.user!.username, action: 'user_deleted', target: username, ip: req.clientIp });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// ==================== SETTINGS ====================

app.get('/api/settings', requireAuth, async (_req, res, next) => {
  try {
    const [result, users] = await Promise.all([
      pool!.query('SELECT * FROM settings WHERE id = 1'),
      pool!.query(`SELECT ${USER_COLUMNS} FROM users`),
    ]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'الإعدادات غير مهيأة بعد' });
      return;
    }
    const row = result.rows[0];
    res.json({
      appName: row.app_name,
      appSubtitle: row.app_subtitle,
      municipalityName: row.municipality_name,
      municipalityCode: row.municipality_code,
      primaryHex: row.primary_hex,
      successHex: row.success_hex,
      destructiveHex: row.destructive_hex,
      agents: users.rows,
      violationTypes: row.violation_types,
      actionTypes: row.action_types,
    });
  } catch (err) {
    next(err);
  }
});

app.put(
  '/api/settings',
  requireRole('admin'),
  writeLimiter,
  validateBody(settingsSchema),
  async (req, res, next) => {
    const s = req.body as Record<string, any>;
    try {
      await pool!.query(
        `INSERT INTO settings (id, app_name, app_subtitle, municipality_name, municipality_code, primary_hex, success_hex, destructive_hex, violation_types, action_types)
         VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           app_name = EXCLUDED.app_name,
           app_subtitle = EXCLUDED.app_subtitle,
           municipality_name = EXCLUDED.municipality_name,
           municipality_code = EXCLUDED.municipality_code,
           primary_hex = EXCLUDED.primary_hex,
           success_hex = EXCLUDED.success_hex,
           destructive_hex = EXCLUDED.destructive_hex,
           violation_types = EXCLUDED.violation_types,
           action_types = EXCLUDED.action_types`,
        [
          s.appName,
          s.appSubtitle ?? null,
          s.municipalityName,
          s.municipalityCode,
          s.primaryHex,
          s.successHex,
          s.destructiveHex,
          JSON.stringify(s.violationTypes),
          JSON.stringify(s.actionTypes),
        ]
      );
      await audit({ actor: req.user!.username, action: 'settings_updated', ip: req.clientIp });
      res.json({ success: true, settings: s });
    } catch (err) {
      next(err);
    }
  }
);

// ==================== VIOLATORS ====================

const VIOLATOR_COLUMNS = `id, first_name AS "firstName", last_name AS "lastName",
  national_id AS "nationalId", phone, address, photo, created_at AS "createdAt"`;

app.get('/api/violators', requireAuth, async (_req, res, next) => {
  try {
    const result = await pool!.query(`SELECT ${VIOLATOR_COLUMNS} FROM violators ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.get('/api/violators/:id', requireAuth, validateParams(idParamsSchema), async (req, res, next) => {
  try {
    const result = await pool!.query(`SELECT ${VIOLATOR_COLUMNS} FROM violators WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'المخالف غير موجود' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.post(
  '/api/violators',
  requireAuth,
  writeLimiter,
  validateBody(violatorSchema),
  async (req, res, next) => {
    const v = req.body as Record<string, any>;
    const id = v.id || `violator-${crypto.randomUUID()}`;
    const createdAt = v.createdAt || new Date().toISOString();

    try {
      await pool!.query(
        `INSERT INTO violators (id, first_name, last_name, national_id, phone, address, photo, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           national_id = EXCLUDED.national_id,
           phone = EXCLUDED.phone,
           address = EXCLUDED.address,
           photo = COALESCE(EXCLUDED.photo, violators.photo)`,
        [id, v.firstName, v.lastName, v.nationalId, v.phone || null, v.address ?? null, v.photo || null, createdAt]
      );
      await audit({
        actor: req.user!.username,
        action: 'violator_saved',
        target: id,
        ip: req.clientIp,
      });
      res.json({ success: true, violator: { ...v, id, createdAt } });
    } catch (err) {
      next(err);
    }
  }
);

// ==================== VIOLATIONS ====================

const VIOLATION_SELECT = `SELECT id, reference, arabic_reference AS "arabicReference", serial, year,
  municipality_code AS "municipalityCode", municipality_name AS "municipalityName",
  violator_id AS "violatorId", agent_username AS "agentUsername", agent_name AS "agentName",
  date, governorate, delegation, area, street, geo,
  violation_type AS "violationType", activity_type AS "activityType", goods_type AS "goodsType",
  description, action, notes, review_status AS "reviewStatus",
  reviewed_by AS "reviewedBy", reviewed_at AS "reviewedAt",
  has_vehicle AS "hasVehicle", vehicle_type AS "vehicleType",
  vehicle_plate AS "vehiclePlate", vehicle_color AS "vehicleColor",
  photos_by_category AS "photosByCategory", seizure, edits
  FROM violations`;

app.get('/api/violations', requireAuth, async (_req, res, next) => {
  try {
    const result = await pool!.query(`${VIOLATION_SELECT} ORDER BY date DESC`);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.get('/api/violations/:id', requireAuth, validateParams(idParamsSchema), async (req, res, next) => {
  try {
    const result = await pool!.query(`${VIOLATION_SELECT} WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'المحضر غير موجود' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.post(
  '/api/violations',
  requireAuth,
  writeLimiter,
  validateBody(violationCreateSchema),
  async (req, res, next) => {
    const v = req.body as Record<string, any>;
    const id = v.id || `violation-${crypto.randomUUID()}`;

    try {
      await pool!.query(
        `INSERT INTO violations (
           id, reference, arabic_reference, serial, year, municipality_code, municipality_name,
           violator_id, agent_username, agent_name, date,
           governorate, delegation, area, street, geo,
           violation_type, activity_type, goods_type, description, action, notes,
           review_status, reviewed_by, reviewed_at,
           has_vehicle, vehicle_type, vehicle_plate, vehicle_color,
           photos_by_category, seizure, edits
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11,
           $12, $13, $14, $15, $16,
           $17, $18, $19, $20, $21, $22,
           $23, $24, $25,
           $26, $27, $28, $29,
           $30, $31, $32
         )`,
        [
          id,
          v.reference,
          v.arabicReference,
          v.serial,
          v.year,
          v.municipalityCode,
          v.municipalityName || v.delegation,
          v.violatorId,
          // Identity is taken from the session, never from the payload.
          req.user!.username,
          req.user!.fullName,
          v.date,
          v.governorate,
          v.delegation,
          v.area ?? null,
          v.street,
          JSON.stringify(v.geo || { lat: 0, lng: 0 }),
          v.violationType,
          v.activityType ?? null,
          v.goodsType ?? null,
          v.description,
          v.action,
          v.notes ?? null,
          'under_review',
          null,
          null,
          v.hasVehicle || false,
          v.vehicleType ?? null,
          v.vehiclePlate ?? null,
          v.vehicleColor ?? null,
          JSON.stringify(v.photosByCategory || {}),
          JSON.stringify(v.seizure || { has: false }),
          JSON.stringify([]),
        ]
      );

      await audit({
        actor: req.user!.username,
        action: 'violation_created',
        target: id,
        ip: req.clientIp,
        details: { reference: v.reference, municipality: v.municipalityCode },
      });

      res.json({
        success: true,
        violation: {
          ...v,
          id,
          agentUsername: req.user!.username,
          agentName: req.user!.fullName,
          reviewStatus: 'under_review',
          reviewedBy: null,
          reviewedAt: null,
          edits: [],
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

app.put(
  '/api/violations/:id',
  requireAuth,
  writeLimiter,
  validateParams(idParamsSchema),
  validateBody(violationUpdateSchema),
  async (req, res, next) => {
    const id = String(req.params.id);
    const updates = req.body as Record<string, any>;

    try {
      const current = await pool!.query(
        'SELECT agent_username AS "agentUsername", review_status AS "reviewStatus" FROM violations WHERE id = $1',
        [id]
      );
      if (current.rowCount === 0) {
        res.status(404).json({ error: 'المحضر غير موجود' });
        return;
      }
      if (!canEditViolation(req.user!, current.rows[0].agentUsername, current.rows[0].reviewStatus)) {
        res.status(403).json({ error: 'لا يمكنك تعديل هذا المحضر (تمت مراجعته أو لا تملك صلاحيته)' });
        return;
      }

      const changedFields = Object.keys(updates).filter((key) => key !== 'reason');
      const editEntry = {
        date: new Date().toISOString(),
        username: req.user!.username,
        fullName: req.user!.fullName,
        reason: updates.reason || 'تعديل بيانات المحضر',
        fields: changedFields,
      };

      await pool!.query(
        `UPDATE violations SET
           governorate = COALESCE($1, governorate),
           delegation = COALESCE($2, delegation),
           area = COALESCE($3, area),
           street = COALESCE($4, street),
           geo = COALESCE($5, geo),
           violation_type = COALESCE($6, violation_type),
           activity_type = COALESCE($7, activity_type),
           goods_type = COALESCE($8, goods_type),
           description = COALESCE($9, description),
           action = COALESCE($10, action),
           notes = COALESCE($11, notes),
           has_vehicle = COALESCE($12, has_vehicle),
           vehicle_type = COALESCE($13, vehicle_type),
           vehicle_plate = COALESCE($14, vehicle_plate),
           vehicle_color = COALESCE($15, vehicle_color),
           photos_by_category = COALESCE($16, photos_by_category),
           seizure = COALESCE($17, seizure),
           edits = COALESCE(edits, '[]'::jsonb) || $18::jsonb
         WHERE id = $19`,
        [
          updates.governorate ?? null,
          updates.delegation ?? null,
          updates.area ?? null,
          updates.street ?? null,
          updates.geo ? JSON.stringify(updates.geo) : null,
          updates.violationType ?? null,
          updates.activityType ?? null,
          updates.goodsType ?? null,
          updates.description ?? null,
          updates.action ?? null,
          updates.notes ?? null,
          updates.hasVehicle ?? null,
          updates.vehicleType ?? null,
          updates.vehiclePlate ?? null,
          updates.vehicleColor ?? null,
          updates.photosByCategory ? JSON.stringify(updates.photosByCategory) : null,
          updates.seizure ? JSON.stringify(updates.seizure) : null,
          JSON.stringify([editEntry]),
          id,
        ]
      );

      await audit({
        actor: req.user!.username,
        action: 'violation_updated',
        target: id,
        ip: req.clientIp,
        details: { fields: changedFields },
      });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

app.patch(
  '/api/violations/:id/review',
  requireRole('chef', 'admin'),
  writeLimiter,
  validateParams(idParamsSchema),
  validateBody(reviewSchema),
  async (req, res, next) => {
    const id = String(req.params.id);
    const { status, reason } = req.body as { status: 'under_review' | 'reviewed'; reason?: string };

    try {
      const isApproving = status === 'reviewed';
      const reviewedAt = isApproving ? new Date().toISOString() : null;
      const reviewedBy = isApproving ? req.user!.fullName : null;

      const result = await pool!.query(
        `UPDATE violations SET review_status = $1, reviewed_by = $2, reviewed_at = $3 WHERE id = $4`,
        [status, reviewedBy, reviewedAt, id]
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'المحضر غير موجود' });
        return;
      }

      await audit({
        actor: req.user!.username,
        action: isApproving ? 'violation_reviewed' : 'violation_reopened',
        target: id,
        ip: req.clientIp,
        details: { reason: reason ?? null },
      });

      res.json({ success: true, status, reviewedBy, reviewedAt });
    } catch (err) {
      next(err);
    }
  }
);

// ==================== REPORTS ====================

app.get('/api/reports/national-summary', requireAuth, validateQuery(timeframeQuerySchema), async (req, res, next) => {
  const { timeframe } = res.locals.query as { timeframe: 'weekly' | 'monthly' };
  const cutoffDays = timeframe === 'weekly' ? 7 : 30;
  const cutoffDate = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000).toISOString();

  try {
    const result = await pool!.query(
      `SELECT municipality_code AS "municipalityCode", municipality_name AS "municipalityName",
              governorate, review_status AS "reviewStatus", seizure
       FROM violations WHERE date >= $1`,
      [cutoffDate]
    );
    const violationsList = result.rows;

    const map = new Map<string, any>();
    ALL_TUNISIAN_MUNICIPALITIES.forEach((m) => {
      map.set(m.code, {
        municipalityCode: m.code,
        municipalityName: m.name,
        governorate: m.governorate,
        totalViolations: 0,
        underReviewCount: 0,
        reviewedCount: 0,
        reviewPercentage: 0,
        seizuresCount: 0,
      });
    });

    violationsList.forEach((v) => {
      const code = (v.municipalityCode || 'MUN').toUpperCase();
      let item = map.get(code);
      if (!item) {
        item = {
          municipalityCode: code,
          municipalityName: v.municipalityName || code,
          governorate: v.governorate || 'غير محدد',
          totalViolations: 0,
          underReviewCount: 0,
          reviewedCount: 0,
          reviewPercentage: 0,
          seizuresCount: 0,
        };
        map.set(code, item);
      }
      item.totalViolations += 1;
      if (v.reviewStatus === 'reviewed') item.reviewedCount += 1;
      else item.underReviewCount += 1;
      if (v.seizure && v.seizure.has) item.seizuresCount += 1;
    });

    const summaries = Array.from(map.values()).map((s) => ({
      ...s,
      reviewPercentage: s.totalViolations > 0 ? Math.round((s.reviewedCount / s.totalViolations) * 100) : 0,
    }));

    summaries.sort((a, b) => {
      if (b.totalViolations !== a.totalViolations) return b.totalViolations - a.totalViolations;
      return a.municipalityName.localeCompare(b.municipalityName, 'ar');
    });

    const totalViolations = violationsList.length;
    const totalUnderReview = violationsList.filter((v) => v.reviewStatus !== 'reviewed').length;
    const totalReviewed = violationsList.filter((v) => v.reviewStatus === 'reviewed').length;
    const reviewPercentage = totalViolations > 0 ? Math.round((totalReviewed / totalViolations) * 100) : 0;
    const activeMunicipalitiesCount = summaries.filter((s) => s.totalViolations > 0).length;

    res.json({
      timeframe,
      timeframeLabel: timeframe === 'weekly' ? 'الحصيلة الأسبوعية (آخر 7 أيام)' : 'الحصيلة الشهرية (آخر 30 يوماً)',
      totalViolations,
      totalUnderReview,
      totalReviewed,
      reviewPercentage,
      activeMunicipalitiesCount,
      summaries,
    });
  } catch (err) {
    next(err);
  }
});

// ==================== DATABASE ADMINISTRATION ====================

app.post(
  '/api/db/test',
  dbAdminLimiter,
  requireAdminOrBootstrap,
  validateBody(dbUrlSchema),
  async (req, res, next) => {
    try {
      const { databaseUrl } = req.body as { databaseUrl: string };
      const result = await testPostgresConnection(databaseUrl);
      await audit({
        actor: req.user?.username ?? 'bootstrap',
        action: 'db_test',
        ip: req.clientIp,
        details: { success: result.success },
      });
      res.json({ success: result.success, message: result.message, version: result.version });
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/api/db/connect',
  dbAdminLimiter,
  requireAdminOrBootstrap,
  validateBody(dbUrlSchema),
  async (req, res, next) => {
    const { databaseUrl } = req.body as { databaseUrl: string };
    try {
      const bootstrap = !isPostgresConnected;
      if (!bootstrap && !ALLOW_DB_RECONNECT) {
        res.status(403).json({ error: 'تغيير قاعدة البيانات أثناء التشغيل معطّل في هذا الإصدار' });
        return;
      }

      await audit({
        actor: req.user?.username ?? 'bootstrap',
        action: 'db_reconnect',
        ip: req.clientIp,
      });

      process.env.DATABASE_URL = databaseUrl;
      const connected = await initDatabase();

      if (connected) {
        res.json({
          success: true,
          message: 'تم الاتصال بقاعدة بيانات PostgreSQL وتطبيق هيكل الجداول بنجاح!',
          isPostgresConnected: true,
        });
      } else {
        res.status(500).json({
          success: false,
          message: lastConnectionError || 'تعذر الاتصال بقاعدة بيانات PostgreSQL',
          isPostgresConnected: false,
        });
      }
    } catch (err) {
      next(err);
    }
  }
);

app.post('/api/db/reset', requireRole('admin'), writeLimiter, async (req, res, next) => {
  try {
    if (!ALLOW_DEMO_RESET) {
      res.status(403).json({ error: 'إعادة ضبط البيانات التجريبية معطّلة في بيئة الإنتاج' });
      return;
    }
    await adminQuery('TRUNCATE violations, violators, users, settings CASCADE');
    await seedPostgres();
    await adminQuery('ANALYZE');
    await audit({ actor: req.user!.username, action: 'demo_data_reset', ip: req.clientIp });

    // Truncating users cascades to sessions, so issue a fresh one for the admin
    // who triggered the reset instead of silently logging them out.
    const token = await createSession(req.user!.username, req);
    setSessionCookie(res, token);
    issueCsrfToken(res);

    res.json({ success: true, message: 'تمت إعادة ضبط البيانات بنجاح' });
  } catch (err) {
    next(err);
  }
});

// ==================== FALLBACKS ====================

app.use('/api', notFoundHandler);
app.use(notFoundHandler);
app.use(errorHandler);

// ==================== SERVER ====================

function createServer() {
  if (HTTPS_ENABLED) {
    const key = fs.readFileSync(HTTPS_KEY_PATH);
    const cert = fs.readFileSync(HTTPS_CERT_PATH);
    return https.createServer({ key, cert, minVersion: 'TLSv1.2' }, app);
  }
  return http.createServer(app);
}

const server = createServer();
server.requestTimeout = 30_000;
server.headersTimeout = 20_000;
server.keepAliveTimeout = 15_000;

server.listen(PORT, async () => {
  const scheme = HTTPS_ENABLED ? 'https' : 'http';
  console.log(`🚀 خادم الواجهة الخلفية (Backend API) يعمل على المنفذ: ${scheme}://localhost:${PORT}`);
  if (!HTTPS_ENABLED && isProduction) {
    console.warn('⚠️ تحذير: يعمل الخادم عبر HTTP في بيئة الإنتاج. فعّل HTTPS_ENABLED مع الشهادات.');
  }
  await initDatabase();
});

if (HTTP_REDIRECT_PORT > 0 && HTTPS_ENABLED) {
  http
    .createServer((req, res) => {
      const host = (req.headers.host ?? `localhost:${PORT}`).replace(/:\d+$/, `:${PORT}`);
      res.writeHead(308, { Location: `https://${host}${req.url ?? '/'}` });
      res.end();
    })
    .listen(HTTP_REDIRECT_PORT, () => {
      console.log(`🔁 إعادة توجيه HTTP→HTTPS على المنفذ ${HTTP_REDIRECT_PORT}`);
    });
}

// Release database connections cleanly on exit.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  });
}
