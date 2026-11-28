import { z } from 'zod';

const RESERVED_SLUGS = new Set([
  'api',
  'app',
  'admin',
  'auth',
  'www',
  'mail',
  'support',
  'help',
  'static',
  'assets',
]);

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .transform(normalizeSlug)
  .pipe(
    z
      .string()
      .min(3)
      .max(48)
      .regex(/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/)
      .refine((value) => !value.includes('--'), 'Slug must not contain consecutive hyphens')
      .refine((value) => !RESERVED_SLUGS.has(value), 'Slug is reserved'),
  );

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: slugSchema.optional(),
});

export const workspaceIdParamSchema = z.object({
  workspaceId: z.string().min(1).max(64),
});

export const workspaceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const slugAvailabilityQuerySchema = z.object({
  slug: slugSchema,
});

export const updateWorkspaceSettingsSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    slug: slugSchema.optional(),
    description: z.string().trim().max(500).nullable().optional(),
    logoUrl: z
      .string()
      .url()
      .max(500)
      .refine((value) => value.startsWith('http://') || value.startsWith('https://'), {
        message: 'Logo URL must use http or https',
      })
      .nullable()
      .optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one workspace setting is required',
  });

export const transferOwnershipSchema = z.object({
  targetMembershipId: z.string().min(1).max(64),
  currentPassword: z.string().min(1).max(128),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type WorkspaceIdParamInput = z.infer<typeof workspaceIdParamSchema>;
export type WorkspaceListQueryInput = z.infer<typeof workspaceListQuerySchema>;
export type SlugAvailabilityQueryInput = z.infer<typeof slugAvailabilityQuerySchema>;
export type UpdateWorkspaceSettingsInput = z.infer<typeof updateWorkspaceSettingsSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
