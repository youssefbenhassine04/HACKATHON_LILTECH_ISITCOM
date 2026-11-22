/**
 * server/validation.ts
 * Zod schemas for every request body/param, plus output sanitization.
 *
 * Parsing rewrites `req.body` with the validated object, so unknown fields are
 * dropped and every stored string has control characters and angle brackets
 * removed (defense-in-depth against stored XSS; React already escapes output).
 */

import { z } from 'zod';
import type { NextFunction, Request, Response } from 'express';
import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_CATEGORY } from './config.js';

/** Single-line text: no control characters, no tag delimiters, collapsed spaces. */
export function sanitizeLine(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex -- intentionally stripping control characters
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Multi-line text (descriptions, notes): keeps newlines and tabs. */
export function sanitizeBlock(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex -- intentionally stripping control characters
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

const line = (min: number, max: number) =>
  z
    .string()
    .max(max)
    .transform(sanitizeLine)
    .refine((v) => v.length >= min, { message: `يجب ألا يقل النص عن ${min} أحرف` });

const optionalLine = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v === undefined ? undefined : sanitizeLine(v)));

const block = (min: number, max: number) =>
  z
    .string()
    .max(max)
    .transform(sanitizeBlock)
    .refine((v) => v.length >= min, { message: `يجب ألا يقل النص عن ${min} أحرف` });

const optionalBlock = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v === undefined ? undefined : sanitizeBlock(v)));

export const identifier = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9._:-]+$/, { message: 'معرّف غير صالح' });

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, { message: 'اللون يجب أن يكون بصيغة #RRGGBB' });

const isoDate = z
  .string()
  .max(40)
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'تاريخ غير صالح' });

/** Only raster data URLs are accepted — no SVG (script vector), no remote URLs. */
const photoDataUrl = z
  .string()
  .max(MAX_PHOTO_BYTES + 100)
  .regex(/^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i, {
    message: 'صورة غير صالحة (يُسمح فقط بصيغ PNG/JPEG/WEBP/GIF)',
  });

const photoList = z.array(photoDataUrl).max(MAX_PHOTOS_PER_CATEGORY);

// ==================== AUTH ====================

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(128),
});

// ==================== USERS ====================

export const userUpsertSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._-]{3,32}$/, { message: 'اسم المستخدم يجب أن يكون 3-32 حرفاً لاتينياً/رقماً' })
    .transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(128).optional(),
  fullName: line(2, 150),
  role: z.enum(['agent', 'chef', 'admin']),
  badgeNumber: optionalLine(50),
});

// ==================== SETTINGS ====================

export const settingsSchema = z.object({
  appName: line(1, 150),
  appSubtitle: optionalLine(255),
  municipalityName: line(1, 100),
  municipalityCode: z
    .string()
    .trim()
    .max(20)
    .regex(/^[A-Za-z0-9_-]{1,20}$/, { message: 'رمز البلدية غير صالح' })
    .transform((v) => v.toUpperCase()),
  primaryHex: hexColor,
  successHex: hexColor,
  destructiveHex: hexColor,
  violationTypes: z.array(line(1, 100)).min(1).max(50),
  actionTypes: z.array(line(1, 100)).min(1).max(50),
  agents: z.unknown().optional(), // read-only server projection, ignored on write
});

// ==================== VIOLATORS ====================

export const violatorSchema = z.object({
  id: identifier.optional(),
  firstName: line(1, 100),
  lastName: line(1, 100),
  nationalId: z
    .string()
    .trim()
    .regex(/^\d{8}$/, { message: 'رقم البطاقة الوطنية يجب أن يتكون من 8 أرقام' }),
  phone: z
    .string()
    .trim()
    .max(50)
    .regex(/^[0-9+\s-]{6,50}$/, { message: 'رقم هاتف غير صالح' })
    .optional()
    .or(z.literal('')),
  address: optionalLine(300),
  photo: photoDataUrl.optional(),
  createdAt: isoDate.optional(),
});

// ==================== VIOLATIONS ====================

const geo = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

const seizure = z.object({
  has: z.boolean(),
  itemType: optionalLine(100),
  quantity: z.number().finite().min(0).max(1_000_000).optional(),
  unit: optionalLine(30),
  storage: optionalLine(150),
  notes: optionalBlock(500),
});

const photosByCategory = z.object({
  violation: photoList.optional(),
  goods: photoList.optional(),
  vehicle: photoList.optional(),
  documents: photoList.optional(),
  place: photoList.optional(),
});

export const violationCreateSchema = z.object({
  id: identifier.optional(),
  reference: line(1, 100),
  arabicReference: line(1, 200),
  serial: z.number().int().min(1).max(99_999_999),
  year: z.number().int().min(2000).max(2100),
  municipalityCode: z
    .string()
    .trim()
    .max(20)
    .regex(/^[A-Za-z0-9_-]{1,20}$/)
    .transform((v) => v.toUpperCase()),
  municipalityName: optionalLine(100),
  violatorId: identifier,
  date: isoDate,
  governorate: line(1, 100),
  delegation: line(1, 100),
  area: optionalLine(100),
  street: line(1, 255),
  geo: geo.optional(),
  violationType: line(1, 100),
  activityType: optionalLine(150),
  goodsType: optionalLine(150),
  description: block(1, 2000),
  action: line(1, 100),
  notes: optionalBlock(2000),
  hasVehicle: z.boolean().optional(),
  vehicleType: optionalLine(100),
  vehiclePlate: optionalLine(50),
  vehicleColor: optionalLine(50),
  photosByCategory: photosByCategory.optional(),
  seizure: seizure.optional(),
});

export const violationUpdateSchema = z.object({
  governorate: line(1, 100).optional(),
  delegation: line(1, 100).optional(),
  area: optionalLine(100),
  street: line(1, 255).optional(),
  geo: geo.optional(),
  violationType: line(1, 100).optional(),
  activityType: optionalLine(150),
  goodsType: optionalLine(150),
  description: block(1, 2000).optional(),
  action: line(1, 100).optional(),
  notes: optionalBlock(2000),
  hasVehicle: z.boolean().optional(),
  vehicleType: optionalLine(100),
  vehiclePlate: optionalLine(50),
  vehicleColor: optionalLine(50),
  photosByCategory: photosByCategory.optional(),
  seizure: seizure.optional(),
  reason: optionalLine(300),
});

export const reviewSchema = z.object({
  status: z.enum(['under_review', 'reviewed']),
  reason: optionalLine(300),
});

// ==================== MISC ====================

export const dbUrlSchema = z.object({
  databaseUrl: z
    .string()
    .trim()
    .max(500)
    .regex(/^postgres(ql)?:\/\/\S+$/i, { message: 'رابط قاعدة البيانات يجب أن يبدأ بـ postgresql://' }),
});

export const idParamsSchema = z.object({ id: identifier });
export const usernameParamsSchema = z.object({ username: z.string().trim().min(1).max(50) });

export const timeframeQuerySchema = z.object({
  timeframe: z.enum(['weekly', 'monthly']).default('weekly'),
});

// ==================== MIDDLEWARE ====================

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const field = issue.path.join('.');
    return field ? `${field}: ${issue.message}` : issue.message;
  });
}

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      res.status(400).json({ error: 'بيانات غير صالحة أو ناقصة', details: formatIssues(result.error) });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({ error: 'معرّف غير صالح', details: formatIssues(result.error) });
      return;
    }
    req.params = result.data as typeof req.params;
    next();
  };
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({ error: 'طلب غير صالح', details: formatIssues(result.error) });
      return;
    }
    // Express 5 exposes req.query as a getter; store the parsed value separately.
    res.locals.query = result.data;
    next();
  };
}
