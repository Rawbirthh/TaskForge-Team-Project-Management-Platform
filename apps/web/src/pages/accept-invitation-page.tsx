import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-context';
import { ApiError } from '@/lib/api-client';
import { acceptInvitation, declineInvitation } from '@/features/workspaces/membership-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function AcceptInvitationPage() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'idle' | 'accepting' | 'declining' | 'done' | 'error'>(
    'idle',
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setMessage('Missing invitation token.');
      setStatus('error');
    }
  }, [token]);

  if (isLoading) {
    return <p className="text-muted">Loading…</p>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Accept invitation</CardTitle>
            <CardDescription>Sign in to accept this invitation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              to={`/login?redirect=/accept-invitation?token=${encodeURIComponent(token)}`}
              className="text-brand hover:underline"
            >
              Sign in
            </Link>
            <Link to={`/register`} className="text-brand hover:underline">
              Create account
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleAccept() {
    setStatus('accepting');
    try {
      const result = await acceptInvitation(token);
      setStatus('done');
      setMessage(`You joined ${result.workspace.name}.`);
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      void navigate('/app', { replace: true });
    } catch (error) {
      setStatus('error');
      if (error instanceof ApiError) setMessage(error.message);
      else setMessage('Failed to accept invitation.');
    }
  }

  async function handleDecline() {
    setStatus('declining');
    try {
      await declineInvitation(token);
      setStatus('done');
      setMessage('Invitation declined.');
    } catch (error) {
      setStatus('error');
      if (error instanceof ApiError) setMessage(error.message);
      else setMessage('Failed to decline invitation.');
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Workspace invitation</CardTitle>
          <CardDescription>Accept or decline this invitation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message ? (
            <p role="alert" className="text-sm">
              {message}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button
              onClick={() => void handleAccept()}
              isLoading={status === 'accepting'}
              disabled={!token || status === 'done'}
            >
              Accept
            </Button>
            <Button
              variant="ghost"
              onClick={() => void handleDecline()}
              isLoading={status === 'declining'}
              disabled={!token || status === 'done'}
            >
              Decline
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
