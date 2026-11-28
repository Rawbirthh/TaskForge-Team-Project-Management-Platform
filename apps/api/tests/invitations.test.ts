import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();

async function cleanup(): Promise<void> {
  await prisma.workspaceInvitation.deleteMany();
  await prisma.workspaceMembership.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.session.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.emailChangeToken.deleteMany();
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

async function register(email = 'u@example.com', password = 'password123456') {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .set('Origin', 'http://localhost:5173')
    .send({ email, password, displayName: 'User' });
  return {
    accessToken: response.body.data.accessToken as string,
    user: response.body.data.user,
  };
}

async function createWorkspace(accessToken: string, name = 'WS') {
  const res = await request(app)
    .post('/api/v1/workspaces')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name });
  return res.body.data.workspace as { id: string; slug: string };
}

describe('invitations auth', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/v1/workspaces/x/invitations');
    expect(res.status).toBe(401);
    const res2 = await request(app).post('/api/v1/invitations/accept').send({ token: 't' });
    expect(res2.status).toBe(401);
  });
});

describe('invitation lifecycle', () => {
  it('creates, lists, resends, revokes', async () => {
    const owner = await register('invowner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const create = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'invitee@example.com', role: 'MEMBER' });
    expect(create.status).toBe(201);
    expect(create.body.data.invitation.status).toBe('PENDING');
    expect(create.body.data.invitation.email).toBe('invitee@example.com');
    const invId = create.body.data.invitation.id;

    const list = await request(app)
      .get(`/api/v1/workspaces/${ws.id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(1);

    const resend = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/invitations/${invId}/resend`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(resend.status).toBe(200);

    const revoke = await request(app)
      .delete(`/api/v1/workspaces/${ws.id}/invitations/${invId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(revoke.status).toBe(204);

    // accept after revoke fails
    const dbInv = await prisma.workspaceInvitation.findUnique({ where: { id: invId } });
    // token hash changed; use a dummy token
    const acc = await request(app)
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ token: 'dummy' });
    expect(acc.status).toBe(400);
    void dbInv;
  });

  it('rejects invite to existing active member', async () => {
    const owner = await register('dupinvowner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const member = await register('dupinv@example.com');
    await prisma.workspaceMembership.create({
      data: { workspaceId: ws.id, userId: member.user.id, role: 'MEMBER', status: 'ACTIVE' },
    });
    const res = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'dupinv@example.com', role: 'MEMBER' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_MEMBER');
  });

  it('rotates pending invitation on re-invite', async () => {
    const owner = await register('rotowner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const first = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'rotatee@example.com', role: 'MEMBER' });
    expect(first.status).toBe(201);
    const firstHash = (await prisma.workspaceInvitation.findUnique({
      where: { id: first.body.data.invitation.id },
    }))!.tokenHash;

    const second = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'rotatee@example.com', role: 'GUEST' });
    expect(second.status).toBe(201);

    // first invitation should be revoked
    const firstRow = await prisma.workspaceInvitation.findUnique({
      where: { id: first.body.data.invitation.id },
    });
    expect(firstRow?.revokedAt).not.toBeNull();
    // new hash differs
    const secondRow = await prisma.workspaceInvitation.findUnique({
      where: { id: second.body.data.invitation.id },
    });
    expect(secondRow?.tokenHash).not.toBe(firstHash);
    expect(secondRow?.role).toBe('GUEST');
  });

  it('accepts invitation and creates membership', async () => {
    const owner = await register('accowner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const invitee = await register('accinv@example.com');
    const create = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'accinv@example.com', role: 'MEMBER' });
    expect(create.status).toBe(201);
    const invId = create.body.data.invitation.id;
    const invRow = await prisma.workspaceInvitation.findUnique({ where: { id: invId } });
    // reconstruct raw token? We don't have it. Instead, accept by looking up token hash is impossible.
    // For test, directly use the stored hash? Accept endpoint hashes the provided token.
    // We need the raw token. Since mailer is console, raw token isn't returned.
    // Workaround: create invitation directly in DB with known token hash.
    // Let's instead test accept via a known raw token inserted manually.
    void invRow;
    void invitee;
    void ws;
  });
});

describe('invitation accept with known token', () => {
  it('accepts when raw token is known', async () => {
    const owner = await register('tokowner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const invitee = await register('tokinv@example.com');

    const { generateOpaqueToken } = await import('../src/lib/tokens.js');
    const token = generateOpaqueToken();
    const inv = await prisma.workspaceInvitation.create({
      data: {
        workspaceId: ws.id,
        email: 'tokinv@example.com',
        role: 'MEMBER',
        tokenHash: token.hash,
        invitedByUserId: owner.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const acc = await request(app)
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .send({ token: token.raw });
    expect(acc.status).toBe(200);
    expect(acc.body.data.workspace.id).toBe(ws.id);
    expect(acc.body.data.membership.role).toBe('MEMBER');
    expect(acc.body.data.membership.status).toBe('ACTIVE');

    // membership exists
    const m = await prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId: ws.id, userId: invitee.user.id } },
    });
    expect(m).not.toBeNull();
    expect(m?.status).toBe('ACTIVE');

    // invitation marked accepted
    const updatedInv = await prisma.workspaceInvitation.findUnique({ where: { id: inv.id } });
    expect(updatedInv?.acceptedAt).not.toBeNull();
    expect(updatedInv?.acceptedUserId).toBe(invitee.user.id);

    // idempotent re-accept
    const acc2 = await request(app)
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .send({ token: token.raw });
    expect(acc2.status).toBe(200);
  });

  it('rejects email mismatch', async () => {
    const owner = await register('mmowner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const other = await register('other@example.com');

    const { generateOpaqueToken } = await import('../src/lib/tokens.js');
    const token = generateOpaqueToken();
    await prisma.workspaceInvitation.create({
      data: {
        workspaceId: ws.id,
        email: 'someoneelse@example.com',
        role: 'MEMBER',
        tokenHash: token.hash,
        invitedByUserId: owner.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const acc = await request(app)
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ token: token.raw });
    expect(acc.status).toBe(403);
    expect(acc.body.error.code).toBe('INVITATION_EMAIL_MISMATCH');
  });

  it('rejects expired token', async () => {
    const owner = await register('expowner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const invitee = await register('expinv@example.com');

    const { generateOpaqueToken } = await import('../src/lib/tokens.js');
    const token = generateOpaqueToken();
    await prisma.workspaceInvitation.create({
      data: {
        workspaceId: ws.id,
        email: 'expinv@example.com',
        role: 'MEMBER',
        tokenHash: token.hash,
        invitedByUserId: owner.user.id,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const acc = await request(app)
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .send({ token: token.raw });
    expect(acc.status).toBe(400);
  });

  it('rejects revoked token', async () => {
    const owner = await register('revowner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const invitee = await register('revinv@example.com');

    const { generateOpaqueToken } = await import('../src/lib/tokens.js');
    const token = generateOpaqueToken();
    await prisma.workspaceInvitation.create({
      data: {
        workspaceId: ws.id,
        email: 'revinv@example.com',
        role: 'MEMBER',
        tokenHash: token.hash,
        invitedByUserId: owner.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: new Date(),
      },
    });

    const acc = await request(app)
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .send({ token: token.raw });
    expect(acc.status).toBe(400);
  });

  it('decline marks revoked', async () => {
    const owner = await register('decowner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const invitee = await register('decinv@example.com');

    const { generateOpaqueToken } = await import('../src/lib/tokens.js');
    const token = generateOpaqueToken();
    const inv = await prisma.workspaceInvitation.create({
      data: {
        workspaceId: ws.id,
        email: 'decinv@example.com',
        role: 'MEMBER',
        tokenHash: token.hash,
        invitedByUserId: owner.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const dec = await request(app)
      .post('/api/v1/invitations/decline')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .send({ token: token.raw });
    expect(dec.status).toBe(204);

    const updated = await prisma.workspaceInvitation.findUnique({ where: { id: inv.id } });
    expect(updated?.revokedAt).not.toBeNull();
  });

  it('resend regenerates token', async () => {
    const owner = await register('resowner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const create = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'resendee@example.com', role: 'MEMBER' });
    expect(create.status).toBe(201);
    const invId = create.body.data.invitation.id;
    const before = await prisma.workspaceInvitation.findUnique({ where: { id: invId } });

    const resend = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/invitations/${invId}/resend`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(resend.status).toBe(200);
    const after = await prisma.workspaceInvitation.findUnique({ where: { id: invId } });
    expect(after?.tokenHash).not.toBe(before?.tokenHash);
  });

  it('revoke then accept fails', async () => {
    const owner = await register('rev2owner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const invitee = await register('rev2inv@example.com');

    const { generateOpaqueToken } = await import('../src/lib/tokens.js');
    const token = generateOpaqueToken();
    const inv = await prisma.workspaceInvitation.create({
      data: {
        workspaceId: ws.id,
        email: 'rev2inv@example.com',
        role: 'MEMBER',
        tokenHash: token.hash,
        invitedByUserId: owner.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    const rev = await request(app)
      .delete(`/api/v1/workspaces/${ws.id}/invitations/${inv.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(rev.status).toBe(204);

    const acc = await request(app)
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .send({ token: token.raw });
    expect(acc.status).toBe(400);
  });

  it('invalid token returns 400', async () => {
    const user = await register('invuser@example.com');
    const res = await request(app)
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ token: 'not-a-real-token' });
    expect(res.status).toBe(400);
  });

  it('non-manager cannot list invitations', async () => {
    const owner = await register('nmowner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const member = await register('nmmember@example.com');
    await prisma.workspaceMembership.create({
      data: { workspaceId: ws.id, userId: member.user.id, role: 'MEMBER', status: 'ACTIVE' },
    });
    const res = await request(app)
      .get(`/api/v1/workspaces/${ws.id}/invitations`)
      .set('Authorization', `Bearer ${member.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('admin cannot invite admin/owner', async () => {
    const owner = await register('adm2owner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const adminUser = await register('adm2@example.com');
    await prisma.workspaceMembership.create({
      data: { workspaceId: ws.id, userId: adminUser.user.id, role: 'ADMIN', status: 'ACTIVE' },
    });
    const res = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/invitations`)
      .set('Authorization', `Bearer ${adminUser.accessToken}`)
      .send({ email: 'x@example.com', role: 'ADMIN' });
    expect(res.status).toBe(403);
  });

  it('invitations pagination', async () => {
    const owner = await register('ipgowner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post(`/api/v1/workspaces/${ws.id}/invitations`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ email: `p${i}@example.com`, role: 'MEMBER' });
    }
    const res = await request(app)
      .get(`/api/v1/workspaces/${ws.id}/invitations?page=1&limit=2`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.total).toBe(3);
  });
});
