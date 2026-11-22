import { User, Violator, Violation, Settings, ViolatorWithStats, ReviewStatus, MunicipalitySummary } from '../types';
import { INITIAL_USERS, INITIAL_SETTINGS, INITIAL_VIOLATORS, INITIAL_VIOLATIONS, ALL_TUNISIAN_MUNICIPALITIES } from './seedData';
import { generateArabicReference } from './arabicNumbers';

const STORAGE_KEYS = {
  USERS: 'police_municipal_users',
  SETTINGS: 'police_municipal_settings',
  VIOLATORS: 'police_municipal_violators',
  VIOLATIONS: 'police_municipal_violations',
};

/** Passwords are never persisted in the browser — only the server stores hashes. */
function sanitizeUsers(users: User[]): User[] {
  return users.map((u) => ({
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    badgeNumber: u.badgeNumber,
  }));
}

// Simple event emitter for reactive store updates
type StoreListener = () => void;
const listeners: Set<StoreListener> = new Set();

export function subscribeToStore(listener: StoreListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch (e) {
      console.error('Error notifying store listener:', e);
    }
  });
}

/**
 * Initialize seed data if not present in localStorage
 */
export function initializeStore(): void {
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(sanitizeUsers(INITIAL_USERS)));
  } else {
    // Drop plaintext passwords left by older versions of the app.
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USERS);
      if (raw && raw.includes('"password"')) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(sanitizeUsers(JSON.parse(raw))));
      }
    } catch {
      localStorage.removeItem(STORAGE_KEYS.USERS);
    }
  }
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.VIOLATORS)) {
    localStorage.setItem(STORAGE_KEYS.VIOLATORS, JSON.stringify(INITIAL_VIOLATORS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.VIOLATIONS)) {
    localStorage.setItem(STORAGE_KEYS.VIOLATIONS, JSON.stringify(INITIAL_VIOLATIONS));
  } else {
    // If violations already exist in storage but lack reviewStatus, backfill it seamlessly
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.VIOLATIONS);
      if (raw) {
        const list: Violation[] = JSON.parse(raw);
        let changed = false;
        // If older storage doesn't have reviewStatus or nationwide seed, ensure seamless data
        if (list.length < INITIAL_VIOLATIONS.length || list.some((v) => !v.reviewStatus)) {
          // Merge or refresh with initial violations while preserving any user-added violations
          const userAdded = list.filter((v) => !INITIAL_VIOLATIONS.some((iv) => iv.id === v.id));
          const updated = [...userAdded, ...INITIAL_VIOLATIONS];
          localStorage.setItem(STORAGE_KEYS.VIOLATIONS, JSON.stringify(updated));
          changed = true;
        }
        if (changed) notifyListeners();
      }
    } catch (e) {
      console.warn('Backfill check warning:', e);
    }
  }

  // Apply colors dynamically
  applyThemeColors(getSettings());
}

/**
 * Injects user-customized colors into document root CSS variables
 */
export function applyThemeColors(settings: Settings): void {
  const root = document.documentElement;
  if (settings.primaryHex) {
    root.style.setProperty('--primary-color', settings.primaryHex);
    root.style.setProperty('--primary-hover', adjustBrightness(settings.primaryHex, -20));
    root.style.setProperty('--primary-light', adjustBrightness(settings.primaryHex, 35));
  }
  if (settings.successHex) {
    root.style.setProperty('--success-color', settings.successHex);
    root.style.setProperty('--success-hover', adjustBrightness(settings.successHex, -20));
  }
  if (settings.destructiveHex) {
    root.style.setProperty('--destructive-color', settings.destructiveHex);
    root.style.setProperty('--destructive-hover', adjustBrightness(settings.destructiveHex, -20));
  }
}

function adjustBrightness(hex: string, percent: number): string {
  let num = parseInt(hex.replace('#', ''), 16);
  if (isNaN(num)) return hex;
  let r = (num >> 16) + Math.round((255 * percent) / 100);
  let g = ((num >> 8) & 0x00ff) + Math.round((255 * percent) / 100);
  let b = (num & 0x0000ff) + Math.round((255 * percent) / 100);

  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// ==================== USERS (read-only cache) ====================
// Authentication lives on the server (see AuthContext); the browser only keeps
// a password-free directory used to render agent lists.

export function getUsers(): User[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    return raw ? sanitizeUsers(JSON.parse(raw)) : sanitizeUsers(INITIAL_USERS);
  } catch {
    return sanitizeUsers(INITIAL_USERS);
  }
}

export function setUsersCache(users: User[]): void {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(sanitizeUsers(users)));
  notifyListeners();
}

// ==================== SETTINGS ====================

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return raw ? JSON.parse(raw) : INITIAL_SETTINGS;
  } catch {
    return INITIAL_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  applyThemeColors(settings);
  notifyListeners();
}

// ==================== VIOLATORS ====================

export function getViolators(): Violator[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VIOLATORS);
    return raw ? JSON.parse(raw) : INITIAL_VIOLATORS;
  } catch {
    return INITIAL_VIOLATORS;
  }
}

export function getViolatorById(id: string): Violator | null {
  const list = getViolators();
  return list.find((v) => v.id === id) || null;
}

export function getViolatorByNationalId(cin: string): Violator | null {
  const cleanCin = cin.trim();
  if (!cleanCin) return null;
  const list = getViolators();
  return list.find((v) => v.nationalId === cleanCin) || null;
}

export function saveViolator(violator: Violator): Violator {
  const list = getViolators();
  const index = list.findIndex((v) => v.id === violator.id);
  let saved: Violator;
  if (index >= 0) {
    saved = { ...list[index], ...violator };
    list[index] = saved;
  } else {
    saved = {
      ...violator,
      id: violator.id || `violator-${Date.now()}`,
      createdAt: violator.createdAt || new Date().toISOString(),
    };
    list.unshift(saved);
  }
  localStorage.setItem(STORAGE_KEYS.VIOLATORS, JSON.stringify(list));
  notifyListeners();
  return saved;
}

export function getViolatorWithStats(id: string): ViolatorWithStats | null {
  const violator = getViolatorById(id);
  if (!violator) return null;

  const violations = getViolationsByViolatorId(id);
  const totalCount = violations.length;
  const warnings = violations.filter(
    (v) => v.action.includes('تنبيه') || v.action.includes('شفوي') || v.action.includes('كتابي')
  ).length;
  const seizures = violations.filter((v) => v.seizure && v.seizure.has).length;

  const latest = violations[0];

  return {
    ...violator,
    violationCount: totalCount,
    warningCount: warnings,
    seizureCount: seizures,
    isRepeatOffender: totalCount >= 3,
    lastViolationDate: latest ? latest.date : undefined,
    lastViolationPlace: latest ? `${latest.street}، ${latest.area}` : undefined,
    lastAction: latest ? latest.action : undefined,
  };
}

export function getAllViolatorsWithStats(): ViolatorWithStats[] {
  const violators = getViolators();
  return violators.map((v) => getViolatorWithStats(v.id)!);
}

// ==================== VIOLATIONS ====================

export function getViolations(): Violation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VIOLATIONS);
    const list: Violation[] = raw ? JSON.parse(raw) : INITIAL_VIOLATIONS;
    // Sort newest first
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return INITIAL_VIOLATIONS;
  }
}

export function getViolationById(id: string): Violation | null {
  const list = getViolations();
  return list.find((v) => v.id === id) || null;
}

export function getViolationsByViolatorId(violatorId: string): Violation[] {
  const list = getViolations();
  return list
    .filter((v) => v.violatorId === violatorId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getNextSerial(year: number): number {
  const list = getViolations();
  const thisYear = list.filter((v) => v.year === year);
  if (thisYear.length === 0) return 1;
  const maxSerial = Math.max(...thisYear.map((v) => v.serial || 0));
  return maxSerial + 1;
}

export function createViolation(
  data: Omit<Violation, 'id' | 'reference' | 'arabicReference' | 'serial' | 'year' | 'municipalityCode' | 'edits' | 'reviewStatus'> & {
    reviewStatus?: ReviewStatus;
  }
): Violation {
  const settings = getSettings();
  const year = new Date(data.date || new Date()).getFullYear();
  const serial = getNextSerial(year);
  const paddedSerial = String(serial).padStart(4, '0');
  const code = (settings.municipalityCode || 'MUN').toUpperCase();
  const reference = `${year}-${code}-${paddedSerial}`;
  const arabicReference = generateArabicReference(year, settings.municipalityName, serial);

  const newViolation: Violation = {
    ...data,
    id: `violation-${Date.now()}`,
    reference,
    arabicReference,
    serial,
    year,
    municipalityCode: code,
    municipalityName: settings.municipalityName,
    reviewStatus: data.reviewStatus || 'under_review',
    edits: [],
  };

  const list = getViolations();
  list.unshift(newViolation);
  localStorage.setItem(STORAGE_KEYS.VIOLATIONS, JSON.stringify(list));
  notifyListeners();
  return newViolation;
}

export function updateViolation(
  id: string,
  updates: Partial<Violation>,
  editReason: string,
  editor: User
): Violation {
  const list = getViolations();
  const index = list.findIndex((v) => v.id === id);
  if (index < 0) {
    throw new Error('Violation not found');
  }

  const existing = list[index];

  // Detect which fields changed
  const changedFields: string[] = [];
  const editableKeys: (keyof Violation)[] = [
    'governorate',
    'delegation',
    'area',
    'street',
    'geo',
    'violationType',
    'activityType',
    'goodsType',
    'description',
    'action',
    'notes',
    'hasVehicle',
    'vehicleType',
    'vehiclePlate',
    'vehicleColor',
    'photosByCategory',
    'seizure',
    'reviewStatus',
  ];

  editableKeys.forEach((key) => {
    if (key in updates) {
      if (JSON.stringify(existing[key]) !== JSON.stringify(updates[key])) {
        changedFields.push(key);
      }
    }
  });

  const editLogEntry = {
    date: new Date().toISOString(),
    username: editor.username,
    fullName: editor.fullName,
    reason: editReason.trim(),
    fields: changedFields,
  };

  const updatedViolation: Violation = {
    ...existing,
    ...updates,
    id: existing.id,
    reference: existing.reference,
    arabicReference: existing.arabicReference,
    serial: existing.serial,
    year: existing.year,
    municipalityCode: existing.municipalityCode,
    municipalityName: existing.municipalityName || existing.delegation,
    violatorId: existing.violatorId,
    edits: [editLogEntry, ...(existing.edits || [])],
  };

  list[index] = updatedViolation;
  localStorage.setItem(STORAGE_KEYS.VIOLATIONS, JSON.stringify(list));
  notifyListeners();
  return updatedViolation;
}

/**
 * Toggles or updates the review status of a violation (under_review <-> reviewed)
 */
export function setViolationReviewStatus(
  id: string,
  status: ReviewStatus,
  reviewer: User
): Violation {
  const list = getViolations();
  const index = list.findIndex((v) => v.id === id);
  if (index < 0) throw new Error('Violation not found');

  const existing = list[index];
  const isApproving = status === 'reviewed';

  const editLogEntry = {
    date: new Date().toISOString(),
    username: reviewer.username,
    fullName: reviewer.fullName,
    reason: isApproving
      ? 'اعتماد ومصادقة محضر المعاينة الميدانية بعد التدقيق'
      : 'إعادة المحضر إلى وضعية قيد التدقيق والمراجعة',
    fields: ['reviewStatus'],
  };

  const updated: Violation = {
    ...existing,
    reviewStatus: status,
    reviewedBy: isApproving ? reviewer.fullName : undefined,
    reviewedAt: isApproving ? new Date().toISOString() : undefined,
    edits: [editLogEntry, ...(existing.edits || [])],
  };

  list[index] = updated;
  localStorage.setItem(STORAGE_KEYS.VIOLATIONS, JSON.stringify(list));
  notifyListeners();
  return updated;
}

// ==================== NATIONAL MUNICIPALITIES SUMMARY ====================

export interface NationalSummaryResult {
  timeframe: 'weekly' | 'monthly';
  timeframeLabel: string;
  totalViolations: number;
  totalUnderReview: number;
  totalReviewed: number;
  reviewPercentage: number;
  totalSeizures: number;
  activeMunicipalitiesCount: number;
  summaries: MunicipalitySummary[];
}

export function getNationalMunicipalitySummary(timeframe: 'weekly' | 'monthly'): NationalSummaryResult {
  const allViolations = getViolations();
  const now = Date.now();
  const cutoffMs = timeframe === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  const cutoffDate = now - cutoffMs;

  // Filter violations within selected timeframe
  const filteredViolations = allViolations.filter((v) => {
    const time = new Date(v.date).getTime();
    return !isNaN(time) && time >= cutoffDate;
  });

  // Map to collect data for all municipalities in the country
  const map: Map<string, MunicipalitySummary> = new Map();

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

  filteredViolations.forEach((v) => {
    const code = (v.municipalityCode || 'MUN').toUpperCase();
    let entry = map.get(code);
    if (!entry) {
      entry = {
        municipalityCode: code,
        municipalityName: v.municipalityName || v.delegation || code,
        governorate: v.governorate || 'غير محدد',
        totalViolations: 0,
        underReviewCount: 0,
        reviewedCount: 0,
        reviewPercentage: 0,
        seizuresCount: 0,
      };
      map.set(code, entry);
    }

    entry.totalViolations += 1;
    if (v.reviewStatus === 'reviewed') {
      entry.reviewedCount += 1;
    } else {
      entry.underReviewCount += 1;
    }
    if (v.seizure && v.seizure.has) {
      entry.seizuresCount += 1;
    }
  });

  // Calculate review percentages and sort
  const summaries: MunicipalitySummary[] = Array.from(map.values()).map((s) => ({
    ...s,
    reviewPercentage: s.totalViolations > 0 ? Math.round((s.reviewedCount / s.totalViolations) * 100) : 0,
  }));

  // Sort: Active municipalities first (highest violations), then alphabetically
  summaries.sort((a, b) => {
    if (b.totalViolations !== a.totalViolations) {
      return b.totalViolations - a.totalViolations;
    }
    return a.municipalityName.localeCompare(b.municipalityName, 'ar');
  });

  const totalViolations = filteredViolations.length;
  const totalUnderReview = filteredViolations.filter((v) => v.reviewStatus !== 'reviewed').length;
  const totalReviewed = filteredViolations.filter((v) => v.reviewStatus === 'reviewed').length;
  const reviewPercentage = totalViolations > 0 ? Math.round((totalReviewed / totalViolations) * 100) : 0;
  const totalSeizures = filteredViolations.filter((v) => v.seizure && v.seizure.has).length;
  const activeMunicipalitiesCount = summaries.filter((s) => s.totalViolations > 0).length;

  return {
    timeframe,
    timeframeLabel: timeframe === 'weekly' ? 'الحصيلة الأسبوعية (آخر 7 أيام)' : 'الحصيلة الشهرية (آخر 30 يوماً)',
    totalViolations,
    totalUnderReview,
    totalReviewed,
    reviewPercentage,
    totalSeizures,
    activeMunicipalitiesCount,
    summaries,
  };
}

// ==================== DATA MANAGEMENT ====================

export function resetToDemoData(): void {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(sanitizeUsers(INITIAL_USERS)));
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
  localStorage.setItem(STORAGE_KEYS.VIOLATORS, JSON.stringify(INITIAL_VIOLATORS));
  localStorage.setItem(STORAGE_KEYS.VIOLATIONS, JSON.stringify(INITIAL_VIOLATIONS));
  applyThemeColors(INITIAL_SETTINGS);
  notifyListeners();
}

export function exportAllData(): string {
  const bundle = {
    exportDate: new Date().toISOString(),
    version: '1.0.0',
    users: getUsers(),
    settings: getSettings(),
    violators: getViolators(),
    violations: getViolations(),
  };
  return JSON.stringify(bundle, null, 2);
}

export function importAllData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (!data.violators || !data.violations || !data.settings) {
      return false;
    }
    if (Array.isArray(data.users)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(sanitizeUsers(data.users)));
    }
    if (data.settings) localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
    if (data.violators) localStorage.setItem(STORAGE_KEYS.VIOLATORS, JSON.stringify(data.violators));
    if (data.violations) localStorage.setItem(STORAGE_KEYS.VIOLATIONS, JSON.stringify(data.violations));
    applyThemeColors(getSettings());
    notifyListeners();
    return true;
  } catch (e) {
    console.error('Import failed:', e);
    return false;
  }
}
