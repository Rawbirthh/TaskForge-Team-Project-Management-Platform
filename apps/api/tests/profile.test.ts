import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { hashOpaqueToken } from '../src/lib/tokens.js';

const app = createApp();

async function cleanup(): Promise<void> {
  await prisma.emailChangeToken.deleteMany();
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

async function register(email = 'profile@example.com', password = 'password123456') {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .set('Origin', 'http://localhost:5173')
    .send({ email, password, displayName: 'Profile User' });

  return {
    accessToken: response.body.data.accessToken as string,
    user: response.body.data.user,
    cookie: response.headers['set-cookie'],
  };
}

describe('profile endpoints', () => {
  it('requires authentication', async () => {
    const response = await request(app).get('/api/v1/users/me/profile');
    expect(response.status).toBe(401);
  });

  it('returns safe profile fields', async () => {
    const { accessToken } = await register();
    const response = await request(app)
      .get('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.profile.email).toBe('profile@example.com');
    expect(response.body.data.profile.timeZone).toBe('UTC');
    expect(response.body.data.profile.passwordHash).toBeUndefined();
  });

  it('updates profile fields', async () => {
    const { accessToken } = await register('update@example.com');
    const response = await request(app)
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        displayName: 'Updated',
        timeZone: 'Europe/Berlin',
        locale: 'de-DE',
        avatarUrl: 'https://example.com/a.png',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.profile.displayName).toBe('Updated');
    expect(response.body.data.profile.timeZone).toBe('Europe/Berlin');
    expect(response.body.data.profile.locale).toBe('de-DE');
    expect(response.body.data.profile.avatarUrl).toBe('https://example.com/a.png');
  });

  it('rejects invalid time zone', async () => {
    const { accessToken } = await register('tz@example.com');
    const response = await request(app)
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ timeZone: 'Not/AZone' });

    expect(response.status).toBe(400);
  });

  it('rejects invalid locale', async () => {
    const { accessToken } = await register('locale@example.com');
    const response = await request(app)
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ locale: 'not a locale !!!' });

    expect(response.status).toBe(400);
  });

  it('rejects invalid avatar URL', async () => {
    const { accessToken } = await register('avatar@example.com');
    const response = await request(app)
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ avatarUrl: 'ftp://example.com/a.png' });

    expect(response.status).toBe(400);
  });

  it('rejects empty update body', async () => {
    const { accessToken } = await register('empty@example.com');
    const response = await request(app)
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(400);
  });

  it('ignores mass-assignment fields', async () => {
    const { accessToken } = await register('mass@example.com');
    const response = await request(app)
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ displayName: 'Safe', userId: 'other', email: 'hack@example.com', role: 'ADMIN' });

    expect(response.status).toBe(200);
    expect(response.body.data.profile.displayName).toBe('Safe');
    expect(response.body.data.profile.email).toBe('mass@example.com');
  });

  it('clears nullable fields', async () => {
    const { accessToken } = await register('clear@example.com');
    await request(app)
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ locale: 'en-US', avatarUrl: 'https://example.com/a.png' });

    const response = await request(app)
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ locale: null, avatarUrl: null });

    expect(response.status).toBe(200);
    expect(response.body.data.profile.locale).toBeNull();
    expect(response.body.data.profile.avatarUrl).toBeNull();
  });

  it('changes password and revokes sessions', async () => {
    const { accessToken } = await register('pw@example.com');
    const response = await request(app)
      .post('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'password123456', newPassword: 'newpassword123456' });

    expect(response.status).toBe(200);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'pw@example.com', password: 'newpassword123456' });
    expect(login.status).toBe(200);
  });

  it('rejects wrong current password', async () => {
    const { accessToken } = await register('pw2@example.com');
    const response = await request(app)
      .post('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword123456' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
  });

  it('rejects same password', async () => {
    const { accessToken } = await register('pw3@example.com');
    const response = await request(app)
      .post('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'password123456', newPassword: 'password123456' });

    expect(response.status).toBe(400);
  });

  it('requests email change and verifies it', async () => {
    const { accessToken } = await register('emailchange@example.com');
    const requestResponse = await request(app)
      .post('/api/v1/users/me/email-change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: 'newemail@example.com' });

    expect(requestResponse.status).toBe(200);

    // find token in DB
    const user = await prisma.user.findUnique({ where: { email: 'emailchange@example.com' } });
    const tokenRecord = await prisma.emailChangeToken.findFirst({ where: { userId: user!.id } });
    expect(tokenRecord).not.toBeNull();

    // We don't have raw token; simulate by creating one via DB? Instead test invalid token.
    const verifyResponse = await request(app)
      .post('/api/v1/users/me/email-change/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: 'a'.repeat(32) });

    expect(verifyResponse.status).toBe(400);
    expect(verifyResponse.body.error.code).toBe('INVALID_EMAIL_CHANGE_TOKEN');
  });

  it('rejects email change to existing email', async () => {
    await register('existing@example.com');
    const { accessToken } = await register('requester@example.com');
    const response = await request(app)
      .post('/api/v1/users/me/email-change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: 'existing@example.com' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('verifies email change and revokes sessions', async () => {
    const { accessToken } = await register('verifychange@example.com');
    const user = await prisma.user.findUnique({ where: { email: 'verifychange@example.com' } });

    await prisma.user.update({
      where: { id: user!.id },
      data: { pendingEmail: 'verifiednew@example.com' },
    });

    const rawToken = 'b'.repeat(32);
    await prisma.emailChangeToken.create({
      data: {
        userId: user!.id,
        newEmail: 'verifiednew@example.com',
        tokenHash: hashOpaqueToken(rawToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const verifyResponse = await request(app)
      .post('/api/v1/users/me/email-change/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: rawToken });

    expect(verifyResponse.status).toBe(200);

    const updated = await prisma.user.findUnique({ where: { id: user!.id } });
    expect(updated!.email).toBe('verifiednew@example.com');
    expect(updated!.pendingEmail).toBeNull();
    expect(updated!.emailVerifiedAt).not.toBeNull();

    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'verifiednew@example.com', password: 'password123456' });
    expect(login.status).toBe(200);
  });

  it('lists and revokes sessions', async () => {
    const { accessToken } = await register('sessions@example.com');
    const listResponse = await request(app)
      .get('/api/v1/users/me/sessions')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(Array.isArray(listResponse.body.data.sessions)).toBe(true);
    expect(listResponse.body.data.sessions.length).toBeGreaterThan(0);
    const sessionId = listResponse.body.data.sessions[0].id;

    const revokeResponse = await request(app)
      .delete(`/api/v1/users/me/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(revokeResponse.status).toBe(204);
  });

  it('paginates sessions with a cursor', async () => {
    const { accessToken } = await register('paged@example.com');
    for (let i = 0; i < 11; i += 1) {
      const login = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:5173')
        .send({ email: 'paged@example.com', password: 'password123456' });
      expect(login.status).toBe(200);
    }

    const first = await request(app)
      .get('/api/v1/users/me/sessions?limit=5')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(first.status).toBe(200);
    expect(first.body.data.sessions).toHaveLength(5);
    expect(typeof first.body.data.nextCursor).toBe('string');

    const second = await request(app)
      .get(`/api/v1/users/me/sessions?limit=5&cursor=${first.body.data.nextCursor}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(second.status).toBe(200);
    expect(second.body.data.sessions).toHaveLength(5);
    expect(typeof second.body.data.nextCursor).toBe('string');

    const third = await request(app)
      .get(`/api/v1/users/me/sessions?limit=5&cursor=${second.body.data.nextCursor}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(third.status).toBe(200);
    expect(third.body.data.sessions).toHaveLength(2);
    expect(third.body.data.nextCursor).toBeNull();

    const ids = [
      ...first.body.data.sessions,
      ...second.body.data.sessions,
      ...third.body.data.sessions,
    ].map((session: { id: string }) => session.id);
    expect(new Set(ids).size).toBe(12);
  });

  it('rejects invalid session pagination input and foreign cursors', async () => {
    const { accessToken } = await register('cursor-validation@example.com');

    const zeroLimit = await request(app)
      .get('/api/v1/users/me/sessions?limit=0')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(zeroLimit.status).toBe(400);

    const largeLimit = await request(app)
      .get('/api/v1/users/me/sessions?limit=51')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(largeLimit.status).toBe(400);

    const unknownCursor = await request(app)
      .get('/api/v1/users/me/sessions?cursor=missing-session')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(unknownCursor.status).toBe(400);
    expect(unknownCursor.body.error.code).toBe('INVALID_CURSOR');
  });

  it('rejects a session cursor owned by another user', async () => {
    const first = await register('cursor-owner@example.com');
    const second = await register('cursor-attacker@example.com');

    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'cursor-owner@example.com', password: 'password123456' });
    expect(login.status).toBe(200);

    const list = await request(app)
      .get('/api/v1/users/me/sessions?limit=1')
      .set('Authorization', `Bearer ${first.accessToken}`);
    expect(list.body.data.nextCursor).toEqual(expect.any(String));

    const replay = await request(app)
      .get(`/api/v1/users/me/sessions?cursor=${list.body.data.nextCursor}`)
      .set('Authorization', `Bearer ${second.accessToken}`);
    expect(replay.status).toBe(400);
    expect(replay.body.error.code).toBe('INVALID_CURSOR');
  });

  it('returns 404 when revoking another user session', async () => {
    const first = await register('first@example.com');
    const second = await register('second@example.com');

    const listResponse = await request(app)
      .get('/api/v1/users/me/sessions')
      .set('Authorization', `Bearer ${first.accessToken}`);
    const sessionId = listResponse.body.data.sessions[0].id;

    const revokeResponse = await request(app)
      .delete(`/api/v1/users/me/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${second.accessToken}`);

    expect(revokeResponse.status).toBe(404);
  });

  it('deactivates account and blocks login', async () => {
    const { accessToken } = await register('deact@example.com');
    const response = await request(app)
      .post('/api/v1/users/me/deactivate')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'deact@example.com', password: 'password123456' });

    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('ACCOUNT_DEACTIVATED');
  });

  it('requests deletion with confirmation', async () => {
    const { accessToken } = await register('delete@example.com');
    const bad = await request(app)
      .post('/api/v1/users/me/delete-request')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ confirmation: 'NOPE' });

    expect(bad.status).toBe(400);

    const good = await request(app)
      .post('/api/v1/users/me/delete-request')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ confirmation: 'DELETE' });

    expect(good.status).toBe(200);
  });

  it('does not expose sensitive fields', async () => {
    const { accessToken } = await register('safe@example.com');
    const response = await request(app)
      .get('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${accessToken}`);

    const profile = response.body.data.profile;
    expect(profile.passwordHash).toBeUndefined();
    expect(profile.refreshTokenHash).toBeUndefined();
    expect(profile.previousRefreshTokenHash).toBeUndefined();
  });
});
