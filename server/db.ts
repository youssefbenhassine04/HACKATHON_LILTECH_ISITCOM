import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { INITIAL_USERS, INITIAL_SETTINGS, INITIAL_VIOLATORS, INITIAL_VIOLATIONS } from '../src/lib/seedData.js';
import { DB_APP_ROLE } from './config.js';
import { hashPassword, isBcryptHash } from './passwords.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export let pool: pg.Pool | null = null;
export let isPostgresConnected = false;
export let lastConnectionError: string | null = null;
export let currentDbUrl: string = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/police_municipale';

/**
 * Schema owner / maintenance pool. Kept only for DDL, seeding, TRUNCATE and
 * role management. Every request path uses the restricted `pool` instead.
 */
let adminPool: pg.Pool | null = null;

/** Role actually used for request queries (null when least privilege unavailable). */
export let dbAccessRole: string | null = null;

function sslFor(connectionString: string): pg.PoolConfig['ssl'] {
  const isSsl =
    connectionString.includes('sslmode=require') ||
    connectionString.includes('neon.tech') ||
    connectionString.includes('supabase.co');
  return isSsl ? { rejectUnauthorized: true } : undefined;
}

function poolConfig(connectionString: string, overrides: pg.PoolConfig = {}): pg.PoolConfig {
  return {
    connectionString,
    ssl: sslFor(connectionString),
    application_name: 'police-municipale-api',
    // Connections stay warm so field requests do not pay TCP/auth setup cost.
    max: 10,
    min: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 5_000,
    // Fail fast instead of letting a bad query hold an HTTP request.
    statement_timeout: 10_000,
    query_timeout: 10_000,
    ...overrides,
  };
}

/**
 * Creates a pg.Pool instance.
 */
export function createPgPool(connectionString: string): pg.Pool {
  return new pg.Pool(poolConfig(connectionString));
}

/**
 * Waits for the PostgreSQL server to accept connections (useful when the
 * database and the API are started together, since startup order is racy).
 */
function isRetryableConnectionError(err: unknown): boolean {
  const code = (err as { code?: string } | undefined)?.code;
  return code === 'ECONNREFUSED' || code === '57P03' /* the database system is starting up */;
}

async function connectWithRetry(target: pg.Pool, attempts = 10, delayMs = 700): Promise<pg.PoolClient> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await target.connect();
    } catch (err) {
      lastError = err;
      // Bad credentials or a bad host should fail immediately, not after retries.
      if (!isRetryableConnectionError(err) || attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

/**
 * Test a PostgreSQL connection string without touching application state.
 */
export async function testPostgresConnection(connectionString: string): Promise<{ success: boolean; message: string; version?: string }> {
  const testPool = createPgPool(connectionString);
  try {
    const client = await testPool.connect();
    const result = await client.query('SELECT version();');
    client.release();
    await testPool.end().catch(() => {});
    return {
      success: true,
      message: 'تم الاتصال بقاعدة بيانات PostgreSQL بنجاح!',
      version: result.rows[0]?.version,
    };
  } catch (err: any) {
    await testPool.end().catch(() => {});
    return {
      success: false,
      message: `فشل الاتصال: ${err.message || 'خطأ غير معروف'}`,
    };
  }
}

// ==================== LEAST-PRIVILEGE DATABASE ROLE ====================

function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Creates/refreshes a dedicated non-owner login role and grants it only the
 * DML it needs. The API then connects as this role, so a SQL injection bug
 * still cannot DROP tables, alter the schema, or read other databases.
 */
async function ensureLeastPrivilegeRole(admin: pg.PoolClient, connectionString: string): Promise<pg.Pool | null> {
  const role = /^[a-z_][a-z0-9_]{0,62}$/.test(DB_APP_ROLE) ? DB_APP_ROLE : 'police_app';
  // Rotated on every boot: the password never needs to be stored on disk.
  const password = crypto.randomBytes(32).toString('base64url');

  try {
    const dbName = (await admin.query('SELECT current_database() AS name')).rows[0].name as string;

    const exists = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
    if (exists.rowCount === 0) {
      await admin.query(`CREATE ROLE ${quoteIdent(role)} LOGIN`);
    }
    await admin.query(`ALTER ROLE ${quoteIdent(role)} WITH LOGIN PASSWORD ${quoteLiteral(password)}`);

    // Remove blanket privileges inherited from PUBLIC, then grant only DML.
    await admin.query(`REVOKE ALL ON DATABASE ${quoteIdent(dbName)} FROM PUBLIC`);
    await admin.query(`GRANT CONNECT ON DATABASE ${quoteIdent(dbName)} TO ${quoteIdent(role)}`);
    await admin.query(`REVOKE ALL ON SCHEMA public FROM ${quoteIdent(role)}`);
    await admin.query(`GRANT USAGE ON SCHEMA public TO ${quoteIdent(role)}`);
    await admin.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${quoteIdent(role)}`
    );
    await admin.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${quoteIdent(role)}`);
    await admin.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${quoteIdent(role)}`
    );
    await admin.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${quoteIdent(role)}`
    );

    // Audit trail and demo data are append/read-only for the app role.
    await admin.query(`REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM ${quoteIdent(role)}`);
    await admin.query(`REVOKE TRUNCATE ON users, settings, violators, violations, sessions FROM ${quoteIdent(role)}`);
    // Sessions are the one table the app may delete from (logout / expiry).
    await admin.query(`GRANT DELETE ON sessions TO ${quoteIdent(role)}`);

    // pg gives the connection-string user priority, so rebuild the URL with
    // the restricted role instead of relying on config overrides.
    const url = new URL(connectionString);
    url.username = encodeURIComponent(role);
    url.password = encodeURIComponent(password);
    const appPool = new pg.Pool(poolConfig(url.toString()));
    const probe = await appPool.connect();
    const currentUser = (await probe.query('SELECT current_user AS u')).rows[0].u as string;
    probe.release();
    if (currentUser !== role) {
      await appPool.end().catch(() => {});
      throw new Error(`app role mismatch: ${currentUser}`);
    }

    dbAccessRole = role;
    return appPool;
  } catch (err: any) {
    dbAccessRole = null;
    console.warn('⚠️ تعذر تفعيل حساب قاعدة البيانات محدود الصلاحيات:', err?.message || err);
    return null;
  }
}

// ==================== PASSWORD MIGRATION ====================

/**
 * Moves any legacy plaintext password into a bcrypt hash and clears the
 * plaintext column. Safe to run on every boot.
 */
async function migrateLegacyPasswords(admin: pg.PoolClient): Promise<void> {
  await admin.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT');
  await admin.query('ALTER TABLE users ALTER COLUMN password DROP NOT NULL');

  const legacy = await admin.query(
    'SELECT username, password, password_hash FROM users WHERE password IS NOT NULL OR password_hash IS NULL'
  );
  for (const row of legacy.rows) {
    if (isBcryptHash(row.password_hash)) {
      await admin.query('UPDATE users SET password = NULL WHERE username = $1', [row.username]);
      continue;
    }
    if (typeof row.password === 'string' && row.password.length > 0) {
      const hash = await hashPassword(row.password);
      await admin.query('UPDATE users SET password_hash = $1, password = NULL WHERE username = $2', [hash, row.username]);
      console.log(`🔐 تم تحويل كلمة مرور الحساب "${row.username}" إلى تجزئة bcrypt آمنة.`);
    }
  }
}

/**
 * Initialize PostgreSQL Database: connect, migrate, run schema.sql, seed if empty,
 * then swap to the least-privilege pool used by the API.
 */
export async function initDatabase(): Promise<boolean> {
  const dbUrl = process.env.DATABASE_URL || currentDbUrl;
  currentDbUrl = dbUrl;

  console.log('🔄 جاري محاولة الاتصال بقاعدة بيانات PostgreSQL...');
  console.log(`🔗 رابط الاتصال: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);

  await closePoolInternal();

  let newAdmin: pg.Pool | null = null;
  let admin: pg.PoolClient | null = null;

  try {
    newAdmin = createPgPool(dbUrl);
    admin = await connectWithRetry(newAdmin);
    console.log('✅ تم الاتصال بقاعدة بيانات PostgreSQL بنجاح!');

    // 1. Schema + migrations (owner privileges).
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
      await admin.query(schemaSql);
      console.log('✅ تم تطبيق هيكل الجداول (Schema) بنجاح في PostgreSQL!');
    }
    await migrateLegacyPasswords(admin);

    // 2. Seed only when the database is genuinely empty.
    const userCheck = await admin.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCheck.rows[0].count, 10) === 0) {
      console.log('🌱 جاري تغذية PostgreSQL بالبيانات الأولية...');
      await seedPostgres(admin);
      console.log('✅ تمت تغذية PostgreSQL بالبيانات الأولية بنجاح!');
    }

    // 3. Restricted role for all application queries.
    const appPool = await ensureLeastPrivilegeRole(admin, dbUrl);

    // 4. Expired sessions are useless; drop them at boot.
    await admin.query('DELETE FROM sessions WHERE expires_at < NOW()').catch(() => {});

    // Refresh planner statistics once the data is in place.
    await admin.query('ANALYZE');

    admin.release();
    admin = null;
    adminPool = newAdmin;
    pool = appPool ?? newAdmin;
    isPostgresConnected = true;
    lastConnectionError = null;
    console.log(
      pool === newAdmin
        ? 'ℹ️ يعمل الـ API بصلاحيات مالك قاعدة البيانات (تعذر إنشاء دور محدود).'
        : `✅ يعمل الـ API بحساب قاعدة بيانات محدود الصلاحيات: ${dbAccessRole}`
    );
    return true;
  } catch (err: any) {
    isPostgresConnected = false;
    dbAccessRole = null;
    lastConnectionError =
      err?.code === '28P01' || err?.code === '28000'
        ? 'بيانات الدخول إلى قاعدة البيانات غير صحيحة'
        : err?.message || 'تعذر الاتصال بخادم PostgreSQL';
    admin?.release();
    if (newAdmin) await newAdmin.end().catch(() => {});
    await closePoolInternal();
    console.warn('⚠️ تعذر الاتصال بـ PostgreSQL:', lastConnectionError);
    console.warn('🔒 تم إيقاف الوصول إلى البيانات (fail-closed) إلى حين توفر قاعدة البيانات.');
    return false;
  }
}

/**
 * Seeds initial demo data. Passwords are stored as bcrypt hashes only.
 */
export async function seedPostgres(client?: pg.PoolClient): Promise<void> {
  const needRelease = !client;
  const dbClient: pg.PoolClient = client || (await (adminPool ?? pool)!.connect());

  try {
    const hashedUsers = await Promise.all(
      INITIAL_USERS.map(async (u) => ({
        username: u.username,
        password_hash: await hashPassword(u.password),
        full_name: u.fullName,
        role: u.role,
        badge_number: u.badgeNumber || null,
      }))
    );

    await dbClient.query('BEGIN');

    // 1. Users — bulk insert in a single round trip
    await dbClient.query(
      `INSERT INTO users (username, password_hash, full_name, role, badge_number)
       SELECT username, password_hash, full_name, role, badge_number
       FROM json_to_recordset($1::json) AS x(
         username text, password_hash text, full_name text, role text, badge_number text
       )
       ON CONFLICT (username) DO NOTHING`,
      [JSON.stringify(hashedUsers)]
    );

    // 2. Settings
    await dbClient.query(
      `INSERT INTO settings (id, app_name, app_subtitle, municipality_name, municipality_code, primary_hex, success_hex, destructive_hex, violation_types, action_types)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         app_name = EXCLUDED.app_name,
         municipality_name = EXCLUDED.municipality_name,
         municipality_code = EXCLUDED.municipality_code`,
      [
        INITIAL_SETTINGS.appName,
        INITIAL_SETTINGS.appSubtitle,
        INITIAL_SETTINGS.municipalityName,
        INITIAL_SETTINGS.municipalityCode,
        INITIAL_SETTINGS.primaryHex,
        INITIAL_SETTINGS.successHex,
        INITIAL_SETTINGS.destructiveHex,
        JSON.stringify(INITIAL_SETTINGS.violationTypes),
        JSON.stringify(INITIAL_SETTINGS.actionTypes),
      ]
    );

    // 3. Violators — bulk insert in a single round trip
    await dbClient.query(
      `INSERT INTO violators (id, first_name, last_name, national_id, phone, address, photo, created_at)
       SELECT id, first_name, last_name, national_id, phone, address, photo, created_at
       FROM json_to_recordset($1::json) AS x(
         id text, first_name text, last_name text, national_id text,
         phone text, address text, photo text, created_at timestamptz
       )
       ON CONFLICT (id) DO NOTHING`,
      [
        JSON.stringify(
          INITIAL_VIOLATORS.map((v) => ({
            id: v.id,
            first_name: v.firstName,
            last_name: v.lastName,
            national_id: v.nationalId,
            phone: v.phone,
            address: v.address,
            photo: v.photo || null,
            created_at: v.createdAt,
          }))
        ),
      ]
    );

    // 4. Violations — bulk insert in a single round trip
    await dbClient.query(
      `INSERT INTO violations (
         id, reference, arabic_reference, serial, year, municipality_code, municipality_name,
         violator_id, agent_username, agent_name, date,
         governorate, delegation, area, street, geo,
         violation_type, activity_type, goods_type, description, action, notes,
         review_status, reviewed_by, reviewed_at,
         has_vehicle, vehicle_type, vehicle_plate, vehicle_color,
         photos_by_category, seizure, edits
       )
       SELECT id, reference, arabic_reference, serial, year, municipality_code, municipality_name,
              violator_id, agent_username, agent_name, date,
              governorate, delegation, area, street, geo,
              violation_type, activity_type, goods_type, description, action, notes,
              review_status, reviewed_by, reviewed_at,
              has_vehicle, vehicle_type, vehicle_plate, vehicle_color,
              photos_by_category, seizure, edits
       FROM json_to_recordset($1::json) AS x(
         id text, reference text, arabic_reference text, serial int, year int,
         municipality_code text, municipality_name text, violator_id text,
         agent_username text, agent_name text, date timestamptz,
         governorate text, delegation text, area text, street text, geo jsonb,
         violation_type text, activity_type text, goods_type text, description text,
         action text, notes text, review_status text, reviewed_by text,
         reviewed_at timestamptz, has_vehicle boolean, vehicle_type text,
         vehicle_plate text, vehicle_color text, photos_by_category jsonb,
         seizure jsonb, edits jsonb
       )
       ON CONFLICT (id) DO NOTHING`,
      [
        JSON.stringify(
          INITIAL_VIOLATIONS.map((viol) => ({
            id: viol.id,
            reference: viol.reference,
            arabic_reference: viol.arabicReference,
            serial: viol.serial,
            year: viol.year,
            municipality_code: viol.municipalityCode,
            municipality_name: viol.municipalityName || 'سيدي بوعلي',
            violator_id: viol.violatorId,
            agent_username: viol.agentUsername,
            agent_name: viol.agentName,
            date: viol.date,
            governorate: viol.governorate,
            delegation: viol.delegation,
            area: viol.area,
            street: viol.street,
            geo: viol.geo,
            violation_type: viol.violationType,
            activity_type: viol.activityType,
            goods_type: viol.goodsType,
            description: viol.description,
            action: viol.action,
            notes: viol.notes || null,
            review_status: viol.reviewStatus || 'under_review',
            reviewed_by: viol.reviewedBy || null,
            reviewed_at: viol.reviewedAt || null,
            has_vehicle: viol.hasVehicle,
            vehicle_type: viol.vehicleType || null,
            vehicle_plate: viol.vehiclePlate || null,
            vehicle_color: viol.vehicleColor || null,
            photos_by_category: viol.photosByCategory,
            seizure: viol.seizure,
            edits: viol.edits || [],
          }))
        ),
      ]
    );

    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    if (needRelease) dbClient.release();
  }
}

/**
 * Runs a statement with owner privileges (TRUNCATE, DDL, ANALYZE).
 */
export async function adminQuery(sql: string, params: unknown[] = []): Promise<pg.QueryResult> {
  if (!adminPool) throw new Error('قاعدة البيانات غير متصلة');
  return adminPool.query(sql, params);
}

/**
 * Appends an entry to the tamper-resistant audit trail. Never throws: logging
 * must not break a request.
 */
export async function audit(entry: {
  actor?: string | null;
  action: string;
  target?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    if (!pool) return;
    await pool.query(
      `INSERT INTO audit_log (actor, action, target, ip, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.actor ?? null,
        entry.action,
        entry.target ?? null,
        entry.ip ?? null,
        entry.userAgent?.slice(0, 400) ?? null,
        JSON.stringify(entry.details ?? {}),
      ]
    );
  } catch (err: any) {
    console.warn('⚠️ تعذر تسجيل حدث التدقيق:', err?.message || err);
  }
}

async function closePoolInternal(): Promise<void> {
  const closingApp = pool;
  const closingAdmin = adminPool;
  pool = null;
  adminPool = null;
  isPostgresConnected = false;
  dbAccessRole = null;
  if (closingApp) await closingApp.end().catch(() => {});
  if (closingAdmin && closingAdmin !== closingApp) await closingAdmin.end().catch(() => {});
}

/**
 * Closes the pools on shutdown so PostgreSQL connections are released cleanly.
 */
export async function closePool(): Promise<void> {
  await closePoolInternal();
}
