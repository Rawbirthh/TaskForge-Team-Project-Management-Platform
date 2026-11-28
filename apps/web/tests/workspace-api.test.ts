import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkspace, listWorkspaces } from '@/features/workspaces/workspace-api';
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
});
