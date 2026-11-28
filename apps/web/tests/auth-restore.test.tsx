import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/features/auth/auth-context';

const refreshCallsRef = { current: 0 };
let firstRefresh: Promise<unknown> | null = null;

vi.mock('@/lib/api-client', () => ({
  apiRequest: vi.fn(async (path: string) => {
    if (path.endsWith('/auth/refresh')) {
      refreshCallsRef.current += 1;
      if (!firstRefresh) {
        firstRefresh = Promise.resolve({ accessToken: 'restored-token' });
        return firstRefresh;
      }
      await firstRefresh;
      throw new Error('Refresh token reuse detected');
    }

    if (path.endsWith('/me')) {
      return {
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
      };
    }

    return {};
  }),
  configureAuthHooks: vi.fn(),
  setAccessToken: vi.fn(),
  resetAuthHooks: vi.fn(),
}));

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
    vi.clearAllMocks();
    refreshCallsRef.current = 0;
    firstRefresh = null;
  });

  it('refreshes only once under StrictMode and keeps the restored token', async () => {
    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('restored-token');
    });
    expect(refreshCallsRef.current).toBe(1);
  });
});
