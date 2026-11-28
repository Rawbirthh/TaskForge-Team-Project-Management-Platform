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
- Frontend uses React Router, TanStack Query, Tailwind 4 tokens, Radix primitives, an Axios-backed typed in-memory-token API client with single-flight 401 refresh, and a StrictMode guard so session restore refreshes once. `buttonVariants`/`badgeVariants` are in separate modules for Fast Refresh.
- Git: repository initialized on `main`; `origin` is the GitHub URL supplied by the user. CI is in `.github/workflows/ci.yml` and runs on every push and pull request.
- Playwright `webServer` must use `pnpm exec vite --host 127.0.0.1`; the earlier `pnpm dev -- --host ...` form caused a CI timeout.
- `/architect` writes a spec and stops for explicit approval. `/develop` implements the approved spec, creates/updates tests, runs relevant checks, and inspects the final diff.
- `/develop` is adaptive; independent review is reserved for critical/high-risk changes, while `/review` always requests it.
- Authentication (Feature 5): short-lived JWT access token in memory + rotating refresh token in an HttpOnly, Secure, SameSite=Strict cookie; server-side sessions in MySQL; refresh rotation with reuse detection; CSRF origin check on cookie-authenticated endpoints; `argon2id` password hashing; `jose` JWT signing/verification; console mailer by default in non-production.
- `/auth/refresh` is exempt from the strict credential rate limiter and remains bounded by the global `/api/v1` limiter, CSRF origin check, and refresh-token reuse detection.
- Non-interactive Prisma migrations: generate SQL with `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script`, then apply with `pnpm --filter @taskforge/api db:deploy` and `db:migrate:test`.
- API Vitest runs with `maxWorkers: 1` because parallel DB test files caused MariaDB transaction conflicts/deadlocks.
- Feature 6 decisions: profile endpoints under `/api/v1/users/me/*`; IANA time zone string default `UTC`; locale via `Intl.getCanonicalLocales`; avatar URL metadata only; `pendingEmail` + `EmailChangeToken`; password/email change and deactivation/deletion request revoke sessions; account status via timestamp flags.
- Feature 6 session listing uses cursor pagination (`createdAt desc, id desc`, default 20, max 50) with a composite `(userId, createdAt)` index replacing the old `userId` index.

## Feature progress
- Feature 1: verified foundation; evidence in `docs/architecture/baseline.md`.
- Feature 2: implemented API foundation (versioned routes, config validation, middleware, logging, health/readiness, CORS/security/rate limits).
- Feature 3: implemented database foundation (Prisma 7 + MariaDB adapter, initial migration, idempotent seed, shadow/test DB workflows, clean shutdown).
- Feature 4: implemented React foundation (routing, layouts, API client, query cache, design tokens, accessible primitives, page states).
- Feature 5: implemented and verified authentication/account lifecycle; committed as `b343650`, `d25e701`, with formatting in `d0bba48`. Spec: `docs/specs/feature-05-authentication-and-account-lifecycle.md`.
- Feature 6: spec explicitly approved by the user, implemented, and verified by agent checks; committed as `a923058`. Spec: `docs/specs/feature-06-user-profile-and-account-preferences.md`.
- Feature 7: spec explicitly approved by the user, implemented, and verified by agent checks; uncommitted. Spec: `docs/specs/feature-07-workspace-creation-onboarding-and-switching.md`.

## Current task / latest handoff
- Status: Feature 7 is implemented in the working tree and verified by agent checks; uncommitted. Dependencies Features 5, 6, and 3 are met. `git status --short` shows modified tracked files plus new untracked files; no commit or push was made.
- Summary: added Workspace and WorkspaceMembership models with owner-membership creation in one transaction, workspace create/list/get/slug-availability endpoints, React create page, workspace switcher, onboarding empty state, and backend/frontend tests. Fixed two client cache bugs: shared `['workspaces']` query key between switcher and dashboard, and switcher not syncing selected workspace from localStorage after creation. Migrated the web API client from `fetch` to `axios` and updated affected tests.
- Changed paths: `apps/api/prisma/schema.prisma`; migration `20261128100000_workspace_creation/`; `apps/api/src/{routes/index.ts,schemas/workspace.schemas.ts,services/workspace.service.ts,controllers/workspace.controller.ts,routes/workspaces.routes.ts}`; `apps/api/tests/workspaces.test.ts`; `apps/web/package.json` and `pnpm-lock.yaml` (added axios); `apps/web/src/{lib/api-client.ts,app/routes.tsx,components/layout/app-shell.tsx,components/layout/workspace-switcher.tsx,pages/dashboard-page.tsx,pages/workspace-create-page.tsx,features/workspaces/workspace-api.ts,types/workspace.ts}`; `apps/web/tests/{api-client.test.ts,workspace-api.test.ts,auth-restore.test.tsx,profile-api.test.ts,profile-pagination.test.tsx,routes.test.tsx}`; `docs/specs/feature-07-workspace-creation-onboarding-and-switching.md`.
- Agent-run checks (latest exact outcomes, 2026-11-28): `pnpm --filter @taskforge/api exec vitest run tests/workspaces.test.ts` passed 17/17; `pnpm test` passed with API 75/75 and web 16/16; `pnpm --filter @taskforge/api typecheck` passed; `pnpm --filter @taskforge/web typecheck` passed; `pnpm lint` passed with 0 errors and 1 pre-existing warning at `apps/web/src/features/auth/auth-context.tsx:129`; `pnpm format:check` passed; `pnpm build` passed (Vite >500 kB chunk advisory only); `pnpm db:status` and `pnpm db:status:test` both reported up to date.
- User-reported manual verification (not agent-run): the user created a workspace and observed that the dropdown did not immediately reflect it without refresh; two client-side cache fixes were applied in response. The user also requested workspace rename/delete, which are deferred to Features 9 and 40 and were not implemented. No post-fix browser confirmation was reported.
- Blockers/open questions: independent `code-reviewer` was not run for this feature. Playwright `pnpm test:e2e` was not run because browser binaries were previously unavailable locally. The spec header still says "Draft for review" although approval and implementation occurred in conversation. Manual browser/device verification was not performed by the agent.
- Next concrete action: review the uncommitted diff, commit the Feature 7 work when the user approves, and have the user manually verify workspace creation, onboarding, and switching. Do not start Feature 8 without explicit user approval. Also do not implement workspace rename/delete until their dedicated features are approved.

## Durable notes
- Save only confirmed decisions, important file paths, meaningful test results, known issues, and next steps.
- Clearly distinguish agent-run checks from user-reported manual verification.
- Never store `.env` values, passwords, tokens, private keys, personal data, or speculative claims.
