import { afterEach, describe, expect, it, vi } from 'vitest';
import { listSessions } from '@/features/profile/profile-api';
import { apiRequest } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

describe('profile API', () => {
  afterEach(() => {
    apiRequestMock.mockReset();
  });

  it('requests the first sessions page without a cursor', async () => {
    apiRequestMock.mockResolvedValue({ sessions: [], nextCursor: null });

    const result = await listSessions();

    expect(result).toEqual({ sessions: [], nextCursor: null });
    expect(apiRequestMock).toHaveBeenCalledWith('/users/me/sessions');
  });

  it('encodes the cursor when requesting a later sessions page', async () => {
    apiRequestMock.mockResolvedValue({ sessions: [], nextCursor: null });

    await listSessions('cursor/with spaces');

    expect(apiRequestMock).toHaveBeenCalledWith('/users/me/sessions?cursor=cursor%2Fwith%20spaces');
  });
});
