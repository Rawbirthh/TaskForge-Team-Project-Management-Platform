import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createWorkspace,
  listWorkspaces,
  transferOwnership,
  updateWorkspace,
} from '@/features/workspaces/workspace-api';
import { apiRequest } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

describe('workspace API', () => {
  afterEach(() => {
    apiRequestMock.mockReset();
  });

  it('lists workspaces with pagination query params', async () => {
    apiRequestMock.mockResolvedValue({ items: [], page: 2, limit: 5, total: 0 });

    const result = await listWorkspaces(2, 5);

    expect(result).toEqual({ items: [], page: 2, limit: 5, total: 0 });
    expect(apiRequestMock).toHaveBeenCalledWith('/workspaces?page=2&limit=5');
  });

  it('creates a workspace with a POST body', async () => {
    apiRequestMock.mockResolvedValue({
      workspace: { id: 'ws_1', name: 'Acme', slug: 'acme', createdAt: '', updatedAt: '' },
    });

    const result = await createWorkspace({ name: 'Acme', slug: 'acme' });

    expect(result.workspace.id).toBe('ws_1');
    expect(apiRequestMock).toHaveBeenCalledWith('/workspaces', {
      method: 'POST',
      body: { name: 'Acme', slug: 'acme' },
    });
  });

  it('updates workspace settings with PATCH', async () => {
    apiRequestMock.mockResolvedValue({ workspace: { id: 'ws_1' } });

    const result = await updateWorkspace('ws_1', { name: 'New name', description: null });

    expect(result.workspace.id).toBe('ws_1');
    expect(apiRequestMock).toHaveBeenCalledWith('/workspaces/ws_1', {
      method: 'PATCH',
      body: { name: 'New name', description: null },
    });
  });

  it('transfers ownership with a re-authenticated POST', async () => {
    apiRequestMock.mockResolvedValue({
      workspace: { id: 'ws_1' },
      membership: { id: 'mem_2', role: 'OWNER', status: 'ACTIVE' },
    });

    const result = await transferOwnership('ws_1', {
      targetMembershipId: 'mem_2',
      currentPassword: 'password123456',
    });

    expect(result.membership.role).toBe('OWNER');
    expect(apiRequestMock).toHaveBeenCalledWith('/workspaces/ws_1/ownership/transfer', {
      method: 'POST',
      body: { targetMembershipId: 'mem_2', currentPassword: 'password123456' },
    });
  });
});
