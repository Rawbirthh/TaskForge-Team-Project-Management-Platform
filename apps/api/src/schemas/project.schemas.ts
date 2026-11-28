import { z } from 'zod';

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format')
  .refine(isCalendarDate, 'Invalid calendar date');

const projectKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(16)
  .transform((value) => value.toUpperCase())
  .pipe(
    z
      .string()
      .regex(
        /^[A-Z][A-Z0-9]{1,15}$/,
        'Key must start with a letter and contain only uppercase letters and digits',
      ),
  );

export const projectIdParamSchema = z.object({
  workspaceId: z.string().min(1).max(64),
  projectId: z.string().min(1).max(64),
});

export const projectListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
  visibility: z.enum(['WORKSPACE', 'PRIVATE']).optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

export const createProjectSchema = z
  .object({
    key: projectKeySchema,
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).optional(),
    visibility: z.enum(['WORKSPACE', 'PRIVATE']).default('WORKSPACE'),
    startDate: dateOnlySchema.optional(),
    targetDate: dateOnlySchema.optional(),
    status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED']).default('ACTIVE'),
  })
  .refine((value) => !value.startDate || !value.targetDate || value.startDate <= value.targetDate, {
    path: ['targetDate'],
    message: 'Target date must not precede start date',
  });

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    visibility: z.enum(['WORKSPACE', 'PRIVATE']).optional(),
    status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED']).optional(),
    startDate: dateOnlySchema.nullable().optional(),
    targetDate: dateOnlySchema.nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one project field is required',
  });

export type ProjectIdParamInput = z.infer<typeof projectIdParamSchema>;
export type ProjectListQueryInput = z.infer<typeof projectListQuerySchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
