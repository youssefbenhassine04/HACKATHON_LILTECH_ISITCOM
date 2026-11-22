/**
 * server/passwords.ts
 * Password hashing (bcrypt) and password policy.
 *
 * bcryptjs is used instead of native bcrypt so the server installs without a
 * compiler toolchain; hashes are the standard `$2b$` format.
 */

import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from './config.js';

/** Bcrypt hashes are 60 chars and always start with $2a$/$2b$/$2y$. */
export function isBcryptHash(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  if (!isBcryptHash(hash)) return false;
  try {
    return await bcrypt.compare(plain, hash as string);
  } catch {
    return false;
  }
}

export interface PasswordPolicyResult {
  ok: boolean;
  message?: string;
}

/**
 * Applied only when a user creates/changes a password. Seeded demo accounts are
 * migrated as-is and must be changed by an administrator.
 */
export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  if (password.length < 8) {
    return { ok: false, message: 'كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل' };
  }
  if (password.length > 128) {
    return { ok: false, message: 'كلمة المرور طويلة جداً (الحد الأقصى 128 حرفاً)' };
  }
  if (!/[A-Za-z\u0600-\u06FF]/.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, message: 'كلمة المرور يجب أن تجمع بين الحروف والأرقام' };
  }
  return { ok: true };
}
