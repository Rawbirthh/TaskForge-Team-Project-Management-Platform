import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().email().max(254);

function isValidTimeZone(value: string): boolean {
  try {
    return Intl.supportedValuesOf('timeZone').includes(value);
  } catch {
    return false;
  }
}

function isValidLocale(value: string): boolean {
  try {
    Intl.getCanonicalLocales(value);
    return true;
  } catch {
    return false;
  }
}

const ianaTimeZoneSchema = z.string().refine(isValidTimeZone, 'Invalid time zone');

const localeSchema = z.string().max(35).refine(isValidLocale, 'Invalid locale').nullable();

const avatarUrlSchema = z
  .string()
  .max(500)
  .url()
  .refine((value) => /^https?:\/\//.test(value), 'Invalid avatar URL')
  .nullable();

export const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    timeZone: ianaTimeZoneSchema.optional(),
    locale: localeSchema.optional(),
    avatarUrl: avatarUrlSchema.optional(),
  })
  .refine(
    (value) =>
      value.displayName !== undefined ||
      value.timeZone !== undefined ||
      value.locale !== undefined ||
      value.avatarUrl !== undefined,
    'At least one field is required',
  );

export const emailChangeRequestSchema = z.object({
  email: emailSchema,
});

export const emailChangeVerifySchema = z.object({
  token: z.string().min(32).max(256),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(12).max(128),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'New password must differ from current password',
    path: ['newPassword'],
  });

export const deleteRequestSchema = z.object({
  confirmation: z.literal('DELETE'),
});

export const sessionIdParamSchema = z.object({
  sessionId: z.string().min(1).max(64),
});

export const sessionListQuerySchema = z.object({
  cursor: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type EmailChangeRequestInput = z.infer<typeof emailChangeRequestSchema>;
export type EmailChangeVerifyInput = z.infer<typeof emailChangeVerifySchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DeleteRequestInput = z.infer<typeof deleteRequestSchema>;
export type SessionIdParamInput = z.infer<typeof sessionIdParamSchema>;
export type SessionListQueryInput = z.infer<typeof sessionListQuerySchema>;
