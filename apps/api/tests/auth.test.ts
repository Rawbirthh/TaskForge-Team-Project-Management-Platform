import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();

async function cleanup(): Promise<void> {
  await prisma.session.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => {
  await cleanup();
});

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('auth endpoints', () => {
  it('registers a user and returns a safe user plus access token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'User@Example.com',
        password: 'password123456',
        displayName: 'Test User',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.user.email).toBe('user@example.com');
    expect(response.body.data.user.displayName).toBe('Test User');
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('rejects duplicate registration', async () => {
    await request(app).post('/api/v1/auth/register').set('Origin', 'http://localhost:5173').send({
      email: 'duplicate@example.com',
      password: 'password123456',
    });

    const response = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'duplicate@example.com',
        password: 'password123456',
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('validates registration input', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'not-an-email',
        password: 'short',
      });

    expect(response.status).toBe(400);
  });

  it('rejects invalid credentials with a generic error', async () => {
    await request(app).post('/api/v1/auth/register').set('Origin', 'http://localhost:5173').send({
      email: 'login@example.com',
      password: 'password123456',
    });

    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'login@example.com',
        password: 'wrongpassword123',
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('logs in and returns an access token', async () => {
    await request(app).post('/api/v1/auth/register').set('Origin', 'http://localhost:5173').send({
      email: 'signin@example.com',
      password: 'password123456',
    });

    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'signin@example.com',
        password: 'password123456',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.user.email).toBe('signin@example.com');
  });

  it('denies unauthenticated access to /me', async () => {
    const response = await request(app).get('/api/v1/me');
    expect(response.status).toBe(401);
  });

  it('returns the authenticated user from /me', async () => {
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'me@example.com',
        password: 'password123456',
      });

    const token = registerResponse.body.data.accessToken as string;
    const response = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe('me@example.com');
  });

  it('refreshes and rotates the refresh token', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/register').set('Origin', 'http://localhost:5173').send({
      email: 'refresh@example.com',
      password: 'password123456',
    });

    const response = await agent
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .send();
    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
  });

  it('rejects logout CSRF without an allowed origin when a refresh cookie is present', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/register').set('Origin', 'http://localhost:5173').send({
      email: 'csrf@example.com',
      password: 'password123456',
    });

    const response = await agent.post('/api/v1/auth/logout');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_ORIGIN_REJECTED');
  });

  it('logs out successfully with an allowed origin', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/register').set('Origin', 'http://localhost:5173').send({
      email: 'logout@example.com',
      password: 'password123456',
    });

    const response = await agent.post('/api/v1/auth/logout').set('Origin', 'http://localhost:5173');

    expect(response.status).toBe(204);
  });

  it('returns a generic success for forgot password', async () => {
    const response = await request(app).post('/api/v1/auth/forgot-password').send({
      email: 'nobody@example.com',
    });

    expect(response.status).toBe(200);
    expect(response.body.data.message).toEqual(expect.any(String));
  });

  it('rejects invalid reset tokens', async () => {
    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: 'a'.repeat(32),
        password: 'newpassword12345',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('rejects invalid verification tokens', async () => {
    const response = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({
        token: 'a'.repeat(32),
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_VERIFICATION_TOKEN');
  });

  it('requires authentication for resend verification', async () => {
    const response = await request(app).post('/api/v1/auth/resend-verification');
    expect(response.status).toBe(401);
  });

  it('rejects tampered access tokens', async () => {
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'tamper@example.com',
        password: 'password123456',
      });

    const token = registerResponse.body.data.accessToken as string;
    const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;

    const response = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${tampered}`);

    expect(response.status).toBe(401);
  });

  it('detects refresh token reuse', async () => {
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'reuse@example.com',
        password: 'password123456',
      });

    const setCookie = registerResponse.headers['set-cookie'];
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
    const match = cookieHeader.match(/taskforge_refresh=([^;]+)/);
    const oldRefreshCookie = match ? `taskforge_refresh=${match[1]}` : '';

    const firstRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', oldRefreshCookie)
      .send();

    expect(firstRefresh.status).toBe(200);

    const secondRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', oldRefreshCookie)
      .send();

    expect(secondRefresh.status).toBe(401);
    expect(['REFRESH_TOKEN_REUSED', 'INVALID_REFRESH_TOKEN']).toContain(
      secondRefresh.body.error.code,
    );
  });

  it('ignores privileged fields during registration', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'privileged@example.com',
        password: 'password123456',
        role: 'ADMIN',
        userId: 'forged',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBeUndefined();
    expect(response.body.data.user.id).not.toBe('forged');
  });
});
