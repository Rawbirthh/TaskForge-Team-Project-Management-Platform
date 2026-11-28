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
- Feature 7 decisions: workspace slug globally unique; owner membership created in the same transaction; active workspace selection is navigation state only (localStorage), never authorization; non-member workspaces return 404 to avoid enumeration.
- Feature 8 decisions: permission matrix (OWNER/ADMIN/MEMBER/GUEST) with grant ceiling (OWNER→ADMIN/MEMBER/GUEST, ADMIN→MEMBER/GUEST); invitations never grant OWNER; `REMOVED` membership status is terminal; last-owner protection on demotion/suspension/removal; invitation tokens hashed (SHA-256), 7-day default expiry (`INVITATION_TOKEN_TTL_DAYS`); accept requires authenticated user whose email matches; reactive selected-workspace context + TanStack Query keys include selected workspace ID to prevent stale data; query cache cleared on login/logout to prevent cross-user stale data.

## Feature progress
- Feature 1: verified foundation; evidence in `docs/architecture/baseline.md`.
- Feature 2: implemented API foundation (versioned routes, config validation, middleware, logging, health/readiness, CORS/security/rate limits).
- Feature 3: implemented database foundation (Prisma 7 + MariaDB adapter, initial migration, idempotent seed, shadow/test DB workflows, clean shutdown).
- Feature 4: implemented React foundation (routing, layouts, API client, query cache, design tokens, accessible primitives, page states).
- Feature 5: implemented and verified authentication/account lifecycle; committed as `b343650`, `d25e701`, `d0bba48`. Spec: `docs/specs/feature-05-authentication-and-account-lifecycle.md`.
- Feature 6: spec approved, implemented, verified; committed as `a923058`. Spec: `docs/specs/feature-06-user-profile-and-account-preferences.md`.
- Feature 7: spec approved, implemented, verified; committed as `74c0285`. Spec: `docs/specs/feature-07-workspace-creation-onboarding-and-switching.md`.
- Feature 8: spec approved, implemented, verified by agent checks + independent code-reviewer; uncommitted. Spec: `docs/specs/feature-08-workspace-memberships-invitations-roles-and-permissions.md`.

## Current task / latest handoff
- Status: Feature 8 implemented in the working tree and verified by agent checks + code-reviewer; uncommitted. Dependencies Features 7 and 5 met. `git status --short` shows modified tracked files plus new untracked files; no commit or push made.
- Summary: added `WorkspaceInvitation` model + migration; membership/invitation services, policy module, controllers, routes; React MembersPage, AcceptInvitationPage, selected-workspace context, membership API client, types; backend tests (memberships + invitations, 31 tests). Fixed stale-data issues: reactive selected-workspace context, cache clear on login/logout, workspace switch navigation. Fixed invite UX: field-specific validation messages, owner-only invite/pending cards, non-owner no role dropdown. Independent code-reviewer warnings addressed (concurrency idempotency, last-owner race-safety, admin reactivation boundary, decline race, console token redaction, accept-page refresh).
- Changed paths: `apps/api/prisma/schema.prisma`; migration `20261128120000_workspace_memberships_invitations/`; `apps/api/src/{config/env.ts,lib/mailer.ts,routes/index.ts,routes/workspaces.routes.ts,routes/invitations.routes.ts,schemas/membership.schemas.ts,services/membership.service.ts,services/invitation.service.ts,controllers/members.controller.ts,controllers/invitations.controller.ts,policies/workspace.policy.ts}`; `apps/api/tests/{memberships.test.ts,invitations.test.ts}`; `apps/api/.env.example`; `apps/web/src/{app/providers.tsx,app/routes.tsx,components/layout/workspace-switcher.tsx,features/auth/auth-context.tsx,features/workspaces/membership-api.ts,features/workspaces/selected-workspace-context.tsx,pages/members-page.tsx,pages/accept-invitation-page.tsx,types/membership.ts}`; `docs/specs/feature-08-workspace-memberships-invitations-roles-and-permissions.md`.
- Agent-run checks (latest exact outcomes, 2026-11-28): `pnpm test` passed with API 106/106 and web 16/16; `pnpm --filter @taskforge/api typecheck` passed; `pnpm --filter @taskforge/web typecheck` passed; `pnpm lint` passed with 0 errors and 1 pre-existing warning at `apps/web/src/features/auth/auth-context.tsx:129`; `pnpm format:check` passed; `pnpm --filter @taskforge/web build` passed (Vite >500 kB chunk advisory only); `pnpm db:status` and `pnpm db:status:test` both reported up to date. Independent `code-reviewer` run completed; warnings addressed.
- User-reported manual verification (not agent-run): user tested inviting/changing roles and reported (1) stale data on workspace switch and cross-user login, (2) generic "Request validation failed" on empty invite, (3) non-owner could see invite/pending cards and role dropdown. Fixes applied: reactive selected-workspace context + cache clear on login/logout + switch navigation; field-specific validation messages with client-side empty-email check; owner-only invite/pending cards; non-owner no role dropdown. No final post-fix browser confirmation reported.
- Blockers/open questions: Playwright `pnpm test:e2e` not run (browser binaries unavailable locally). Spec header still says "Draft for review" although approval and implementation occurred in conversation. Frontend tests for Feature 8 (spec matrix) not added. Manual browser/device verification not performed by the agent.
- Next concrete action: user manual verification of invite/accept flow and role management; commit Feature 8 work when the user approves; do not start Feature 9 without explicit approval. Also do not implement workspace rename/delete until their dedicated features are approved.

## Durable notes
- Save only confirmed decisions, important file paths, meaningful test results, known issues, and next steps.
- Clearly distinguish agent-run checks from user-reported manual verification.
- Never store `.env` values, passwords, tokens, private keys, personal data, or speculative claims.