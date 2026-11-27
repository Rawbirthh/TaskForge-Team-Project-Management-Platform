import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register(email, password, displayName || undefined);
      void navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-12">
      <Card>
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Register with your email and a password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-sm font-medium text-ink" htmlFor="displayName">
                Display name
              </label>
              <Input
                id="displayName"
                name="displayName"
                defaultValue={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                onFocus={(event) => setDisplayName(event.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-ink" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={email}
                onChange={(event) => setEmail(event.target.value)}
                onFocus={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-ink" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={12}
                defaultValue={password}
                onChange={(event) => setPassword(event.target.value)}
                onFocus={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Register'}
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-brand">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
