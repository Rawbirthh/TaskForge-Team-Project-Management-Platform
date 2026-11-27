import type { RouteObject } from 'react-router';
import { AppShell } from '@/components/layout/app-shell';
import { PublicLayout } from '@/components/layout/public-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardPage } from '@/pages/dashboard-page';
import { ForgotPasswordPage } from '@/pages/forgot-password-page';
import { LandingPage } from '@/pages/landing-page';
import { LoginPage } from '@/pages/login-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { RegisterPage } from '@/pages/register-page';
import { ResetPasswordPage } from '@/pages/reset-password-page';
import { RouteErrorPage } from '@/pages/route-error-page';
import { VerifyEmailPage } from '@/pages/verify-email-page';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: [{ index: true, element: <LandingPage /> }],
  },
  {
    path: '/login',
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    path: '/register',
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: [{ index: true, element: <RegisterPage /> }],
  },
  {
    path: '/forgot-password',
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: [{ index: true, element: <ForgotPasswordPage /> }],
  },
  {
    path: '/reset-password',
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: [{ index: true, element: <ResetPasswordPage /> }],
  },
  {
    path: '/verify-email',
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: [{ index: true, element: <VerifyEmailPage /> }],
  },
  {
    path: '/app',
    element: <ProtectedRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: '',
        element: <AppShell />,
        children: [{ index: true, element: <DashboardPage /> }],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];
