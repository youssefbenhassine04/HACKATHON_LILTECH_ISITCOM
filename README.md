# Municipal Police Field Inspection System

**A production-hardened, Arabic-first (RTL) web application for Tunisian municipal police officers** to record field violations, manage offender records, review reports, and produce national statistics.

| | |
|---|---|
| **Version** | 1.0.0 |
| **Status** | Release 1.0.0 — deployment-ready, hardened API, verified end-to-end |
| **Language** | Arabic UI (RTL), English documentation |
| **Stack** | React 19 + Vite 8 · Express 5 + TypeScript · PostgreSQL 18 |
| **Runtime** | Node.js ≥ 20 (verified on Node 24.13.1) |

---

## Table of Contents

1. [Overview](#1-overview)
2. [Feature Set](#2-feature-set)
3. [Technology Stack](#3-technology-stack)
4. [Architecture](#4-architecture)
5. [Repository Layout](#5-repository-layout)
6. [Getting Started](#6-getting-started)
7. [Scripts Reference](#7-scripts-reference)
8. [Demo Accounts](#8-demo-accounts)
9. [Configuration](#9-configuration)
10. [Database](#10-database)
11. [Authentication & Sessions](#11-authentication--sessions)
12. [Authorization Model](#12-authorization-model)
13. [Security Controls](#13-security-controls)
14. [API Reference](#14-api-reference)
15. [Error Codes](#15-error-codes)
16. [Frontend Architecture](#16-frontend-architecture)
17. [Verification & Test Evidence](#17-verification--test-evidence)
18. [Performance Measurements](#18-performance-measurements)
19. [Deployment & Release Checklist](#19-deployment--release-checklist)
20. [Troubleshooting](#20-troubleshooting)
21. [Known Limitations](#21-known-limitations)
22. [Roadmap](#22-roadmap)

---

## 1. Overview

The system digitises the daily field work of a municipal police unit:

- An **agent** records a violation in the street (offender identity, GPS location, photos, seizure details, violation type, action taken).
- A **chef** (brigade chief) reviews and approves or reopens reports.
- An **admin** (station chief) manages officers, municipal branding, violation categories, reports and the database.

The original prototype stored everything in the browser (`localStorage`) with mock logins. This release moves **authentication, authorization, validation, persistence and auditing to the server**, while keeping a local render cache so the UI stays fast.

### Release highlights (1.0.0)

- Real server sessions (bcrypt + hashed session tokens) replacing mock users.
- Role-based authorization enforced on every endpoint, with server-owned identities and an edit trail.
- Least-privilege PostgreSQL role (`police_app`), schema migrations and an append-only audit log.
- Validation, sanitisation, CSRF, rate limiting, hardened headers and HTTPS support.
- Server-authoritative data with a fast local cache and automatic resync on failure.
- Self-service password change and an admin audit viewer.
- Single-process production deployment: `npm run build && npm start` serves the SPA and the API together.

---

## 2. Feature Set

### Screens (11)

| # | Route | Screen | Purpose |
|---|-------|--------|---------|
| 1 | `/login` | Login | Server-side credential check, role-aware redirect |
| 2 | `/` | Dashboard | Counters, recent violations, quick actions, role greeting |
| 3 | `/search` | Search | Cross-field search over offenders and violations |
| 4 | `/violations/new` | Add Violation | Multi-section field form: offender, location + map, photos, seizure, action |
| 5 | `/violators` | Offenders List | Aggregate per offender: total, warnings, seizures, repeat-offender flag |
| 6 | `/violators/:id` | Offender Profile | Identity, photo, history timeline, statistics |
| 7 | `/violations` | Violations Register | Full chronological register with review badges |
| 8 | `/violations/:id` | Violation Details | Read-only report, photo gallery, review action, print |
| 9 | `/violations/:id/edit` | Edit Violation (chef/admin) | Field corrections with mandatory edit reason |
| 10 | `/reports` | National Reports | Weekly/monthly aggregation across all Tunisian municipalities |
| 11 | `/settings` | Settings (admin) | Branding, colours, officers, violation/action categories, backups, **security audit trail** |

### Cross-cutting features

- **Server-backed sessions** with httpOnly cookies and rotation.
- **Self-service password change** (header key icon) that revokes other devices.
- **Role-based UI + API guards** (agent / chef / admin).
- **Live data synchronisation**: reads hydrate from the API before pages render; writes go straight to PostgreSQL, with an automatic resync + banner on failure.
- **Arabic RTL layout**, Cairo typeface, dynamic theme colours stored in the database.
- **PWA metadata** (`manifest.json`, icons, standalone mode) and print-friendly report views.
- **Photo capture** from camera or gallery, stored as validated data URLs.
- **Map preview** via OpenStreetMap embed and reverse geocoding via Nominatim.

---

## 3. Technology Stack

### Runtime dependencies

| Package | Version | Role |
|---|---|---|
| `react`, `react-dom` | ^19.3.1 | UI |
| `react-router-dom` | ^7.18.6 | Client routing |
| `lucide-react` | ^1.77.0 | Icons |
| `express` | ^5.3.0 | HTTP API |
| `pg` | ^8.23.1 | PostgreSQL driver + pooling |
| `zod` | ^4.6.7 | Request schema validation |
| `helmet` | ^8.3.0 | Security headers / CSP |
| `express-rate-limit` | ^8.7.5 | Rate limiting |
| `bcryptjs` | ^3.0.3 | Password hashing (pure JS, no native build) |
| `cookie-parser` | ^1.4.7 | httpOnly/CSRF cookie parsing |
| `cors` | ^2.8.6 | Origin-restricted CORS |
| `dotenv` | ^18.0.10 | `.env` loading |
| `tsx` | ^4.23.15 | Runs TypeScript directly in dev and production |

### Development dependencies

| Package | Version | Role |
|---|---|---|
| `vite` + `@vitejs/plugin-react` | ^8.3.6 / ^6.1.2 | Dev server & production bundler |
| `typescript` | ~7.0.2 | Type checking (app + server projects) |
| `tailwindcss`, `postcss`, `autoprefixer` | 3.4 / 8.5 / 10.4 | Styling |
| `oxlint` | ^1.90.0 | Linter |
| `embedded-postgres` | ^18.7.0-beta.19 | Local PostgreSQL 18.7 binaries (no admin rights needed) |
| `selfsigned` | ^5.5.0 | Local HTTPS development certificate |
| `concurrently` | ^10.0.7 | Runs DB + API + UI together |
| `@types/*` | latest | Type definitions |

---

## 4. Architecture

```
┌──────────────────────────── Browser ────────────────────────────┐
│  React SPA (React 19 + Router 7 + Tailwind, Arabic RTL)         │
│                                                                 │
│  AuthContext ── GET /api/auth/me ──────────────┐                │
│  lib/api.ts  ── fetch(credentials:'include')    │                │
│                 + X-CSRF-Token                  │                │
│  lib/store.ts ── hydrate cache + write-through  │                │
│  localStorage ── render cache only              │                │
└──────────────────────────┬──────────────────────┼───────────────┘
                           │ HTTPS (cookies)      │
┌──────────────────────────▼──────────────────────▼───────────────┐
│  Express 5 API (TypeScript, port 3001)                          │
│                                                                 │
│  helmet → CORS → client IP → global rate limit → JSON → cookies │
│  → JSON content-type → no-store → origin guard → session        │
│  → CSRF → routes (Zod validation → role guard → SQL)            │
│  → 404 handler → central error handler                          │
│                                                                 │
│  sessions (SHA-256 token hash) · audit_log (append-only)         │
└───────────────┬─────────────────────────────────────────────────┘
                │ pg.Pool  (role: police_app, DML only)
┌───────────────▼─────────────────────────────────────────────────┐
│  PostgreSQL 18 (UTF-8)                                          │
│  users · settings · violators · violations · sessions · audit   │
│  owner pool (postgres) used only for DDL/seed/reset/ANALYZE     │
└─────────────────────────────────────────────────────────────────┘
```

### Request lifecycle

1. `helmet` adds CSP and hardening headers; `cors` only echoes allowed origins.
2. Per-IP limiter rejects abusive traffic before any parsing.
3. Body is parsed (12 MB cap), cookies read, and non-JSON writes rejected.
4. `originGuard` blocks cross-site state changes (`Origin` + `Sec-Fetch-Site`).
5. `attachSession` resolves the httpOnly cookie to a live DB session row.
6. `verifyCsrf` requires the double-submit token on unsafe methods.
7. Route-level Zod validation rewrites `req.body` (unknown keys dropped, strings sanitised).
8. Role guard → parameterised SQL via the restricted `police_app` role.
9. Successful mutations append to `audit_log`.
10. Errors are mapped centrally; internal details never reach the client.

### Data synchronisation (frontend)

- On login / reload, `AuthContext` calls `/api/auth/me`, then `syncFromServer()` pulls **settings + offenders + violations** before protected routes render.
- Every mutation (`createViolation`, `updateViolation`, `setViolationReviewStatus`, `saveViolator`, `saveSettings`) updates the cache instantly (optimistic) and POSTs to the API.
- Settings writes are debounced 800 ms so typing does not spam the API.
- Failures raise a visible banner (`SyncBanner`) and trigger a full resync, so the UI never silently diverges.
- Logout clears the cache so the next officer cannot see the previous one's data.

---

## 5. Repository Layout

```
.
├── Dockerfile                  # Multi-stage build: Vite SPA → Express runtime
├── docker-compose.yml          # App + PostgreSQL 18 stack
├── .dockerignore
├── index.html                  # Vite entry (RTL, Cairo font, PWA metadata)
├── vite.config.ts              # Dev proxy /api → :3001 (HTTP or HTTPS)
├── tailwind.config.js
├── tsconfig.json               # Project references (app / node)
├── tsconfig.app.json
├── tsconfig.node.json
├── .env.example                # Documented environment template
├── public/
│   ├── logo.png                # Institutional emblem (512×512 master, used by the PWA)
│   ├── logo-192.png            # Emblem used in the UI (header, login, reports)
│   ├── apple-touch-icon.png    # iOS home-screen icon (180×180)
│   ├── favicon-64.png          # Browser favicon (64×64)
│   ├── manifest.json           # PWA manifest
│   └── icons.svg
├── server/
│   ├── index.ts                # Express app, all routes, HTTPS/HTTP server, static hosting
│   ├── config.ts               # Central environment/security configuration
│   ├── auth.ts                 # Sessions, cookies, lockout, role guards
│   ├── passwords.ts            # bcrypt hashing + password policy
│   ├── validation.ts           # Zod schemas + sanitisation + validators
│   ├── security.ts             # helmet, CORS, rate limits, CSRF, error mapping
│   ├── db.ts                   # Pools, migrations, least-privilege role, seed, audit
│   ├── local-db.ts             # Embedded PostgreSQL launcher (dev)
│   ├── gen-cert.ts             # Self-signed HTTPS cert generator (dev)
│   ├── schema.sql              # Idempotent DDL, indexes, trigger
│   └── tsconfig.json           # Server type-check project
├── src/
│   ├── assets/logo-source.jpeg # Original logo artwork (source for public/logo*.png)
│   ├── main.tsx                # Bootstrap + theme application
│   ├── App.tsx                 # Routes and role-protected trees
│   ├── context/AuthContext.tsx # Server session, hydration, login/logout
│   ├── lib/
│   │   ├── api.ts              # Authenticated, CSRF-aware API client
│   │   ├── store.ts            # Local cache + server sync + derived statistics
│   │   ├── seedData.ts         # Demo users, settings, offenders, violations, municipalities
│   │   ├── arabicNumbers.ts    # Arabic reference generation / numeral helpers
│   │   └── dateUtils.ts
│   ├── components/             # Layout, Header, BottomNav, PhotoUploader, Map, Guards, etc.
│   ├── pages/                  # 11 screens
│   └── types/index.ts          # Shared domain types
└── .pgdata/                    # Local PostgreSQL cluster (gitignored)
```

---

## 6. Getting Started

### Prerequisites

- **Node.js ≥ 20** and npm (no system PostgreSQL, Docker or admin rights required).
- Ports free: `5432` (database), `3001` (API), `5173` (Vite dev server).

### Install

```bash
npm install
cp .env.example .env      # then adjust if needed
```

### Run everything (development)

```bash
npm run dev:full
```

Starts three coordinated processes (Ctrl+C stops all):

| Process | Port | Description |
|---|---|---|
| `npm run db` | 5432 | Embedded PostgreSQL 18.7, cluster in `.pgdata/` |
| `npm run server` | 3001 | Express API (auto-applies schema, migrates, seeds) |
| `npm run dev` | 5173 | Vite dev server, proxies `/api` to the backend |

Open **http://localhost:5173**.

### Run services separately

```bash
npm run db
npm run server
npm run dev
```

### Run the production build

```bash
npm run build          # type-check + Vite production bundle into dist/
npm start              # Express serves dist/ AND /api on one origin
```

Set `NODE_ENV=production` (and TLS settings) in the environment for a real deployment.

### Run with Docker

The image builds the SPA and serves it from the Express API, so UI and API share
one origin. PostgreSQL 18 runs in its own container and stores its data in a
named volume.

```bash
docker compose up --build -d   # build the image, start db + api
docker compose logs -f app     # schema / seed progress
```

Open **http://localhost:3001** — same demo accounts as above; the schema is
applied and demo data seeded automatically on first boot.

| Detail | Value |
|---|---|
| Files | `Dockerfile`, `docker-compose.yml`, `.dockerignore` |
| App URL | http://localhost:3001 (override with `APP_PORT`) |
| Database | `postgres:18`, data in the `pgdata` volume, not published to the host |
| Migrations | Applied by the API on startup (`server/schema.sql`) |
| Stop | `docker compose down` (keep data) · `docker compose down -v` (delete data) |

Optional variables (shell env or a `.env` file next to the compose file):

| Variable | Default | Purpose |
|---|---|---|
| `APP_PORT` | `3001` | Host port for the app |
| `POSTGRES_PASSWORD` | `postgres` | Database password — change outside local use |
| `ALLOWED_ORIGINS` | `http://localhost:3001,http://127.0.0.1:3001` | Origins allowed to call the API |
| `COOKIE_SECURE` | `false` | Set `true` when served over HTTPS |
| `TRUST_PROXY` | `false` | Set `true` behind nginx/Caddy/ALB |
| `ALLOW_DEMO_RESET` | `false` | Enables “reset demo data” in Settings |

For a real deployment put the container behind a TLS-terminating proxy and set
`COOKIE_SECURE=true`, `TRUST_PROXY=true` and `ALLOWED_ORIGINS=https://your-domain`
(the runtime image itself runs as the unprivileged `node` user).

---

## 7. Scripts Reference

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `vite` | Frontend dev server with API proxy |
| `npm run server` | `tsx server/index.ts` | API server |
| `npm run db` | `tsx server/local-db.ts` | Local embedded PostgreSQL (init/start/stop) |
| `npm run dev:full` | `concurrently ...` | DB + API + UI together |
| `npm run build` | `tsc -b && vite build` | Production bundle |
| `npm start` | `tsx server/index.ts` | Production server (serves `dist/` when `NODE_ENV=production`) |
| `npm run typecheck` | `tsc -b && tsc -p server/tsconfig.json --noEmit` | Type-check app **and** server |
| `npm run lint` | `oxlint` | Lint the repository |
| `npm run preview` | `vite preview` | Preview the built SPA (static only) |
| `npm run cert:dev` | `tsx server/gen-cert.ts` | Generate `.certs/dev-key.pem` + `dev-cert.pem` |

---

## 8. Demo Accounts

Seeded on first run (passwords are stored as bcrypt hashes, never plaintext):

| Username | Password | Role | Arabic label | Badge |
|---|---|---|---|---|
| `agent` | `agent` | agent | عون | SH-4102 |
| `chef` | `chef` | chef | رئيس فرقة | CH-2015 |
| `admin` | `admin` | admin | رئيس مركز | DIR-1001 |

> ⚠️ These are **demo** credentials with weak passwords. Change them (key icon in the header) before exposing the system to any real network.

Seed data volume: **17 violations**, **5 offenders**, **3 users**, one settings row, plus the full Tunisian municipality list used by the national report.

---

## 9. Configuration

All settings are optional; defaults are safe for local development. See `.env.example`.

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@127.0.0.1:5432/police_municipale` | PostgreSQL connection string |
| `PORT` | `3001` | API port |
| `NODE_ENV` | `development` | `production` enables fail-closed TLS warnings, static hosting, demo-reset lockout |
| `TRUST_PROXY` | `false` | Trust `X-Forwarded-*` (set `true` behind nginx/Caddy/ALB) |
| `ALLOWED_ORIGINS` | localhost origins | Comma-separated browser origins allowed to send credentialed requests |
| `COOKIE_SECURE` | `true` in production/HTTPS | Mark session cookies `Secure` + `__Host-`; `false` for plain-HTTP Docker |
| `SESSION_TTL_HOURS` | `8` | Session lifetime |
| `BCRYPT_ROUNDS` | `12` | Password hash cost (clamped 10–14) |
| `LOGIN_MAX_FAILURES` | `5` | Failed passwords before account lockout |
| `LOGIN_LOCKOUT_MINUTES` | `15` | Lockout duration |
| `RATE_LIMIT_GLOBAL` | `600` | Requests per IP per 15 min |
| `RATE_LIMIT_LOGIN` | `8` | Failed logins per IP+username per 15 min |
| `RATE_LIMIT_WRITE` | `150` | Write operations per IP per 15 min |
| `RATE_LIMIT_DB_ADMIN` | `10` | DB admin operations per IP per hour |
| `HTTPS_ENABLED` | `false` | Serve TLS from Node |
| `HTTPS_KEY_PATH` | `.certs/dev-key.pem` | Private key path |
| `HTTPS_CERT_PATH` | `.certs/dev-cert.pem` | Certificate path |
| `HTTP_REDIRECT_PORT` | `0` (off) | Extra HTTP listener redirecting 308 → HTTPS |
| `ALLOW_DB_RECONNECT` | `true` dev / `false` prod | Allow changing `DATABASE_URL` at runtime |
| `ALLOW_DEMO_RESET` | `true` dev / `false` prod | Allow `POST /api/db/reset` |
| `BODY_LIMIT` | `12mb` | Max JSON body size |
| `DB_APP_ROLE` | `police_app` | Least-privilege runtime role name |
| `MAX_PHOTO_BYTES` | `2000000` | Max characters per photo data URL |
| `MAX_PHOTOS_PER_CATEGORY` | `10` | Max photos per category |

`.env` is gitignored; `.env.example` is committed.

---

## 10. Database

### 10.1 Local embedded server (development)

`npm run db` uses `embedded-postgres` (real PostgreSQL 18.7 binaries shipped via npm) and:

- initialises the cluster in `.pgdata/` on first run with `--encoding=UTF8 --locale=C` (mandatory for Arabic);
- creates the `police_municipale` database if absent;
- listens on `127.0.0.1:5432` only;
- shuts down gracefully on `Ctrl+C` (SIGINT/SIGTERM).

Tuning applied at startup:

| Setting | Value |
|---|---|
| `shared_buffers` | 256 MB |
| `effective_cache_size` | 768 MB |
| `work_mem` | 16 MB |
| `maintenance_work_mem` | 64 MB |
| `random_page_cost` | 1.1 (SSD) |
| `max_connections` | 30 |
| `wal_compression` | on |
| `log_min_duration_statement` | 250 ms |

### 10.2 Schema

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Officers/accounts | `username` PK, `password_hash` (bcrypt, legacy `password` empty), `full_name`, `role` (`agent`/`chef`/`admin`), `badge_number`, `created_at` |
| `settings` | Single-row system/branding config | `id` (always 1), `app_name`, `app_subtitle`, `municipality_name`, `municipality_code`, `primary_hex`, `success_hex`, `destructive_hex`, `violation_types` JSONB, `action_types` JSONB, `updated_at` (trigger) |
| `violators` | Offender master records | `id` PK, `first_name`, `last_name`, `national_id` UNIQUE (8 digits), `phone`, `address`, `photo` (data URL), `created_at` |
| `violations` | Field reports | `id` PK, `reference` UNIQUE, `arabic_reference`, `serial`, `year`, `municipality_code/name`, `violator_id` FK CASCADE, `agent_username`, `agent_name`, `date`, `governorate`, `delegation`, `area`, `street`, `geo` JSONB, `violation_type`, `activity_type`, `goods_type`, `description`, `action`, `notes`, `review_status` CHECK, `reviewed_by`, `reviewed_at`, `has_vehicle`, vehicle fields, `photos_by_category` JSONB, `seizure` JSONB, `edits` JSONB, `created_at` |
| `sessions` | Server-side login sessions | `token_hash` CHAR(64) PK, `username` FK CASCADE, `created_at`, `expires_at`, `ip`, `user_agent` |
| `audit_log` | Append-only security trail | `id` BIGSERIAL, `at`, `actor`, `action`, `target`, `ip`, `user_agent`, `details` JSONB |

Indexes are built around the real queries:

- `idx_users_username_lower` — case-insensitive login lookup.
- `idx_violators_created_at` — newest offenders first.
- `idx_violations_date` — register ordered by date.
- `idx_violations_violator_date` — offender history.
- `idx_violations_date_municipality` — national summary range scans.
- `idx_violations_under_review` — partial index for the review queue.
- `idx_violations_municipality_date` — per-municipality statistics.
- `idx_sessions_username`, `idx_sessions_expires_at` — session cleanup/revocation.
- `idx_audit_log_at`, `idx_audit_log_actor` — audit browsing.

### 10.3 Least-privilege runtime role

At startup the API (as the schema owner) creates/refreshes a dedicated **`police_app`** login role:

- password: 32 random bytes, regenerated on every boot, never written to disk;
- grants: `CONNECT` on the database, `USAGE` on `public`, `SELECT/INSERT/UPDATE/DELETE` on tables, `USAGE/SELECT` on sequences;
- explicitly **denied**: DDL, `TRUNCATE`, `UPDATE/DELETE` on `audit_log`, `TRUNCATE` on all business tables, role escalation;
- the API then connects **as `police_app`**, so a hypothetical SQL-injection bug cannot alter or drop schema objects.

The owner pool is kept only for schema application, seeding, `ANALYZE` and demo reset.

### 10.4 Seed, reset, backups

- Schema + seed run automatically on API boot; seeding is skipped when users already exist.
- Passwords for seeded users are hashed at seed time (`bcrypt`, cost 12).
- Demo reset: **Settings → “Reset demo data”** or `POST /api/db/reset` (admin only, disabled in production by default). It truncates business tables, reseeds 17/5/3 and issues a fresh session for the initiating admin.
- Logical backup: `pg_dump "$DATABASE_URL" -Fc -f backup.dump`; restore with `pg_restore -d "$DATABASE_URL" backup.dump`.
- Raw cluster copy (local dev only): stop the DB, archive `.pgdata/`.

### 10.5 External / hosted PostgreSQL

Point `DATABASE_URL` at any PostgreSQL 13+ server. The API applies the schema, creates the restricted role if permitted (and falls back to the owner connection with a warning if it cannot), and continues to work. For managed providers requiring TLS, include `?sslmode=require`.

---

## 11. Authentication & Sessions

1. `GET /api/auth/csrf` sets a readable `pm_csrf` cookie and returns the token.
2. `POST /api/auth/login` (JSON `{username, password}`) verifies the bcrypt hash, applies lockout/throttling, deletes any previous session for that cookie, creates a new random 32-byte token, stores **SHA-256(token)** in `sessions`, and sets:
   - `pm_session` → `HttpOnly; SameSite=Strict; Secure` (when HTTPS/production); 8 h TTL
   - rotated `pm_csrf`
3. `GET /api/auth/me` restores the user on reload.
4. `POST /api/auth/logout` deletes the session row and clears the cookie.
5. `POST /api/auth/password` re-verifies the current password, enforces the policy, re-hashes, and revokes **all other** sessions.

Security properties:

- No token ever reaches JavaScript (httpOnly) and no token is stored in `localStorage`.
- Tokens are stored hashed: a database dump cannot be replayed as live sessions.
- Session rotation on login prevents session fixation.
- Unknown usernames still perform a bcrypt comparison to equalise response time (no account enumeration).
- Account lockout: 5 failures → 15 minutes (configurable), independent of IP-based limiting.
- Cookie names switch to `__Host-` prefixed variants when HTTPS is enabled.

---

## 12. Authorization Model

| Capability | Agent | Chef | Admin |
|---|:---:|:---:|:---:|
| Read violations, offenders, settings, reports | ✅ | ✅ | ✅ |
| Create offender / violation | ✅ | ✅ | ✅ |
| Edit a violation | own **unreviewed** only | ✅ | ✅ |
| Approve / reopen a violation | ❌ | ✅ | ✅ |
| List officers | ❌ | ✅ | ✅ |
| Create / update / delete officers | ❌ | ❌ | ✅ |
| Change system settings & branding | ❌ | ❌ | ✅ |
| View security audit trail | ❌ | ❌ | ✅ |
| Reset demo data / change database | ❌ | ❌ | ✅ |
| Change own password | ✅ | ✅ | ✅ |

Server-enforced invariants:

- `agent_username`, `agent_name`, `review_status`, `reviewed_by`, `reviewed_at` and `edits` are **taken from the session**, never trusted from the payload.
- Reviewer identity comes from the authenticated session.
- The last remaining `admin` cannot be deleted or demoted.
- An officer can no longer edit a report after it has been approved.

---

## 13. Security Controls

| Requirement | Implementation |
|---|---|
| **Authentication** | Server-side sessions (hashed tokens), httpOnly `SameSite=Strict` cookies, rotation, revocation, lockout. Replaced mock/local logins entirely. |
| **Password hashing** | bcrypt cost 12; legacy plaintext passwords migrated automatically at boot and erased; password policy (8+ chars, letters + digits) on create/change; no password ever returned by the API. |
| **Authorization** | `requireAuth` / `requireRole` guards on every route + ownership checks; UI guards mirror the API but are not relied upon. |
| **SQL injection prevention** | 100 % parameterised queries; no string-built SQL from user input; runtime DB role limited to DML; validated identifiers. |
| **Input validation** | Zod schemas for every body, param and query; unknown keys stripped; enums, lengths, numbers, dates, CIDs, hex colours, GPS ranges enforced. |
| **XSS protection** | React escaping + server-side sanitisation (control chars and `<`/`>` removed), strict CSP (no `unsafe-eval`), images restricted to `data:image/(png|jpeg|webp|gif);base64`, no SVG uploads, `nosniff`, `frame-ancestors 'none'`. |
| **CSRF protection** | Double-submit token (`pm_csrf` cookie + `X-CSRF-Token` header, timing-safe compare) on all unsafe methods, plus `SameSite=Strict`, `Origin`/`Sec-Fetch-Site` checks, and an origin allowlist. |
| **Rate limiting** | Global, login (failures only), writes and DB-admin limiters; account lockout; standard `RateLimit-*` headers. |
| **Security headers** | Helmet: CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, COOP/CORP, `X-Powered-By` removed, HSTS when TLS is on. |
| **HTTPS** | Native HTTPS server (`minVersion TLSv1.2`), `npm run cert:dev` for local certificates, optional 308 HTTP→HTTPS redirect, `Secure`/`__Host-` cookies, HSTS, production warning if plain HTTP. |
| **Database access control** | Dedicated `police_app` role (DML only), owner pool reserved for migrations, append-only audit table, no cross-database access, local listener bound to `127.0.0.1`. |
| **Audit logging** | `audit_log` records logins (success/failure), logouts, password changes, user CRUD, settings updates, violation create/edit/review, and DB administration, with actor/IP/User-Agent — no secrets. |
| **Additional hardening** | 12 MB body cap, JSON-only writes, `Cache-Control: no-store` on the API, central error handler that never leaks internals, admin-only bootstrap for the first DB connection, demo reset disabled in production, `.env` gitignored. |

---

## 14. API Reference

Base URL: `http://localhost:3001/api` (or `https://…/api`).

**Conventions**

- All requests/responses are JSON (`Content-Type: application/json`).
- Authenticated requests rely on the `pm_session` cookie.
- Every unsafe method (`POST`, `PUT`, `PATCH`, `DELETE`) requires `X-CSRF-Token` matching the `pm_csrf` cookie.
- Errors: `{ "error": "…" , "details"?: ["field: message"] }`.

### 14.1 Health & auth

| Method | Path | Access | Body | Response |
|---|---|---|---|---|
| `GET` | `/health` | public | — | `{status, isPostgresConnected, engine, timestamp}` (+ `currentDbUrl`, `error`, `dbAccessRole` for admins) |
| `GET` | `/auth/csrf` | public | — | `{csrfToken}` and sets `pm_csrf` |
| `POST` | `/auth/login` | public | `{username, password}` | `{user}` + session cookie |
| `GET` | `/auth/me` | authenticated | — | `{user}` |
| `POST` | `/auth/password` | authenticated | `{currentPassword, newPassword}` | `{success:true}` |
| `POST` | `/auth/logout` | authenticated | — | `{success:true}` |

`user` object: `{username, fullName, role, badgeNumber}`.

### 14.2 Users

| Method | Path | Access | Body |
|---|---|---|---|
| `GET` | `/users` | chef, admin | — |
| `POST` | `/users` | admin | `{username, password?, fullName, role, badgeNumber?}` |
| `DELETE` | `/users/:username` | admin | — |

- `password` is required for new accounts, optional for updates (omit to keep the current hash). Any password change revokes that user's sessions.
- Usernames: `^[a-zA-Z0-9._-]{3,32}$`, stored lowercase.
- Roles: `agent` | `chef` | `admin`.

### 14.3 Settings

| Method | Path | Access | Body |
|---|---|---|---|
| `GET` | `/settings` | authenticated | — |
| `PUT` | `/settings` | admin | `{appName, appSubtitle?, municipalityName, municipalityCode, primaryHex, successHex, destructiveHex, violationTypes[], actionTypes[]}` |

`agents` is returned read-only by `GET` and ignored on `PUT`.

### 14.4 Offenders

| Method | Path | Access | Body |
|---|---|---|---|
| `GET` | `/violators` | authenticated | — |
| `GET` | `/violators/:id` | authenticated | — |
| `POST` | `/violators` | authenticated | `{id?, firstName, lastName, nationalId, phone?, address?, photo?, createdAt?}` |

`nationalId` must be exactly 8 digits; `photo` must be an allowed raster data URL.

### 14.5 Violations

| Method | Path | Access | Notes |
|---|---|---|---|
| `GET` | `/violations` | authenticated | Newest first |
| `GET` | `/violations/:id` | authenticated | 404 if missing |
| `POST` | `/violations` | authenticated | Identity/review fields forced from session |
| `PUT` | `/violations/:id` | agent (own, unreviewed), chef, admin | Appends an edit-log entry |
| `PATCH` | `/violations/:id/review` | chef, admin | `{status: "reviewed" \| "under_review", reason?}` |

Create body:

```json
{
  "id": "violation-…", "reference": "2026-SIDI-0001", "arabicReference": "محضر …",
  "serial": 1, "year": 2026,
  "municipalityCode": "SIDI", "municipalityName": "سيدي بوعلي",
  "violatorId": "violator-1", "date": "2026-11-22T09:00:00.000Z",
  "governorate": "سوسة", "delegation": "سيدي بوعلي", "area": "وسط المدينة",
  "street": "شارع الحبيب بورقيبة", "geo": {"lat": 35.97, "lng": 10.48},
  "violationType": "استغلال الرصيف", "activityType": "تجارة", "goodsType": "خضر",
  "description": "…", "action": "تنبيه كتابي", "notes": "…",
  "hasVehicle": false, "vehicleType": "", "vehiclePlate": "", "vehicleColor": "",
  "photosByCategory": {"violation": [], "goods": [], "vehicle": [], "documents": [], "place": []},
  "seizure": {"has": false}
}
```

Update body: any subset of `{governorate, delegation, area, street, geo, violationType, activityType, goodsType, description, action, notes, hasVehicle, vehicleType, vehiclePlate, vehicleColor, photosByCategory, seizure, reason}`. `reviewStatus`, `reviewedBy`, `reviewedAt`, `edits`, `agentUsername` and `agentName` are never accepted from clients.

### 14.6 Reports

| Method | Path | Access | Query |
|---|---|---|---|
| `GET` | `/reports/national-summary` | authenticated | `timeframe=weekly\|monthly` (default weekly) |

Returns totals, review percentage, seizure counts and a per-municipality breakdown covering all Tunisian municipalities.

### 14.7 Administration

| Method | Path | Access | Limits |
|---|---|---|---|
| `GET` | `/admin/audit` | admin | `limit` ≤ 200, `offset` |
| `POST` | `/db/test` | admin (or loopback bootstrap when DB is down) | 10/hour |
| `POST` | `/db/connect` | admin (or loopback bootstrap) | 10/hour, blocked in production by default |
| `POST` | `/db/reset` | admin | dev only by default |

---

## 15. Error Codes

| Status | When | Example body |
|---|---|---|
| `400` | Validation failure, malformed JSON, bad reference | `{"error":"بيانات غير صالحة أو ناقصة","details":["nationalId: …"]}` |
| `401` | Missing/expired/forged session, wrong password | `{"error":"يجب تسجيل الدخول للوصول إلى هذه البيانات"}` |
| `403` | Role denial, CSRF failure, disallowed origin | `{"error":"لا تملك الصلاحية الكافية لتنفيذ هذا الإجراء"}` |
| `404` | Unknown resource or route | `{"error":"المحضر غير موجود"}` |
| `409` | Unique constraint (duplicate national ID/reference) | `{"error":"هذه البيانات موجودة مسبقاً"}` |
| `413` | Body over 12 MB | `{"error":"حجم الطلب كبير جداً …"}` |
| `415` | Non-JSON body on a write | `{"error":"نوع المحتوى يجب أن يكون application/json"}` |
| `429` | Rate limit or account lockout | `{"error":"محاولات دخول كثيرة …"}` |
| `500` | Unexpected server error (details logged only) | `{"error":"حدث خطأ غير متوقع في الخادم"}` |
| `503` | Database unavailable (fail-closed) | `{"error":"قاعدة البيانات غير متوفرة …"}` |
| `504` | Query exceeded 10 s | `{"error":"استغرق الطلب وقتاً أطول من المسموح"}` |

---

## 16. Frontend Architecture

- **Routing**: `App.tsx` wraps everything in `AuthProvider`; `ProtectedRoute` waits for the session check (spinner) before deciding, and enforces `allowedRoles` for `EditViolation` and `Settings`.
- **Auth**: `AuthContext` exposes `{user, isAuthenticated, isLoading, login, logout, hasRole}`; nothing sensitive is persisted client-side.
- **API client**: `src/lib/api.ts` adds the CSRF header automatically, sends cookies (`credentials: 'include'`), retries once with a fresh token when the CSRF cookie rotated, and throws typed `ApiError`s with the Arabic server message.
- **Store**: `src/lib/store.ts` keeps the existing synchronous selectors used by pages (`getViolations`, `getViolatorsWithStats`, `getNationalMunicipalitySummary`, …) over a local cache that is hydrated from and written through to the API.
- **Styling**: Tailwind with dynamic CSS variables derived from the database (`primaryHex`, `successHex`, `destructiveHex`); RTL layout, mobile-first with safe-area handling and 44 px touch targets.
- **PWA/print**: standalone manifest plus print-optimised report/detail views (`no-print` utilities).

---

## 17. Verification & Test Evidence

All checks below were executed against the real PostgreSQL instance and the running API.

### 17.1 Static checks

```bash
npm run typecheck     # app project + server project → exit 0
npm run lint          # 0 errors / 19 advisory warnings (hook dependency hints, fast-refresh)
npm run build         # dist/index.html + assets produced
```

### 17.2 Test harness (cookie + CSRF)

```bash
BASE=http://localhost:3001/api
JAR=./cookies.txt

# 1) Obtain a CSRF token (sets pm_csrf)
curl -s -c $JAR -b $JAR $BASE/auth/csrf -o /dev/null
CSRF=$(awk '$6=="pm_csrf"{print $7}' $JAR)

# 2) Log in (sets pm_session and rotates pm_csrf)
curl -s -c $JAR -b $JAR \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d '{"username":"admin","password":"admin"}' $BASE/auth/login

# 3) Re-read the rotated token before any write
CSRF=$(awk '$6=="pm_csrf"{print $7}' $JAR)
```

### 17.3 Cases and observed results

| # | Test | Input | Result |
|---|---|---|---|
| 1 | Security headers | `curl -D - $BASE/health` | CSP (incl. fonts/map origins), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `RateLimit-Policy: "600-in-15min"`, no `X-Powered-By` |
| 2 | Public health | `GET /api/health` | `{"status":"ok","isPostgresConnected":true,"engine":"PostgreSQL Server",…}` — **no** connection string leaked |
| 3 | Unauthenticated data | `GET /api/{violations,violators,settings,users}` | `401` on all four |
| 4 | Login without CSRF | `POST /auth/login` | `403` `"رمز الحماية من CSRF مفقود…"` |
| 5 | Non-JSON write | `Content-Type: text/plain` | `415` `"نوع المحتوى يجب أن يكون application/json"` |
| 6 | Successful login | `{"username":"admin","password":"admin"}` | `200`; `Set-Cookie: pm_session=…; Max-Age=28800; HttpOnly; SameSite=Strict`; over HTTPS also `Secure` and `__Host-` prefix |
| 7 | Session restore | `GET /auth/me` with cookie | `200` `{"user":{…"role":"admin"}}` |
| 8 | Authenticated reads | `GET /{violations,violators,settings,users}` | `200` ×4 |
| 9 | Cross-site origin | `Origin: https://evil.example` on `POST` | `403` `"مصدر الطلب غير مسموح به"` |
| 10 | Agent role | `PATCH /violations/violation-4/review` | `403` |
| 11 | Agent self-edit | `PUT /violations/violation-4` (own, unreviewed) | `200` |
| 12 | Agent edit reviewed | `PUT /violations/violation-5` (approved) | `403` |
| 13 | Agent admin API | `PUT /settings`, `POST /users`, `POST /db/reset` | `403` ×3 |
| 14 | Chef review | `PATCH /violations/violation-4/review {"status":"reviewed"}` | `200` `{"reviewedBy":"الملازم أول طارق العبيدي"}` |
| 15 | Chef user creation | `POST /users` | `403` |
| 16 | Invalid CIN | `{"firstName":"أحمد","lastName":"بن علي","nationalId":"12AB"}` | `400` `nationalId: رقم البطاقة الوطنية يجب أن يتكون من 8 أرقام` |
| 17 | Missing fields | `{"username":"ab"}` | `400` with details for `username`, `fullName`, `role` |
| 18 | Weak password | `{"username":"newagent","password":"short","fullName":"عون جديد","role":"agent"}` | `400` `password: Too small…` |
| 19 | Bad colour | settings payload with `"primaryHex":"red"` | `400` `primaryHex: اللون يجب أن يكون بصيغة #RRGGBB` |
| 20 | Stored XSS | `{"username":"xtest","password":"Str0ngPass1","fullName":"<img src=x onerror=alert(1)>اختبار","role":"agent","badgeNumber":"<script>x</script>"}` | `200`; stored as `img src=x onerror=alert(1)اختبار` / `scriptx/script` (tags neutralised), then account deleted |
| 21 | SQL injection (login) | `{"username":"' OR 1=1--","password":"x"}` | `401` (parameterised query) |
| 22 | Forged session | `Cookie: pm_session=forged-token-value-for-testing` | `401` |
| 23 | Account lockout | 5 × wrong password for `ghost_user` | attempts 1–5 `401`, then `429` |
| 24 | Logout revocation | `POST /auth/logout` then `GET /violations` | `200` then `401` |
| 25 | Settings round-trip | `PUT /settings` with the current document | `200` |
| 26 | Demo reset | `POST /db/reset` | `200`; 17 violations / 5 offenders / 3 users restored; initiating admin keeps a fresh session |
| 27 | Malformed JSON | `{"bad json` | `400` `"صيغة JSON غير صالحة"` |
| 28 | Audit RBAC | `GET /admin/audit` as admin / agent | `200` / `403` |
| 29 | Password change | wrong current → `401`; `abcdefgh` → `400` (no digits); `OldPass123 → NewPass456` → `200` | old password then `401`, new password `200`, current session stays valid |
| 30 | Identity spoofing | create payload with `"agentUsername":"spoofed-user"`, `"agentName":"اسم مزور"`, `"reviewStatus":"reviewed"`, `"reviewedBy":"مزور"` | stored as `agent` / `العون أحمد المنصوري`, status `under_review`, reviewer `null` |
| 31 | Edit audit trail | `PUT /violations/:id` with `{"notes":"…","reason":"تصحيح ملاحظات"}` | `200`; `edits` gains `{username:"agent", reason:"تصحيح ملاحظات"}` |
| 32 | CORS | allowed origin vs `https://evil.example` | `Access-Control-Allow-Origin: http://localhost:5173` + credentials; none for the evil origin |
| 33 | Production SPA hosting | `NODE_ENV=production HTTPS_ENABLED=true npm start` | `/` `200 text/html`, `/settings` `200` (SPA fallback), `/assets/*.js` `200`, `/api/health` JSON, `/api/does-not-exist` `404` |

### 17.4 Database privilege checks

```js
// run while the API is up (owner credentials)
import pg from 'pg';
const c = new pg.Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:5432/police_municipale' });
await c.connect();
const asRole = async (sql) => {
  await c.query('BEGIN');
  try { await c.query('SET LOCAL ROLE police_app'); await c.query(sql); await c.query('ROLLBACK'); return 'ALLOWED'; }
  catch (e) { await c.query('ROLLBACK').catch(() => {}); return `blocked (${e.code})`; }
};
console.log(await asRole('SELECT count(*) FROM violations'));  // ALLOWED
console.log(await asRole('CREATE TABLE probe(x int)'));        // blocked (42501)
console.log(await asRole('TRUNCATE violations'));              // blocked (42501)
console.log(await asRole('DELETE FROM audit_log'));            // blocked (42501)
await c.end();
```

Observed:

```
users:    [{ username:'admin', pw_null:true, algo:'$2b$12$', len:60 }, …]
sessions: [{ rows:3, hash_len:64, live:true }]
API connections (pg_stat_activity): usename=police_app ×2, postgres ×1 (maintenance pool)
```

All `audit_log.details` values inspected for password material: none (only booleans such as `passwordChanged: true`).

### 17.5 HTTPS verification

```bash
npm run cert:dev
HTTPS_ENABLED=true npm run server
curl -sk https://localhost:3001/api/health
curl -sk -D - -o /dev/null https://localhost:3001/api/health | grep -i strict-transport
```

Observed: `200 OK`, `Strict-Transport-Security: max-age=15552000; includeSubDomains`, and after login:

```
Set-Cookie: __Host-pm_session=…; Max-Age=28800; Path=/; HttpOnly; Secure; SameSite=Strict
Set-Cookie: __Host-pm_csrf=…;    Max-Age=28800; Path=/; Secure; SameSite=Strict
```

---

## 18. Performance Measurements

Local embedded PostgreSQL, seeded data (17 violations), warm pool, single request each (`curl -w '%{time_total}'`):

| Endpoint | Time |
|---|---|
| `GET /api/users` | 3.7 ms |
| `GET /api/violators` | 7.4 ms |
| `GET /api/violations` | 14.3 ms |
| `GET /api/reports/national-summary?timeframe=monthly` | 20.3 ms |
| `GET /api/settings` (first request after start) | 78 ms |

20-request loop on `GET /api/violations`: **min 3 ms, median 4 ms, max 8 ms, average 4 ms**.

Contributing choices: warm pooled connections (`min: 2`, keep-alive), `Promise.all` for independent settings queries, one-transaction bulk seeding, statement/query timeouts of 10 s, tuned planner settings and indexes matched to real queries. At 17 rows the planner correctly prefers sequential scans; index benefits appear as the dataset grows.

---

## 19. Deployment & Release Checklist

### Environment

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` points to a managed/HA PostgreSQL with backups; TLS (`sslmode=require`) where offered.
- [ ] `HTTPS_ENABLED=true` with `HTTPS_KEY_PATH` / `HTTPS_CERT_PATH` (real CA certificate), **or** terminate TLS at a reverse proxy and set `TRUST_PROXY=true`.
- [ ] `ALLOWED_ORIGINS` set to the exact public origin(s), e.g. `https://police.example.tn`.
- [ ] `ALLOW_DEMO_RESET=false`, `ALLOW_DB_RECONNECT=false`.
- [ ] Change or remove the demo accounts and their weak passwords.
- [ ] Firewall: expose only 443; PostgreSQL must never be publicly reachable.
- [ ] Backups scheduled (nightly `pg_dump` + retention); restore rehearsed.

### Build & run

```bash
npm ci
npm run typecheck
npm run build
NODE_ENV=production HTTPS_ENABLED=true npm start
```

With `NODE_ENV=production` the same process serves the built SPA from `dist/`, applies CSP/HSTS, and exposes `/api` — a single origin, so cookies and CSRF work without cross-site exceptions.

### Process supervision

Run under systemd, pm2 or a container with restart policies. The server handles `SIGINT`/`SIGTERM` by closing HTTP connections and draining the PostgreSQL pools.

### Scaling notes

- Rate-limit counters and account lockouts are **in-process**; with multiple instances, move them to Redis (or a shared store) and/or enable sticky sessions.
- Sessions are in PostgreSQL, so they survive restarts and work across instances.
- Serve photos from object storage before large-scale use (see limitations).

---

## 20. Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| `EADDRINUSE :::3001` | Another API instance is running: `netstat -ano \| grep :3001` then stop that PID. |
| `lock file "postmaster.pid" already exists` | A previous cluster was killed hard. Confirm nothing listens on 5432, delete `.pgdata/postmaster.pid`, rerun `npm run db`. |
| API logs `تعذر الاتصال بـ PostgreSQL` | Start `npm run db` first, or fix `DATABASE_URL`. The API is fail-closed: it keeps running but returns `503` for data routes. |
| Login returns `503` | No database connection (by design). |
| Login returns `429` | Account locked after 5 failures or IP rate limit; wait 15 minutes or adjust `LOGIN_MAX_FAILURES`. |
| Writes return `403` CSRF | The CSRF cookie rotated (login/logout/restart). Reload the page; the client retries automatically once. |
| Arabic stored as `????` | Client sent the payload through a non-UTF-8 shell. Send JSON from a UTF-8 file (`curl --data-binary @file.json`). |
| Browsers warn about the certificate | Expected for the self-signed `npm run cert:dev` certificate; use a trusted certificate in production. |
| `npm warn install-scripts` for esbuild/embedded-postgres | npm's script approval is conservative. Installs still work here: platform packages provide the binaries and the embedded cluster rehydrates its symlinks at runtime. |
| `dist/index.html` missing in production | Run `npm run build` before `npm start`. |

---

## 21. Known Limitations

- **No automated test suite** — verification is scripted/manual (documented above), not wired into CI.
- **Rate limiting and lockout are per process** (memory); use a shared store for multi-instance deployments.
- **Photos are stored as base64 inside PostgreSQL** — convenient for a field demo, but it bloats rows and backups; move to object storage for scale.
- **No pagination** on `/violations`, `/violators` or `/audit` (audit is capped at 200 per page). Large datasets will increase payload size.
- **No password reset by email / MFA**; account recovery is an admin action.
- **Sessions are fixed-lifetime** (8 h) with no refresh-token rotation.
- **`embedded-postgres` is a development convenience** (beta wrapper around stable PostgreSQL binaries), not a production database server.
- **Single-municipality tenancy**: the settings row defines one municipality; per-municipality data isolation is not implemented.
- **`bcryptjs` is pure JavaScript** — roughly an order of magnitude slower than native bcrypt (~200–300 ms per login by design cost).
- **CSP intentionally allows** Google Fonts (Cairo) and OpenStreetMap/Google Maps embed origins; everything else is `'self'`.
- **Offline mode is read-only from cache**; writes require connectivity and surface a banner otherwise.

---

## 22. Roadmap

1. Automated API/integration tests (Vitest + Supertest) and CI pipeline.
2. Pagination, server-side search and filtered registers.
3. Object storage for photos with signed URLs.
4. Redis-backed rate limits/lockouts and horizontal scaling.
5. Per-municipality tenancy and governorate-level dashboards.
6. Optional MFA and password-reset flow.
7. Native mobile client (React Native/Expo) reusing the same API.

---

*Built for the Tunisian municipal police field-inspection hackathon; Arabic-first UI, English documentation.*
