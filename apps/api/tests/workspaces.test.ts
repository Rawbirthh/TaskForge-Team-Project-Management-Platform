import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();

async function cleanup(): Promise<void> {
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

async function register(email = 'ws@example.com', password = 'password123456') {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .set('Origin', 'http://localhost:5173')
    .send({ email, password, displayName: 'Workspace User' });

  return {
    accessToken: response.body.data.accessToken as string,
    user: response.body.data.user,
  };
}

describe('workspace creation', () => {
  it('requires authentication', async () => {
    const response = await request(app).post('/api/v1/workspaces').send({ name: 'Acme' });
    expect(response.status).toBe(401);
  });

  it('creates a workspace and owner membership', async () => {
    const { accessToken } = await register();
    const response = await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Acme Corp' });

    expect(response.status).toBe(201);
    expect(response.body.data.workspace.name).toBe('Acme Corp');
    expect(response.body.data.workspace.slug).toBe('acme-corp');
    expect(response.body.data.workspace.id).toBeTruthy();

    const list = await request(app)
      .get('/api/v1/workspaces')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].membership.role).toBe('OWNER');
    expect(list.body.data.items[0].membership.status).toBe('ACTIVE');
  });

  it('derives slug from name when omitted', async () => {
    const { accessToken } = await register('derive@example.com');
    const response = await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Hello World!' });
    expect(response.status).toBe(201);
    expect(response.body.data.workspace.slug).toBe('hello-world');
  });

  it('uses provided slug', async () => {
    const { accessToken } = await register('slug@example.com');
    const response = await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Acme', slug: 'my-acme' });
    expect(response.status).toBe(201);
    expect(response.body.data.workspace.slug).toBe('my-acme');
  });

  it('rejects duplicate slug', async () => {
    const { accessToken } = await register('dup@example.com');
    await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'First', slug: 'shared-slug' });

    const second = await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Second', slug: 'shared-slug' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('WORKSPACE_SLUG_TAKEN');
  });

  it('rejects invalid name', async () => {
    const { accessToken } = await register('name@example.com');
    const response = await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '' });
    expect(response.status).toBe(400);
  });

  it('rejects invalid slug', async () => {
    const { accessToken } = await register('badslug@example.com');
    const response = await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Acme', slug: 'A' });
    expect(response.status).toBe(400);
  });

  it('rejects reserved slug', async () => {
    const { accessToken } = await register('reserved@example.com');
    const response = await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Admin', slug: 'admin' });
    expect(response.status).toBe(400);
  });
});

describe('workspace listing and access', () => {
  it('lists only the caller active memberships', async () => {
    const { accessToken: aToken } = await register('a@example.com');
    const { accessToken: bToken } = await register('b@example.com');

    await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${aToken}`)
      .send({ name: 'A Workspace' });

    await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${bToken}`)
      .send({ name: 'B Workspace' });

    const aList = await request(app)
      .get('/api/v1/workspaces')
      .set('Authorization', `Bearer ${aToken}`);
    expect(aList.status).toBe(200);
    expect(aList.body.data.items).toHaveLength(1);
    expect(aList.body.data.items[0].workspace.name).toBe('A Workspace');

    const bList = await request(app)
      .get('/api/v1/workspaces')
      .set('Authorization', `Bearer ${bToken}`);
    expect(bList.body.data.items).toHaveLength(1);
    expect(bList.body.data.items[0].workspace.name).toBe('B Workspace');
  });

  it('returns 404 for non-member workspace', async () => {
    const { accessToken: aToken } = await register('owner@example.com');
    const { accessToken: bToken } = await register('intruder@example.com');

    const create = await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${aToken}`)
      .send({ name: 'Private WS' });
    const wsId = create.body.data.workspace.id;

    const response = await request(app)
      .get(`/api/v1/workspaces/${wsId}`)
      .set('Authorization', `Bearer ${bToken}`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('WORKSPACE_NOT_FOUND');
  });

  it('returns workspace for member', async () => {
    const { accessToken } = await register('member@example.com');
    const create = await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'My WS' });
    const wsId = create.body.data.workspace.id;

    const response = await request(app)
      .get(`/api/v1/workspaces/${wsId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.workspace.id).toBe(wsId);
    expect(response.body.data.membership.role).toBe('OWNER');
  });

  it('validates workspace id param', async () => {
    const { accessToken } = await register('param@example.com');
    const response = await request(app)
      .get('/api/v1/workspaces/' + 'x'.repeat(100))
      .set('Authorization', `Bearer ${accessToken}`);
    expect(response.status).toBe(400);
  });

  it('paginates workspaces', async () => {
    const { accessToken } = await register('page@example.com');
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/v1/workspaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `WS ${i}` });
    }

    const response = await request(app)
      .get('/api/v1/workspaces?page=1&limit=2')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.total).toBe(3);
    expect(response.body.data.page).toBe(1);
    expect(response.body.data.limit).toBe(2);
  });

  it('rejects invalid pagination', async () => {
    const { accessToken } = await register('badpage@example.com');
    const response = await request(app)
      .get('/api/v1/workspaces?limit=100')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(response.status).toBe(400);
  });
});

describe('slug availability', () => {
  it('requires authentication', async () => {
    const response = await request(app).get('/api/v1/workspaces/slug-availability?slug=foo-bar');
    expect(response.status).toBe(401);
  });

  it('reports available and taken', async () => {
    const { accessToken } = await register('avail@example.com');
    await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Taken WS', slug: 'taken-slug' });

    const taken = await request(app)
      .get('/api/v1/workspaces/slug-availability?slug=taken-slug')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(taken.status).toBe(200);
    expect(taken.body.data.available).toBe(false);
    expect(taken.body.data.slug).toBe('taken-slug');

    const available = await request(app)
      .get('/api/v1/workspaces/slug-availability?slug=free-slug')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(available.status).toBe(200);
    expect(available.body.data.available).toBe(true);
  });

  it('rejects invalid slug input', async () => {
    const { accessToken } = await register('availbad@example.com');
    const response = await request(app)
      .get('/api/v1/workspaces/slug-availability?slug=a')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(response.status).toBe(400);
  });
});
