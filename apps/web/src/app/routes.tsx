import type { RouteObject } from 'react-router';
import { AppShell } from '@/components/layout/app-shell';
import { PublicLayout } from '@/components/layout/public-layout';
import { DashboardPage } from '@/pages/dashboard-page';
import { LandingPage } from '@/pages/landing-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { RouteErrorPage } from '@/pages/route-error-page';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: [{ index: true, element: <LandingPage /> }],
  },
  {
    path: '/app',
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [{ index: true, element: <DashboardPage /> }],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];
