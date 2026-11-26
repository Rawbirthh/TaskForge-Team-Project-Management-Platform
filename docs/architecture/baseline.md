# Architecture Baseline — TaskForge

Date: 2026-11-26. This file records **observed facts** for Features 1–4. Recommendations and unverified items are explicitly separated. No secrets or `.env` values are recorded.

## Environment facts (observed)

- Working directory: `C:\Users\Asus\Desktop\Taskforge`. It is **not** a Git repository.
- Node.js `v24.13.0`; npm `11.6.2`; Corepack `0.34.5`; pnpm `12.23.0` enabled and used for all installs.
- Local MySQL/MariaDB listeners observed:
  - `3306` — MySQL Server 5.6 (service `MySQL56`)
  - `3307` — MySQL Server 5.7 (service `MySQL57`)
  - `3308` — MySQL Server 8.0 (service `MySQL80`)
  - `3309` — XAMPP MariaDB `10.4.32-MariaDB` (chosen for TaskForge)
- Docker daemon was not running; no containerized database was used.
- Playwright package `1.65.1` is installed but no browser binaries are present in `ms-playwright`.

## Repository structure (observed)

- Originally documentation/OpenCode configuration only; no application code existed.
- Now a pnpm workspace with two private packages:
  - `apps/api` — Express 5.3.0 REST API under `/api/v1`, TypeScript 6.0.3 strict + `exactOptionalPropertyTypes`.
  - `apps/web` — React 19.3.1 + Vite 8.3.8 SPA.
- Root tooling: `eslint@10.15.0` flat config, `prettier@3.10.1` with Tailwind class sorting, `vitest@5.1.2`, shared `tsconfig.base.json`, `.editorconfig`, `.nvmrc`, `.npmrc`.
- `pnpm-workspace.yaml` declares `allowBuilds` for `@prisma/engines`, `esbuild`, and `prisma`, plus pnpm-managed `minimumReleaseAgeExclude` entries.

## Backend conventions (implemented)

- `src/config/env.ts`: Zod validates `NODE_ENV`, `PORT`, `DATABASE_URL` (mysql/mariadb URL with database name), `CORS_ORIGINS` (explicit URL allowlist, no wildcard), `LOG_LEVEL`, rate-limit values, `TRUST_PROXY`, and `APP_VERSION`. Invalid config exits with a safe message. Production rejects the default localhost CORS origin.
- `src/app.ts`: security middleware order is `pino-http` → Helmet → CORS allowlist → rate limit → JSON/urlencoded parsers → routes → 404 → centralized error handler. Rate limiting is skipped in test and for OPTIONS.
- Request IDs are UUIDs written to `X-Request-Id` and exposed via CORS.
- `src/middleware/validate.ts`: Zod `safeParse` for `params`/`query`/`body`; only parsed data is placed on `req.validated` and read through `getValidated`. Raw request objects are never mapped into Prisma.
- `src/middleware/error-handler.ts`: consistent `{ error: { code, message, requestId, details? } }` envelope. Handles Zod issues (400), `AppError`, body-parser errors (400/413/415), and unknown errors as sanitized 500s. No stack traces or internal details are returned.
- `src/lib/prisma.ts`: one `PrismaClient` per process using `@prisma/adapter-mariadb` with the database name passed explicitly; reused on `globalThis` outside production; disconnected on shutdown.
- Routes currently implemented: `GET /api/v1`, `GET /api/v1/health`, `GET /api/v1/health/ready`. Readiness performs a real `systemSetting.findFirst` query and returns 503 without leaking the error.

## Database conventions (implemented)

- Prisma 7.10.1 with `prisma-client` generator output to `apps/api/src/generated/prisma` (gitignored). Prisma 7 config files load dotenv explicitly.
- `prisma/schema.prisma`: provider `mysql`, single infrastructure-only `SystemSetting` model mapped to `system_settings` (`key` PK, `value`, `updated_at`). No speculative domain models.
- Migration `20261126120000_init_foundation/migration.sql` + `migration_lock.toml` (`provider = "mysql"`), generated with `prisma migrate diff --from-empty`.
- `prisma/seed.ts`: idempotent upsert of `schema.version=1`.
- Three local databases: `taskforge` (dev), `taskforge_test` (isolated tests), `taskforge_shadow` (`prisma migrate dev` shadow). A dedicated `taskforge` user is scoped to these three databases only.
- `prisma.config.ts` uses `DATABASE_URL` and `SHADOW_DATABASE_URL`; `prisma.test.config.ts` uses only `TEST_DATABASE_URL`. Root scripts expose both migration workflows.
- MariaDB adapter is compatible with the `mysql://` datasource URL and rewrites it internally to `mariadb://`.

## Frontend conventions (implemented)

- `src/app/routes.tsx`: public layout (landing) and app shell (dashboard/not-found), each with a route error boundary.
- `src/lib/api-client.ts`: typed fetch wrapper for `{ data }` / `{ error }` envelopes, in-memory access token, credentials included, one refresh attempt on 401 via injected hook, typed `ApiError`.
- `src/lib/query-client.ts` + providers: TanStack Query with conservative defaults; toasts via Sonner.
- Tailwind 4 custom tokens (`canvas`, `surface`, `ink`, `muted`, `line`, `brand`) in `src/styles/index.css`, reduced-motion support, visible focus rings.
- Accessible primitives: Button, Badge, Card, Input, Skeleton, PageState (loading/error/empty), Radix Dialog, Radix Dropdown Menu. `buttonVariants` and `badgeVariants` live in separate modules so primitive files stay React Fast Refresh friendly.
- App shell: skip link, responsive sidebar with `aria-controls`/`aria-expanded`, desktop/tablet/mobile layouts. Dashboard/landing pages intentionally contain no business data.

## Verification performed (agent-run)

| Check | Command | Result |
| --- | --- | --- |
| Install + client generation | `pnpm install` | Passed; Prisma client generated |
| Schema validation | `prisma validate`, `prisma validate --config prisma.test.config.ts` | Both valid |
| Dev migrations | `pnpm db:deploy`, `pnpm db:status`, `pnpm db:migrate` | Applied; up to date; dev sync confirmed |
| Seed repeatability | `pnpm db:seed` (run once) | `schema.version=1` upserted |
| Test migrations | `pnpm db:migrate:test`, `pnpm db:status:test` | Applied; up to date on `taskforge_test` |
| Lint | `pnpm lint` | Passed, 0 errors/warnings |
| Types | `pnpm typecheck` | Passed for both apps |
| Format | `pnpm format:check` | Passed after formatting |
| Build | `pnpm build` | Passed (Vite reports a >500 kB chunk advisory) |
| Unit/integration tests | `pnpm test` | API 17/17 (incl. real MariaDB integration), web 10/10 |
| API runtime smoke | Built server + HTTP requests | `/api/v1/health` 200, `/api/v1/health/ready` 200 with `database: ok` |
| Web runtime smoke | Vite preview + HTTP request | HTTP 200, title `TaskForge`, hashed asset served |

## Known issues / unverified

- XAMPP `mysql.db` privilege table was found corrupt (`CHECK TABLE` reported `Wrong base information on indexpage`). `REPAIR TABLE mysql.db` was run with user approval; it reported `Number of rows changed from 3 to 0`, so three unreadable database-level grant rows were discarded. `FLUSH PRIVILEGES` still reports a checksum error, but GRANT writes, user authentication, and Prisma connections were verified working. Monitor phpMyAdmin privilege displays if other local projects use this instance.
- Playwright E2E (`pnpm test:e2e`) was **not** run: Chromium binaries are absent. No browser binary was installed because that is a dependency/tooling change requiring approval.
- Manual browser/device responsive review was **not** performed by the agent.
- MySQL 5.6/5.7/8.0 services on 3306–3308 were observed but not modified.

## Recommended next steps (not implemented)

- Approve a spec for Feature 5 (authentication and account lifecycle). Add CSRF protection for cookie-authenticated refresh/logout endpoints at that time.
- Add Socket.IO, BullMQ/Redis, and S3 only when their features are approved; keep REST + committed database state authoritative.
- Consider route-level lazy loading if the frontend bundle grows further (advisory only).
