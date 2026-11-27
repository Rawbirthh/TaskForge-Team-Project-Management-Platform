import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/api-client';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function verify() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await apiRequest<{ message: string }>('/auth/verify-email', {
        method: 'POST',
        body: { token },
      });
      setMessage(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (token) {
      void verify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="mx-auto max-w-md py-12">
      <Card>
        <CardHeader>
          <CardTitle>Verify email</CardTitle>
          <CardDescription>Confirm your email address.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message ? <p className="text-sm text-muted">{message}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!token ? <p className="text-sm text-muted">Missing verification token.</p> : null}
          {token && !message ? (
            <Button type="button" onClick={() => void verify()} disabled={isSubmitting}>
              {isSubmitting ? 'Verifying...' : 'Verify email'}
            </Button>
          ) : null}
          <p className="text-sm text-muted">
            <Link to="/login" className="text-brand">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
