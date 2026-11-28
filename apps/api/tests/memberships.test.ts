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

describe('members auth', () => {
  it('requires auth for members list', async () => {
    const res = await request(app).get('/api/v1/workspaces/abc/members');
    expect(res.status).toBe(401);
  });
});

describe('member list scoping and permissions', () => {
  it('lists members for active member', async () => {
    const owner = await register('owner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const res = await request(app)
      .get(`/api/v1/workspaces/${ws.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].membership.role).toBe('OWNER');
  });

  it('returns 404 for non-member', async () => {
    const owner = await register('owner2@example.com');
    const intruder = await register('intruder@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const res = await request(app)
      .get(`/api/v1/workspaces/${ws.id}/members`)
      .set('Authorization', `Bearer ${intruder.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('paginates members', async () => {
    const owner = await register('pageowner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    // add a second user via direct membership
    const u2 = await register('pageu2@example.com');
    await prisma.workspaceMembership.create({
      data: { workspaceId: ws.id, userId: u2.user.id, role: 'MEMBER', status: 'ACTIVE' },
    });
    const res = await request(app)
      .get(`/api/v1/workspaces/${ws.id}/members?page=1&limit=1`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.total).toBe(2);
  });

  it('rejects invalid pagination', async () => {
    const owner = await register('badpage@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const res = await request(app)
      .get(`/api/v1/workspaces/${ws.id}/members?limit=100`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(res.status).toBe(400);
  });

  it('filters by role and q', async () => {
    const owner = await register('filterowner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const u2 = await register('filtermember@example.com');
    await prisma.workspaceMembership.create({
      data: { workspaceId: ws.id, userId: u2.user.id, role: 'MEMBER', status: 'ACTIVE' },
    });
    const byRole = await request(app)
      .get(`/api/v1/workspaces/${ws.id}/members?role=MEMBER`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(byRole.status).toBe(200);
    expect(byRole.body.data.items).toHaveLength(1);

    const byQ = await request(app)
      .get(`/api/v1/workspaces/${ws.id}/members?q=filtermember`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(byQ.status).toBe(200);
    expect(byQ.body.data.items).toHaveLength(1);
  });
});

describe('role change and last-owner protection', () => {
  it('owner can change a member role', async () => {
    const owner = await register('ro@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const u2 = await register('romem@example.com');
    const m = await prisma.workspaceMembership.create({
      data: { workspaceId: ws.id, userId: u2.user.id, role: 'MEMBER', status: 'ACTIVE' },
    });
    const res = await request(app)
      .patch(`/api/v1/workspaces/${ws.id}/members/${m.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'GUEST' });
    expect(res.status).toBe(200);
    expect(res.body.data.membership.role).toBe('GUEST');
  });

  it('member cannot change roles', async () => {
    const owner = await register('ro2@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const u2 = await register('ro2mem@example.com');
    const m = await prisma.workspaceMembership.create({
      data: { workspaceId: ws.id, userId: u2.user.id, role: 'MEMBER', status: 'ACTIVE' },
    });
    const res = await request(app)
      .patch(`/api/v1/workspaces/${ws.id}/members/${m.id}`)
      .set('Authorization', `Bearer ${u2.accessToken}`)
      .send({ role: 'ADMIN' });
    expect(res.status).toBe(403);
  });

  it('cannot demote the last owner', async () => {
    const owner = await register('lasto@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const m = await prisma.workspaceMembership.findFirst({
      where: { workspaceId: ws.id, userId: owner.user.id },
    });
    const res = await request(app)
      .patch(`/api/v1/workspaces/${ws.id}/members/${m!.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'ADMIN' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LAST_OWNER_PROTECTED');
  });

  it('admin cannot invite or change admin/owner', async () => {
    const owner = await register('adm@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const adminUser = await register('adminu@example.com');
    await prisma.workspaceMembership.create({
      data: { workspaceId: ws.id, userId: adminUser.user.id, role: 'ADMIN', status: 'ACTIVE' },
    });
    // admin tries to change owner role
    const ownerM = await prisma.workspaceMembership.findFirst({
      where: { workspaceId: ws.id, userId: owner.user.id },
    });
    const res = await request(app)
      .patch(`/api/v1/workspaces/${ws.id}/members/${ownerM!.id}`)
      .set('Authorization', `Bearer ${adminUser.accessToken}`)
      .send({ role: 'MEMBER' });
    expect(res.status).toBe(403);

    // admin invites ADMIN (ceiling exceeded)
    const inv = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/invitations`)
      .set('Authorization', `Bearer ${adminUser.accessToken}`)
      .send({ email: 'new@example.com', role: 'ADMIN' });
    expect(inv.status).toBe(403);
  });

  it('cannot assign OWNER role via patch', async () => {
    const owner = await register('nopatchowner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const u2 = await register('nopatchmem@example.com');
    const m = await prisma.workspaceMembership.create({
      data: { workspaceId: ws.id, userId: u2.user.id, role: 'MEMBER', status: 'ACTIVE' },
    });
    const res = await request(app)
      .patch(`/api/v1/workspaces/${ws.id}/members/${m.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'OWNER' });
    expect(res.status).toBe(400);
  });
});

describe('suspend/reactivate/remove', () => {
  it('owner can suspend and reactivate a member', async () => {
    const owner = await register('sus@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const u2 = await register('susmem@example.com');
    const m = await prisma.workspaceMembership.create({
      data: { workspaceId: ws.id, userId: u2.user.id, role: 'MEMBER', status: 'ACTIVE' },
    });
    const susp = await request(app)
      .patch(`/api/v1/workspaces/${ws.id}/members/${m.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ status: 'SUSPENDED' });
    expect(susp.status).toBe(200);
    expect(susp.body.data.membership.status).toBe('SUSPENDED');

    // suspended user loses access
    const access = await request(app)
      .get(`/api/v1/workspaces/${ws.id}`)
      .set('Authorization', `Bearer ${u2.accessToken}`);
    expect(access.status).toBe(404);

    const react = await request(app)
      .patch(`/api/v1/workspaces/${ws.id}/members/${m.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ status: 'ACTIVE' });
    expect(react.status).toBe(200);
    expect(react.body.data.membership.status).toBe('ACTIVE');
  });

  it('remove sets REMOVED and is terminal', async () => {
    const owner = await register('rem@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const u2 = await register('remmem@example.com');
    const m = await prisma.workspaceMembership.create({
      data: { workspaceId: ws.id, userId: u2.user.id, role: 'MEMBER', status: 'ACTIVE' },
    });
    const del = await request(app)
      .delete(`/api/v1/workspaces/${ws.id}/members/${m.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(del.status).toBe(204);

    // reactivate not allowed via patch? status REMOVED -> patch to ACTIVE allowed? Spec: REMOVED terminal, must re-invite.
    // We allow patch status ACTIVE on REMOVED row technically; check access restored? We'll just verify status change blocked?
    // Actually our service allows reactivation. To enforce terminal, remove should prevent reactivation.
    // Check: patch REMOVED -> ACTIVE should fail or be ignored. We'll assert it stays REMOVED?
    const patch = await request(app)
      .patch(`/api/v1/workspaces/${ws.id}/members/${m.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ status: 'ACTIVE' });
    expect(patch.status).toBe(409);
  });

  it('member can remove self if not last owner', async () => {
    const owner = await register('selfremowner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const u2 = await register('selfrem@example.com');
    const m = await prisma.workspaceMembership.create({
      data: { workspaceId: ws.id, userId: u2.user.id, role: 'MEMBER', status: 'ACTIVE' },
    });
    const del = await request(app)
      .delete(`/api/v1/workspaces/${ws.id}/members/${m.id}`)
      .set('Authorization', `Bearer ${u2.accessToken}`);
    expect(del.status).toBe(204);
  });

  it('last owner cannot remove self', async () => {
    const owner = await register('selfowner@example.com');
    const ws = await createWorkspace(owner.accessToken, 'WS');
    const m = await prisma.workspaceMembership.findFirst({
      where: { workspaceId: ws.id, userId: owner.user.id },
    });
    const del = await request(app)
      .delete(`/api/v1/workspaces/${ws.id}/members/${m!.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(del.status).toBe(409);
  });
});
