-- ============================================================================
-- منظومة الشرطة البلدية - الجمهورية التونسية
-- Tunisian Municipal Police Management System - PostgreSQL Database Schema
-- ============================================================================

-- 1. جدول المستخدمين والأعوان (Users & Police Agents)
-- كلمات المرور تُخزَّن مجزّأة بـ bcrypt فقط. العمود "password" قديم ومهجور ويُفرَّغ عند الإقلاع.
CREATE TABLE IF NOT EXISTS users (
  username VARCHAR(50) PRIMARY KEY,
  password VARCHAR(255),
  password_hash TEXT CHECK (password_hash IS NULL OR length(password_hash) >= 50),
  full_name VARCHAR(150) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('agent', 'chef', 'admin')),
  badge_number VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ترقية قواعد البيانات القديمة (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- 5. جلسات الدخول (Server-side sessions)
-- يُخزَّن فقط تجزئة SHA-256 للرمز، فلا يمكن سرقة جلسات من نسخة احتياطية للقاعدة.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) PRIMARY KEY,
  username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ip VARCHAR(64),
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions (username);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- 6. سجل التدقيق الأمني (Append-only security audit trail)
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor VARCHAR(50),
  action VARCHAR(64) NOT NULL,
  target VARCHAR(150),
  ip VARCHAR(64),
  user_agent TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_log_at ON audit_log (at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log (actor, at DESC);

-- 2. جدول إعدادات البلدية والمنظومة (System & Municipality Settings)
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  app_name VARCHAR(150) NOT NULL DEFAULT 'الشرطة البلدية',
  app_subtitle VARCHAR(255) DEFAULT 'منظومة معاينة وتسجيل المخالفات الميدانية',
  municipality_name VARCHAR(100) NOT NULL DEFAULT 'سيدي بوعلي',
  municipality_code VARCHAR(20) NOT NULL DEFAULT 'SIDI',
  primary_hex VARCHAR(20) NOT NULL DEFAULT '#0b2545',
  success_hex VARCHAR(20) NOT NULL DEFAULT '#1f9d55',
  destructive_hex VARCHAR(20) NOT NULL DEFAULT '#d62828',
  violation_types JSONB NOT NULL DEFAULT '["انتصاب عشوائي", "استغلال الرصيف", "عرض بضاعة دون ترخيص", "استعمال طريق عام", "مخالفة صحية", "مخالفة ترتيبية"]'::jsonb,
  action_types JSONB NOT NULL DEFAULT '["تنبيه شفوي", "تنبيه كتابي", "حجز", "إزالة فورية", "تحرير محضر", "إحالة إلى جهة أخرى"]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. جدول بطاقات المخالفين (Violators Master Table)
CREATE TABLE IF NOT EXISTS violators (
  id VARCHAR(100) PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  national_id VARCHAR(20) NOT NULL UNIQUE,
  phone VARCHAR(50),
  address TEXT,
  photo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. جدول محاضر المخالفات الميدانية (Field Violations Register)
CREATE TABLE IF NOT EXISTS violations (
  id VARCHAR(100) PRIMARY KEY,
  reference VARCHAR(100) NOT NULL UNIQUE,
  arabic_reference TEXT NOT NULL,
  serial INTEGER NOT NULL,
  year INTEGER NOT NULL,
  municipality_code VARCHAR(20) NOT NULL,
  municipality_name VARCHAR(100),
  violator_id VARCHAR(100) NOT NULL REFERENCES violators(id) ON DELETE CASCADE,
  agent_username VARCHAR(50) NOT NULL,
  agent_name VARCHAR(150) NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- الموقع الجغرافي
  governorate VARCHAR(100) NOT NULL,
  delegation VARCHAR(100) NOT NULL,
  area VARCHAR(100),
  street VARCHAR(255) NOT NULL,
  geo JSONB DEFAULT '{"lat": 0, "lng": 0}'::jsonb,

  -- تفاصيل المخالفة
  violation_type VARCHAR(100) NOT NULL,
  activity_type VARCHAR(150),
  goods_type VARCHAR(150),
  description TEXT NOT NULL,
  action VARCHAR(100) NOT NULL,
  notes TEXT,

  -- حالة التدقيق والمراجعة
  review_status VARCHAR(50) NOT NULL DEFAULT 'under_review' CHECK (review_status IN ('under_review', 'reviewed')),
  reviewed_by VARCHAR(150),
  reviewed_at TIMESTAMP WITH TIME ZONE,

  -- وسيلة النقل
  has_vehicle BOOLEAN DEFAULT FALSE,
  vehicle_type VARCHAR(100),
  vehicle_plate VARCHAR(50),
  vehicle_color VARCHAR(50),

  -- الصور والمرفقات (5 أصناف)
  photos_by_category JSONB DEFAULT '{"violation": [], "goods": [], "vehicle": [], "documents": [], "place": []}'::jsonb,

  -- الحجز الفعلي
  seizure JSONB DEFAULT '{"has": false}'::jsonb,

  -- سجل التعديلات والتدقيق غير القابل للحذف
  edits JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- الفهارس (Indexes) — مبنية على استعلامات الـ API الفعلية
-- national_id و reference لهما فهارس فريدة ضمن القيود أعلاه، فلا حاجة لتكرارها.
-- ============================================================================

-- تسجيل الدخول: WHERE LOWER(username) = LOWER($1)
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));

-- قوائم المخالفين: ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_violators_created_at ON violators (created_at DESC);

-- سجل المخالفات: ORDER BY date DESC
CREATE INDEX IF NOT EXISTS idx_violations_date ON violations (date DESC);

-- كشف حساب المخالف: WHERE violator_id = $1 ORDER BY date DESC
CREATE INDEX IF NOT EXISTS idx_violations_violator_date ON violations (violator_id, date DESC);

-- الحصيلة الوطنية: WHERE date >= $1 مع تجميع حسب البلدية وحالة المراجعة
CREATE INDEX IF NOT EXISTS idx_violations_date_municipality ON violations (date DESC, municipality_code, review_status);

-- قائمة انتظار المراجعة: المخالفات غير المراجعة فقط (فهرس جزئي أصغر وأسرع)
CREATE INDEX IF NOT EXISTS idx_violations_under_review ON violations (date DESC) WHERE review_status = 'under_review';

-- بحث الإحصائيات حسب البلدية
CREATE INDEX IF NOT EXISTS idx_violations_municipality_date ON violations (municipality_code, date DESC);

-- تحديث updated_at تلقائياً في جدول الإعدادات
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_settings_updated_at ON settings;
CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- إحصاءات محدّثة للمخطط لتمكين المخطط من اختيار خطط تنفيذ أفضل
ANALYZE users;
ANALYZE settings;
ANALYZE violators;
ANALYZE violations;
ANALYZE sessions;
ANALYZE audit_log;
