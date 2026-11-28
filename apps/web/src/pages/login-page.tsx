import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      void navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-12">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Access your TaskForge account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Absorb browser/password-manager autofill so the visible fields stay empty. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden"
            >
              <input type="text" autoComplete="username" tabIndex={-1} />
              <input type="password" autoComplete="current-password" tabIndex={-1} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-ink" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                name="taskforge-email"
                type="email"
                required
                value={email}
                placeholder="you@example.com"
                onChange={(event) => setEmail(event.target.value)}
                onFocus={(event) => {
                  // Browsers can autofill a controlled input without firing onChange.
                  // Clear only when React state is still empty, never user-typed text.
                  if (email === '' && event.target.value !== '') event.target.value = '';
                }}
                autoComplete="off"
                data-form-type="other"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-ink" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                name="taskforge-password"
                type="password"
                required
                value={password}
                placeholder="Enter your password"
                onChange={(event) => setPassword(event.target.value)}
                onFocus={(event) => {
                  if (password === '' && event.target.value !== '') event.target.value = '';
                }}
                autoComplete="new-password"
                data-form-type="other"
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted">
            Need an account?{' '}
            <Link to="/register" className="text-brand">
              Register
            </Link>
          </p>
          <p className="mt-2 text-sm text-muted">
            <Link to="/forgot-password" className="text-brand">
              Forgot password?
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
