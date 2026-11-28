# Feature 07 — Workspace creation, onboarding, and switching

Spec status: Draft for review. No application code, migration, or package change is produced by this spec.

## Overview alignment

- Feature number/title: Feature 7 — Workspace creation, onboarding, and switching.
- Dependencies: Feature 5 (Authentication and account lifecycle), Feature 6 (User profile and account preferences), Feature 3 (MySQL and Prisma database foundation).
  - Dependency status: **met**.
  - Evidence: `memory.md` marks Feature 5 implemented and verified (`b343650`, `d25e701`, `d0bba48`); Feature 6 implemented, verified, and committed (`a923058`); Feature 3 implemented database foundation. Auth middleware at `apps/api/src/middleware/auth.ts`; Prisma schema at `apps/api/prisma/schema.prisma`; routes under `apps/api/src/routes/`; frontend routes at `apps/web/src/app/routes.tsx`. `git status --short` is clean.
- In scope honored: create a workspace with validated name and unique slug/identifier; atomically create the creator's initial owner membership; onboarding flow for the first workspace; workspace switcher for users with multiple memberships; list only active workspaces belonging to the authenticated user; persist last selected workspace as safe client navigation state; empty state when the user has no workspace membership.
- Out of scope honored: invitations, advanced member administration, project creation, workspace billing, workspace deletion, workspace settings beyond identity (deferred to Features 8–10 and 40), Socket.IO rooms (deferred to Feature 25), project membership/visibility (deferred to Feature 11).
- Overview acceptance criteria mapped to the test matrix below.
- Documented refinements of overview rules:
  1. **Slug ownership/normalization:** the client may suggest a slug, but the server normalizes it (lowercase, trimmed, whitespace/underscore runs converted to single hyphens, invalid characters removed) and enforces global uniqueness. A user cannot claim an existing workspace by submitting its slug or ID; a duplicate normalized slug returns `409 WORKSPACE_SLUG_TAKEN`.
  2. **Owner membership creation:** performed in the same Prisma `$transaction` as workspace creation. A failure in membership creation rolls back the workspace row.
  3. **Active workspace selection is navigation only:** the selected workspace ID/slug is stored in browser navigation state (localStorage) and is never an authorization credential. Every request re-verifies membership server-side.
  4. **Workspace visibility on non-membership:** a workspace the user cannot access is indistinguishable from a nonexistent one; endpoints return `404 WORKSPACE_NOT_FOUND` rather than `403`, to avoid enumeration.
  5. **Slug availability check:** an optional read-only endpoint reports whether a normalized slug is available. It exposes only a boolean and never workspace data.

## Goal

Let an authenticated user create a workspace, become its initial owner, move between the workspaces they are authorized to access, and see a useful empty state when they have no workspace membership.

## Non-goals

- Invitations, role changes, member administration, and the permission matrix (Feature 8).
- Workspace settings, slug changes after creation, logo uploads, and member directory (Feature 9).
- Projects, tasks, boards, and project membership (Features 10–11).
- Workspace deletion/data export (Feature 40).
- Real-time delivery or socket rooms (Feature 25).
- Server-side persistence of the last selected workspace as a user column; this feature uses safe client navigation state (see Assumptions).

## User flows

1. **First workspace (onboarding):** An authenticated user with zero active memberships opens the app and sees an onboarding empty state with a "Create workspace" action. They submit a name (and optional slug). The server creates the workspace and owner membership atomically and returns the workspace. The client stores the new workspace ID as the selected navigation state and redirects to the app shell.
2. **Create additional workspace:** An authenticated user with one or more memberships opens "Create workspace" (link in the switcher), submits the form, and is switched to the new workspace on success.
3. **Switch workspace:** The user opens the workspace switcher in the app shell, sees their active memberships with workspace name/slug/role, and selects one. The client updates the stored selected workspace ID and refreshes workspace-scoped queries; no authorization is granted by the selection itself.
4. **No membership:** If all memberships are removed/suspended, the user sees the onboarding empty state again; stale stored selection is cleared.

## Acceptance criteria

- An authenticated user can create a workspace and becomes its initial owner.
- A failed membership creation rolls back the workspace creation.
- Users can switch only among their active memberships.
- Guessing another workspace ID or slug does not reveal workspace data.
- The UI handles users with zero, one, or multiple workspaces.
- Duplicate slugs are rejected with `409 WORKSPACE_SLUG_TAKEN`.
- Invalid names/slugs are rejected server-side with field-specific errors.
- Workspace lists are bounded (max 50 per request) and scoped to the authenticated user's active memberships.

## Assumptions

- **A1 (non-blocking):** The last selected workspace is stored in browser navigation state (`localStorage`), not as a `User` column. This keeps authorization derived solely from `WorkspaceMembership` and avoids a cross-tenant preference column. If cross-device persistence is later required, a `User.lastSelectedWorkspaceId` column can be added without changing the authorization model.
- **A2 (non-blocking):** Workspace slug is globally unique (not per-workspace) to support URL-style routing (`/w/:slug`) in later features. If per-workspace uniqueness is preferred, the unique constraint changes to `(ownerId, slug)`; this spec assumes global.
- **A3 (non-blocking):** Slug format: 3–48 characters, lowercase letters/numbers/hyphens, starting and ending with an alphanumeric character, no consecutive hyphens. Reserved slugs (`api`, `app`, `admin`, `auth`, `www`, `mail`, `support`, `help`, `static`, `assets`) are rejected. These limits are an engineering choice not specified by the overview and may be adjusted before implementation.
- **A4 (non-blocking):** Workspace name: 1–80 characters after trim. Display name is stored as submitted (trimmed); no uniqueness requirement on name.
- **A5 (non-blocking):** List pagination uses offset (`page`/`limit`) with default 20 and max 50, sorted by `createdAt` desc then `id` desc. Cursor pagination is not required for this bounded, small-cardinality list.
- **A6 (non-blocking):** Workspace has no `createdBy` column beyond the owner membership; the initial owner membership identifies the creator. Audit-grade creator tracking is deferred to Feature 39.
- **A7 (non-blocking):** No update endpoints are included in this feature; workspace identity edits are deferred to Feature 9.

## Unresolved questions

None blocking. The slug uniqueness scope (global vs. per-owner) and the storage location of the selected workspace (client vs. server column) are labeled assumptions above and can be changed before implementation without affecting authorization.

## API endpoints (`/api/v1`)

All endpoints require `requireAuth` unless noted. Responses use the established `{ data }` / `{ error: { code, message, requestId, details? } }` envelopes. Status codes: 200 OK, 201 Created, 400/422 validation, 401 unauthenticated, 404 not found (also used for non-member workspaces), 409 conflict, 429 rate limited.

### `POST /workspaces`

Create a workspace and the creator's owner membership atomically.

- Auth: required.
- Rate limit: global `/api/v1` limiter (no stricter limit needed; creation is low-volume).
- Request body (Zod `createWorkspaceSchema`):
  - `name`: string, trim, min 1, max 80.
  - `slug`: string, optional. If omitted, derived from `name`. If provided, normalized and validated against the slug format.
- Trusted server-derived fields: `id`, `slug` (when derived), `createdAt`, `updatedAt`, membership `role = OWNER`, `status = ACTIVE`, `userId` from the verified session.
- Response 201: `{ data: { workspace: WorkspaceSummary } }`.
- Errors: 401 `UNAUTHENTICATED`; 422 `VALIDATION_ERROR` (field-specific); 409 `WORKSPACE_SLUG_TAKEN` if the normalized slug already exists.

### `GET /workspaces`

List active workspaces for the authenticated user.

- Auth: required.
- Query (Zod `workspaceListQuerySchema`):
  - `page`: coerced int, min 1, default 1.
  - `limit`: coerced int, min 1, max 50, default 20.
- Query scope: `WorkspaceMembership` rows where `userId = req.auth.userId` and `status = ACTIVE`, including the related `Workspace`.
- Response 200: `{ data: { items: WorkspaceListItem[], page, limit, total } }`.
  - `WorkspaceListItem`: `{ workspace: WorkspaceSummary, membership: { id, role, status, createdAt } }`.
- Errors: 401 `UNAUTHENTICATED`; 422 `VALIDATION_ERROR`.

### `GET /workspaces/:workspaceId`

Get a single workspace the user is an active member of.

- Auth: required.
- Params (Zod `workspaceIdParamSchema`): `workspaceId` string, min 1, max 64.
- Scope: verify an `ACTIVE` membership for `(workspaceId, req.auth.userId)`; otherwise 404.
- Response 200: `{ data: { workspace: WorkspaceSummary, membership: { id, role, status } } }`.
- Errors: 401 `UNAUTHENTICATED`; 404 `WORKSPACE_NOT_FOUND`; 422 `VALIDATION_ERROR`.

### `GET /workspaces/slug-availability`

Check whether a normalized slug is available.

- Auth: required.
- Query (Zod `slugAvailabilityQuerySchema`): `slug` string, min 1, max 80 (pre-normalization input).
- Response 200: `{ data: { slug: string (normalized), available: boolean } }`.
- Errors: 401 `UNAUTHENTICATED`; 422 `VALIDATION_ERROR` (invalid slug format after normalization).

## Zod schemas

New file `apps/api/src/schemas/workspace.schemas.ts`:

- `slugSchema`: string, trim, transform to normalized slug, refine format (3–48 chars, `^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$`, no `--`), refine not reserved.
- `createWorkspaceSchema`: object `{ name: z.string().trim().min(1).max(80), slug: slugSchema.optional() }`.
- `workspaceIdParamSchema`: object `{ workspaceId: z.string().min(1).max(64) }`.
- `workspaceListQuerySchema`: object `{ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) }`.
- `slugAvailabilityQuerySchema`: object `{ slug: z.string().min(1).max(80) }`.

Env changes: none.

## Authentication and authorization

- All endpoints use `requireAuth`, which resolves `req.auth.userId` and `req.auth.sessionId` from the verified access token and checks the session record (revocation-aware).
- Resource authorization: every workspace read verifies an `ACTIVE` `WorkspaceMembership` for `(workspaceId, userId)`. There is no role gate beyond active membership in this feature; role-based administration is deferred to Feature 8.
- Trusted server-derived fields: `userId` from `req.auth.userId`; membership `role`/`status` set server-side; workspace `id`/`slug`/timestamps generated server-side. The client never submits `userId`, `workspaceId` as an owner, `role`, or `status`.
- Mass-assignment protection: controllers map only `name` and optional `slug` into the service; Prisma `create` receives an explicit data object.

## Prisma models, relations, constraints, indexes

Add to `apps/api/prisma/schema.prisma`:

```prisma
enum WorkspaceRole {
  OWNER
  ADMIN
  MEMBER
  GUEST

  @@map("workspace_role")
}

enum WorkspaceMembershipStatus {
  ACTIVE
  INVITED
  SUSPENDED
  REMOVED

  @@map("workspace_membership_status")
}

model Workspace {
  id          String   @id @default(cuid())
  name        String   @db.VarChar(80)
  slug        String   @unique @db.VarChar(48)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  memberships WorkspaceMembership[]

  @@map("workspaces")
}

model WorkspaceMembership {
  id          String                   @id @default(cuid())
  workspaceId String                   @map("workspace_id")
  userId      String                   @map("user_id")
  role        WorkspaceRole            @default(MEMBER)
  status      WorkspaceMembershipStatus @default(ACTIVE)
  createdAt   DateTime                 @default(now()) @map("created_at")
  updatedAt   DateTime                 @updatedAt @map("updated_at")

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, userId])
  @@index([userId, status])
  @@index([workspaceId, status])
  @@map("workspace_memberships")
}
```

- `User` gains `workspaceMemberships WorkspaceMembership[]`.
- Migration: a single new migration `..._workspace_creation/` adding the two tables, enums, FKs, unique constraint, and indexes. No data backfill. Review generated SQL for FK `ON DELETE CASCADE` and index names.
- Deletion/retention: workspace deletion is out of scope (Feature 40). Membership removal (Feature 8) will set `status = REMOVED` rather than hard-delete, to preserve history; this feature only creates `ACTIVE` rows. Cascade on workspace/user deletion is a safety net for future features and must not be exercised by normal F7 flows.
- Concurrency: `slug @unique` is the concurrency guard for duplicate creation; the service catches Prisma `P2002` on `slug` and returns `WORKSPACE_SLUG_TAKEN`.

## Query shape, selected fields, pagination, transaction/concurrency concerns, scale risks

- Creation uses `$transaction` with explicit selects: create `Workspace` with `{ name, slug }`, then create `WorkspaceMembership` with `{ workspaceId, userId, role: OWNER, status: ACTIVE }`. No nested writes beyond the two rows.
- List query: `findMany` on `WorkspaceMembership` with `where: { userId, status: ACTIVE }`, `include: { workspace: { select: { id, name, slug, createdAt, updatedAt } } }`, `orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]`, `skip`/`take` for offset pagination. Also a separate `count` for `total` (or use `findMany` + count in the same transaction). Cap `take` at 50.
- Single get: `findFirst` on `WorkspaceMembership` with `where: { workspaceId, userId, status: ACTIVE }` and `include` of workspace; if none, throw `WORKSPACE_NOT_FOUND`.
- Slug availability: `findUnique` on `Workspace` by slug; returns boolean. No membership requirement beyond auth (slug is a public-ish identifier).
- Scale risks: none significant at portfolio scale. `userId, status` and `workspaceId, status` indexes support the list and membership checks. Avoid N+1 by including workspace in the membership query.

## Service/repository decision

- **Service:** Add `apps/api/src/services/workspace.service.ts` for creation (slug normalization/derivation, uniqueness handling, transactional owner membership), listing, single-get, and slug availability. Justified: multi-step transactional write and reused query logic.
- **Repository:** Not needed. Prisma access is simple and single-use; a repository would add ceremony without a demonstrated benefit (per `AGENTS.md` decision tree). Revisit only if query complexity grows (e.g., search in Feature 31).

## React routes/pages/components, API client, server-state/cache behavior, forms, shared types, loading/empty/error/accessibility states

- New API client module `apps/web/src/features/workspaces/workspace-api.ts` with typed functions: `createWorkspace`, `listWorkspaces`, `getWorkspace`, `checkSlugAvailability`.
- Types in `apps/web/src/types/workspace.ts`: `WorkspaceSummary`, `WorkspaceListItem`, `WorkspaceListResponse`, `CreateWorkspaceInput`.
- Routes:
  - Add `apps/web/src/pages/workspace-create-page.tsx` rendered at `/app/workspaces/new` (protected, inside `AppShell`).
  - Onboarding empty state rendered by `DashboardPage` (or a dedicated `/app` index) when `listWorkspaces` returns zero items: heading, explanation, and "Create workspace" button linking to `/app/workspaces/new`.
- App shell (`app-shell.tsx`): add a `WorkspaceSwitcher` component (dropdown) listing active memberships with workspace name + slug + role badge, the currently selected workspace highlighted, a "Create workspace" link, and a loading/empty state. Selection stored in `localStorage` under `taskforge:selectedWorkspaceId`; validate against the list on load and clear if stale.
- Server state: TanStack Query keys `['workspaces']` and `['workspace', id]`. Invalidate `['workspaces']` after successful creation. Do not mirror the list in component state beyond the selected ID.
- Forms: `react-hook-form`? Use existing pattern (if any) or controlled inputs with Zod client validation. Display server field errors. Disable submit while pending; prevent double submission.
- Loading/empty/error: skeleton for list; empty state copy; error toast/banner with retry; 404 handling clears stale selection.
- Accessibility: switcher is a Radix Dropdown Menu (or native select) with keyboard support, visible focus, `aria-label`, and screen-reader-friendly option labels. Create form has labels, field errors, and `aria-invalid`.

## Socket.IO events/auth/rooms/after-commit behavior

Not applicable. Feature 7 introduces no real-time events. Socket.IO foundation is deferred to Feature 25. No rooms, events, or after-commit broadcasts are added.

## S3 / BullMQ / Redis

Not applicable. No file storage or background jobs in this feature.

## Test matrix

Backend (Vitest + Supertest, real MariaDB test DB):
- **Success:** authenticated user creates workspace; owner membership created in same transaction; response is 201 with `WorkspaceSummary`; slug derived from name when omitted.
- **Validation:** missing/empty/overlong name (422, field-specific); invalid slug format (422); reserved slug (422); slug too short/long.
- **Conflict:** duplicate normalized slug (409 `WORKSPACE_SLUG_TAKEN`), including race-safety via unique constraint.
- **Auth:** unauthenticated create/list/get/slug-availability (401).
- **Scoping:** list returns only the caller's active memberships; suspended/removed memberships excluded; another user's workspaces not listed.
- **Non-member access:** get by guessed ID returns 404 `WORKSPACE_NOT_FOUND` (not 403); cross-user isolation.
- **Pagination:** `page`/`limit` bounds (max 50, min 1); invalid values 422; total count correct.
- **Slug availability:** available vs. taken; invalid input 422.
- **Transactional integrity:** simulated membership-creation failure rolls back the workspace row (unit/service-level test with a thrown error inside the transaction, or integration test asserting absence after failure).

Frontend (Vitest + Testing Library):
- Create form validation and server error display.
- Successful creation redirects and updates switcher.
- Switcher renders zero/one/many memberships and persists selection.
- Empty state renders when no memberships.
- Stale selection cleared on 404.

Critical E2E (Playwright, optional/blocked): not required for this feature; manual verification of onboarding + switcher acceptable.

## Security/performance risks

- **Enumeration:** non-member workspace reads return 404 to avoid confirming existence. Slug availability returns only a boolean and never metadata.
- **Mass assignment:** controllers map only `name`/`slug`; `userId`, `role`, `status`, `id` are never accepted from the request.
- **Slug squatting/race:** global unique constraint + `P2002` handling; consider rate limiting creation if abuse appears (global limiter sufficient for portfolio).
- **Tenant isolation:** list and get are scoped by `req.auth.userId` and `status = ACTIVE`; no global `findMany` without user filter.
- **Bounded lists:** max 50 per request; no unbounded workspace loading.
- **Client selection is not authority:** stored selected ID is validated against memberships on use; never trusted for access.
- **Response DTOs:** only safe fields (`id`, `name`, `slug`, `createdAt`, `updatedAt`, role, status) are serialized; no internal flags.

## Rollout/compatibility notes

- New tables/enums only; no changes to existing tables, so existing auth/profile tests remain valid.
- Migration is additive and reversible by dropping the new tables (no data in production yet). No backfill.
- Frontend changes are additive routes/components; existing routes remain functional.
- No env changes; no dependency changes.

## Implementation sequence

1. Prisma schema: add `WorkspaceRole`, `WorkspaceMembershipStatus`, `Workspace`, `WorkspaceMembership`, and `User.workspaceMemberships` relation; generate migration SQL and review.
2. Apply migration to dev and test DBs (`db:deploy`, `db:migrate:test`); verify `db:status`/`db:status:test`.
3. Zod schemas in `apps/api/src/schemas/workspace.schemas.ts`.
4. Service `apps/api/src/services/workspace.service.ts` (slug normalization, creation transaction, list, get, slug availability).
5. Controller `apps/api/src/controllers/workspace.controller.ts` and route `apps/api/src/routes/workspaces.routes.ts`; register in `routes/index.ts`.
6. Frontend types, API client, create page, switcher, onboarding empty state, route registration.
7. Tests: backend integration + frontend unit/component tests.
8. Run verification commands; inspect final diff.

## Actual verification commands (repository)

- `pnpm test` (API + web)
- `pnpm --filter @taskforge/api typecheck`
- `pnpm --filter @taskforge/web typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm build`
- `pnpm db:status` and `pnpm db:status:test`
- Non-interactive migration: `pnpm --filter @taskforge/api exec prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` then `pnpm --filter @taskforge/api db:deploy` and `db:migrate:test`
- Targeted: `pnpm --filter @taskforge/api exec vitest run tests/workspaces.test.ts` (new), `pnpm --filter @taskforge/web exec vitest run tests/workspace*.test.tsx` (new)

---

Spec written; implementation requires explicit user approval via a later `/develop` request. STOP.