# Architecture Baseline — TaskForge

Date: 2026-11-26. This file records **observed facts** from repository inspection and the Feature 1 evidence checks. Recommendations and unverified items are explicitly separated. No `.env` values, passwords, tokens, or secrets are recorded.

## Evidence sources (inspected paths)

`package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `eslint.config.mjs`, `prettier.config.mjs`, `.gitignore`, `.npmrc`, `.nvmrc`, `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json`, `apps/api/vitest.config.ts`, `apps/api/prisma.config.ts`, `apps/api/prisma.test.config.ts`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.ts`, `apps/api/prisma/migrations/**`, `apps/api/.env.example`, `apps/api/.env.test.example`, `apps/api/src/**`, `apps/api/tests/**`, `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/playwright.config.ts`, `apps/web/.env.example`, `apps/web/src/**`, `apps/web/tests/**`, `apps/web/e2e/**`, `project-overview.md` (shared rules + Features 1–4), `AGENTS.md`, `README.md`, `docs/GETTING_STARTED.md`, `docs/ui-registry.md`, and `git status` / `git log`.

## Environment facts (observed)

- Working directory: `C:\Users\Asus\Desktop\Taskforge`.
- The directory **was not** a Git repository at the start of setup. It is now a Git repository on branch `main`, with one commit `dd39804` and `origin` set to the GitHub URL supplied by the user. `git status --short` was empty at audit time.
- Node.js `v24.13.0`; pnpm `12.23.0`; TypeScript `6.0.3` (from `pnpm exec tsc --version`). Earlier setup observed npm `11.6.2` and Corepack `0.34.5`.
- Engine requirements in `package.json`: Node `>=24.0.0`, pnpm `>=12.0.0`. `packageManager` is pinned to `pnpm@12.23.0`.
- Local listeners observed: `3306` MySQL 5.6, `3307` MySQL 5.7, `3308` MySQL 8.0, and `3309` XAMPP MariaDB `10.4.32-MariaDB`. TaskForge uses the XAMPP MariaDB instance.
- Docker daemon was not running during setup; no containerized database was used.
- Playwright package `1.65.1` is installed, but no browser binaries are present in `ms-playwright`.

## Installed versions (from `pnpm list --depth 0`)

| Area | Exact installed versions |
| --- | --- |
| Runtime/tooling | Node 24.13.0, pnpm 12.23.0, TypeScript 6.0.3, tsx 4.23.15 |
| API | Express 5.3.0, Zod 4.6.7, Pino 10.4.0, pino-http 11.0.0, Helmet 8.3.0, cors 2.8.6, express-rate-limit 8.7.5, dotenv 18.0.10 |
| Database | Prisma 7.10.1, `@prisma/client` 7.10.1, `@prisma/adapter-mariadb` 7.10.1 |
| Frontend | React 19.3.1, React DOM 19.3.1, Vite 8.3.8, React Router 8.5.3, TanStack Query 5.108.4, Tailwind CSS 4.3.5, `@tailwindcss/vite` 4.3.5, Radix Dialog 1.3.1, Radix Dropdown Menu 2.2.1, Sonner 2.0.8, lucide-react 1.80.0, clsx 2.1.1, tailwind-merge 3.7.1, class-variance-authority 0.7.1 |
| Tests | Vitest 5.1.2, Supertest 7.3.2, `@playwright/test` 1.65.1, jsdom 29.1.1, Testing Library React 16.3.3, Testing Library DOM 10.4.2, user-event 14.6.13, jest-dom 8.0.0 |
| Root dev tools | ESLint 10.15.0, `@eslint/js` 10.0.1, typescript-eslint 8.74.0, Prettier 3.10.1, prettier-plugin-tailwindcss 0.8.1, eslint-plugin-react-hooks 7.1.1, eslint-plugin-react-refresh 0.5.8, globals 17.14.0 |

## Repository structure and folder conventions (observed)

- pnpm workspace (`pnpm-workspace.yaml`) with two private packages: `apps/api` and `apps/web`. Root owns shared dev tooling.
- `apps/api/`: `prisma/`, `src/`, `tests/`, generated client in `src/generated/prisma/` (gitignored), build output `dist/`.
- `apps/api/src/`: `config/`, `errors/`, `lib/`, `middleware/`, `routes/`, `types/`.
- `apps/web/`: `src/`, `tests/`, `e2e/`, build output `dist/`.
- `apps/web/src/`: `app/`, `components/`, `features/`, `lib/`, `pages/`, `styles/`.
- `docs/`: `GETTING_STARTED.md`, `architecture/`, `ui-registry.md`.
- No `services/`, `repositories/`, `modules/`, or enterprise layer directories exist.

## API route structure and `/api/v1` convention

- All REST routes are mounted under `/api/v1` in `apps/api/src/app.ts` via `apiRouter` from `src/routes/index.ts`.
- Current routes: `GET /api/v1`, `GET /api/v1/health`, `GET /api/v1/health/ready`.
- Success convention: `{ "data": ... }`. Error convention: `{ "error": { code, message, requestId, details? } }`.
- `X-Request-Id` is set on every response and exposed through CORS.

## Zod usage (observed)

- `apps/api/src/config/env.ts` defines `envSchema`, calls `envSchema.safeParse(process.env)` once at startup, prints sanitized issues and exits with code 1 on invalid config.
- `apps/api/src/middleware/validate.ts` provides reusable `validate({ params, query, body })` and `getValidated<T>()`. It `safeParse`s each requested request part and stores only parsed values on `req.validated`.
- No current domain route calls `validate()`; only the unit test exercises it. The two health routes take no request input.
- Grep of `apps/api/src` found raw `req.body` / `req.query` / `req.params` usage only inside `validate.ts` and logger redaction paths. No raw request object is spread into Prisma.
- Frontend does not use Zod.

## Authentication and resource authorization (observed)

- No backend authentication middleware, JWT library, session model, cookie parser, password handling, role/permission model, or resource ownership/authorization helper exists.
- No protected routes exist, so no resource-level checks are present or required yet.
- `apps/web/src/lib/api-client.ts` contains an in-memory access token plus injectable `getAccessToken` / `refreshAccessToken` hooks; the default refresh hook returns `null`. This is a framework for Feature 5, not working authentication.
- Logger preemptively redacts `authorization`, `cookie`, `set-cookie`, password, token, and refresh-token fields.
- CSRF middleware is not installed or configured; there are no cookie-authenticated endpoints yet.

## Error handling, CORS, rate limit, and security middleware (observed)

- `src/app.ts` middleware order: `pino-http` → `helmet()` → `cors(allowlist)` → rate limiter on `/api/v1` → `express.json({ limit: '1mb' })` → `express.urlencoded({ extended: false, limit: '1mb' })` → routes → 404 handler → centralized error handler.
- CORS uses an explicit origin allowlist built from `CORS_ORIGINS`; wildcard `*` is rejected; `credentials: true`; `X-Request-Id` exposed.
- Rate limit is skipped in `NODE_ENV=test` and for `OPTIONS`; returns a sanitized 429 envelope.
- `src/middleware/error-handler.ts` handles `ZodError` (400), `AppError`, body-parser errors (400/413/415), and unknown errors as sanitized 500. No stack traces, SQL, or internal details are returned.
- `src/middleware/not-found.ts` returns a consistent 404 `AppError`.
- `helmet()` is applied. `app.disable('x-powered-by')`. `TRUST_PROXY` is opt-in.

## Socket.IO, Redis, S3, and BullMQ status (observed)

- No `socket.io`, Redis client/adapter, `bullmq`, AWS SDK, `multer`, or `busboy` entry exists in any `package.json`.
- No source file imports those packages. The only mentions are UI copy in `dashboard-page.tsx` and `landing-page.tsx` describing them as future/out-of-scope.
- Therefore: Socket.IO realtime, Redis adapter, background jobs, and private S3 uploads are **not implemented and not installed**.

## Database conventions (observed)

- Prisma 7.10.1 with `generator client { provider = "prisma-client" }` and generated output at `apps/api/src/generated/prisma` (gitignored, regenerated by `postinstall` / `pnpm db:generate`).
- `datasource db { provider = "mysql" }`; runtime uses `@prisma/adapter-mariadb` with the database name parsed from the validated URL.
- `prisma/schema.prisma` contains one infrastructure-only `SystemSetting` model mapped to `system_settings` (`key` PK, `value`, `updated_at`). No domain models.
- One tracked migration: `20261126120000_init_foundation/migration.sql` plus `migration_lock.toml` with `provider = "mysql"`.
- `prisma/seed.ts` idempotently upserts `schema.version=1`.
- Three dedicated databases are used: `taskforge` (development), `taskforge_test` (isolated tests), `taskforge_shadow` (`prisma migrate dev` shadow).
- Configuration variable names only (no values recorded here): `DATABASE_URL`, `SHADOW_DATABASE_URL`, `TEST_DATABASE_URL`. App config also validates `NODE_ENV`, `PORT`, `CORS_ORIGINS`, `LOG_LEVEL`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `TRUST_PROXY`, `APP_VERSION`. Frontend uses `VITE_API_BASE_URL`.
- `prisma.config.ts` loads `.env` via `dotenv/config` and uses `DATABASE_URL` + `SHADOW_DATABASE_URL`. `prisma.test.config.ts` loads `.env.test` and uses only `TEST_DATABASE_URL`.
- `src/lib/prisma.ts` keeps one client per process on `globalThis` outside production and disconnects on SIGINT/SIGTERM/exception.

## Frontend conventions (observed)

- `react-router` 8.5.3 with `createBrowserRouter`; routes in `src/app/routes.tsx`: public `/` layout with landing index, `/app` shell with dashboard index, `*` not-found, and route error elements.
- TanStack Query 5.108.4 via `QueryClientProvider`; `queryClient` defaults: `staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false`, mutations `retry: 0`. Sonner toasts in providers.
- Tailwind CSS 4 with `@tailwindcss/vite` and custom tokens in `src/styles/index.css`; reduced-motion support and visible focus rings.
- Accessible primitives in `src/components/ui/`: Button, Badge, Card, Input, Skeleton, PageState, Dialog (Radix), Dropdown Menu (Radix). Variant constants are in separate `button-variants.ts` / `badge-variants.ts` files for Fast Refresh.
- App shell has skip link, responsive sidebar with `aria-controls`/`aria-expanded`, and loading/error/empty states via `PageState`. No business data is rendered yet.

## Test framework and available scripts (observed)

- API: Vitest 5.1.2 + Supertest 7.3.2, Node environment, `tests/**/*.test.ts`, coverage via `@vitest/coverage-v8`.
- Web: Vitest 5.1.2 in jsdom with Testing Library, tests in `tests/**/*.test.{ts,tsx}`.
- E2E: Playwright 1.65.1, `e2e/`, Chromium project, auto-starts Vite via `webServer`.
- Root scripts: `dev`, `dev:api`, `dev:web`, `build`, `typecheck`, `lint`, `lint:fix`, `test`, `test:e2e`, `format`, `format:check`, `db:generate`, `db:migrate`, `db:deploy`, `db:seed`, `db:status`, `db:migrate:test`, `db:status:test`, `db:studio`.
- Check commands: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`.

## Feature 1 verification evidence (checks run and exact results)

| Feature 1 check | Command | Result | When |
| --- | --- | --- | --- |
| Install | `pnpm install` | Passed; Prisma client generated via `postinstall` | Earlier setup; not re-run in this audit (dependency changes prohibited) |
| Backend startup | `node --env-file-if-exists=.env dist/server.js` + HTTP requests | `/api/v1/health` status `ok`, version `0.1.0`; `/api/v1/health/ready` status `ready`, `checks.database: ok` | Re-run in this audit |
| Frontend startup | `node node_modules/vite/bin/vite.js preview --host 127.0.0.1` + HTTP request | HTTP `200`, title `TaskForge` | Re-run in this audit |
| Database connectivity | readiness endpoint + Prisma migrate status | Query succeeded; statuses up to date | Re-run in this audit |
| Migration status (dev) | `pnpm db:status` | 1 migration found; database schema up to date | Re-run in this audit |
| Migration status (test) | `pnpm db:status:test` | 1 migration found; `taskforge_test` up to date | Re-run in this audit after correcting a shell-level placeholder override |
| Prisma schema validation | `prisma validate` and `prisma validate --config prisma.test.config.ts` | Both reported valid | Re-run in this audit |
| Tests | `pnpm test` | API 17/17 passing (includes real MariaDB integration), web 10/10 passing | Re-run in this audit |
| Lint | `pnpm lint` | Passed, 0 errors/warnings | Re-run in this audit |
| Type-check | `pnpm typecheck` | Passed for both apps | Re-run in this audit |
| Format | `pnpm format:check` | All matched files use Prettier style | Re-run in this audit |
| Build | `pnpm build` | Passed; Vite emitted a >500 kB chunk advisory only | Re-run in this audit |
| E2E | `pnpm test:e2e` | Not run — Playwright browser binaries absent | Unverified |

`pnpm db:status:test` initially failed with `P1000` during this audit because a temporary shell variable overrode `TEST_DATABASE_URL` with a placeholder. The corrected run without that override passed; this was an audit-command mistake, not a repository defect. No migration reset or destructive command was run.

## Verified setup instructions (for the README deliverable; README not edited here)

1. `corepack enable`, then `pnpm install` (do not use npm; `postinstall` runs `prisma generate`).
2. Create three databases — `taskforge`, `taskforge_test`, `taskforge_shadow` — and a dedicated user scoped only to them. Use an admin account and a placeholder password, never a real secret in docs.
3. Copy `apps/api/.env.example` → `apps/api/.env` and `apps/api/.env.test.example` → `apps/api/.env.test`. Fill the placeholders. Variable names: `DATABASE_URL`, `SHADOW_DATABASE_URL`, `TEST_DATABASE_URL`, plus `NODE_ENV`, `PORT`, `CORS_ORIGINS`, `LOG_LEVEL`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `TRUST_PROXY`, `APP_VERSION`. Optional frontend: `apps/web/.env.example` → `.env`, variable `VITE_API_BASE_URL` (defaults to `/api/v1`).
4. Apply migrations: `pnpm db:deploy`, `pnpm db:seed`, `pnpm db:status`; then `pnpm db:migrate:test`, `pnpm db:status:test`. Use `pnpm db:migrate` only when creating new migrations; it needs `SHADOW_DATABASE_URL`. Never reset or edit an applied migration.
5. Run `pnpm dev`. Web: port 5173; API: port 4000; Vite proxies `/api` to the API.
6. Verify with `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`. Browser E2E requires `pnpm --filter @taskforge/web exec playwright install chromium` first.

## Unknowns / unverified

- Playwright browser binaries are absent, so `pnpm test:e2e` was not run.
- Manual browser/device responsive review was not performed by the agent.
- Production deployment was not attempted; production config (explicit `CORS_ORIGINS`, `NODE_ENV=production`) was validated by schema inspection only.
- XAMPP `mysql.db` privilege table was corrupt and repaired with approval earlier; `FLUSH PRIVILEGES` still reports an Aria checksum error, but grants and Prisma connections are verified working.
- MySQL 5.6/5.7/8.0 services on ports 3306–3308 were observed but not modified.

## Recommendations (not implemented, require approval)

- Approve a Feature 5 spec before implementing authentication; add JWT access/refresh sessions, server-side session records, refresh-token hashing/rotation, and CSRF protection for cookie-authenticated endpoints.
- Add Socket.IO, Redis adapter, BullMQ/Redis, and S3 only when their features are approved; keep REST + committed database state authoritative.
- Consider route-level lazy loading if the frontend bundle grows further (advisory from the >500 kB build chunk).
- Add route/controller tests alongside each new feature using the existing Vitest/Supertest conventions.
