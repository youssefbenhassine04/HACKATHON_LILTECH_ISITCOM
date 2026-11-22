export type UserRole = 'agent' | 'chef' | 'admin';

export interface User {
  username: string;
  password?: string;
  fullName: string;
  role: UserRole;
  badgeNumber?: string;
}

export interface Violator {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string; // CIN - 8 digits
  phone: string;
  address: string;
  photo?: string; // base64 / data URL
  createdAt: string; // ISO
}

export interface ViolationEditLog {
  date: string; // ISO
  username: string;
  fullName: string;
  reason: string;
  fields: string[];
}

export type PhotoCategory = 'violation' | 'goods' | 'vehicle' | 'documents' | 'place';

export interface ViolationPhotos {
  violation: string[];
  goods: string[];
  vehicle: string[];
  documents: string[];
  place: string[];
}

export interface ViolationSeizure {
  has: boolean;
  itemType?: string;
  quantity?: number;
  unit?: 'كغ' | 'لتر' | 'قطعة' | 'صندوق' | 'كيس' | 'أخرى' | string;
  storage?: string;
  notes?: string;
}

export interface ViolationLocation {
  governorate: string;
  delegation: string;
  area: string;
  street: string;
  geo: {
    lat: number;
    lng: number;
    address?: string;
  };
}

export interface Violation {
  id: string;
  reference: string; // e.g. "2026-SIDI-0001"
  arabicReference: string; // e.g. "ألفان وستة وعشرون - سيدي بوعلي - واحد"
  serial: number;
  year: number;
  municipalityCode: string;
  violatorId: string;
  agentUsername: string;
  agentName: string;
  date: string; // ISO
  
  // Location
  governorate: string;
  delegation: string;
  area: string;
  street: string;
  geo: {
    lat: number;
    lng: number;
    address?: string;
  };

  // Violation Details
  violationType: string;
  activityType: string;
  goodsType: string;
  description: string;
  action: string;
  notes?: string;

  // Vehicle
  hasVehicle: boolean;
  vehicleType?: string;
  vehiclePlate?: string;
  vehicleColor?: string;

  // Categorized Photos
  photosByCategory: ViolationPhotos;

  // Seizure
  seizure: ViolationSeizure;

  // Edit history
  edits: ViolationEditLog[];
}

export interface Settings {
  appName: string;
  appSubtitle: string;
  municipalityName: string;
  municipalityCode: string;
  primaryHex: string;
  successHex: string;
  destructiveHex: string;
  agents: User[];
  violationTypes: string[];
  actionTypes: string[];
}

export interface ViolatorWithStats extends Violator {
  violationCount: number;
  warningCount: number;
  seizureCount: number;
  isRepeatOffender: boolean; // >= 3 violations
  lastViolationDate?: string;
  lastViolationPlace?: string;
  lastAction?: string;
}
