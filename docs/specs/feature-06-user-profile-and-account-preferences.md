# Feature 06 — User profile and account preferences

Spec status: Draft for review. No application code, migration, or package change is produced by this spec.

## Overview alignment

- Feature number/title: Feature 6 — User profile and account preferences.
- Dependencies: Feature 5 (Authentication and account lifecycle). Dependency status: **met**.
  - Evidence: `memory.md` marks Feature 5 implemented and verified; auth code present at `apps/api/src/services/auth.service.ts`, `apps/api/src/routes/auth.routes.ts`, `apps/api/src/middleware/auth.ts`; migration `apps/api/prisma/migrations/20261127022322_auth_foundation/` exists; tests `apps/api/tests/auth.test.ts` and `apps/web/tests/routes.test.tsx` exist. Git history contains `b343650 feat(auth)`, `d25e701 fix(auth)`, `d0bba48 style`. Working tree is clean.
- In scope honored: view/update display name, avatar metadata, basic profile fields; preferred time zone; optional locale/display preferences; change password with current-password verification; resend email verification; account deactivation/deletion request behavior (flags + session revocation only; full cleanup deferred); show active session/security information from `Session` records.
- Out of scope honored: workspace profile/settings, workspace membership, public user profiles, permanent account deletion workflow, avatar file upload (deferred to Feature 21), workspace data deletion (deferred to Feature 40).
- Overview acceptance criteria mapped to test matrix below.
- Documented refinements of overview rules:
  1. **Time zone storage/validation:** preferred time zone is stored as an IANA identifier string. Validation uses `Intl.supportedValuesOf('timeZone')` (available in Node 24) and rejects unknown values. Default for existing users is `UTC`.
  2. **Locale storage/validation:** optional BCP 47 locale string validated with `Intl.getCanonicalLocales`. Stored only as metadata; no localization framework is introduced in this feature.
  3. **Avatar metadata:** stored as an optional `avatarUrl` string (http/https URL, max 500 chars). Binary upload and object storage are deferred to Feature 21; this feature stores metadata only and does not proxy or fetch remote images.
  4. **Email change policy (adopted):** changing the login/contact email requires verification before it takes effect. A pending email is stored on the user; a verification link is sent to the new address; on successful verification the email is swapped, `emailVerifiedAt` is set, and `pendingEmail` is cleared. All sessions are revoked on completion.
  5. **Password-change session policy:** changing the password revokes **all** active sessions for the user (including the one used for the request). The client must re-authenticate. This mirrors the password-reset policy in Feature 5.
  6. **Email-change session policy:** completing an email change revokes all active sessions for the user.
  7. **Deactivation/deletion request:** sets a timestamp flag and revokes all sessions. Login is rejected for flagged accounts. Full data cleanup is deferred to Feature 40.
  8. **Session list exposure:** session records expose only `id`, `createdAt`, `expiresAt`, `revokedAt`, `userAgent`, `ipAddress`, and a `current` boolean. Refresh-token hashes and previous-token hashes are never exposed. The list is cursor-paginated (20 per page, max 50) so the UI never renders an unbounded list.
  9. **Profile endpoint placement:** profile operations live under `/api/v1/users/me/*` (new router) while the existing `/api/v1/me` and `/api/v1/auth/*` endpoints remain unchanged for compatibility.

## Goal

Allow an authenticated user to view and update their own profile and account preferences, change their password safely, request an email change with verification, inspect and revoke their active sessions, and request account deactivation/deletion — without exposing or mutating any other user's data or any workspace/project authorization state.

## Non-goals

- Workspace profile/settings, workspace membership, roles, invitations.
- Public user profiles or profile discovery by other users.
- Permanent account deletion workflow and workspace data cleanup (Feature 40).
- Avatar file upload/binary storage (Feature 21).
- Real-time delivery of profile/session changes (not required; no Socket.IO in this feature).
- Localization/i18n framework, theming engine beyond storing a preference string.
- Admin views of other users' profiles.

## User flows

1. **View profile:** authenticated user opens profile page; client calls `GET /users/me/profile`; server returns only the current user's profile fields plus `/me` data.
2. **Update profile:** user edits display name, time zone, locale, avatar URL; client calls `PATCH /users/me/profile`; server validates, persists, returns updated profile.
3. **Change password:** user submits current + new password; server verifies current password, updates hash, revokes all sessions; client clears auth and redirects to login.
4. **Request email change:** user submits new email; server validates format, checks uniqueness (email + pendingEmail), stores `pendingEmail`, creates a single-use expiring token, sends verification link to the new address.
5. **Verify email change:** user opens link; client calls `POST /users/me/email-change/verify` with token; server validates, swaps email, sets `emailVerifiedAt`, clears pending email, revokes sessions.
6. **Resend account verification:** reuse existing `POST /auth/resend-verification`.
7. **Manage sessions:** user views `GET /users/me/sessions`; revokes a session via `DELETE /users/me/sessions/:sessionId`.
8. **Account deactivation/deletion request:** user requests deactivation or deletion; server sets flag, revokes sessions; login is blocked for flagged accounts. Full cleanup deferred.

## Acceptance criteria

- A user can view and update permitted profile fields (display name, time zone, locale, avatar URL).
- Invalid time zones, email formats, locales, and overlong fields are rejected server-side.
- A user cannot change another user's profile by changing an ID (no ID in path for self endpoints; resource scoping by `req.auth.userId`).
- Password change requires the correct current password and revokes sessions per policy.
- Email change requires verification before the new address becomes the login email.
- Profile endpoints expose only fields needed by the current user (no password hash, token hashes, internal flags beyond documented status).
- Session list exposes only safe session metadata and marks the current session.
- Deactivated/deletion-requested accounts cannot log in.

## Assumptions

- Node 24 provides `Intl.supportedValuesOf('timeZone')` and `Intl.getCanonicalLocales`; no new dependency is needed.
- `avatarUrl` is metadata only; no remote fetch/validation beyond URL shape.
- Account status is derived from `deactivatedAt` / `deletionRequestedAt` timestamps rather than an enum, to minimize migration complexity.
- Email change verification reuses a dedicated `EmailChangeToken` model rather than overloading `EmailVerificationToken`, so the two flows cannot be confused.
- Deactivation/deletion request endpoints are implemented in this feature (flags + session revocation); actual data deletion/export remains Feature 40.
- `locale` and `avatarUrl` are optional and nullable.

## Unresolved questions

- Whether the frontend should offer a time-zone picker with search or a simple validated text input. (Non-blocking; recommend a searchable select backed by `Intl.supportedValuesOf`.)
- Whether deactivation should be reversible by the user without support. (Non-blocking; recommend reversible via a future "reactivate" endpoint in Feature 40 or admin tooling.)
- Whether email change should revoke only other sessions instead of all. (Blocking for UX; default chosen: revoke all, require re-login, consistent with password reset.)

## API endpoints under `/api/v1`

All profile endpoints require `requireAuth`. All use the shared `{ data }` / `{ error }` envelope.

### `GET /users/me/profile`

- Auth: Bearer access token + active session.
- Response `200`:
  ```json
  {
    "data": {
      "profile": {
        "id": "string",
        "email": "string",
        "displayName": "string",
        "timeZone": "string",
        "locale": "string | null",
        "avatarUrl": "string | null",
        "pendingEmail": "string | null",
        "emailVerifiedAt": "string | null",
        "deactivatedAt": "string | null",
        "deletionRequestedAt": "string | null",
        "createdAt": "string",
        "updatedAt": "string"
      }
    }
  }
  ```
- Errors: `401 UNAUTHENTICATED`.

### `PATCH /users/me/profile`

- Body (all optional, at least one required):
  ```json
  {
    "displayName": "string (1-80)",
    "timeZone": "string (IANA)",
    "locale": "string | null",
    "avatarUrl": "string (http/https URL) | null"
  }
  ```
- Response `200`: `{ data: { profile } }`.
- Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`.

### `POST /users/me/email-change`

- Body: `{ "email": "string (valid email)" }`.
- Behavior: validates format; rejects if email equals current email; rejects if email already used by another user or already pending for another user; stores `pendingEmail`; invalidates prior pending email-change tokens for the user; creates a new single-use expiring token; sends verification link to the new address.
- Response `200`: `{ data: { message: "If the address is available, a verification link has been sent." } }` (generic to reduce enumeration).
- Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `409 EMAIL_ALREADY_EXISTS` (when the address is already a primary email of another account — acceptable to reveal for an authenticated self-service flow).

### `POST /users/me/email-change/verify`

- Body: `{ "token": "string (32-256)" }`.
- Behavior: validates token; on success swaps `email`, sets `emailVerifiedAt`, clears `pendingEmail`, marks token used, revokes all sessions.
- Response `200`: `{ data: { message: "Email address updated." } }`.
- Errors: `400 INVALID_EMAIL_CHANGE_TOKEN`, `401 UNAUTHENTICATED`.

### `POST /users/me/password`

- Body: `{ "currentPassword": "string (1-128)", "newPassword": "string (12-128)" }`.
- Behavior: verifies current password; rejects if new password equals current (recommended, documented as a refinement); updates hash; revokes all sessions.
- Response `200`: `{ data: { message: "Password changed. Please sign in again." } }`.
- Errors: `400 VALIDATION_ERROR` / `INVALID_CURRENT_PASSWORD`, `401 UNAUTHENTICATED`.

### `GET /users/me/sessions`

- Query: `cursor` (optional opaque session id from `nextCursor`), `limit` (optional integer 1–50, default 20).
- Response `200`:
  ```json
  {
    "data": {
      "sessions": [
        {
          "id": "string",
          "createdAt": "string",
          "expiresAt": "string",
          "revokedAt": "string | null",
          "userAgent": "string | null",
          "ipAddress": "string | null",
          "current": "boolean"
        }
      ],
      "nextCursor": "string | null"
    }
  }
  ```
- Sessions ordered by `createdAt` desc then `id` desc for a stable cursor. Include active + recently revoked within 30 days. Each page is bounded by `limit`; `nextCursor` is non-null only when another page exists. A cursor not owned by the current user is rejected.
- Errors: `400 VALIDATION_ERROR` / `INVALID_CURSOR`, `401 UNAUTHENTICATED`.

### `DELETE /users/me/sessions/:sessionId`

- Params: `sessionId` string (cuid).
- Behavior: revokes the session if it belongs to the current user; no-op if already revoked; cannot revoke another user's session.
- Response `204`.
- Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `404 SESSION_NOT_FOUND`.

### `POST /users/me/deactivate`

- Body: none.
- Behavior: sets `deactivatedAt = now` if not already; revokes all sessions.
- Response `200`: `{ data: { message: "Account deactivated." } }`.
- Errors: `401 UNAUTHENTICATED`, `409 ACCOUNT_ALREADY_DEACTIVATED`.

### `POST /users/me/delete-request`

- Body: `{ "confirmation": "DELETE" }` (literal confirmation to prevent accidental requests).
- Behavior: sets `deletionRequestedAt = now` if not already; revokes all sessions. Full cleanup deferred to Feature 40.
- Response `200`: `{ data: { message: "Deletion request recorded. Contact support to complete account closure." } }`.
- Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `409 DELETION_ALREADY_REQUESTED`.

### `POST /auth/resend-verification`

- Reused from Feature 5 (already implemented). Profile UI calls it for unverified accounts.

### Pagination

- Session list uses bounded cursor pagination (`limit` default 20, max 50) rather than an unbounded `findMany`. Cursor ownership is checked against `req.auth.userId`.

## Zod params/query/body and environment changes

### New schemas (`apps/api/src/schemas/profile.schemas.ts`)

- `profileUpdateSchema`: object with optional `displayName`, `timeZone`, `locale`, `avatarUrl`; refine to require at least one field; `locale`/`avatarUrl` accept `null` to clear.
- `emailChangeRequestSchema`: `{ email }`.
- `emailChangeVerifySchema`: `{ token }` (min 32, max 256).
- `changePasswordSchema`: `{ currentPassword, newPassword }`; refine `newPassword !== currentPassword`.
- `deleteRequestSchema`: `{ confirmation }` refine equals `"DELETE"`.
- `sessionIdParamSchema`: `{ sessionId: cuid }` (or min 1 max 64).
- `sessionListQuerySchema`: `{ cursor?: string (1-64), limit: number int 1-50 default 20 }`.

### Validation helpers

- `ianaTimeZoneSchema`: `z.string().refine((v) => Intl.supportedValuesOf('timeZone').includes(v), 'Invalid time zone')`.
- `localeSchema`: `z.string().nullable().refine((v) => v === null || isValidLocale(v))`.
- `avatarUrlSchema`: `z.string().url().max(500).refine((v) => /^https?:\/\//.test(v))` or null.

### Environment changes

- None required. Reuse existing `APP_PUBLIC_URL` for email-change verification links and existing mailer. (Optional: add `EMAIL_CHANGE_TOKEN_TTL_HOURS` with default 24; if added, validate in `env.ts`. Proposed default 24h, min 1, max 168. Label as an env addition requiring approval at implementation time.)

## Authentication middleware, resource authorization, trusted fields

- All `/users/me/*` routes use `requireAuth`.
- No resource ID is accepted from the client for self endpoints; the actor is always `req.auth.userId`. `sessionId` param is validated and ownership-checked in service.
- Trusted server-derived fields: `userId`, `sessionId` (current), `createdAt`, `updatedAt`, `emailVerifiedAt`, `deactivatedAt`, `deletionRequestedAt`, IP/user-agent from request (already in auth flow).
- `requireVerifiedOrigin` is applied to cookie-authenticated mutation endpoints that rely on the refresh cookie? Profile mutations use Bearer access token, so CSRF origin check is not required; however, to be safe, apply `requireVerifiedOrigin` to password-change and deactivation endpoints? They use Bearer token, not cookie, so no CSRF. Decision: not required. Document.
- Deactivated/deletion-requested users: `loginUser` rejects login if flags set; `authenticateAccessToken` rejects via revoked sessions. Additionally, `getProfile`/mutations should reject with `403 ACCOUNT_DEACTIVATED` if flags set (defense in depth).

## Prisma models, relations, constraints, indexes, migration/deletion semantics

### `User` additions

```prisma
model User {
  id                    String    @id @default(cuid())
  email                 String    @unique
  passwordHash          String    @map("password_hash")
  displayName           String    @map("display_name")
  timeZone              String    @default("UTC") @map("time_zone") @db.VarChar(64)
  locale                String?   @map("locale") @db.VarChar(35)
  avatarUrl             String?   @map("avatar_url") @db.VarChar(500)
  pendingEmail          String?   @unique @map("pending_email") @db.VarChar(254)
  emailVerifiedAt       DateTime? @map("email_verified_at")
  deactivatedAt         DateTime? @map("deactivated_at")
  deletionRequestedAt   DateTime? @map("deletion_requested_at")
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  sessions                Session[]
  passwordResetTokens     PasswordResetToken[]
  emailVerificationTokens EmailVerificationToken[]
  emailChangeTokens       EmailChangeToken[]

  @@map("users")
}
```

- `pendingEmail` unique (nullable) prevents two accounts from pending the same address and one pending per user (already one per user by row).
- `timeZone` default `UTC` backfills existing rows.

### New model `EmailChangeToken`

```prisma
model EmailChangeToken {
  id        String    @id @default(cuid())
  userId    String    @map("user_id")
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  newEmail  String    @map("new_email") @db.VarChar(254)
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")

  @@index([userId])
  @@map("email_change_tokens")
}
```

### Migration

- Create a new Prisma migration (do not edit existing). Backfill `time_zone = 'UTC'` for existing users (default handles new; migration default applies to existing? Prisma sets default in DB; existing rows receive default on column add with default). 
- Add unique index on `pending_email` (nullable unique supported by MySQL/Prisma).
- `EmailChangeToken` table with FK cascade.

### Deletion/retention semantics

- User deletion is not implemented here. Flags only. If a user with flags exists, login blocked. Feature 40 handles cleanup.
- `Session` cascade on user delete remains as defined in Feature 5.
- `EmailChangeToken` cascade on user delete.

## Query shape, selected fields, pagination, transaction/concurrency

- All queries use explicit `select` for profile fields; never return `passwordHash` or token hashes.
- `getProfile`: `prisma.user.findUnique({ where: { id }, select: {...} })`.
- `updateProfile`: `prisma.user.update({ where: { id }, data: { ...mapped }, select: {...} })`.
- Email change request: transaction to invalidate prior unused tokens (`updateMany usedAt = now`) + create new token; then send email after commit (mailer non-blocking, logged on failure).
- Email change verify: transaction to validate token (read first), then update user email/pendingEmail/emailVerifiedAt, mark token used, revoke sessions. Re-check token `usedAt`/expiry inside transaction to handle races.
- Password change: transaction update password + revoke sessions.
- Deactivation/deletion request: transaction set flag + revoke sessions.
- Session list: validate `cursor`/`limit`; if a cursor is present, confirm it belongs to `userId`; `prisma.session.findMany({ where: { userId, AND: [recentSessions, keysetCondition] }, select: safeFields, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1 })`; derive `nextCursor` from the extra row.
- Session revoke: `updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: now } })`; if count 0 and session exists but already revoked → success (idempotent); if not owned → 404.
- Concurrency: token verification uses unique `tokenHash`; `updateMany` with guards; race results in `INVALID_EMAIL_CHANGE_TOKEN`.

## Service decision

- Add `profile.service.ts` (`apps/api/src/services/profile.service.ts`) for profile read/update, email change request/verify, password change, session list/revoke, deactivation, deletion request. Justification: multi-step, transactional, reused by controller; keeps controller thin.
- Reuse `auth.service.ts` helpers (`toPublicUser`? extend or duplicate minimal). Decision: extend `PublicUser` in `auth.service.ts` with profile fields? Better define `ProfileUser` in `profile.service.ts` and a `toProfileUser` mapper. `/me` can remain minimal `PublicUser`; optionally enrich `/me` to include profile fields. Decision: extend `PublicUser` with `timeZone`, `locale`, `avatarUrl`, `pendingEmail`, `deactivatedAt`, `deletionRequestedAt` so frontend auth context has them without a second call. This changes `/me` response shape (additive, non-breaking).

## Repository/query-helper decision

- No separate repository. Prisma calls are straightforward and localized in `profile.service.ts`. Add a small private helper for session-safe select. Revisit if query complexity grows (Feature 39 audit).

## React routes/pages/components

- New page: `apps/web/src/pages/profile-page.tsx` (protected route `/app/profile`).
- Add route in `routes.tsx`: `{ path: 'profile', element: <ProfilePage /> }` under `/app`.
- App shell: add "Profile" nav item or account dropdown link to `/app/profile`. Recommend dropdown item "Profile & security" plus maybe settings later.
- Components:
  - Profile form (display name, time zone select, locale input, avatar URL input).
  - Password change form.
  - Email change form + pending email status + resend verification.
  - Sessions list with revoke action and Previous/Next cursor pagination (20 per page).
  - Danger zone (deactivate, request deletion) with confirmation dialog.
- API client: add functions in a new `apps/web/src/features/profile/profile-api.ts` or extend api-client usage. Use TanStack Query keys `['profile']`, `['sessions', cursor]`.
- Server-state: `useQuery` for profile/sessions; `useMutation` for updates with invalidation; toast feedback via sonner.
- Shared types: extend `PublicUser` in `apps/web/src/types/auth.ts` with profile fields; add `SessionSummary` and `SessionListResponse` types.
- Forms: client-side validation mirrors Zod (optional); server errors displayed per field where possible.
- Loading/empty/error/accessibility: skeleton loading, empty sessions state, error retry, focus management in dialogs, keyboard-accessible controls.

## Socket.IO / S3 / BullMQ

- Not needed for this feature. No realtime events, no file storage, no background jobs. Profile updates take effect on next request; sessions revoked immediately in DB. If later features need profile-change events, they can be added then.

## Test matrix

Backend (Vitest + Supertest, real MySQL test DB):
- Profile read returns safe fields; no `passwordHash`/token hashes.
- Profile update happy path (display name, timeZone, locale, avatarUrl).
- Partial update and clearing nullable fields (`locale: null`, `avatarUrl: null`).
- Validation: invalid time zone, invalid locale, invalid avatar URL, overlong display name, empty body.
- Cross-user denial: no ID in path; attempts to pass `userId` in body ignored; accessing another user's session revoke returns 404.
- Password change: success, wrong current password, too-short new password, same password rejection, sessions revoked after.
- Email change request: success generic response, duplicate pending, already-used email, invalid format.
- Email change verify: success swaps email + verified + clears pending + revokes sessions; invalid/expired/used token; race handling.
- Sessions list: only own sessions, safe fields, current flag, cursor pages (default 20, max 50), no overlap across pages, invalid/foreign cursor rejected.
- Session revoke: own session, already revoked idempotent, other user's session → 404.
- Deactivation: sets flag, revokes sessions, login blocked.
- Deletion request: requires `DELETE` confirmation, sets flag, revokes sessions, login blocked.
- Deactivated/deletion-requested login rejection.
- `/me` additive fields present and backward compatible.

Frontend (Vitest + Testing Library where configured):
- Profile page renders loading/empty/error states.
- Form validation feedback.
- Password change form submission and error display.
- Session revoke interaction.

E2E (Playwright, if binaries available): not required for this feature; manual verification acceptable.

## Security/performance risks

- **Mass assignment:** PATCH must map only allowed fields; ignore unknown keys (Zod strict).
- **ID tampering:** self endpoints derive actor from `req.auth`; no `userId` param.
- **Time zone validation:** avoid accepting arbitrary strings; use allowlist.
- **Locale validation:** use `Intl.getCanonicalLocales` carefully (catch throws).
- **Avatar URL:** store only; do not fetch or render without sanitization on frontend (use `rel="noopener"` / sanitize).
- **Email enumeration:** email-change request returns generic message; but 409 on already-used primary email is acceptable for authenticated self-service. Document tradeoff.
- **Session data exposure:** never expose token hashes; cap list.
- **Revocation timing:** sessions revoked in DB; access tokens remain valid until expiry but session check fails. Acceptable (matches Feature 5).
- **Concurrency:** token race handled; password change concurrent requests: both verify against same hash; one succeeds, other may fail with invalid current password. Acceptable.
- **Performance:** session list bounded by cursor pagination with a composite `(userId, createdAt)` index; profile queries single-row with select; no N+1.

## Rollout/compatibility notes

- Additive migration: new nullable/defaulted columns and new table. No breaking changes to existing auth endpoints.
- `/me` response gains optional profile fields; frontend updated in same change.
- Existing users backfilled with `timeZone = 'UTC'`, null locale/avatar.
- No new required env vars (optional `EMAIL_CHANGE_TOKEN_TTL_HOURS` if adopted).
- No infrastructure changes (no Redis/S3/Socket.IO).

## Implementation sequence

1. Prisma schema: add User columns + `EmailChangeToken` model; create migration; verify `db:status`/`db:status:test`.
2. Zod schemas in `apps/api/src/schemas/profile.schemas.ts`; optional env addition.
3. Mailer: add `sendEmailChangeEmail` method to interface and console/smtp/disabled implementations.
4. Service: `apps/api/src/services/profile.service.ts`; extend `PublicUser` in auth service (or add `ProfileUser`).
5. Controller + route: `apps/api/src/controllers/profile.controller.ts`, `apps/api/src/routes/users.routes.ts`; mount in `routes/index.ts`.
6. Update `loginUser` to reject deactivated/deletion-requested accounts.
7. Frontend: types, API helpers, profile page, route, app shell link, mutations.
8. Tests: backend integration + frontend component tests.
9. Run lint, typecheck, format:check, build, test; report exact outcomes.

## Actual verification commands found in repository

- `pnpm lint`
- `pnpm typecheck`
- `pnpm format:check`
- `pnpm build`
- `pnpm test` (API + web)
- `pnpm db:status` / `pnpm db:status:test`
- `pnpm test:e2e` (requires Playwright browsers; may be unavailable locally)

Present the spec path and concise key decisions, then STOP. Implementation requires explicit user approval in a later `/develop` request.