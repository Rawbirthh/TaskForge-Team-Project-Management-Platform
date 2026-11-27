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
- Git: repository initialized on `main`; `origin` is the GitHub URL supplied by the user; three foundation commits pushed. CI is in `.github/workflows/ci.yml` and runs on every push and pull request.
- Playwright `webServer` must use `pnpm exec vite --host 127.0.0.1`; the earlier `pnpm dev -- --host ...` form caused a CI timeout.
- `/architect` writes a spec and stops for explicit approval. `/develop` implements the approved spec, creates/updates tests, runs relevant checks, and inspects the final diff.
- `/develop` is adaptive; independent review is reserved for critical/high-risk changes, while `/review` always requests it.
- Authentication (Feature 5): short-lived JWT access token in memory + rotating refresh token in an HttpOnly, Secure, SameSite=Strict cookie; server-side sessions in MySQL; refresh rotation with reuse detection; CSRF origin check on cookie-authenticated endpoints; `argon2id` password hashing; `jose` JWT signing/verification; console mailer by default in non-production.

## Feature progress
- Feature 1: verified foundation; evidence in `docs/architecture/baseline.md`.
- Feature 2: implemented API foundation (versioned routes, config validation, middleware, logging, health/readiness, CORS/security/rate limits).
- Feature 3: implemented database foundation (Prisma 7 + MariaDB adapter, initial migration, idempotent seed, shadow/test DB workflows, clean shutdown).
- Feature 4: implemented React foundation (routing, layouts, API client, query cache, design tokens, accessible primitives, page states).
- Feature 5: implemented and verified authentication/account lifecycle (registration, login, logout, refresh rotation/reuse detection, password reset, email verification, `/me`, auth middleware, frontend auth flows, auth rate limiting). Spec: `docs/specs/feature-05-authentication-and-account-lifecycle.md`.
- Feature 6: not started. No spec, no approval, no implementation.

## Current task / latest handoff
- Status: Feature 5 implemented in the working tree but not committed. Feature 5 dependency chain (Features 2–4) is complete. No active approval for Feature 6.
- Summary: Added authentication/session foundation: Prisma `User`, `Session`, `PasswordResetToken`, and `EmailVerificationToken` models/migration; Zod-validated auth environment variables; auth service, middleware, routes, and controllers; frontend auth provider/pages/routes; auth integration and route tests; independent code-review fixes applied.
- Changed paths (Feature 5): `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20261127022322_auth_foundation/`, `apps/api/src/config/env.ts`, `apps/api/src/lib/{cookies,mailer,password,tokens}.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/schemas/auth.schemas.ts`, `apps/api/src/services/auth.service.ts`, `apps/api/src/controllers/auth.controller.ts`, `apps/api/src/routes/auth.routes.ts`, `apps/api/src/routes/index.ts`, `apps/api/src/types/express.d.ts`, `apps/api/tests/auth.test.ts`, `apps/api/tests/setup.ts`, `apps/api/vitest.config.ts`, `apps/web/src/features/auth/auth-context.tsx`, `apps/web/src/components/auth/protected-route.tsx`, `apps/web/src/pages/{login,register,forgot-password,reset-password,verify-email}-page.tsx`, `apps/web/src/app/routes.tsx`, `apps/web/src/app/providers.tsx`, `apps/web/src/lib/api-client.ts`, `apps/web/src/types/auth.ts`, `apps/web/tests/routes.test.tsx`, `docs/specs/feature-05-authentication-and-account-lifecycle.md`, plus `.env.example`/`.env.test.example` placeholder updates. Unrelated practice migration artifacts are also present in the working tree; their net schema effect is none.
- Agent-run checks (2026-11-27, exact outcomes): `pnpm lint` passed with 0 errors (1 non-blocking React Fast Refresh warning); `pnpm typecheck` passed for API and web; `pnpm format:check` passed; `pnpm build` passed (Vite >500 kB chunk advisory only); `pnpm test` passed with API 34/34 and web 10/10; `pnpm db:status` and `pnpm db:status:test` both reported up to date; independent `code-reviewer` pass completed and critical/material findings were fixed and re-verified.
- Git evidence: working tree contains uncommitted Feature 5 changes at save time; no new commit has been created for Feature 5. Earlier foundation commits remain `dd39804`, `d1f74ff`, `1e74e9a`; memory checkpoint commit `f74ecb6`.
- User-reported manual verification: none recorded in this conversation.
- Blockers/open questions: Playwright browser binaries are absent locally, so `pnpm test:e2e` was not run. CI rerun result after commit `1e74e9a` remains unverified by the agent. Manual browser/device responsive review was not performed. XAMPP `mysql.db` privilege table was corrupt; repaired with approval, but `FLUSH PRIVILEGES` still reports an Aria checksum error while GRANTs and connections work.
- Next concrete action: review the Feature 5 diff and commit it. If clean, run `/architect Feature 6` (user profile and account preferences) and wait for explicit approval before implementation.

## Durable notes
- Save only confirmed decisions, important file paths, meaningful test results, known issues, and next steps.
- Clearly distinguish agent-run checks from user-reported manual verification.
- Never store `.env` values, passwords, tokens, private keys, personal data, or speculative claims.