/**
 * src/lib/api.ts
 * Authenticated API client: sends the httpOnly session cookie and the CSRF
 * header required by the backend, and surfaces typed errors.
 */

import type { User, Violator, Violation, Settings, ReviewStatus } from '../types';

const BASE = '/api';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** CSRF token is kept in memory only; it is re-fetched after a reload. */
let csrfToken: string | null = null;

async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const res = await fetch(`${BASE}/auth/csrf`, { credentials: 'include' });
  if (!res.ok) throw new ApiError('تعذر تهيئة الحماية الأمنية للطلب', res.status);
  const data = (await res.json()) as { csrfToken: string };
  csrfToken = data.csrfToken;
  return csrfToken;
}

async function fetchJson<T>(path: string, options: RequestInit = {}, allowRetry = true): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (UNSAFE_METHODS.has(method)) {
    headers.set('X-CSRF-Token', await ensureCsrfToken());
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include', // session cookie never touches JavaScript
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    const message = body.error || body.message || `HTTP ${res.status}`;

    // The CSRF cookie rotates on login/logout: refresh the token and retry once.
    if (res.status === 403 && allowRetry && UNSAFE_METHODS.has(method) && /CSRF/i.test(message)) {
      csrfToken = null;
      await ensureCsrfToken();
      return fetchJson<T>(path, options, false);
    }
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

// ==================== HEALTH ====================

export interface HealthStatus {
  status: string;
  isPostgresConnected: boolean;
  engine: string;
  timestamp: string;
  currentDbUrl?: string;
  dbAccessRole?: string | null;
  error?: string | null;
}

export async function apiGetHealth(): Promise<HealthStatus> {
  return fetchJson<HealthStatus>('/health');
}

export async function apiTestDbConnection(databaseUrl: string): Promise<{ success: boolean; message: string }> {
  return fetchJson('/db/test', { method: 'POST', body: JSON.stringify({ databaseUrl }) });
}

export async function apiConnectDb(
  databaseUrl: string
): Promise<{ success: boolean; message: string; isPostgresConnected?: boolean }> {
  return fetchJson('/db/connect', { method: 'POST', body: JSON.stringify({ databaseUrl }) });
}

// ==================== AUTH ====================

export async function apiLogin(username: string, password: string): Promise<{ user: User }> {
  const result = await fetchJson<{ user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  csrfToken = null; // the server rotates the token on login
  return result;
}

export async function apiGetMe(): Promise<{ user: User }> {
  return fetchJson<{ user: User }>('/auth/me');
}

export async function apiLogout(): Promise<{ success: boolean }> {
  const result = await fetchJson<{ success: boolean }>('/auth/logout', { method: 'POST' });
  csrfToken = null;
  return result;
}

// ==================== USERS ====================

export async function apiGetUsers(): Promise<User[]> {
  return fetchJson<User[]>('/users');
}

export async function apiSaveUser(user: User): Promise<{ success: boolean; user: User }> {
  return fetchJson('/users', { method: 'POST', body: JSON.stringify(user) });
}

export async function apiDeleteUser(username: string): Promise<{ success: boolean }> {
  return fetchJson(`/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
}

// ==================== SETTINGS ====================

export async function apiGetSettings(): Promise<Settings> {
  return fetchJson<Settings>('/settings');
}

export async function apiSaveSettings(settings: Settings): Promise<{ success: boolean; settings: Settings }> {
  return fetchJson('/settings', { method: 'PUT', body: JSON.stringify(settings) });
}

// ==================== VIOLATORS ====================

export async function apiGetViolators(): Promise<Violator[]> {
  return fetchJson<Violator[]>('/violators');
}

export async function apiGetViolator(id: string): Promise<Violator> {
  return fetchJson<Violator>(`/violators/${encodeURIComponent(id)}`);
}

export async function apiSaveViolator(violator: Violator): Promise<{ success: boolean; violator: Violator }> {
  return fetchJson('/violators', { method: 'POST', body: JSON.stringify(violator) });
}

// ==================== VIOLATIONS ====================

export async function apiGetViolations(): Promise<Violation[]> {
  return fetchJson<Violation[]>('/violations');
}

export async function apiGetViolation(id: string): Promise<Violation> {
  return fetchJson<Violation>(`/violations/${encodeURIComponent(id)}`);
}

export async function apiCreateViolation(violation: Violation): Promise<{ success: boolean; violation: Violation }> {
  return fetchJson('/violations', { method: 'POST', body: JSON.stringify(violation) });
}

export async function apiUpdateViolation(id: string, updates: Partial<Violation>): Promise<{ success: boolean }> {
  return fetchJson(`/violations/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function apiSetViolationReviewStatus(
  id: string,
  status: ReviewStatus,
  reason?: string
): Promise<{ success: boolean; status: ReviewStatus; reviewedBy: string | null; reviewedAt: string | null }> {
  // The reviewer identity is taken from the session on the server.
  return fetchJson(`/violations/${encodeURIComponent(id)}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  });
}

// ==================== REPORTS ====================

export interface NationalSummaryApiResult {
  timeframe: 'weekly' | 'monthly';
  timeframeLabel: string;
  totalViolations: number;
  totalUnderReview: number;
  totalReviewed: number;
  reviewPercentage: number;
  activeMunicipalitiesCount: number;
  summaries: Array<{
    municipalityCode: string;
    municipalityName: string;
    governorate: string;
    totalViolations: number;
    underReviewCount: number;
    reviewedCount: number;
    reviewPercentage: number;
    seizuresCount: number;
  }>;
}

export async function apiGetNationalSummary(timeframe: 'weekly' | 'monthly'): Promise<NationalSummaryApiResult> {
  return fetchJson<NationalSummaryApiResult>(`/reports/national-summary?timeframe=${timeframe}`);
}

// ==================== DATA MANAGEMENT ====================

export async function apiResetDemoData(): Promise<{ success: boolean; message: string }> {
  return fetchJson('/db/reset', { method: 'POST' });
}
