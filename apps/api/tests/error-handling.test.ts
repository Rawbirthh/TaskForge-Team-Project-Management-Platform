import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('centralized error handling', () => {
  it('returns a consistent 404 response for unknown routes', async () => {
    const response = await request(createApp()).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested route was not found',
      },
    });
    expect(response.body.error.requestId).toBeTruthy();
  });

  it('rejects malformed JSON with a safe 400 response', async () => {
    const response = await request(createApp())
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: 'INVALID_JSON',
      },
    });
  });

  it('allows configured CORS origins', async () => {
    const response = await request(createApp())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('denies CORS origins that are not in the allowlist', async () => {
    const response = await request(createApp())
      .get('/api/v1/health')
      .set('Origin', 'https://evil.example');

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      error: {
        code: 'CORS_ORIGIN_DENIED',
      },
    });
  });

  it('does not expose stack traces or internal error details', async () => {
    const response = await request(createApp()).get('/api/v1/does-not-exist');
    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toContain('at ');
    expect(serialized).not.toContain('node_modules');
    expect(serialized).not.toContain('C:\\');
  });
});
