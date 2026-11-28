import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from '@/pages/profile-page';

const logoutMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ logout: logoutMock }),
}));

vi.mock('@/lib/api-client', () => ({
  apiRequest: vi.fn((path: string) => {
    if (path.includes('/users/me/profile')) {
      return Promise.resolve({ profile });
    }
    if (path.includes('/users/me/sessions')) {
      if (path.includes('cursor=')) {
        return Promise.resolve({ sessions: [session('session-2', 'Firefox')], nextCursor: null });
      }
      return Promise.resolve({
        sessions: [session('session-1', 'Chrome')],
        nextCursor: 'cursor-2',
      });
    }
    return Promise.resolve({ data: {} });
  }),
}));

const profile = {
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

function session(id: string, userAgent: string) {
  return {
    id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    revokedAt: null,
    userAgent,
    ipAddress: '1.1.1.1',
    current: false,
  };
}

describe('profile sessions pagination', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows one page at a time and navigates with Previous and Next', async () => {
    const user = userEvent.setup();

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ProfilePage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/Chrome/)).toBeInTheDocument();
    expect(screen.queryByText(/Firefox/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText(/Firefox/)).toBeInTheDocument();
    expect(screen.queryByText(/Chrome/)).not.toBeInTheDocument();
    expect(screen.getByText('Page 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Previous' }));

    expect(await screen.findByText(/Chrome/)).toBeInTheDocument();
    expect(screen.getByText('Page 1')).toBeInTheDocument();
  });
});
