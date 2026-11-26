import 'dotenv/config';
import { z } from 'zod';

const databaseUrlSchema = z
  .string()
  .min(1, 'DATABASE_URL is required')
  .refine((value) => {
    try {
      const url = new URL(value);
      return (url.protocol === 'mysql:' || url.protocol === 'mariadb:') && url.pathname.length > 1;
    } catch {
      return false;
    }
  }, 'DATABASE_URL must be a valid mysql:// URL that includes a database name');

const corsOriginsSchema = z
  .string()
  .default('http://localhost:5173')
  .refine((value) => {
    const origins = value.split(',').map((origin) => origin.trim());
    return origins.length > 0 && origins.every((origin) => origin.length > 0);
  }, 'CORS_ORIGINS must contain at least one origin')
  .refine((value) => {
    return value
      .split(',')
      .map((origin) => origin.trim())
      .every((origin) => {
        try {
          new URL(origin);
          return true;
        } catch {
          return false;
        }
      });
  }, 'CORS_ORIGINS must be a comma-separated list of valid URLs')
  .refine(
    (value) => !value.split(',').some((origin) => origin.trim() === '*'),
    'Wildcard CORS origins are not allowed',
  );

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: databaseUrlSchema,
    CORS_ORIGINS: corsOriginsSchema,
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).max(3_600_000).default(900_000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100_000).default(300),
    TRUST_PROXY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    APP_VERSION: z.string().min(1).max(50).default('0.1.0'),
  })
  .superRefine((value, ctx) => {
    if (
      value.NODE_ENV === 'production' &&
      value.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .includes('http://localhost:5173')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'CORS_ORIGINS must be configured explicitly in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${details}`);
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
