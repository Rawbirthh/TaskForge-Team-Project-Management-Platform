# Feature 01 — Existing project foundation audit and verification

Spec status: Draft for review (retrospective audit specification). No application code is changed by this spec.

## Overview alignment

- Feature number/title: Feature 1 — Existing project foundation audit and verification.
- Dependencies: None. Dependency status: met (no prerequisites).
- Evidence used: `docs/architecture/baseline.md` (Feature 1 verification evidence), `memory.md`, `AGENTS.md`, `project-overview.md` (shared rules + Feature 1), repository files listed in the baseline evidence sources, and `git status --short` (clean at spec time).
- In scope honored:
  - Inspected repository structure, package manager, Node.js/TypeScript, Express, React/Vite, Prisma/MySQL, styling/UI libraries, and test tools.
  - Documented monorepo/workspace boundary (`apps/api`, `apps/web`) and frontend/backend separation.
  - Verified install, environment-example safety, backend/frontend startup, DB connectivity, migrations, tests, lint, type-check, and build where the environment permitted.
  - Documented conventions for routes, controllers, middleware, Zod validation, API errors, frontend routing, query caching, and component organization.
  - Recorded blockers and unverified items instead of claiming success.
- Out of scope honored:
  - No authentication, workspace/project/task features, package-manager replacement, broad refactor, or optional infrastructure installation.
  - No destructive database reset or production data operation.
- Overview acceptance criteria mapped to evidence:
  - Installed stack, versions, structure, environment requirements, and test tools documented → `docs/architecture/baseline.md` sections "Installed versions", "Repository structure", "Environment facts", "Test framework".
  - Backend/frontend can start using documented instructions, or blockers recorded → baseline "Feature 1 verification evidence" (health/readiness and Vite preview passed).
  - Prisma connects to configured development DB and migration status understood → `pnpm db:status` and `pnpm db:status:test` up to date; `prisma validate` passed for both configs.
  - Existing tests, type checks, lint, builds run where possible with actual results → baseline verification table.
  - `.env.example` contains placeholders only and no secrets committed → baseline environment facts and setup instructions; no `.env` values recorded in memory or baseline.
  - No broad refactor or dependency upgrade performed without approval → no such changes; Git history shows only foundation/CI/memory commits.

## Goal

Audit and verify the actual installed repository foundation so later TaskForge features are built against observed versions, conventions, and constraints, with blockers recorded precisely.

## Non-goals

- Implementing authentication, workspaces, projects, tasks, or any business feature.
- Replacing the package manager, architecture, or core dependencies.
- Installing optional infrastructure (Socket.IO, Redis, BullMQ, S3) without approval.
- Running destructive database commands or production deployments.

## User flows

- Developer setup/verification flow: copy `.env.example` files, configure placeholders, apply migrations, seed, run dev servers, run quality checks.
- Audit flow: inspect repository, run safe verification commands, record exact results and unverified items in `docs/architecture/baseline.md`.

## Acceptance criteria

- Stack, versions, repository structure, environment requirements, and test tools are documented.
- Backend and frontend can start using documented instructions, or blockers are recorded precisely.
- Prisma connects to the configured development database and migration status is understood.
- Existing tests, type checks, lint, and builds are run where possible; actual results are recorded.
- `.env.example` contains placeholders only and no secrets are committed.
- No broad refactor or dependency upgrade is performed without an approved specification.

## Assumptions

- Feature 1 is treated as already implemented/verified in the repository; this spec documents the verified state rather than proposing new implementation work.
- The XAMPP MariaDB instance on port 3309 is the supported local database for this portfolio environment; other local MySQL instances are intentionally untouched.
- CI rerun status after commit `1e74e9a` remains unverified by the agent and is not claimed as passed.

## Unresolved questions

- None blocking. Open verification items: Playwright browser binaries are absent locally (`pnpm test:e2e` not run); CI rerun after `1e74e9a` is unchecked; manual responsive browser/device review was not performed; XAMPP `FLUSH PRIVILEGES` still reports an Aria checksum error while grants and connections work.

## API endpoints under `/api/v1`

- `GET /api/v1` → `{ data: { name, version, health, readiness } }`
- `GET /api/v1/health` → `{ data: { status: "ok", version } }`
- `GET /api/v1/health/ready` → `{ data: { status: "ready", checks: { database: "ok" } } }`
- Unknown routes → centralized 404 `{ error: { code, message, requestId } }`
- Validation and unexpected errors → centralized handler `{ error: { code, message, requestId, details? } }`
- `X-Request-Id` is set on every response and exposed through CORS.

## Zod params/query/body and environment changes

- Environment validation: `apps/api/src/config/env.ts` defines `envSchema`, calls `safeParse(process.env)` once at startup, prints sanitized issues, exits code 1 on invalid config.
- Request validation: `apps/api/src/middleware/validate.ts` provides `validate({ params, query, body })` and `getValidated<T>()`; stores only parsed values on `req.validated`.
- No domain route currently calls `validate()`; only the unit test exercises it.
- No new environment variables are required by Feature 1 itself.

## Authentication middleware and resource authorization

- None implemented yet; Feature 5 owns authentication/account lifecycle.
- No protected routes exist, so no resource-level checks are present or required for Feature 1.

## Prisma models, relations, constraints, indexes, and migration

- Model: `SystemSetting` (infrastructure-only), mapped to `system_settings` (`key` PK `VarChar(100)`, `value` `VarChar(500)`, `updated_at`).
- No domain models, relations, or tenant-scoped constraints exist yet.
- Migration: `20261126120000_init_foundation` plus `migration_lock.toml` (`provider = "mysql"`).
- Seed: `prisma/seed.ts` idempotently upserts `schema.version=1`.
- Databases: `taskforge` (dev), `taskforge_test` (integration), `taskforge_shadow` (`prisma migrate dev`).
- Prisma client is a per-process singleton with clean disconnect on SIGINT/SIGTERM/exception.

## Query shape, selected fields, pagination, transaction/concurrency

- Not applicable to Feature 1; no domain list endpoints exist.
- No unbounded `findMany` is exposed; health/readiness uses minimal DB access.

## Service and Repository decisions

- No service or repository layer is introduced for Feature 1. Health/readiness and validation are small enough to stay direct and readable. Services/repositories will be added only when a concrete feature demonstrates reusable or complex business logic.

## React routes/pages/components

- Routes (`apps/web/src/app/routes.tsx`): public `/` layout with landing index, `/app` shell with dashboard index, `*` not-found, route error elements.
- TanStack Query provider defaults: `staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false`, mutations `retry: 0`.
- Tailwind CSS 4 with custom tokens; Radix Dialog/Dropdown; accessible primitives in `src/components/ui/`.
- No business data is rendered yet; app shell includes skip link, responsive sidebar, loading/error/empty states.

## Socket.IO, S3, and BullMQ/Redis

- Not installed or implemented. Feature 1 explicitly does not add optional infrastructure. REST + committed database state remain authoritative.

## Test matrix

- Backend tests (Vitest + Supertest, real MariaDB integration):
  - `tests/health.test.ts` — health/readiness and DB connectivity.
  - `tests/env.test.ts` — environment validation.
  - `tests/validation.test.ts` — Zod validation middleware.
  - `tests/error-handling.test.ts` — centralized errors and 404.
  - `tests/database.integration.test.ts` — Prisma/MariaDB integration.
- Frontend tests (Vitest + Testing Library, jsdom):
  - `tests/routes.test.tsx`, `tests/button.test.tsx`, `tests/api-client.test.ts`.
- E2E (Playwright): `e2e/smoke.spec.ts` — not run locally because browser binaries are absent.
- Quality checks: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build` (Vite >500 kB chunk advisory only).

## Security and performance risks

- No authentication/authorization exists yet by design; Feature 1 must not be treated as a security boundary.
- CORS uses an explicit allowlist and rejects wildcard `*`; credentials enabled.
- Helmet, rate limiter, request parsing limits, and safe error handling are configured.
- Logger redacts authorization, cookie, token, password, and refresh-token fields.
- No secrets are committed; `.env.example` contains placeholders only.
- XAMPP `mysql.db` privilege table repair left a non-blocking Aria checksum error on `FLUSH PRIVILEGES`.

## Rollout and compatibility notes

- No production deployment was attempted; production config was validated by schema inspection only.
- Node `>=24.0.0`, pnpm `>=12.0.0`, `packageManager` pinned to `pnpm@12.23.0`.
- Playwright `webServer` must use `pnpm exec vite --host 127.0.0.1` (CI host-binding fix in commit `1e74e9a`).

## Implementation sequence

Feature 1 is already implemented and verified; no further implementation is required. If gaps are found, the next action is to rerun the relevant verification commands and update `docs/architecture/baseline.md` rather than changing application code.

## Verification commands found in the repository

- `pnpm install`
- `pnpm dev` (API port 4000, web port 5173, Vite proxies `/api`)
- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm format:check`
- `pnpm build`
- `pnpm db:status`
- `pnpm db:status:test`
- `pnpm db:deploy`
- `pnpm db:seed`
- `pnpm db:migrate:test`
- `pnpm test:e2e` (requires `pnpm --filter @taskforge/web exec playwright install chromium` first)

## Approval gate

This specification is provided for review. Implementation or changes require explicit user approval in a later `/develop` request. No application code, migration, package change, or destructive command was produced by this spec.