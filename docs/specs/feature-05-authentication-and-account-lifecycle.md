# Feature 05 — Authentication and account lifecycle

Spec status: Draft for review. No application code, migration, or package change is produced by this spec.

## Overview alignment

- Feature number/title: Feature 5 — Authentication and account lifecycle.
- Dependencies: Feature 2, Feature 3, Feature 4. Dependency status: met.
  - Evidence: `memory.md` marks Features 2 (API foundation), 3 (database foundation), and 4 (React foundation) as implemented; `docs/architecture/baseline.md` records their verification. `git status --short` is clean except the untracked `docs/specs/` directory created by the Feature 1 spec.
- In scope honored: registration, login, logout, password hashing, JWT access token + rotating refresh cookie, server-side sessions, refresh rotation/reuse detection, password reset, email verification or documented local mail adapter, auth middleware, `/me`, frontend auth forms, and auth rate limiting.
- Out of scope honored: social login, SSO/SAML, MFA, workspace roles, invitations, organization provisioning, Socket.IO, S3, BullMQ/Redis, and workspace/account deletion beyond defining dependency behavior.
- Overview acceptance criteria mapped to the test matrix below.
- Documented refinements of overview rules (all must be followed during implementation):
  1. JWT library choice: use `jose` (ESM-native, supports HS256 and explicit algorithm/issuer/audience validation). This is a proposed dependency and requires user approval before installation.
  2. Password hashing choice: use `argon2` (argon2id) with documented cost parameters. This is a proposed dependency and requires user approval before installation. If native build/install is blocked, `bcryptjs` with cost 12 is the documented fallback, subject to approval.
  3. Email delivery: use a small mailer interface with a `console` adapter that logs verification/reset links in development and a disabled adapter in production unless SMTP settings are configured. `nodemailer` (or an equivalent) is introduced only when the SMTP adapter is implemented and approved.
  4. Email verification is not a login gate for the MVP: unverified users may log in and are shown a verification prompt. Verification status is exposed by `/me`.
  5. Registration requires email and password; `displayName` is optional and defaults to the local part of the email address.
  6. CSRF protection for refresh/logout uses an allowlisted `Origin` check, `SameSite=Strict`, `HttpOnly`, `Secure` in production, a path-scoped cookie, and no double-submit token. This refines the overview's "origin check plus SameSite and a custom header or equivalent."
  7. Access-token lifetime is 15 minutes; refresh-token lifetime is 7 days.
  8. Password reset revokes all active sessions for the user.
  9. Cookie-authenticated endpoints require the `Origin` header to be present and in `CORS_ORIGINS`; requests without an allowed origin are rejected.
  10. Auth rate limiting is separate from the global API limiter and is skipped in `NODE_ENV=test`.

## Goal

Provide secure account registration, sign-in, sign-out, password recovery, and email verification so later workspace features can rely on an authenticated, revocable session.

## Non-goals

- Social/enterprise identity providers, MFA, workspace roles, invitations, organization provisioning.
- Socket.IO delivery, S3 uploads, background jobs, and email provider integration beyond a documented adapter.
- User profile editing (Feature 6), including change-password and session management UI.
- Permanent account deletion or workspace data deletion.

## User flows

- Registration: user submits email/password (optional display name); account is created; verification email/link is generated; a session is created; access token is returned in the response body and refresh token is set as an HttpOnly cookie.
- Login: user submits email/password; invalid credentials return a generic error; valid credentials create a new session and return an access token plus user DTO.
- Authenticated request: frontend sends `Authorization: Bearer <access token>`; middleware verifies JWT and active session, then attaches `req.auth`.
- Token refresh: frontend calls refresh with cookie; server rotates the refresh token and returns a new access token.
- Logout: server revokes the current session and clears the refresh cookie.
- Forgot password: request always returns success; if the account exists, a single-use reset token is created and delivered through the mail adapter.
- Reset password: token and new password are submitted; token is validated and marked used; password is updated; all active sessions are revoked.
- Email verification: verification link points to the frontend, which calls the API with the token; token is validated and marked used; `emailVerifiedAt` is set.

## Acceptance criteria

- A user can register, verify email as configured, log in, and log out.
- Invalid credentials and invalid forms return safe, useful errors.
- Guests cannot call protected endpoints successfully.
- The refresh cookie uses the approved security settings in production, and access tokens are never persisted in browser storage.
- Password reset links are single-use and expire; password reset revokes prior sessions according to the approved policy.
- Public payloads cannot assign roles, workspaces, or privileged account fields.

## Assumptions

- `displayName` is optional at registration and defaults to the local part of the email address.
- Email verification is not required to log in.
- Password policy: minimum 12 characters, maximum 128 characters. No composition rules beyond length.
- Refresh-token lifetime is 7 days; access-token lifetime is 15 minutes.
- Password reset token lifetime is 60 minutes; email verification token lifetime is 24 hours.
- User IDs use Prisma `cuid()`.
- SMTP is optional; the default development adapter logs links to the server console.
- The frontend base URL for email links is configured by `APP_PUBLIC_URL`.
- IP address and user agent are stored on sessions for future security display; this is limited to those two values.

## Unresolved questions

- None blocking. Non-blocking choices requiring approval: `argon2` vs `bcryptjs`, `jose` vs `jsonwebtoken`, and whether to introduce `nodemailer` in the first implementation or keep the console adapter only.

## API endpoints under `/api/v1`

All auth endpoints are mounted under `/api/v1/auth`. Responses use `{ data }` / `{ error: { code, message, requestId, details? } }`.

- `POST /api/v1/auth/register`
  - Auth: guest.
  - Body: `{ email: string; password: string; displayName?: string }`.
  - 201: `{ data: { accessToken: string; user: PublicUser } }`; sets refresh cookie.
  - 400: validation error.
  - 409: `EMAIL_ALREADY_EXISTS`.
  - 429: auth rate limit.
- `POST /api/v1/auth/login`
  - Auth: guest.
  - Body: `{ email: string; password: string }`.
  - 200: `{ data: { accessToken: string; user: PublicUser } }`; sets/rotates refresh cookie.
  - 401: `INVALID_CREDENTIALS`.
  - 429: auth rate limit.
- `POST /api/v1/auth/refresh`
  - Auth: refresh cookie (no Bearer required).
  - Body: none.
  - 200: `{ data: { accessToken: string } }`; rotates refresh cookie.
  - 401: `INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_REUSED`, or `SESSION_EXPIRED`; clears cookie.
  - 403: `CSRF_ORIGIN_REJECTED`.
- `POST /api/v1/auth/logout`
  - Auth: optional Bearer access token or refresh cookie.
  - Body: none.
  - 204: no content; clears refresh cookie and revokes the resolved session.
  - 403: `CSRF_ORIGIN_REJECTED` when a cookie is used without an allowed origin.
- `POST /api/v1/auth/forgot-password`
  - Auth: guest.
  - Body: `{ email: string }`.
  - 200: `{ data: { message: string } }` (always the same message).
  - 429: auth rate limit.
- `POST /api/v1/auth/reset-password`
  - Auth: guest.
  - Body: `{ token: string; password: string }`.
  - 200: `{ data: { message: string } }`.
  - 400: validation error or `INVALID_RESET_TOKEN`.
  - 429: auth rate limit.
- `POST /api/v1/auth/verify-email`
  - Auth: guest.
  - Body: `{ token: string }`.
  - 200: `{ data: { message: string } }`.
  - 400: `INVALID_VERIFICATION_TOKEN`.
- `POST /api/v1/auth/resend-verification`
  - Auth: Bearer access token.
  - Body: none.
  - 200: `{ data: { message: string } }`.
  - 401: unauthenticated.
- `GET /api/v1/me`
  - Auth: Bearer access token.
  - 200: `{ data: { user: PublicUser } }`.
  - 401: unauthenticated.

`PublicUser`:
```ts
{
  id: string;
  email: string;
  displayName: string;
  emailVerifiedAt: string | null;
  createdAt: string;
}
```

## Zod params/query/body and environment changes

Request schemas:
- `registerSchema`: `{ email: z.string().email().max(254).transform(lowercase trim), password: z.string().min(12).max(128), displayName: z.string().trim().min(1).max(80).optional() }`.
- `loginSchema`: `{ email: ..., password: z.string().min(1).max(128) }`.
- `forgotPasswordSchema`: `{ email: ... }`.
- `resetPasswordSchema`: `{ token: z.string().min(32).max(256), password: z.string().min(12).max(128) }`.
- `verifyEmailSchema`: `{ token: z.string().min(32).max(256) }`.
- No params/query validation is needed for auth routes except standard route handling.

Environment changes (add to `envSchema`):
- `JWT_ACCESS_SECRET`: `z.string().min(32)`.
- `JWT_ISSUER`: `z.string().min(1).default('taskforge-api')`.
- `JWT_AUDIENCE`: `z.string().min(1).default('taskforge-web')`.
- `ACCESS_TOKEN_TTL_MINUTES`: `z.coerce.number().int().min(5).max(60).default(15)`.
- `REFRESH_TOKEN_TTL_DAYS`: `z.coerce.number().int().min(1).max(30).default(7)`.
- `PASSWORD_RESET_TOKEN_TTL_MINUTES`: `z.coerce.number().int().min(5).max(1440).default(60)`.
- `EMAIL_VERIFICATION_TOKEN_TTL_HOURS`: `z.coerce.number().int().min(1).max(168).default(24)`.
- `AUTH_RATE_LIMIT_WINDOW_MS`: `z.coerce.number().int().min(1000).max(3_600_000).default(900_000)`.
- `AUTH_RATE_LIMIT_MAX`: `z.coerce.number().int().min(1).max(100).default(10)`.
- `MAIL_PROVIDER`: `z.enum(['disabled', 'console', 'smtp']).default('console')`.
- `APP_PUBLIC_URL`: `z.string().url().default('http://localhost:5173')`.
- SMTP fields (optional): `SMTP_HOST`, `SMTP_PORT` (coerced number), `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.
- Add a `superRefine` requiring `SMTP_HOST`, `SMTP_PORT`, and `SMTP_FROM` when `MAIL_PROVIDER === 'smtp'`.

Update `.env.example` and `.env.test.example` with placeholders only.

## Authentication middleware and resource authorization

- `requireAuth` middleware:
  - Reads `Authorization: Bearer <token>`.
  - Verifies the JWT with `jose` using HS256, issuer, audience, and expiry.
  - Loads the session by `sid`; rejects if missing, revoked, or expired.
  - Loads the user by `sub`; rejects if missing.
  - Attaches `req.auth = { userId, sessionId }`.
  - Does not attach roles or permissions; later features read those from the database.
- `requireVerifiedOrigin` middleware for cookie-authenticated endpoints:
  - Requires `Origin` header and verifies it is in `corsOrigins`.
  - Rejects with 403 `CSRF_ORIGIN_REJECTED` otherwise.
- Trusted server-derived fields: user ID, session ID, email verification timestamp, password hash, token hashes, and cookie attributes are derived server-side. `userId`, `sessionId`, `role`, `emailVerifiedAt`, and token values are never accepted from request bodies.
- Resource authorization for Feature 5 is limited to self-access: `/me`, resend verification, logout, and password change (Feature 6) operate only on the authenticated user.

## Prisma models, relations, constraints, unique keys, indexes, and migration

Add to `schema.prisma`:

```prisma
model User {
  id               String   @id @default(cuid())
  email            String   @unique
  passwordHash     String   @map("password_hash")
  displayName      String   @map("display_name")
  emailVerifiedAt  DateTime? @map("email_verified_at")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  sessions                 Session[]
  passwordResetTokens      PasswordResetToken[]
  emailVerificationTokens  EmailVerificationToken[]

  @@map("users")
}

model Session {
  id                        String    @id @default(cuid())
  userId                    String    @map("user_id")
  user                      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshTokenHash          String    @unique @map("refresh_token_hash")
  previousRefreshTokenHash  String?   @unique @map("previous_refresh_token_hash")
  rotatedAt                 DateTime? @map("rotated_at")
  expiresAt                 DateTime  @map("expires_at")
  revokedAt                 DateTime? @map("revoked_at")
  userAgent                 String?   @map("user_agent") @db.VarChar(512)
  ipAddress                 String?   @map("ip_address") @db.VarChar(64)
  createdAt                 DateTime  @default(now()) @map("created_at")

  @@index([userId])
  @@index([expiresAt])
  @@index([previousRefreshTokenHash])
  @@map("sessions")
}

model PasswordResetToken {
  id        String    @id @default(cuid())
  userId    String    @map("user_id")
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")

  @@index([userId])
  @@map("password_reset_tokens")
}

model EmailVerificationToken {
  id        String    @id @default(cuid())
  userId    String    @map("user_id")
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")

  @@index([userId])
  @@map("email_verification_tokens")
}
```

Migration plan:
- Create a new migration, for example `20261127..._auth_foundation`, using `pnpm db:migrate` in development; do not edit the existing foundation migration.
- Apply to dev with `pnpm db:migrate`, to test with `pnpm db:migrate:test`.
- Review generated SQL for foreign keys, indexes, and MySQL column types.
- No destructive changes. Rollback is by creating a follow-up migration if needed.

Deletion/retention semantics:
- Deleting a `User` cascades to sessions and tokens.
- Sessions are soft-revoked via `revokedAt`; expired sessions may be cleaned up later by a maintenance job (not in Feature 5).
- Password reset tokens are single-use and expire; used/expired rows may be cleaned up later.

## Query shape, selected fields, pagination, transaction, and concurrency

- User lookup by email uses `select` for `id, email, passwordHash, displayName, emailVerifiedAt, createdAt`.
- Session lookup by refresh hash uses `select` for session and user fields needed for rotation.
- Registration creates user + session in one `$transaction`.
- Password reset updates password and revokes sessions in one `$transaction`.
- Email verification updates user and marks token used in one `$transaction`.
- No list endpoint is added in Feature 5; `/me` is single-record.
- Concurrency: unique constraints on email and token hashes prevent duplicate rows. Refresh rotation updates `refreshTokenHash`; if two concurrent refresh requests use the same old token, one succeeds and the other detects reuse and revokes the session.
- Scale risks: session/token table growth and password-hashing CPU cost. Mitigations: indexes on user/session/token, auth rate limits, and future cleanup of expired rows.

## Service and Repository decisions

- Add `AuthService` in `apps/api/src/services/auth.service.ts` (or `auth/`) because registration, login, refresh, logout, reset, and verification are multi-step, transactional, and reused by controllers. Controllers remain thin.
- Add small helpers:
  - `password.ts` for hashing/verification.
  - `tokens.ts` for JWT signing/verification and opaque token generation/hashing.
  - `mailer.ts` for the mail adapter interface and console/SMTP adapters.
- Do not add a repository layer. Prisma access is simple, single-table, and not duplicated across features yet. If auth queries become complex or are reused by Feature 6/8, introduce a repository then.
- Add auth middleware in `apps/api/src/middleware/auth.ts`.

## React routes/pages/components

- Add public routes under `PublicLayout`:
  - `/login`
  - `/register`
  - `/forgot-password`
  - `/reset-password`
  - `/verify-email`
- Add an auth provider (context or hooks) that:
  - Stores the access token in memory only.
  - Configures `configureAuthHooks` with `getAccessToken` and `refreshAccessToken`.
  - Calls `/me` via TanStack Query when a token exists.
- Add pages:
  - `LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `VerifyEmailPage`.
- Add components/forms using existing `Input`, `Button`, `Card`, and `PageState`:
  - `AuthForm`, `PasswordField`, server error display, pending/disabled submit.
- Route protection:
  - `/app` remains accessible only when an access token exists; unauthenticated users are redirected to `/login`.
  - Route guards are UX only; API authorization remains authoritative.
- Cache behavior:
  - Query key `['me']` with `enabled: Boolean(accessToken)`.
  - Invalidate `['me']` on login/logout/profile changes.
  - Do not store tokens in `localStorage` or `sessionStorage`.

## Socket.IO, S3, and BullMQ/Redis

- Not introduced in Feature 5.
- Auth verification logic must be reusable by Feature 25's socket handshake: `verifyAccessToken` should be exported from the auth module rather than embedded only in Express middleware.
- No realtime events are emitted by Feature 5.

## Test matrix

Backend (Vitest + Supertest, real MariaDB):
- Registration success returns safe user and access token; password is hashed.
- Duplicate email returns 409.
- Invalid email/password/display name return 400 with field errors.
- Privileged fields in registration body are ignored/rejected.
- Login success/failure; unknown email and wrong password return the same 401.
- Guest denial for `/me`.
- `/me` returns only safe fields.
- Refresh rotation returns a new access token and updates the cookie.
- Refresh token reuse revokes the session and rejects the reused token.
- Expired/invalid/tampered JWT is rejected; wrong issuer/audience/algorithm rejected.
- Logout revokes the session; subsequent refresh fails.
- Forgot password always returns success and creates a token only for existing users.
- Reset password token expiry/reuse; password update; all sessions revoked.
- Email verification success/expiry/reuse.
- Resend verification requires authentication and only sends for unverified users.
- CSRF origin rejection on refresh/logout.
- Auth rate limit behavior (where not skipped in tests).

Frontend (Vitest + Testing Library):
- Register/login form validation and server error display.
- Pending/disabled submit and double-submit protection.
- Token stored in memory only; refresh retry path.
- Protected route redirect when unauthenticated.

E2E (Playwright, if binaries installed):
- Register → verify email (via logged link in dev) → login → refresh → logout.

## Security and performance risks

- Password hashing is CPU-intensive; rate limits and bounded input sizes mitigate abuse.
- JWT secret rotation is not supported in Feature 5; changing `JWT_ACCESS_SECRET` invalidates all access tokens but not refresh sessions. Document this limitation.
- Refresh-token reuse detection depends on storing the previous token hash; concurrent requests may cause a false reuse if the client retries. Mitigation: client refresh serialization and clear error messaging.
- Email enumeration is partially mitigated for login and forgot-password, but registration necessarily reveals duplicate emails.
- Tokens in email links can leak through referrer headers; verification/reset pages should avoid leaking the token to third parties (no external assets requiring the token).
- Session and token tables grow indefinitely until cleanup is added (Feature 29 or a maintenance task).
- CSRF protection relies on `Origin` validation and SameSite; older browsers or non-browser clients must send an allowed `Origin`.

## Rollout and compatibility notes

- No Socket.IO, Redis, S3, or BullMQ changes.
- New environment variables must be added to `.env.example` and `.env.test.example` with placeholders.
- Existing tests must continue to pass; auth rate limiter must be skipped in `NODE_ENV=test` to avoid flaky failures.
- Prisma migration adds four tables; review generated SQL before applying.

## Implementation sequence

1. Add environment variables and validation.
2. Add Prisma models and migration; generate client.
3. Add password/token/mailer helpers and `AuthService`.
4. Add auth middleware and routes/controllers.
5. Add frontend auth pages/provider and route guards.
6. Add backend and frontend tests.
7. Run `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`, `pnpm test`, and safe migration-status checks.

## Verification commands found in the repository

- `pnpm lint`
- `pnpm typecheck`
- `pnpm format:check`
- `pnpm build`
- `pnpm test`
- `pnpm db:migrate`
- `pnpm db:migrate:test`
- `pnpm db:status`
- `pnpm db:status:test`
- `pnpm test:e2e` (requires Playwright browser binaries)

## Approval gate

This specification is provided for review. Implementation requires explicit user approval in a later `/develop` request. No application code, migration, package change, or destructive command was produced by this spec.