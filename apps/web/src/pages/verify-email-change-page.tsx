import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/page-state';
import { ErrorState } from '@/components/ui/page-state';
import { verifyEmailChange } from '@/features/profile/profile-api';

export function VerifyEmailChangePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }

    void (async () => {
      try {
        const result = await verifyEmailChange(token);
        setStatus('success');
        setMessage(result.message);
      } catch (error) {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Verification failed');
      }
    })();
  }, [token]);

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Email change verification</CardTitle>
        </CardHeader>
        <CardContent>
          {status === 'loading' ? <LoadingState label="Verifying..." /> : null}
          {status === 'success' ? <p className="text-sm text-green-700">{message}</p> : null}
          {status === 'error' ? (
            <ErrorState title="Verification failed" description={message} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
