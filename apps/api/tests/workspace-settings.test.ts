import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();
const PASSWORD = 'password123456';

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

async function register(email: string, password = PASSWORD) {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .set('Origin', 'http://localhost:5173')
    .send({ email, password, displayName: 'User' });
  return {
    accessToken: response.body.data.accessToken as string,
    user: response.body.data.user as { id: string },
  };
}

async function createWorkspace(accessToken: string, name = 'Settings WS', slug?: string) {
  const response = await request(app)
    .post('/api/v1/workspaces')
    .set('Authorization', `Bearer ${accessToken}`)
    .send(slug ? { name, slug } : { name });
  return response.body.data.workspace as { id: string; slug: string };
}

async function addMember(
  workspaceId: string,
  userId: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST',
) {
  return prisma.workspaceMembership.create({
    data: { workspaceId, userId, role, status: 'ACTIVE' },
    select: { id: true },
  });
}

describe('workspace settings authorization', () => {
  it('requires authentication for settings update and ownership transfer', async () => {
    const patch = await request(app).patch('/api/v1/workspaces/abc').send({ name: 'X' });
    expect(patch.status).toBe(401);

    const transfer = await request(app)
      .post('/api/v1/workspaces/abc/ownership/transfer')
      .send({ targetMembershipId: 'x', currentPassword: PASSWORD });
    expect(transfer.status).toBe(401);
  });

  it('lets an owner update allowed settings and persists them', async () => {
    const owner = await register('settings-owner@example.com');
    const ws = await createWorkspace(owner.accessToken);

    const response = await request(app)
      .patch(`/api/v1/workspaces/${ws.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Renamed WS',
        slug: 'renamed-ws',
        description: 'A short description',
        logoUrl: 'https://example.com/logo.png',
      });
    expect(response.status).toBe(200);
    expect(response.body.data.workspace).toMatchObject({
      name: 'Renamed WS',
      slug: 'renamed-ws',
      description: 'A short description',
      logoUrl: 'https://example.com/logo.png',
    });

    const detail = await request(app)
      .get(`/api/v1/workspaces/${ws.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(detail.body.data.workspace.description).toBe('A short description');
    expect(detail.body.data.workspace.logoUrl).toBe('https://example.com/logo.png');
  });

  it('normalizes whitespace-only description to null', async () => {
    const owner = await register('settings-null@example.com');
    const ws = await createWorkspace(owner.accessToken);
    const response = await request(app)
      .patch(`/api/v1/workspaces/${ws.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ description: '   ' });
    expect(response.status).toBe(200);
    expect(response.body.data.workspace.description).toBeNull();
  });

  it('rejects invalid settings input', async () => {
    const owner = await register('settings-invalid@example.com');
    const ws = await createWorkspace(owner.accessToken);

    const empty = await request(app)
      .patch(`/api/v1/workspaces/${ws.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({});
    expect(empty.status).toBe(400);

    const name = await request(app)
      .patch(`/api/v1/workspaces/${ws.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: '' });
    expect(name.status).toBe(400);

    const longDescription = await request(app)
      .patch(`/api/v1/workspaces/${ws.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ description: 'a'.repeat(501) });
    expect(longDescription.status).toBe(400);

    const logoUrl = await request(app)
      .patch(`/api/v1/workspaces/${ws.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ logoUrl: 'ftp://example.com/logo.png' });
    expect(logoUrl.status).toBe(400);

    const slug = await request(app)
      .patch(`/api/v1/workspaces/${ws.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ slug: 'A' });
    expect(slug.status).toBe(400);
  });

  it('rejects a duplicate slug with 409', async () => {
    const owner = await register('settings-slug@example.com');
    await createWorkspace(owner.accessToken, 'First', 'taken-slug');
    const second = await createWorkspace(owner.accessToken, 'Second', 'other-slug');

    const response = await request(app)
      .patch(`/api/v1/workspaces/${second.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ slug: 'taken-slug' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('WORKSPACE_SLUG_TAKEN');
  });

  it('allows admins to update general settings but not slug', async () => {
    const owner = await register('settings-admin-owner@example.com');
    const admin = await register('settings-admin@example.com');
    const ws = await createWorkspace(owner.accessToken);
    await addMember(ws.id, admin.user.id, 'ADMIN');

    const allowed = await request(app)
      .patch(`/api/v1/workspaces/${ws.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ description: 'Admin edit' });
    expect(allowed.status).toBe(200);

    const denied = await request(app)
      .patch(`/api/v1/workspaces/${ws.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ slug: 'admin-slug' });
    expect(denied.status).toBe(403);
  });

  it('denies settings updates to members and non-members', async () => {
    const owner = await register('settings-member-owner@example.com');
    const member = await register('settings-member@example.com');
    const intruder = await register('settings-intruder@example.com');
    const ws = await createWorkspace(owner.accessToken);
    await addMember(ws.id, member.user.id, 'MEMBER');

    const memberResponse = await request(app)
      .patch(`/api/v1/workspaces/${ws.id}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ name: 'Nope' });
    expect(memberResponse.status).toBe(403);

    const intruderResponse = await request(app)
      .patch(`/api/v1/workspaces/${ws.id}`)
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .send({ name: 'Nope' });
    expect(intruderResponse.status).toBe(404);
  });
});

describe('workspace ownership transfer', () => {
  it('promotes the target and demotes the acting owner', async () => {
    const owner = await register('transfer-owner@example.com');
    const next = await register('transfer-next@example.com');
    const ws = await createWorkspace(owner.accessToken);
    const target = await addMember(ws.id, next.user.id, 'ADMIN');

    const response = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/ownership/transfer`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ targetMembershipId: target.id, currentPassword: PASSWORD });
    expect(response.status).toBe(200);
    expect(response.body.data.membership).toMatchObject({
      id: target.id,
      userId: next.user.id,
      role: 'OWNER',
      status: 'ACTIVE',
    });

    const ownerDetail = await request(app)
      .get(`/api/v1/workspaces/${ws.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(ownerDetail.body.data.membership.role).toBe('ADMIN');

    const owners = await prisma.workspaceMembership.count({
      where: { workspaceId: ws.id, role: 'OWNER', status: 'ACTIVE' },
    });
    expect(owners).toBe(1);
  });

  it('serializes concurrent transfers so only one succeeds', async () => {
    const owner = await register('transfer-race-owner@example.com');
    const first = await register('transfer-race-first@example.com');
    const second = await register('transfer-race-second@example.com');
    const ws = await createWorkspace(owner.accessToken);
    const firstTarget = await addMember(ws.id, first.user.id, 'ADMIN');
    const secondTarget = await addMember(ws.id, second.user.id, 'MEMBER');

    const [firstResult, secondResult] = await Promise.all([
      request(app)
        .post(`/api/v1/workspaces/${ws.id}/ownership/transfer`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ targetMembershipId: firstTarget.id, currentPassword: PASSWORD }),
      request(app)
        .post(`/api/v1/workspaces/${ws.id}/ownership/transfer`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ targetMembershipId: secondTarget.id, currentPassword: PASSWORD }),
    ]);

    expect([firstResult.status, secondResult.status].sort()).toEqual([200, 403]);
    const owners = await prisma.workspaceMembership.count({
      where: { workspaceId: ws.id, role: 'OWNER', status: 'ACTIVE' },
    });
    expect(owners).toBe(1);
  });

  it('rejects an incorrect current password', async () => {
    const owner = await register('transfer-badpw@example.com');
    const next = await register('transfer-badpw-next@example.com');
    const ws = await createWorkspace(owner.accessToken);
    const target = await addMember(ws.id, next.user.id, 'MEMBER');

    const response = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/ownership/transfer`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ targetMembershipId: target.id, currentPassword: 'wrong-password' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
  });

  it('denies transfer to non-owners and non-members', async () => {
    const owner = await register('transfer-deny-owner@example.com');
    const admin = await register('transfer-deny-admin@example.com');
    const intruder = await register('transfer-deny-intruder@example.com');
    const ws = await createWorkspace(owner.accessToken);
    const adminMembership = await addMember(ws.id, admin.user.id, 'ADMIN');

    const adminResponse = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/ownership/transfer`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ targetMembershipId: adminMembership.id, currentPassword: PASSWORD });
    expect(adminResponse.status).toBe(403);

    const intruderResponse = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/ownership/transfer`)
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .send({ targetMembershipId: adminMembership.id, currentPassword: PASSWORD });
    expect(intruderResponse.status).toBe(404);
  });

  it('rejects self, inactive, already-owner, and missing targets', async () => {
    const owner = await register('transfer-cases@example.com');
    const other = await register('transfer-cases-other@example.com');
    const ws = await createWorkspace(owner.accessToken);
    const self = await prisma.workspaceMembership.findFirstOrThrow({
      where: { workspaceId: ws.id, userId: owner.user.id },
      select: { id: true },
    });
    const inactive = await prisma.workspaceMembership.create({
      data: { workspaceId: ws.id, userId: other.user.id, role: 'MEMBER', status: 'SUSPENDED' },
      select: { id: true },
    });

    const send = (targetMembershipId: string) =>
      request(app)
        .post(`/api/v1/workspaces/${ws.id}/ownership/transfer`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ targetMembershipId, currentPassword: PASSWORD });

    const secondOwnerUser = await register('transfer-cases-second-owner@example.com');
    const secondOwner = await addMember(ws.id, secondOwnerUser.user.id, 'OWNER');

    expect((await send(self.id)).body.error.code).toBe('CANNOT_TRANSFER_TO_SELF');
    expect((await send(inactive.id)).body.error.code).toBe('MEMBER_NOT_ACTIVE');
    expect((await send(secondOwner.id)).body.error.code).toBe('ALREADY_OWNER');
    expect((await send('does-not-exist')).body.error.code).toBe('MEMBER_NOT_FOUND');

    const ws2 = await createWorkspace(owner.accessToken, 'Another', 'another-slug');
    const foreign = await register('transfer-cases-foreign@example.com');
    const foreignWs = await createWorkspace(foreign.accessToken, 'Foreign', 'foreign-slug');
    const foreignMember = await addMember(foreignWs.id, other.user.id, 'MEMBER');
    const cross = await request(app)
      .post(`/api/v1/workspaces/${ws2.id}/ownership/transfer`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ targetMembershipId: foreignMember.id, currentPassword: PASSWORD });
    expect(cross.status).toBe(404);
  });

  it('rejects transfer for a workspace that does not exist', async () => {
    const owner = await register('transfer-missing@example.com');
    const response = await request(app)
      .post('/api/v1/workspaces/missing-workspace/ownership/transfer')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ targetMembershipId: 'anything', currentPassword: PASSWORD });
    expect(response.status).toBe(404);
  });

  it('validates transfer body', async () => {
    const owner = await register('transfer-validation@example.com');
    const ws = await createWorkspace(owner.accessToken);
    const response = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/ownership/transfer`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ targetMembershipId: '', currentPassword: '' });
    expect(response.status).toBe(400);
  });
});
