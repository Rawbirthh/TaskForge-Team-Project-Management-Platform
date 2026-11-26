import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            data: {
              status: 'ok',
              service: 'taskforge-api',
              version: '0.1.0',
              uptimeSeconds: 5,
              timestamp: new Date().toISOString(),
            },
          }),
      }),
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const router = createMemoryRouter(routes, { initialEntries: ['/app'] });
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Foundation status')).toBeInTheDocument();
    expect(await screen.findByText('Online')).toBeInTheDocument();
  });
});
