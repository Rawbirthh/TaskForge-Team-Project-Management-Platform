import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  apiRequest,
  configureAuthHooks,
  resetAuthHooks,
  setAccessToken,
} from '@/lib/api-client';

function mockResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(payload),
  } as Response;
}

describe('API client', () => {
  beforeEach(() => {
    resetAuthHooks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unwraps the API data envelope and sends credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ data: { status: 'ok' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiRequest<{ status: string }>('/health');

    expect(result).toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/health',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('turns API error envelopes into typed ApiError instances', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'The requested route was not found',
            requestId: 'request-123',
          },
        },
        404,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/missing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'NOT_FOUND',
      requestId: 'request-123',
    });
  });

  it('refreshes once on 401 and retries with the new access token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ error: { code: 'UNAUTHORIZED', message: 'No' } }, 401))
      .mockResolvedValueOnce(mockResponse({ data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    const refreshAccessToken = vi.fn().mockResolvedValue('fresh-token');
    configureAuthHooks({ refreshAccessToken });

    const result = await apiRequest<{ ok: boolean }>('/me');

    expect(result).toEqual({ ok: true });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(new Headers(secondCall[1].headers).get('Authorization')).toBe('Bearer fresh-token');
  });

  it('does not retry when the refresh token is not available', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ error: { code: 'UNAUTHORIZED', message: 'No' } }, 401));
    vi.stubGlobal('fetch', fetchMock);
    configureAuthHooks({ refreshAccessToken: () => Promise.resolve(null) });

    await expect(apiRequest('/me')).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends the in-memory access token as a bearer header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken('memory-token');

    await apiRequest('/me');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/me');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer memory-token');
  });
});
