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
- Git: repository initialized on `main`; `origin` is the GitHub URL supplied by the user; three commits pushed. CI is in `.github/workflows/ci.yml` and runs on every push and pull request.
- Playwright `webServer` must use `pnpm exec vite --host 127.0.0.1`; the earlier `pnpm dev -- --host ...` form caused a CI timeout.
- `/architect` writes a spec and stops for explicit approval. `/develop` implements the approved spec, creates/updates tests, runs relevant checks, and inspects the final diff.
- `/develop` is adaptive; independent review is reserved for critical/high-risk changes, while `/review` always requests it.

## Feature progress
- Feature 1: verified foundation; evidence in `docs/architecture/baseline.md`. Install, startup, DB connectivity, migration status, tests, lint, type-check, and build verified; E2E not run locally.
- Feature 2: implemented API foundation (versioned routes, config validation, middleware, logging, health/readiness, CORS/security/rate limits).
- Feature 3: implemented database foundation (Prisma 7 + MariaDB adapter, initial migration, idempotent seed, shadow/test DB workflows, clean shutdown).
- Feature 4: implemented React foundation (routing, layouts, API client, query cache, design tokens, accessible primitives, page states).
- Feature 5: not started. No spec, no approval, no implementation.

## Current task / latest handoff
- Status: Foundation complete, committed, pushed, and locally verified. No active feature spec; no `docs/specs/*.md` files found. No feature approval for Feature 5 has been given.
- Summary: Added setup guide, Git history, CI workflow, architecture baseline, and a Playwright CI host-binding fix. All local checks passed; first CI run failed only on the webServer host binding and the fix was pushed, but the rerun result has not been checked by the agent.
- Files changed in this handoff: `docs/GETTING_STARTED.md`, `README.md` (link), `.github/workflows/ci.yml`, `docs/architecture/baseline.md`, `apps/web/playwright.config.ts`. Earlier foundation paths are described in `docs/architecture/baseline.md`.
- Agent-run checks (2026-11-26, exact outcomes): `pnpm lint` passed; `pnpm typecheck` passed; `pnpm format:check` passed; `pnpm build` passed (Vite >500 kB chunk advisory only); `pnpm test` passed with API 17/17 (including real MariaDB integration) and web 10/10; `pnpm db:status` and `pnpm db:status:test` both reported up to date; `prisma validate` passed for both configs; built API health returned `status: ok` and readiness returned `database: ok`; Vite preview returned HTTP 200/title `TaskForge`; the new Playwright webServer command was verified locally to bind `127.0.0.1:5173` and return HTTP 200.
- Git evidence: commits `dd39804`, `d1f74ff`, `1e74e9a` pushed to `main`; `git status --short` clean at save time.
- User-reported manual verification: none recorded in this conversation.
- Blockers/open questions: Playwright browser binaries are absent locally, so `pnpm test:e2e` was not run locally. The CI rerun after commit `1e74e9a` is unverified by the agent. Manual browser/device responsive review was not performed. XAMPP `mysql.db` privilege table was corrupt; repaired with approval, but `FLUSH PRIVILEGES` still reports an Aria checksum error while GRANTs and connections work.
- Next concrete action: check the GitHub Actions result for commit `1e74e9a`. If green, run `/architect Feature 5` (authentication and account lifecycle) and wait for explicit approval before implementation; add CSRF protection for cookie-based refresh/logout endpoints in that feature.

## Durable notes
- Save only confirmed decisions, important file paths, meaningful test results, known issues, and next steps.
- Clearly distinguish agent-run checks from user-reported manual verification.
- Never store `.env` values, passwords, tokens, private keys, personal data, or speculative claims.
