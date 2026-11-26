import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findFirst } = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    systemSetting: {
      findFirst,
    },
  },
}));

import { createApp } from '../src/app.js';

describe('health endpoints', () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it('returns liveness metadata and a request id', async () => {
    const response = await request(createApp()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: {
        status: 'ok',
        service: 'taskforge-api',
        version: '0.1.0',
      },
    });
    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('reports readiness when the database query succeeds', async () => {
    findFirst.mockResolvedValue(null);

    const response = await request(createApp()).get('/api/v1/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        status: 'ready',
        checks: { database: 'ok' },
      },
    });
  });

  it('returns 503 without leaking the database error when readiness fails', async () => {
    findFirst.mockRejectedValue(new Error('connection refused: mysql://secret'));

    const response = await request(createApp()).get('/api/v1/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      error: {
        code: 'NOT_READY',
        message: 'A required dependency is not ready',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('connection refused');
    expect(JSON.stringify(response.body)).not.toContain('secret');
  });
});
