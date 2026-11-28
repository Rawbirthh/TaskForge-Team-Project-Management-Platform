import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  archiveProject,
  createProject,
  getProject,
  listProjects,
  restoreProject,
  updateProject,
} from '@/features/projects/project-api';
import { apiRequest } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

describe('project API', () => {
  afterEach(() => {
    apiRequestMock.mockReset();
  });

  it('lists projects with bounded, allowlisted query params', async () => {
    apiRequestMock.mockResolvedValue({ items: [], page: 2, limit: 5, total: 0 });

    const result = await listProjects('ws_1', {
      page: 2,
      limit: 5,
      status: 'ACTIVE',
      visibility: 'PRIVATE',
      q: 'alpha',
    });

    expect(result).toEqual({ items: [], page: 2, limit: 5, total: 0 });
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/workspaces/ws_1/projects?page=2&limit=5&status=ACTIVE&visibility=PRIVATE&q=alpha',
    );
  });

  it('omits query params when no filters are provided', async () => {
    apiRequestMock.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 });

    await listProjects('ws_1');

    expect(apiRequestMock).toHaveBeenCalledWith('/workspaces/ws_1/projects');
  });

  it('creates a project with POST', async () => {
    apiRequestMock.mockResolvedValue({ project: { id: 'p1' } });

    const input = {
      key: 'ALPHA',
      name: 'Alpha',
      visibility: 'WORKSPACE' as const,
      status: 'ACTIVE' as const,
    };
    await createProject('ws_1', input);

    expect(apiRequestMock).toHaveBeenCalledWith('/workspaces/ws_1/projects', {
      method: 'POST',
      body: input,
    });
  });

  it('gets, updates, archives, and restores a project', async () => {
    apiRequestMock.mockResolvedValue({ project: { id: 'p1' } });

    await getProject('ws_1', 'p1');
    expect(apiRequestMock).toHaveBeenLastCalledWith('/workspaces/ws_1/projects/p1');

    await updateProject('ws_1', 'p1', { name: 'Renamed' });
    expect(apiRequestMock).toHaveBeenLastCalledWith('/workspaces/ws_1/projects/p1', {
      method: 'PATCH',
      body: { name: 'Renamed' },
    });

    await archiveProject('ws_1', 'p1');
    expect(apiRequestMock).toHaveBeenLastCalledWith('/workspaces/ws_1/projects/p1/archive', {
      method: 'POST',
    });

    await restoreProject('ws_1', 'p1');
    expect(apiRequestMock).toHaveBeenLastCalledWith('/workspaces/ws_1/projects/p1/restore', {
      method: 'POST',
    });
  });
});
