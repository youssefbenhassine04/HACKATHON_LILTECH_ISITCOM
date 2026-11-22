import { User, Violator, Violation, Settings, ViolatorWithStats } from '../types';
import { INITIAL_USERS, INITIAL_SETTINGS, INITIAL_VIOLATORS, INITIAL_VIOLATIONS } from './seedData';
import { generateArabicReference } from './arabicNumbers';

const STORAGE_KEYS = {
  USERS: 'police_municipal_users',
  SETTINGS: 'police_municipal_settings',
  VIOLATORS: 'police_municipal_violators',
  VIOLATIONS: 'police_municipal_violations',
  SESSION: 'police_municipal_session_user',
};

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
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.VIOLATORS)) {
    localStorage.setItem(STORAGE_KEYS.VIOLATORS, JSON.stringify(INITIAL_VIOLATORS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.VIOLATIONS)) {
    localStorage.setItem(STORAGE_KEYS.VIOLATIONS, JSON.stringify(INITIAL_VIOLATIONS));
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

// ==================== AUTH & SESSION ====================

export function getCurrentUser(): User | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User | null): void {
  if (user) {
    sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
  } else {
    sessionStorage.removeItem(STORAGE_KEYS.SESSION);
  }
  notifyListeners();
}

export function authenticate(username: string, password: string): User | null {
  const users = getUsers();
  const found = users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password.trim()
  );
  if (found) {
    const { password: _, ...safeUser } = found;
    setCurrentUser(safeUser as User);
    return safeUser as User;
  }
  return null;
}

export function logout(): void {
  setCurrentUser(null);
}

export function getUsers(): User[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    return raw ? JSON.parse(raw) : INITIAL_USERS;
  } catch {
    return INITIAL_USERS;
  }
}

export function saveUser(user: User): void {
  const users = getUsers();
  const index = users.findIndex((u) => u.username === user.username);
  if (index >= 0) {
    users[index] = { ...users[index], ...user };
  } else {
    users.push(user);
  }
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

  // Also update agents in settings
  const settings = getSettings();
  settings.agents = users;
  saveSettings(settings);

  notifyListeners();
}

export function deleteUser(username: string): void {
  const users = getUsers().filter((u) => u.username !== username);
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

  const settings = getSettings();
  settings.agents = users;
  saveSettings(settings);

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
  data: Omit<Violation, 'id' | 'reference' | 'arabicReference' | 'serial' | 'year' | 'municipalityCode' | 'edits'>
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
    violatorId: existing.violatorId,
    edits: [editLogEntry, ...(existing.edits || [])],
  };

  list[index] = updatedViolation;
  localStorage.setItem(STORAGE_KEYS.VIOLATIONS, JSON.stringify(list));
  notifyListeners();
  return updatedViolation;
}

// ==================== DATA MANAGEMENT ====================

export function resetToDemoData(): void {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
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
    if (data.users) localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(data.users));
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
