import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { LoginPage } from '@/pages/login-page';
import { AuthProvider } from '@/features/auth/auth-context';

describe('login page', () => {
  it('starts with empty fields and placeholder hints (no autofill values)', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const email = screen.getByLabelText<HTMLInputElement>('Email');
    const password = screen.getByLabelText<HTMLInputElement>('Password');

    expect(email.value).toBe('');
    expect(password.value).toBe('');
    expect(email).toHaveAttribute('placeholder', 'you@example.com');
    expect(password).toHaveAttribute('placeholder', 'Enter your password');
    expect(email).toHaveAttribute('autocomplete', 'off');
    expect(password).toHaveAttribute('autocomplete', 'new-password');
  });
});
