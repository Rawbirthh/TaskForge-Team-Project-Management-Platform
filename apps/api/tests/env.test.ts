import { describe, expect, it } from 'vitest';
import { envSchema } from '../src/config/env.js';

const baseEnv = {
  DATABASE_URL: 'mysql://taskforge:secret@localhost:3306/taskforge',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
};

describe('environment schema', () => {
  it('accepts a minimal valid configuration', () => {
    const result = envSchema.safeParse(baseEnv);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(4000);
      expect(result.data.CORS_ORIGINS).toBe('http://localhost:5173');
      expect(result.data.TRUST_PROXY).toBe(false);
    }
  });

  it('rejects non-MySQL database URLs', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      DATABASE_URL: 'postgresql://user:secret@localhost:5432/taskforge',
    });

    expect(result.success).toBe(false);
  });

  it('rejects database URLs without a database name', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      DATABASE_URL: 'mysql://taskforge:secret@localhost:3306/',
    });

    expect(result.success).toBe(false);
  });

  it('rejects wildcard CORS origins', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      CORS_ORIGINS: '*',
    });

    expect(result.success).toBe(false);
  });

  it('requires an explicit CORS origin in production', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'production',
    });

    expect(result.success).toBe(false);
  });
});
