import {
  ArrowRight,
  CheckCircle2,
  Database,
  Layers,
  Server,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const foundationCards = [
  {
    icon: ShieldCheck,
    title: 'Hardened API shell',
    description:
      'Versioned /api/v1 routes, Zod-validated configuration, CORS allowlist, Helmet, rate limiting, request IDs, and centralized error handling.',
  },
  {
    icon: Database,
    title: 'MySQL + Prisma',
    description:
      'Prisma 7 with the MariaDB driver adapter, a versioned initial migration, an idempotent seed, and an isolated test database workflow.',
  },
  {
    icon: Layers,
    title: 'React foundation',
    description:
      'React Router, TanStack Query, Tailwind design tokens, and accessible primitives for buttons, cards, dialogs, menus, and page states.',
  },
];

const roadmap = [
  { feature: 'Feature 5', title: 'Authentication and sessions' },
  { feature: 'Feature 7', title: 'Workspaces and onboarding' },
  { feature: 'Feature 10', title: 'Projects and lifecycle' },
  { feature: 'Feature 14', title: 'Tasks and workflow statuses' },
];

export function LandingPage() {
  return (
    <div>
      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-24">
        <div>
          <Badge variant="info">
            <Sparkles className="size-3" aria-hidden="true" />
            Foundation release
          </Badge>
          <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Plan work. Ship together.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
            TaskForge is a multi-tenant project management platform for small teams. The secure
            Express API, MySQL persistence layer, and React application shell are in place and ready
            for the feature roadmap.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/app" className={buttonVariants({ size: 'lg' })}>
              Open workspace
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a href="#foundation" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
              See what is ready
            </a>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-6">
            <div>
              <dt className="text-xs font-medium tracking-wide text-muted uppercase">API</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">Express 5</dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-muted uppercase">Database</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">MySQL 8</dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-muted uppercase">Frontend</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">React 19</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-100 shadow-2xl">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-red-400" />
            <span className="size-2.5 rounded-full bg-amber-400" />
            <span className="size-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="mt-6 space-y-4 font-mono text-sm">
            <p>
              <span className="text-slate-500"># 1. install workspace dependencies</span>
              <br />
              <span className="text-emerald-300">$</span> pnpm install
            </p>
            <p>
              <span className="text-slate-500"># 2. apply the initial MySQL migration</span>
              <br />
              <span className="text-emerald-300">$</span> pnpm db:migrate
            </p>
            <p>
              <span className="text-slate-500"># 3. run the API and web app together</span>
              <br />
              <span className="text-emerald-300">$</span> pnpm dev
            </p>
            <p className="text-slate-400">
              API <span className="text-sky-300">http://localhost:4000</span>
              <br />
              Web <span className="text-sky-300">http://localhost:5173</span>
            </p>
          </div>
        </div>
      </section>

      <section id="foundation" className="border-y border-line bg-surface py-16">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-brand">Foundation</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              The groundwork is deliberately boring
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Security, validation, database migrations, and shared UI patterns come first. Product
              features build on top of them without rework.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {foundationCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title}>
                  <CardHeader>
                    <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <CardTitle className="mt-2">{card.title}</CardTitle>
                    <CardDescription>{card.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold text-brand">Roadmap</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              Built in dependency order
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Authentication comes before workspaces. Workspaces come before projects. Projects come
              before tasks and real-time collaboration. Each feature ships with tests and a review
              of its security boundaries.
            </p>
            <Link to="/app" className={buttonVariants({ variant: 'secondary', className: 'mt-6' })}>
              Open the app shell
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Next in line</CardTitle>
                <Badge variant="warning">Feature 5</Badge>
              </div>
              <CardDescription>
                The roadmap starts with secure accounts and server-side sessions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {roadmap.map((item) => (
                  <li key={item.feature} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="size-4 shrink-0 text-brand" aria-hidden="true" />
                    <span className="font-medium text-ink">{item.title}</span>
                    <span className="ml-auto text-xs text-muted">{item.feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex items-start gap-3 rounded-lg bg-surface-muted/60 p-3 text-xs leading-5 text-muted">
                <Server className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                <p>
                  The API and committed MySQL data remain the source of truth. Socket.IO events will
                  be delivery signals added in Feature 25, not a second data store.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
