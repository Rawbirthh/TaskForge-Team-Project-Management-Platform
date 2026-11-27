import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';

describe('auth refresh rate limiting', () => {
  const originalNodeEnv = env.NODE_ENV;

  afterEach(() => {
    env.NODE_ENV = originalNodeEnv;
  });

  it('does not apply the strict credential limiter to routine session refreshes', async () => {
    env.NODE_ENV = 'development';
    const app = createApp();

    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', 'http://localhost:5173');

      expect(response.status).not.toBe(429);
    }
  });
});
