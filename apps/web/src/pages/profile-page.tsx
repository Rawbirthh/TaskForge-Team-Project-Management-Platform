import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/page-state';
import { ErrorState } from '@/components/ui/page-state';
import { EmptyState } from '@/components/ui/page-state';
import { useAuth } from '@/features/auth/auth-context';
import { apiRequest } from '@/lib/api-client';
import {
  changePassword,
  deactivateAccount,
  getProfile,
  listSessions,
  requestDeletion,
  requestEmailChange,
  revokeSession,
  updateProfile,
} from '@/features/profile/profile-api';

const timeZones = Intl.supportedValuesOf('timeZone');

export function ProfilePage() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  async function signOutAndRedirect(): Promise<void> {
    try {
      await logout();
    } catch {
      // Password change, deactivation, or deletion already revoked the session.
    }
    window.location.href = '/login';
  }

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await getProfile()).profile,
  });

  const [sessionCursor, setSessionCursor] = useState<string | null>(null);
  const [sessionCursorStack, setSessionCursorStack] = useState<Array<string | null>>([null]);
  const [sessionPageIndex, setSessionPageIndex] = useState(0);

  const sessionsQuery = useQuery({
    queryKey: ['sessions', sessionCursor],
    queryFn: async () => listSessions(sessionCursor),
    placeholderData: (previous) => previous,
  });

  function goToPreviousSessionsPage(): void {
    if (sessionPageIndex === 0) return;
    const nextIndex = sessionPageIndex - 1;
    setSessionPageIndex(nextIndex);
    setSessionCursor(sessionCursorStack[nextIndex] ?? null);
  }

  function goToNextSessionsPage(): void {
    const nextCursor = sessionsQuery.data?.nextCursor;
    if (!nextCursor) return;
    setSessionCursorStack((prev) => [...prev.slice(0, sessionPageIndex + 1), nextCursor]);
    setSessionCursor(nextCursor);
    setSessionPageIndex(sessionPageIndex + 1);
  }

  const [profileForm, setProfileForm] = useState({
    displayName: '',
    timeZone: '',
    locale: '',
    avatarUrl: '',
  });
  const [profileDirty, setProfileDirty] = useState(false);

  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Profile updated');
      setProfileDirty(false);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Update failed');
    },
  });

  const emailChangeMutation = useMutation({
    mutationFn: requestEmailChange,
    onSuccess: (result) => {
      toast.success(result.message);
      setEmail('');
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Request failed');
    },
  });

  const passwordMutation = useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => changePassword(currentPassword, newPassword),
    onSuccess: async (result) => {
      toast.success(result.message);
      setCurrentPassword('');
      setNewPassword('');
      await signOutAndRedirect();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Password change failed');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      setSessionCursor(null);
      setSessionCursorStack([null]);
      setSessionPageIndex(0);
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session revoked');
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Revoke failed');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateAccount,
    onSuccess: async (result) => {
      toast.success(result.message);
      await signOutAndRedirect();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Deactivation failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: requestDeletion,
    onSuccess: async (result) => {
      toast.success(result.message);
      await signOutAndRedirect();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Request failed');
    },
  });

  // Sync form when profile loads.
  useEffect(() => {
    if (profileQuery.data && !profileDirty) {
      setProfileForm({
        displayName: profileQuery.data.displayName,
        timeZone: profileQuery.data.timeZone,
        locale: profileQuery.data.locale ?? '',
        avatarUrl: profileQuery.data.avatarUrl ?? '',
      });
    }
  }, [profileQuery.data, profileDirty]);

  if (profileQuery.isLoading) {
    return <LoadingState label="Loading profile..." />;
  }
  if (profileQuery.isError || !profileQuery.data) {
    return (
      <ErrorState
        title="Profile unavailable"
        description="We could not load your profile."
        onRetry={() => void profileQuery.refetch()}
      />
    );
  }

  const profile = profileQuery.data;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Profile & security</h1>
        <p className="mt-2 text-sm text-muted">
          Manage your personal information, preferences, password, and active sessions.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
          <CardDescription>
            Update your display name, time zone, locale, and avatar URL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              profileMutation.mutate({
                displayName: profileForm.displayName,
                timeZone: profileForm.timeZone,
                locale: profileForm.locale === '' ? null : profileForm.locale,
                avatarUrl: profileForm.avatarUrl === '' ? null : profileForm.avatarUrl,
              });
            }}
          >
            <div className="space-y-2">
              <label htmlFor="displayName" className="text-sm font-medium text-ink">
                Display name
              </label>
              <Input
                id="displayName"
                value={profileForm.displayName}
                onChange={(event) => {
                  setProfileForm((prev) => ({ ...prev, displayName: event.target.value }));
                  setProfileDirty(true);
                }}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="timeZone" className="text-sm font-medium text-ink">
                Time zone
              </label>
              <select
                id="timeZone"
                className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm"
                value={profileForm.timeZone}
                onChange={(event) => {
                  setProfileForm((prev) => ({ ...prev, timeZone: event.target.value }));
                  setProfileDirty(true);
                }}
              >
                {timeZones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="locale" className="text-sm font-medium text-ink">
                Locale (optional)
              </label>
              <Input
                id="locale"
                value={profileForm.locale}
                placeholder="en-US"
                onChange={(event) => {
                  setProfileForm((prev) => ({ ...prev, locale: event.target.value }));
                  setProfileDirty(true);
                }}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="avatarUrl" className="text-sm font-medium text-ink">
                Avatar URL (optional)
              </label>
              <Input
                id="avatarUrl"
                value={profileForm.avatarUrl}
                placeholder="https://..."
                onChange={(event) => {
                  setProfileForm((prev) => ({ ...prev, avatarUrl: event.target.value }));
                  setProfileDirty(true);
                }}
              />
            </div>
            <Button type="submit" disabled={profileMutation.isPending}>
              {profileMutation.isPending ? 'Saving...' : 'Save profile'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>
            Current email: {profile.email}.{' '}
            {profile.pendingEmail ? `Pending change to ${profile.pendingEmail}.` : ''}
            {profile.emailVerifiedAt ? ' Verified.' : ' Not verified.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!profile.emailVerifiedAt ? (
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await apiRequest('/auth/resend-verification', { method: 'POST' });
                  toast.success('Verification email sent if applicable');
                } catch {
                  toast.error('Could not resend verification');
                }
              }}
            >
              Resend verification
            </Button>
          ) : null}
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (!email) return;
              emailChangeMutation.mutate(email);
            }}
          >
            <Input
              type="email"
              placeholder="new-email@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button type="submit" disabled={emailChangeMutation.isPending || !email}>
              {emailChangeMutation.isPending ? 'Sending...' : 'Request email change'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Changing your password revokes all active sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              passwordMutation.mutate({ currentPassword, newPassword });
            }}
          >
            <div className="space-y-2">
              <label htmlFor="currentPassword" className="text-sm font-medium text-ink">
                Current password
              </label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="newPassword" className="text-sm font-medium text-ink">
                New password
              </label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={passwordMutation.isPending || !currentPassword || !newPassword}
            >
              {passwordMutation.isPending ? 'Changing...' : 'Change password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>Review and revoke devices signed in to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessionsQuery.isLoading ? (
            <LoadingState label="Loading sessions..." />
          ) : sessionsQuery.isError ? (
            <ErrorState title="Sessions unavailable" onRetry={() => void sessionsQuery.refetch()} />
          ) : (
            <>
              {!sessionsQuery.data || sessionsQuery.data.sessions.length === 0 ? (
                <EmptyState title="No sessions" description="No recent sessions found." />
              ) : (
                <ul className="space-y-3">
                  {sessionsQuery.data.sessions.map((session) => (
                    <li
                      key={session.id}
                      className="flex flex-col gap-2 rounded-lg border border-line p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="text-sm">
                        <p className="font-medium text-ink">
                          {session.current ? 'Current session' : 'Session'}{' '}
                          {session.revokedAt ? '(revoked)' : ''}
                        </p>
                        <p className="text-muted">
                          {session.userAgent ?? 'Unknown device'} ·{' '}
                          {session.ipAddress ?? 'Unknown IP'}
                        </p>
                        <p className="text-xs text-muted">
                          Created {new Date(session.createdAt).toLocaleString()}
                          {session.revokedAt
                            ? ` · Revoked ${new Date(session.revokedAt).toLocaleString()}`
                            : ''}
                        </p>
                      </div>
                      {!session.revokedAt && !session.current ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={revokeMutation.isPending}
                          onClick={() => revokeMutation.mutate(session.id)}
                        >
                          Revoke
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {sessionPageIndex > 0 || sessionsQuery.data?.nextCursor ? (
                <nav
                  className="mt-4 flex items-center justify-between gap-3"
                  aria-label="Session pages"
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={sessionPageIndex === 0 || sessionsQuery.isFetching}
                    onClick={goToPreviousSessionsPage}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted">Page {sessionPageIndex + 1}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!sessionsQuery.data?.nextCursor || sessionsQuery.isFetching}
                    onClick={goToNextSessionsPage}
                  >
                    Next
                  </Button>
                </nav>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>Deactivate your account or request deletion.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="secondary"
            disabled={deactivateMutation.isPending}
            onClick={() => {
              if (window.confirm('Deactivate your account? You will be signed out.')) {
                deactivateMutation.mutate();
              }
            }}
          >
            {deactivateMutation.isPending ? 'Deactivating...' : 'Deactivate account'}
          </Button>
          <Button
            variant="danger"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (
                window.confirm(
                  'Request permanent deletion? Type DELETE to confirm in the next step.',
                )
              ) {
                const value = window.prompt('Type DELETE to confirm');
                if (value === 'DELETE') {
                  deleteMutation.mutate();
                }
              }
            }}
          >
            {deleteMutation.isPending ? 'Requesting...' : 'Request deletion'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
