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
- Frontend uses React Router, TanStack Query, Tailwind 4 tokens, Radix primitives, typed in-memory-token API client with single-flight 401 refresh, and a StrictMode guard so session restore refreshes once. `buttonVariants`/`badgeVariants` are in separate modules for Fast Refresh.
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
- Feature 6: spec explicitly approved by the user, implemented, and verified by agent checks; uncommitted. Spec: `docs/specs/feature-06-user-profile-and-account-preferences.md`.

## Current task / latest handoff
- Status: Feature 6 is complete in the working tree, including two recovery fixes and session pagination. Dependency Feature 5 is met. `main...origin/main` showed no ahead/behind divergence at save time; all current work is uncommitted. No commit or push was made.
- Summary: added self-profile read/update, email-change request/verification, password change with session revocation, safe session list/revoke with cursor pagination, deactivation/deletion requests, plus `/me` additive profile fields and login rejection for flagged accounts.
- Recovery fixes: StrictMode no longer double-runs session restore in `auth-context.tsx`; `/auth/refresh` no longer uses the strict login/register rate limiter.
- Changed paths: `apps/api/prisma/schema.prisma`; migrations `20261127100000_profile_preferences/` and `20261127120000_session_pagination_index/`; `apps/api/src/{config/env.ts,lib/mailer.ts,routes/index.ts,routes/users.routes.ts,routes/auth.routes.ts,schemas/profile.schemas.ts,services/profile.service.ts,services/auth.service.ts,controllers/profile.controller.ts,vitest.config.ts}`; `apps/api/.env.example`; `apps/api/tests/{profile.test.ts,auth-rate-limit.test.ts}`; `apps/web/src/{app/routes.tsx,components/layout/app-shell.tsx,features/auth/auth-context.tsx,features/profile/profile-api.ts,pages/profile-page.tsx,pages/verify-email-change-page.tsx,types/auth.ts}`; `apps/web/tests/{auth-restore.test.tsx,profile-api.test.ts,profile-pagination.test.tsx}`; `docs/specs/feature-06-user-profile-and-account-preferences.md`.
- Agent-run checks (latest exact outcomes, 2026-11-27): `pnpm test` passed with API 58/58 and web 14/14; `pnpm --filter @taskforge/api typecheck` passed; `pnpm --filter @taskforge/web typecheck` passed; `pnpm lint` passed with 0 errors and 1 pre-existing warning at `apps/web/src/features/auth/auth-context.tsx:129`; `pnpm format:check` passed; `pnpm build` passed (Vite >500 kB chunk advisory only); `pnpm db:status` and `pnpm db:status:test` both reported up to date; `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` produced an empty migration after the new index migration.
- Targeted regressions: `vitest run tests/auth-restore.test.tsx` failed before the StrictMode fix and passed 1/1 after; `vitest run tests/auth-rate-limit.test.ts` failed before the refresh-rate-limit fix and passed 1/1 after; `vitest run tests/profile.test.ts` passed 23/23; `vitest run tests/profile-pagination.test.tsx tests/profile-api.test.ts` passed 3/3.
- User-reported manual verification (not agent-run): the user observed refresh-to-login behavior and later a `429` on `POST /api/v1/auth/refresh` after repeated browser refreshes. No post-fix browser confirmation was reported for the StrictMode fix, 429 fix, or session pagination.
- Blockers/open questions: independent `code-reviewer` for Feature 6 was blocked by the provider free-usage limit; later recovery/pagination changes were self-reviewed only. Playwright `pnpm test:e2e` was not run because browser binaries were previously unavailable locally. The active spec file header still says "Draft for review" although approval and implementation occurred in conversation. Manual browser/device verification was not performed by the agent.
- Next concrete action: review the uncommitted diff, commit the Feature 6/recovery/pagination work when the user approves, and have the user manually verify browser refresh behavior and session Previous/Next paging. Do not start Feature 7 without explicit user approval.

## Durable notes
- Save only confirmed decisions, important file paths, meaningful test results, known issues, and next steps.
- Clearly distinguish agent-run checks from user-reported manual verification.
- Never store `.env` values, passwords, tokens, private keys, personal data, or speculative claims.
