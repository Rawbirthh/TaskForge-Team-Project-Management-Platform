import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/features/auth/auth-context';

function mockResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(payload),
  } as Response;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function AuthState() {
  const { accessToken, isRestoring } = useAuth();
  return <p data-testid="auth-state">{isRestoring ? 'restoring' : (accessToken ?? 'anonymous')}</p>;
}

function renderAuthProvider() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthState />
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

describe('session restore', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes only once under StrictMode and keeps the restored token', async () => {
    let refreshCalls = 0;
    let firstRefresh: Promise<Response> | null = null;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);

      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        if (!firstRefresh) {
          firstRefresh = Promise.resolve(mockResponse({ data: { accessToken: 'restored-token' } }));
          return firstRefresh;
        }
        return firstRefresh.then(() =>
          mockResponse(
            {
              error: {
                code: 'REFRESH_TOKEN_REUSED',
                message: 'Refresh token reuse detected',
              },
            },
            401,
          ),
        );
      }

      if (url.endsWith('/me')) {
        return mockResponse({
          data: {
            id: 'user-1',
            email: 'user@example.com',
            displayName: 'Test User',
            timeZone: 'UTC',
            locale: null,
            avatarUrl: null,
            pendingEmail: null,
            emailVerifiedAt: null,
            deactivatedAt: null,
            deletionRequestedAt: null,
            createdAt: new Date().toISOString(),
          },
        });
      }

      return mockResponse({ data: {} });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('restored-token');
    });
    expect(refreshCalls).toBe(1);
  });
});
