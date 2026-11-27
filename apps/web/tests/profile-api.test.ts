import { afterEach, describe, expect, it, vi } from 'vitest';
import { listSessions } from '@/features/profile/profile-api';

function mockResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(payload),
  } as Response;
}

describe('profile API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests the first sessions page without a cursor', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ data: { sessions: [], nextCursor: null } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await listSessions();

    expect(result).toEqual({ sessions: [], nextCursor: null });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/users/me/sessions',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('encodes the cursor when requesting a later sessions page', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ data: { sessions: [], nextCursor: null } }));
    vi.stubGlobal('fetch', fetchMock);

    await listSessions('cursor/with spaces');

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/users/me/sessions?cursor=cursor%2Fwith%20spaces');
  });
});
