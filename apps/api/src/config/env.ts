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
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_ISSUER: z.string().min(1).default('taskforge-api'),
    JWT_AUDIENCE: z.string().min(1).default('taskforge-web'),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(60).default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
    PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
    EMAIL_VERIFICATION_TOKEN_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
    EMAIL_CHANGE_TOKEN_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).max(3_600_000).default(900_000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100).default(10),
    MAIL_PROVIDER: z
      .enum(['disabled', 'console', 'smtp'])
      .default(process.env.NODE_ENV === 'production' ? 'disabled' : 'console'),
    APP_PUBLIC_URL: z.string().url().default('http://localhost:5173'),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    SMTP_FROM: z.string().email().optional(),
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

    if (value.MAIL_PROVIDER === 'smtp') {
      if (!value.SMTP_HOST) {
        ctx.addIssue({
          code: 'custom',
          path: ['SMTP_HOST'],
          message: 'SMTP_HOST is required when MAIL_PROVIDER=smtp',
        });
      }
      if (value.SMTP_PORT === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['SMTP_PORT'],
          message: 'SMTP_PORT is required when MAIL_PROVIDER=smtp',
        });
      }
      if (!value.SMTP_FROM) {
        ctx.addIssue({
          code: 'custom',
          path: ['SMTP_FROM'],
          message: 'SMTP_FROM is required when MAIL_PROVIDER=smtp',
        });
      }
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
