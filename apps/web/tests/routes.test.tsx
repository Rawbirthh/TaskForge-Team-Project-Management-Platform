import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/auth-context';
import { routes } from '@/app/routes';

function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe('application routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the landing page at /', () => {
    renderRoute('/');

    expect(screen.getByRole('heading', { name: 'Plan work. Ship together.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open workspace/i })).toBeInTheDocument();
  });

  it('renders the not-found page for unknown routes', () => {
    renderRoute('/does-not-exist');

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('renders the app shell and dashboard at /app', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const router = createMemoryRouter(routes, { initialEntries: ['/app'] });
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});
