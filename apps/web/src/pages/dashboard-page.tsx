import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Database,
  Layers,
  LockKeyhole,
  Server,
} from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiStatusCard } from '@/features/foundation/api-status-card';
import { SetupCommandsDialog } from '@/features/foundation/setup-commands-dialog';

type FoundationStatus = 'ready' | 'configured' | 'next';

const statusMeta: Record<
  FoundationStatus,
  { label: string; variant: 'success' | 'info' | 'warning' }
> = {
  ready: { label: 'Ready', variant: 'success' },
  configured: { label: 'Configured', variant: 'info' },
  next: { label: 'Next', variant: 'warning' },
};

const foundationItems: Array<{
  icon: typeof Server;
  title: string;
  description: string;
  status: FoundationStatus;
}> = [
  {
    icon: Server,
    title: 'API foundation',
    description:
      'Express 5 with Zod-validated configuration, CORS allowlist, Helmet, rate limiting, request IDs, and health/readiness endpoints.',
    status: 'ready',
  },
  {
    icon: Database,
    title: 'MySQL + Prisma',
    description:
      'Prisma 7 schema, initial migration, and idempotent seed. Apply it locally with pnpm db:migrate after creating the database.',
    status: 'configured',
  },
  {
    icon: Layers,
    title: 'React foundation',
    description:
      'React Router, TanStack Query, Tailwind design tokens, typed API client, and accessible shared primitives.',
    status: 'ready',
  },
  {
    icon: LockKeyhole,
    title: 'Authentication',
    description:
      'Feature 5 adds accounts, short-lived JWT access tokens, rotating refresh cookies, and server-side sessions.',
    status: 'next',
  },
];

const outOfScope = [
  'Sign-in and registration screens',
  'Workspace, project, and task data',
  'Kanban board and drag-and-drop',
  'Socket.IO realtime events',
  'S3 uploads and background jobs',
];

export function DashboardPage() {
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted">Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            The application shell, API client, and server-state layer are in place. Product features
            land in dependency order.
          </p>
        </div>
        <SetupCommandsDialog />
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <ApiStatusCard />

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Foundation status</CardTitle>
            <CardDescription>What is in place now, and what the next feature adds.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-line">
              {foundationItems.map((item) => {
                const Icon = item.icon;
                const meta = statusMeta[item.status];

                return (
                  <li key={item.title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-muted text-muted">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-ink">{item.title}</p>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted">{item.description}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Next: authentication</CardTitle>
              <Badge variant="warning">Feature 5</Badge>
            </div>
            <CardDescription>
              Secure accounts and sessions come before workspace data. The API will issue a
              short-lived access token in memory and a rotating refresh token in an HttpOnly cookie.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                Server-side session records with refresh-token hashes
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                Rotation with reuse detection and immediate revocation
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                Registration, login, logout, and password reset flows
              </li>
            </ul>
            <Link
              to="/"
              className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'w-fit' })}
            >
              Back to overview
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Intentionally not here yet</CardTitle>
            <CardDescription>
              This foundation avoids placeholder business data and half-built flows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {outOfScope.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-muted">
                  <CircleDashed className="size-4 shrink-0 text-muted/60" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
