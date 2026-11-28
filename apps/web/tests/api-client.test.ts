import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  apiRequest,
  configureAuthHooks,
  resetAuthHooks,
  setAccessToken,
} from '@/lib/api-client';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({ request: requestMock })),
    isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError),
  },
}));

function axiosResponse(payload: unknown, status = 200) {
  return { data: payload, status, headers: {} };
}

function axiosError(status: number, payload: unknown) {
  return {
    isAxiosError: true,
    response: { status, data: payload },
    message: 'Request failed',
  };
}

describe('API client', () => {
  beforeEach(() => {
    resetAuthHooks();
    requestMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unwraps the API data envelope and sends credentials', async () => {
    requestMock.mockResolvedValue(axiosResponse({ data: { status: 'ok' } }));

    const result = await apiRequest<{ status: string }>('/health');

    expect(result).toEqual({ status: 'ok' });
    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/health',
        method: 'GET',
        withCredentials: true,
      }),
    );
  });

  it('turns API error envelopes into typed ApiError instances', async () => {
    requestMock.mockRejectedValue(
      axiosError(404, {
        error: {
          code: 'NOT_FOUND',
          message: 'The requested route was not found',
          requestId: 'request-123',
        },
      }),
    );

    await expect(apiRequest('/missing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'NOT_FOUND',
      requestId: 'request-123',
    });
  });

  it('refreshes once on 401 and retries with the new access token', async () => {
    requestMock
      .mockRejectedValueOnce(axiosError(401, { error: { code: 'UNAUTHORIZED', message: 'No' } }))
      .mockResolvedValueOnce(axiosResponse({ data: { ok: true } }));

    const refreshAccessToken = vi.fn().mockResolvedValue('fresh-token');
    configureAuthHooks({ refreshAccessToken });

    const result = await apiRequest<{ ok: boolean }>('/me');

    expect(result).toEqual({ ok: true });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledTimes(2);

    const secondCall = requestMock.mock.calls[1]?.[0] as { headers: Record<string, string> };
    expect(secondCall.headers.Authorization).toBe('Bearer fresh-token');
  });

  it('does not retry when the refresh token is not available', async () => {
    requestMock.mockRejectedValue(
      axiosError(401, { error: { code: 'UNAUTHORIZED', message: 'No' } }),
    );
    configureAuthHooks({ refreshAccessToken: () => Promise.resolve(null) });

    await expect(apiRequest('/me')).rejects.toBeInstanceOf(ApiError);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('sends the in-memory access token as a bearer header', async () => {
    requestMock.mockResolvedValue(axiosResponse({ data: { ok: true } }));
    setAccessToken('memory-token');

    await apiRequest('/me');

    const [config] = requestMock.mock.calls[0] as [{ headers: Record<string, string> }];
    expect(config.headers.Authorization).toBe('Bearer memory-token');
  });
});
