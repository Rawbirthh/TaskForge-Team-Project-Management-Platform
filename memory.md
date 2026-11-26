# Project Memory

> Maintained by `/remember save`. Keep this concise, factual, and free of secrets. This is a project handoff, not a chat transcript.

## Project profile
- Product: TaskForge, a multi-tenant team project management platform (workspaces, projects, tasks, Kanban, comments, files, real-time updates, notifications). Product scope, business rules, Features 1–42, dependencies, and acceptance criteria live in `project-overview.md`; engineering rules live in `AGENTS.md`.
- Stack in use: Node.js 24.13.0, pnpm 12.23.0 (via Corepack; npm must not be used), TypeScript 6.0.3 strict + `exactOptionalPropertyTypes`, Express 5.3.0 REST API under `/api/v1`, React 19.3.1 + Vite 8.3.8, Prisma 7.10.1 with `@prisma/adapter-mariadb`.
- Database: XAMPP MariaDB 10.4.32 at `127.0.0.1:3309`. Other local instances (MySQL 5.6/5.7/8.0 on 3306/3307/3308) were observed and left untouched.
- Validation: Zod for backend params/query/body and startup environment. Config is validated once in `apps/api/src/config/env.ts`.
- Realtime/jobs/storage: Socket.IO, BullMQ/Redis, S3 are feature-driven and not installed; REST + committed MariaDB state remain authoritative.
- Architecture: one Express API (`apps/api`) and one React app (`apps/web`) in a pnpm workspace. No modular monolith or microservices. Services/repositories only when a feature justifies them.

## Confirmed architecture decisions
- Prisma 7 uses `prisma.config.ts` and `prisma.test.config.ts` with explicit dotenv loading; generated client lives in `apps/api/src/generated/prisma` (gitignored).
- Three dedicated databases: `taskforge` (dev), `taskforge_test` (isolated Vitest integration), `taskforge_shadow` (`prisma migrate dev`). A dedicated `taskforge` user is scoped only to these.
- API conventions: `{ data }` / `{ error: { code, message, requestId, details? } }` envelopes, `X-Request-Id` on responses, centralized error handler, Zod validation middleware, explicit CORS allowlist, Helmet, rate limiting.
- Pino redacts authorization, cookies, tokens, and password fields. Prisma client is a per-process singleton with clean disconnect on shutdown.
- Frontend uses React Router, TanStack Query, Tailwind 4 tokens, Radix primitives, typed in-memory-token API client with single refresh retry on 401. `buttonVariants`/`badgeVariants` are in separate modules for Fast Refresh.
- `/architect` writes a spec and stops for explicit approval. `/develop` implements the approved spec, creates/updates tests, runs relevant checks, and inspects the final diff.
- `/develop` is adaptive; independent review is reserved for critical/high-risk changes, while `/review` always requests it.

## Feature progress
- Feature 1: verified foundation; stack, workspace layout, commands, environment, and blockers recorded in `docs/architecture/baseline.md`. DB connectivity and migrations verified; Playwright E2E and manual browser review not performed.
- Feature 2: implemented API foundation (versioned routes, config validation, middleware, logging, health/readiness, CORS/security/rate limits).
- Feature 3: implemented database foundation (Prisma 7 + MariaDB adapter, initial migration, idempotent seed, shadow/test DB workflows, clean shutdown).
- Feature 4: implemented React foundation (routing, layouts, API client, query cache, design tokens, accessible primitives, page states).

## Current task / latest handoff
- Status: Foundation complete and verified locally.
- Summary: All install, migration, lint, typecheck, format, build, unit/integration test, API runtime, and web preview checks passed. Next feature must start with an approved spec.
- Files changed: root workspace/tooling; `apps/api` (config, lib, middleware, routes, Prisma schema/config/seed/migration, tests); `apps/web` (app router/providers, components, pages, features, lib, tests, e2e, Playwright config); `README.md`; `docs/architecture/baseline.md`; `docs/ui-registry.md`; `memory.md`.
- Tests/checks (2026-11-26): `pnpm lint` passed; `pnpm typecheck` passed; `pnpm format:check` passed; `pnpm build` passed (bundle-size advisory only); `pnpm test` passed (API 17/17 incl. real MariaDB integration, web 10/10); `pnpm db:deploy`/`db:status`/`db:seed`/`db:migrate`/`db:migrate:test`/`db:status:test` all passed; built API readiness returned `database: ok`; Vite preview returned HTTP 200.
- Blockers/open questions: Playwright browser binaries not installed, so `pnpm test:e2e` is unverified. Manual responsive/device review not performed. XAMPP `mysql.db` privilege table was corrupt; repaired with approval, but `FLUSH PRIVILEGES` still reports an Aria checksum error while GRANTs and connections work.
- Next recommended step: `/architect Feature 5` (authentication and account lifecycle), then wait for explicit approval before implementation. Add CSRF protection for cookie-based refresh/logout endpoints in that feature.

## Durable notes
- Save only confirmed decisions, important file paths, meaningful test results, known issues, and next steps.
- Clearly distinguish agent-run checks from user-reported manual verification.
- Never store `.env` values, passwords, tokens, private keys, personal data, or speculative claims.
