import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();
const PASSWORD = 'password123456';

type ProjectDto = {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string | null;
  visibility: 'WORKSPACE' | 'PRIVATE';
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  startDate: string | null;
  targetDate: string | null;
  createdBy: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

async function cleanup(): Promise<void> {
  await prisma.project.deleteMany();
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

async function register(email: string) {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .set('Origin', 'http://localhost:5173')
    .send({ email, password: PASSWORD, displayName: 'Project User' });
  expect(response.status).toBe(201);
  return {
    accessToken: response.body.data.accessToken as string,
    user: response.body.data.user as { id: string },
  };
}

async function createWorkspace(accessToken: string, name = 'Projects WS', slug?: string) {
  const response = await request(app)
    .post('/api/v1/workspaces')
    .set('Authorization', `Bearer ${accessToken}`)
    .send(slug ? { name, slug } : { name });
  expect(response.status).toBe(201);
  return response.body.data.workspace as { id: string; slug: string };
}

async function addMember(
  workspaceId: string,
  userId: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST',
  status: 'ACTIVE' | 'SUSPENDED' | 'REMOVED' = 'ACTIVE',
) {
  return prisma.workspaceMembership.create({
    data: { workspaceId, userId, role, status },
    select: { id: true },
  });
}

function postProject(accessToken: string, workspaceId: string, body: Record<string, unknown>) {
  return request(app)
    .post(`/api/v1/workspaces/${workspaceId}/projects`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send(body);
}

function getProject(accessToken: string, workspaceId: string, projectId: string) {
  return request(app)
    .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
    .set('Authorization', `Bearer ${accessToken}`);
}

function patchProject(
  accessToken: string,
  workspaceId: string,
  projectId: string,
  body: Record<string, unknown>,
) {
  return request(app)
    .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send(body);
}

async function createProjectAs(
  accessToken: string,
  workspaceId: string,
  overrides: Record<string, unknown> = {},
): Promise<ProjectDto> {
  const response = await postProject(accessToken, workspaceId, {
    key: 'ALPHA',
    name: 'Alpha Project',
    ...overrides,
  });
  expect(response.status).toBe(201);
  return response.body.data.project as ProjectDto;
}

describe('project creation (T1–T6)', () => {
  it('creates with all fields, normalizes the key, and persists server-derived fields', async () => {
    const owner = await register('projects-owner@example.com');
    const ws = await createWorkspace(owner.accessToken);

    const response = await postProject(owner.accessToken, ws.id, {
      key: ' alpha ',
      name: ' Alpha Project ',
      description: 'A short description',
      visibility: 'PRIVATE',
      startDate: '2026-01-02',
      targetDate: '2026-02-03',
      status: 'ACTIVE',
    });
    expect(response.status).toBe(201);
    const project = response.body.data.project as ProjectDto;
    expect(project).toMatchObject({
      key: 'ALPHA',
      name: 'Alpha Project',
      description: 'A short description',
      visibility: 'PRIVATE',
      status: 'ACTIVE',
      startDate: '2026-01-02',
      targetDate: '2026-02-03',
    });
    expect(project.workspaceId).toBe(ws.id);
    expect(project.createdBy.id).toBe(owner.user.id);
    expect(project.archivedAt).toBeNull();

    const stored = await prisma.project.findUnique({
      where: { id: project.id },
      select: { workspaceId: true, createdByUserId: true, archivedAt: true },
    });
    expect(stored).toMatchObject({ workspaceId: ws.id, createdByUserId: owner.user.id });
    expect(stored?.archivedAt).toBeNull();

    const fetched = await getProject(owner.accessToken, ws.id, project.id);
    expect(fetched.status).toBe(200);
    expect((fetched.body.data.project as ProjectDto).startDate).toBe('2026-01-02');
    expect((fetched.body.data.project as ProjectDto).targetDate).toBe('2026-02-03');
  });

  it('lets an admin create a project', async () => {
    const owner = await register('projects-admin-owner@example.com');
    const admin = await register('projects-admin@example.com');
    const ws = await createWorkspace(owner.accessToken);
    await addMember(ws.id, admin.user.id, 'ADMIN');

    const project = await createProjectAs(admin.accessToken, ws.id);
    expect(project.createdBy.id).toBe(admin.user.id);
  });

  it('rejects invalid key, name, visibility, status, and date formats', async () => {
    const owner = await register('projects-validation@example.com');
    const ws = await createWorkspace(owner.accessToken);

    const invalidBodies: Array<Record<string, unknown>> = [
      { key: '1BAD', name: 'Valid Name' },
      { key: 'A', name: 'Valid Name' },
      { key: 'A-B', name: 'Valid Name' },
      { key: 'VALID', name: '   ' },
      { key: 'VALID', name: 'Valid Name', visibility: 'SECRET' },
      { key: 'VALID', name: 'Valid Name', status: 'ARCHIVED' },
      { key: 'VALID', name: 'Valid Name', startDate: '2026-02-30' },
      { key: 'VALID', name: 'Valid Name', targetDate: '2026/02/03' },
    ];
    for (const body of invalidBodies) {
      const response = await postProject(owner.accessToken, ws.id, body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(response.body.error.details)).toBe(true);
    }
  });

  it('rejects target dates before start dates on create and on partial update', async () => {
    const owner = await register('projects-dates@example.com');
    const ws = await createWorkspace(owner.accessToken);

    const invalidCreate = await postProject(owner.accessToken, ws.id, {
      key: 'DATES',
      name: 'Date Project',
      startDate: '2026-03-10',
      targetDate: '2026-03-01',
    });
    expect(invalidCreate.status).toBe(400);
    expect(invalidCreate.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'targetDate' })]),
    );

    const project = await createProjectAs(owner.accessToken, ws.id, {
      key: 'DATES',
      name: 'Date Project',
      startDate: '2026-03-10',
    });
    const invalidUpdate = await patchProject(owner.accessToken, ws.id, project.id, {
      targetDate: '2026-03-01',
    });
    expect(invalidUpdate.status).toBe(400);
    expect(invalidUpdate.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'targetDate' })]),
    );
  });

  it('round-trips date-only values without a timezone shift', async () => {
    const owner = await register('projects-date-roundtrip@example.com');
    const ws = await createWorkspace(owner.accessToken);
    const project = await createProjectAs(owner.accessToken, ws.id, {
      startDate: '2026-12-31',
      targetDate: '2027-01-01',
    });
    expect(project.startDate).toBe('2026-12-31');
    expect(project.targetDate).toBe('2027-01-01');

    const response = await patchProject(owner.accessToken, ws.id, project.id, {
      targetDate: '2027-02-02',
    });
    expect((response.body.data.project as ProjectDto).targetDate).toBe('2027-02-02');
  });

  it('ignores forged server-derived fields and rejects ARCHIVED as an initial status', async () => {
    const owner = await register('projects-forged-owner@example.com');
    const other = await register('projects-forged-other@example.com');
    const wsA = await createWorkspace(owner.accessToken, 'Forge A', 'forge-a');
    const wsB = await createWorkspace(other.accessToken, 'Forge B', 'forge-b');

    const forged = await postProject(owner.accessToken, wsA.id, {
      key: 'FORGE',
      name: 'Forged Project',
      workspaceId: wsB.id,
      createdByUserId: other.user.id,
      archivedAt: '2020-01-01T00:00:00.000Z',
      id: 'client-chosen-id',
    });
    expect(forged.status).toBe(201);
    const project = forged.body.data.project as ProjectDto;
    expect(project.workspaceId).toBe(wsA.id);
    expect(project.createdBy.id).toBe(owner.user.id);
    expect(project.archivedAt).toBeNull();
    expect(project.id).not.toBe('client-chosen-id');

    const archived = await postProject(owner.accessToken, wsA.id, {
      key: 'ARCHV',
      name: 'Archived At Creation',
      status: 'ARCHIVED',
    });
    expect(archived.status).toBe(400);
    expect(archived.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('exposes only approved DTO fields', async () => {
    const owner = await register('projects-dto@example.com');
    const ws = await createWorkspace(owner.accessToken);
    const project = await createProjectAs(owner.accessToken, ws.id);
    expect(Object.keys(project).sort()).toEqual(
      [
        'archivedAt',
        'createdAt',
        'createdBy',
        'description',
        'id',
        'key',
        'name',
        'startDate',
        'status',
        'targetDate',
        'updatedAt',
        'visibility',
        'workspaceId',
      ].sort(),
    );
    expect(project.createdBy).not.toHaveProperty('email');
    expect(project).not.toHaveProperty('passwordHash');
    expect(project).not.toHaveProperty('refreshTokenHash');
  });
});

describe('project authorization and tenant isolation (T7–T13)', () => {
  it('denies create/manage actions for MEMBER and GUEST', async () => {
    const owner = await register('projects-roles-owner@example.com');
    const member = await register('projects-roles-member@example.com');
    const guest = await register('projects-roles-guest@example.com');
    const ws = await createWorkspace(owner.accessToken);
    await addMember(ws.id, member.user.id, 'MEMBER');
    await addMember(ws.id, guest.user.id, 'GUEST');
    const project = await createProjectAs(owner.accessToken, ws.id);

    for (const actor of [member, guest]) {
      const create = await postProject(actor.accessToken, ws.id, {
        key: 'DENIED',
        name: 'Denied Project',
      });
      expect(create.status).toBe(403);
      expect(create.body.error.code).toBe('FORBIDDEN');

      const update = await patchProject(actor.accessToken, ws.id, project.id, { name: 'Nope' });
      expect(update.status).toBe(403);

      const archive = await request(app)
        .post(`/api/v1/workspaces/${ws.id}/projects/${project.id}/archive`)
        .set('Authorization', `Bearer ${actor.accessToken}`);
      expect(archive.status).toBe(403);

      const restore = await request(app)
        .post(`/api/v1/workspaces/${ws.id}/projects/${project.id}/restore`)
        .set('Authorization', `Bearer ${actor.accessToken}`);
      expect(restore.status).toBe(403);
    }
  });

  it('denies suspended and removed members on create, list, and detail', async () => {
    const owner = await register('projects-suspended-owner@example.com');
    const suspended = await register('projects-suspended@example.com');
    const removed = await register('projects-removed@example.com');
    const ws = await createWorkspace(owner.accessToken);
    await addMember(ws.id, suspended.user.id, 'MEMBER', 'SUSPENDED');
    await addMember(ws.id, removed.user.id, 'MEMBER', 'REMOVED');
    const project = await createProjectAs(owner.accessToken, ws.id);

    for (const actor of [suspended, removed]) {
      const create = await postProject(actor.accessToken, ws.id, {
        key: 'BLOCKED',
        name: 'Blocked Project',
      });
      expect(create.status).toBe(404);
      expect(create.body.error.code).toBe('WORKSPACE_NOT_FOUND');

      const list = await request(app)
        .get(`/api/v1/workspaces/${ws.id}/projects`)
        .set('Authorization', `Bearer ${actor.accessToken}`);
      expect(list.status).toBe(404);

      const detail = await getProject(actor.accessToken, ws.id, project.id);
      expect(detail.status).toBe(404);
    }
  });

  it('returns 404 for guessed workspace IDs and projects from another workspace', async () => {
    const owner = await register('projects-isolation@example.com');
    const outsider = await register('projects-outsider@example.com');
    const wsA = await createWorkspace(owner.accessToken, 'Isolation A', 'isolation-a');
    const wsB = await createWorkspace(owner.accessToken, 'Isolation B', 'isolation-b');
    await createWorkspace(outsider.accessToken, 'Isolation C', 'isolation-c');
    const projectA = await createProjectAs(owner.accessToken, wsA.id);

    const guessed = await request(app)
      .get(`/api/v1/workspaces/${wsB.id}/projects`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);
    expect(guessed.status).toBe(404);
    expect(guessed.body.error.code).toBe('WORKSPACE_NOT_FOUND');

    const swapped = await getProject(owner.accessToken, wsB.id, projectA.id);
    expect(swapped.status).toBe(404);
    expect(swapped.body.error.code).toBe('PROJECT_NOT_FOUND');
  });

  it('excludes private projects from member/guest lists and totals', async () => {
    const owner = await register('projects-private-owner@example.com');
    const member = await register('projects-private-member@example.com');
    const guest = await register('projects-private-guest@example.com');
    const ws = await createWorkspace(owner.accessToken);
    await addMember(ws.id, member.user.id, 'MEMBER');
    await addMember(ws.id, guest.user.id, 'GUEST');
    await createProjectAs(owner.accessToken, ws.id, { key: 'OPEN1', name: 'Open One' });
    await createProjectAs(owner.accessToken, ws.id, { key: 'OPEN2', name: 'Open Two' });
    await createProjectAs(owner.accessToken, ws.id, {
      key: 'SECRET',
      name: 'Secret Project',
      visibility: 'PRIVATE',
    });

    for (const actor of [member, guest]) {
      const list = await request(app)
        .get(`/api/v1/workspaces/${ws.id}/projects`)
        .set('Authorization', `Bearer ${actor.accessToken}`);
      expect(list.status).toBe(200);
      expect(list.body.data.total).toBe(2);
      expect(list.body.data.items).toHaveLength(2);
      expect(list.body.data.items).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ key: 'SECRET' })]),
      );
    }
  });

  it('returns 404 when a member guesses a private project ID', async () => {
    const owner = await register('projects-private-guess-owner@example.com');
    const member = await register('projects-private-guess-member@example.com');
    const ws = await createWorkspace(owner.accessToken);
    await addMember(ws.id, member.user.id, 'MEMBER');
    const privateProject = await createProjectAs(owner.accessToken, ws.id, {
      visibility: 'PRIVATE',
    });

    const detail = await getProject(member.accessToken, ws.id, privateProject.id);
    expect(detail.status).toBe(404);
    expect(detail.body.error.code).toBe('PROJECT_NOT_FOUND');
  });

  it('allows the creator (after demotion) and workspace owners/admins to read a private project', async () => {
    const creator = await register('projects-private-creator@example.com');
    const coOwner = await register('projects-private-coowner@example.com');
    const admin = await register('projects-private-admin@example.com');
    const ws = await createWorkspace(creator.accessToken);
    await addMember(ws.id, coOwner.user.id, 'OWNER');
    await addMember(ws.id, admin.user.id, 'ADMIN');
    const project = await createProjectAs(creator.accessToken, ws.id, { visibility: 'PRIVATE' });

    await prisma.workspaceMembership.updateMany({
      where: { workspaceId: ws.id, userId: creator.user.id },
      data: { role: 'MEMBER' },
    });

    for (const actor of [creator, coOwner, admin]) {
      const response = await getProject(actor.accessToken, ws.id, project.id);
      expect(response.status).toBe(200);
    }
  });

  it('ignores forged fields on PATCH and denies cross-workspace mutations', async () => {
    const owner = await register('projects-patch-forge@example.com');
    const other = await register('projects-patch-other@example.com');
    const wsA = await createWorkspace(owner.accessToken, 'Patch A', 'patch-a');
    const wsB = await createWorkspace(owner.accessToken, 'Patch B', 'patch-b');
    const projectA = await createProjectAs(owner.accessToken, wsA.id);
    const projectB = await createProjectAs(owner.accessToken, wsB.id, {
      key: 'SECOND',
      name: 'Second Project',
    });

    const patched = await patchProject(owner.accessToken, wsA.id, projectA.id, {
      name: 'Renamed',
      workspaceId: wsB.id,
      createdByUserId: other.user.id,
      updatedAt: '2020-01-01T00:00:00.000Z',
      archivedAt: '2020-01-01T00:00:00.000Z',
    });
    expect(patched.status).toBe(200);
    const result = patched.body.data.project as ProjectDto;
    expect(result.name).toBe('Renamed');
    expect(result.workspaceId).toBe(wsA.id);
    expect(result.createdBy.id).toBe(owner.user.id);
    expect(result.archivedAt).toBeNull();

    const swappedPatch = await patchProject(owner.accessToken, wsA.id, projectB.id, {
      name: 'Cross Workspace',
    });
    expect(swappedPatch.status).toBe(404);
    expect(swappedPatch.body.error.code).toBe('PROJECT_NOT_FOUND');

    const swappedArchive = await request(app)
      .post(`/api/v1/workspaces/${wsA.id}/projects/${projectB.id}/archive`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(swappedArchive.status).toBe(404);
    expect(swappedArchive.body.error.code).toBe('PROJECT_NOT_FOUND');

    const swappedRestore = await request(app)
      .post(`/api/v1/workspaces/${wsA.id}/projects/${projectB.id}/restore`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(swappedRestore.status).toBe(404);
    expect(swappedRestore.body.error.code).toBe('PROJECT_NOT_FOUND');
  });
});

describe('project lifecycle and uniqueness (T14–T18)', () => {
  it('supports lifecycle transitions and archive/restore', async () => {
    const owner = await register('projects-lifecycle@example.com');
    const ws = await createWorkspace(owner.accessToken);
    const project = await createProjectAs(owner.accessToken, ws.id);

    for (const status of ['PAUSED', 'COMPLETED', 'ACTIVE'] as const) {
      const response = await patchProject(owner.accessToken, ws.id, project.id, { status });
      expect(response.status).toBe(200);
      expect((response.body.data.project as ProjectDto).status).toBe(status);
    }

    const archive = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/projects/${project.id}/archive`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(archive.status).toBe(200);
    const archived = archive.body.data.project as ProjectDto;
    expect(archived.status).toBe('ARCHIVED');
    expect(archived.archivedAt).not.toBeNull();

    const restore = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/projects/${project.id}/restore`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(restore.status).toBe(200);
    const restored = restore.body.data.project as ProjectDto;
    expect(restored.status).toBe('ACTIVE');
    expect(restored.archivedAt).toBeNull();
  });

  it('enforces key and name uniqueness within a workspace but not across workspaces', async () => {
    const owner = await register('projects-unique@example.com');
    const wsA = await createWorkspace(owner.accessToken, 'Unique A', 'unique-a');
    const wsB = await createWorkspace(owner.accessToken, 'Unique B', 'unique-b');
    await createProjectAs(owner.accessToken, wsA.id, { key: 'SAME', name: 'Same Name' });

    const duplicateKey = await postProject(owner.accessToken, wsA.id, {
      key: 'SAME',
      name: 'Different Name',
    });
    expect(duplicateKey.status).toBe(409);
    expect(duplicateKey.body.error.code).toBe('PROJECT_KEY_TAKEN');

    const duplicateName = await postProject(owner.accessToken, wsA.id, {
      key: 'OTHER',
      name: 'Same Name',
    });
    expect(duplicateName.status).toBe(409);
    expect(duplicateName.body.error.code).toBe('PROJECT_NAME_TAKEN');

    const otherWorkspace = await postProject(owner.accessToken, wsB.id, {
      key: 'SAME',
      name: 'Same Name',
    });
    expect(otherWorkspace.status).toBe(201);
  });

  it('creates exactly one row for concurrent duplicate-key creates', async () => {
    const owner = await register('projects-concurrent@example.com');
    const ws = await createWorkspace(owner.accessToken);
    const body = { key: 'RACE', name: 'Race Project' };
    const results = await Promise.all([
      postProject(owner.accessToken, ws.id, body),
      postProject(owner.accessToken, ws.id, body),
    ]);
    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(1);
    expect(await prisma.project.count({ where: { workspaceId: ws.id } })).toBe(1);
  });

  it('keeps archived projects read-only and rejects invalid transitions', async () => {
    const owner = await register('projects-archived@example.com');
    const ws = await createWorkspace(owner.accessToken);
    const project = await createProjectAs(owner.accessToken, ws.id);

    const archive = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/projects/${project.id}/archive`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(archive.status).toBe(200);

    const edit = await patchProject(owner.accessToken, ws.id, project.id, { name: 'Nope' });
    expect(edit.status).toBe(409);
    expect(edit.body.error.code).toBe('PROJECT_ARCHIVED');

    const reArchive = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/projects/${project.id}/archive`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(reArchive.status).toBe(409);
    expect(reArchive.body.error.code).toBe('PROJECT_ARCHIVED');

    const restore = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/projects/${project.id}/restore`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(restore.status).toBe(200);

    const reRestore = await request(app)
      .post(`/api/v1/workspaces/${ws.id}/projects/${project.id}/restore`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(reRestore.status).toBe(409);
    expect(reRestore.body.error.code).toBe('INVALID_LIFECYCLE_TRANSITION');

    const editAfterRestore = await patchProject(owner.accessToken, ws.id, project.id, {
      name: 'Now Editable',
    });
    expect(editAfterRestore.status).toBe(200);
  });

  it('paginates, filters, and searches within the authorized workspace', async () => {
    const owner = await register('projects-list@example.com');
    const ws = await createWorkspace(owner.accessToken);
    await createProjectAs(owner.accessToken, ws.id, {
      key: 'FIRST',
      name: 'First Project',
      status: 'ACTIVE',
    });
    await createProjectAs(owner.accessToken, ws.id, {
      key: 'SECOND',
      name: 'Second Project',
      status: 'PAUSED',
    });
    await createProjectAs(owner.accessToken, ws.id, {
      key: 'THIRD',
      name: 'Third Project',
      visibility: 'PRIVATE',
    });

    const list = (query: string) =>
      request(app)
        .get(`/api/v1/workspaces/${ws.id}/projects?${query}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

    const all = await list('page=1&limit=2');
    expect(all.status).toBe(200);
    expect(all.body.data.items).toHaveLength(2);
    expect(all.body.data.total).toBe(3);
    expect(all.body.data.page).toBe(1);
    expect(all.body.data.limit).toBe(2);

    const paused = await list('status=PAUSED');
    expect(paused.body.data.total).toBe(1);
    expect((paused.body.data.items[0] as ProjectDto).key).toBe('SECOND');

    const privateOnly = await list('visibility=PRIVATE');
    expect(privateOnly.body.data.total).toBe(1);
    expect((privateOnly.body.data.items[0] as ProjectDto).key).toBe('THIRD');

    const byName = await list('q=first');
    expect(byName.body.data.total).toBe(1);
    expect((byName.body.data.items[0] as ProjectDto).key).toBe('FIRST');

    const byKey = await list('q=SECOND');
    expect(byKey.body.data.total).toBe(1);
    expect((byKey.body.data.items[0] as ProjectDto).key).toBe('SECOND');

    const combined = await list('status=ACTIVE&visibility=WORKSPACE&q=first');
    expect(combined.body.data.total).toBe(1);
    expect((combined.body.data.items[0] as ProjectDto).key).toBe('FIRST');

    const invalidLimit = await list('limit=51');
    expect(invalidLimit.status).toBe(400);
    const invalidPage = await list('page=0');
    expect(invalidPage.status).toBe(400);
  });
});

describe('project guest access', () => {
  it('requires authentication on every endpoint', async () => {
    const base = '/api/v1/workspaces/abc/projects';
    expect((await request(app).post(base).send({})).status).toBe(401);
    expect((await request(app).get(base)).status).toBe(401);
    expect((await request(app).get(`${base}/def`)).status).toBe(401);
    expect((await request(app).patch(`${base}/def`).send({ name: 'X' })).status).toBe(401);
    expect((await request(app).post(`${base}/def/archive`)).status).toBe(401);
    expect((await request(app).post(`${base}/def/restore`)).status).toBe(401);
  });
});
