# Feature 09 — Workspace settings and member administration

Spec status: Draft for review. No application code, migration, or package change is produced by this spec.

## Overview alignment

- Feature number/title: Feature 9 — Workspace settings and member administration.
- Dependencies: Feature 8 (Workspace memberships, invitations, roles, and permissions).
  - Dependency status: **met**.
  - Evidence: Feature 8 implemented and committed as `7e14d86 feat(workspace): add workspace memberships, invitations, roles, and permissions` (git log, 2026-11-28); `docs/specs/feature-08-workspace-memberships-invitations-roles-and-permissions.md` exists; Feature 7 committed as `74c0285`; Feature 5 committed as `b343650`, `d25e701`, `d0bba48`. Membership service/policy/routes present at `apps/api/src/services/membership.service.ts`, `apps/api/src/policies/workspace.policy.ts`, `apps/api/src/routes/workspaces.routes.ts`. `git status --short` is clean. Backend tests pass (API 106/106, web 16/16 verified this session).
- In scope honored: update workspace name, slug under controlled validation, description, and optional logo; paginated member directory with search/filter by role and membership status; change eligible member roles, suspend/reactivate/remove members, and revoke pending invitations (endpoints already shipped in Feature 8 and reused); transfer ownership through explicit confirmation and re-authentication; show workspace creation/update metadata and a clear settings navigation structure.
- Out of scope honored: billing; custom workspace domains; advanced audit reporting (Feature 39); workspace deletion/data export (Feature 40); project-specific access rules (Feature 11); Socket.IO (Feature 25).
- Overview acceptance criteria mapped to the test matrix below.
- Documented refinements of overview rules:
  1. **Settings permission split:** `OWNER` and `ADMIN` may update `name`, `description`, and `logoUrl`. Only `OWNER` may update `slug`. This refines "Only permitted roles can change workspace settings" by treating slug (which affects routing/identity) as owner-only.
  2. **Ownership transfer is immediate but re-authenticated:** the owner supplies their current password; on success the selected active member becomes `OWNER` and the acting owner is demoted to `ADMIN` in the same transaction. No separate acceptance step or cooling period is required. This refines "Transfer ownership through explicit confirmation and re-authentication or other approved protection."
  3. **Transfer target constraints:** target must be an `ACTIVE` member of the same workspace, must not already be an `OWNER`, and must not be the acting owner. A workspace never becomes ownerless because the target is promoted before the actor is demoted.
  4. **Logo is metadata-only:** `logoUrl` is a validated URL string (or null). No file upload is performed in this feature; actual logo upload/storage lands with Feature 21 (S3). This keeps Feature 9 free of S3 dependencies.
  5. **Description limits:** `description` is an optional, nullable string, max 500 characters (trimmed). Empty/whitespace becomes null.
  6. **Member directory filters are query-driven:** reuse the existing `memberListQuerySchema` (`page`, `limit`, `role`, `status`, `q`) already shipped in Feature 8. Feature 9 adds the frontend filter controls and pagination UI; no new backend list endpoint.
  7. **Settings navigation:** a dedicated settings route under the workspace, with sections for General (name/slug/description/logo), Members (link to existing members page with filters), and Invitations (link to existing members page invitation table). Member/invitation mutations continue to use Feature 8 endpoints.

## Goal

Provide a workspace settings area where authorized owners/admins can manage workspace identity (name, slug, description, logo metadata), transfer ownership safely with re-authentication, and navigate member administration that already exists from Feature 8. Keep the change additive and consistent with existing workspace/member/invitation flows.

## Non-goals

- Billing, custom domains, or workspace theming beyond a logo URL.
- Advanced audit reporting (Feature 39).
- Workspace deletion/data export (Feature 40).
- Project-level settings or project membership (Features 10–11).
- File upload for logos (Feature 21).
- Socket.IO events (Feature 25).
- New member/invitation backend endpoints (reuse Feature 8).

## User flows

1. **Update workspace settings (owner/admin):** Owner/admin opens workspace settings, edits name/description/logo (and slug if owner), submits. Server validates permission and input, updates the workspace, returns the updated workspace. UI updates the workspace summary and slug-dependent navigation.
2. **Change slug (owner only):** Owner edits slug; server validates format + uniqueness; non-owner submission is rejected. On success, the slug changes and subsequent workspace lookups use the new slug-independent ID (IDs are unchanged).
3. **Transfer ownership (owner):** Owner selects an active member, enters their current password, confirms. Server re-authenticates, promotes the member to `OWNER`, demotes the acting owner to `ADMIN`, returns the updated workspace + new owner membership. UI refreshes workspace detail/role.
4. **Member administration (existing):** Owner/admin uses the members page (with new search/filter/pagination controls) to change roles, suspend/reactivate/remove members, and manage invitations via Feature 8 endpoints.
5. **Settings navigation:** From the workspace, a settings link opens `/app/workspaces/:workspaceId/settings`, which links to General, Members, and Invitations sections.

## Acceptance criteria (overview Feature 9)

- Authorized owners/admins can update allowed workspace settings.
- Member lists are paginated and scoped to the active workspace.
- Unauthorized members cannot change roles or workspace settings.
- Ownership transfer cannot leave the workspace ownerless.
- Removing a member revokes their future workspace/project access while preserving safe historical attribution.

## Assumptions

- **A1 (non-blocking):** `description` max 500 chars, nullable; whitespace-only input is normalized to null.
- **A2 (non-blocking):** `logoUrl` is a validated URL string (max 500 chars), nullable; no file upload in this feature. Only `http`/`https` URLs are accepted.
- **A3 (non-blocking):** slug changes are restricted to `OWNER`. Admins attempting a slug change receive `403 FORBIDDEN`.
- **A4 (non-blocking):** ownership transfer re-authenticates via the actor's current password (argon2 verify). No email confirmation or cooling period.
- **A5 (non-blocking):** after transfer, the previous owner becomes `ADMIN` (not removed). Existing sessions are not revoked (membership role change takes effect on next request).
- **A6 (non-blocking):** member directory filter UI reuses existing backend query params (`q`, `role`, `status`, `page`, `limit`); no new backend list endpoint.
- **A7 (non-blocking):** no new environment variables.
- **A8 (non-blocking):** settings page is additive; existing members route remains functional. Frontend tests for filters are optional but recommended.

## Unresolved questions

- None blocking. Non-blocking: whether admins should also be allowed to change slug (decided: owner-only, A3); whether ownership transfer should require the target's acceptance (decided: immediate with password re-auth, A4).

## API endpoints (`/api/v1`)

All endpoints require `requireAuth`. Envelopes: `{ data }` / `{ error: { code, message, requestId, details? } }`. Status codes: 200, 201, 204, 400/422 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 429 rate limited.

Member/invitation endpoints from Feature 8 are reused unchanged:
- `GET /workspaces/:workspaceId/members`, `PATCH /workspaces/:workspaceId/members/:membershipId`, `DELETE /workspaces/:workspaceId/members/:membershipId`
- `POST/GET /workspaces/:workspaceId/invitations`, resend/revoke.

### Workspace settings (under `/workspaces/:workspaceId`)

`workspaceId` validated by `workspaceIdParamSchema`. Every endpoint resolves an `ACTIVE` membership for `(workspaceId, req.auth.userId)`; absence → `404 WORKSPACE_NOT_FOUND`.

#### `PATCH /workspaces/:workspaceId`

Update workspace settings.

- Permission: `OWNER` or `ADMIN` for `name`/`description`/`logoUrl`. `slug` requires `OWNER` (A3).
- Params: `workspaceIdParamSchema`.
- Body (Zod `updateWorkspaceSettingsSchema`): `{ name?: string, slug?: string, description?: string | null, logoUrl?: string | null }`. At least one field required.
  - `name`: trim, min 1, max 80.
  - `slug`: reuse `slugSchema` (transform + validation).
  - `description`: trim, max 500, nullable.
  - `logoUrl`: URL, max 500, nullable.
- Rules: slug uniqueness enforced; `P2002` → `409 WORKSPACE_SLUG_TAKEN`. Non-owner slug submission → `403 FORBIDDEN`. Empty/whitespace description → null.
- Response 200: `{ data: { workspace: WorkspaceSummary } }` (now includes `description`, `logoUrl`).
- Errors: 401, 403, 404 `WORKSPACE_NOT_FOUND`, 409 `WORKSPACE_SLUG_TAKEN`, 422.

#### `POST /workspaces/:workspaceId/ownership/transfer`

Transfer workspace ownership.

- Permission: `OWNER` only.
- Params: `workspaceIdParamSchema`.
- Body (Zod `transferOwnershipSchema`): `{ targetMembershipId: string (min 1, max 64), currentPassword: string (min 1, max 128) }`.
- Rate limit: apply the auth rate limiter to this sensitive endpoint.
- Rules:
  1. Resolve actor active membership; if role !== `OWNER` → `403 FORBIDDEN`.
  2. Verify `currentPassword` against the actor's password hash; invalid → `400 INVALID_CURRENT_PASSWORD`.
  3. Transaction:
     - Load target membership by `id` + `workspaceId`; not found → `404 MEMBER_NOT_FOUND`.
     - If `target.userId === actor.userId` → `409 CANNOT_TRANSFER_TO_SELF`.
     - If `target.status !== ACTIVE` → `409 MEMBER_NOT_ACTIVE`.
     - If `target.role === OWNER` → `409 ALREADY_OWNER`.
     - Promote target to `OWNER`.
     - Demote actor to `ADMIN`.
  4. Ensure at least one active owner remains (target is owner); if not, rollback (should not happen given promotion-first).
- Response 200: `{ data: { workspace: WorkspaceSummary, membership: { id, userId, role: 'OWNER', status: 'ACTIVE' } } }` (target membership).
- Errors: 400 `INVALID_CURRENT_PASSWORD`, 401, 403, 404 `WORKSPACE_NOT_FOUND` / `MEMBER_NOT_FOUND`, 409 `CANNOT_TRANSFER_TO_SELF` / `MEMBER_NOT_ACTIVE` / `ALREADY_OWNER`, 422.

## Zod schemas

Extend `apps/api/src/schemas/workspace.schemas.ts`:
- `updateWorkspaceSettingsSchema`: `{ name?: ..., slug?: slugSchema, description?: z.string().trim().max(500).nullable().optional(), logoUrl?: z.string().url().max(500).nullable().optional() }` with `.refine` requiring at least one field. Empty/whitespace description normalized to null in service.
- `transferOwnershipSchema`: `{ targetMembershipId: z.string().min(1).max(64), currentPassword: z.string().min(1).max(128) }`.

No env changes (A7).

## Authentication and authorization

### Auth middleware
All endpoints use `requireAuth` (session-revocation-aware).

### Authorization policy
Extend `apps/api/src/policies/workspace.policy.ts`:
- `canManageWorkspaceSettings(role): boolean` — `OWNER` or `ADMIN`.
- `canChangeSlug(role): boolean` — `OWNER` only.
- `canTransferOwnership(role): boolean` — `OWNER` only.

Reuse existing `getActiveMembership(workspaceId, userId)` for active-membership resolution; absence → `404 WORKSPACE_NOT_FOUND`.

### Permission matrix (workspace-level, unchanged from Feature 8 except settings detail)

| Capability | OWNER | ADMIN | MEMBER | GUEST |
|---|---|---|---|---|
| Read workspace + member list | ✓ | ✓ | ✓ | ✓ |
| Update workspace settings (name/description/logo) | ✓ | ✓ | ✗ | ✗ |
| Update workspace slug | ✓ | ✗ | ✗ | ✗ |
| Transfer ownership | ✓ | ✗ | ✗ | ✗ |
| Delete workspace (F40) | ✓ | ✗ | ✗ | ✗ |
| Member/invitation admin (F8) | ✓ | ✓ (bounded) | self only | self only |

### Trusted server-derived fields
`userId` from `req.auth.userId`; `workspaceId` from URL param (validated against membership); `description`/`logoUrl` normalized server-side; `slug` validated + uniqueness-checked; `role` changes only via policy. Client never submits `userId`, `workspaceId` as authority, `role`, `status`, or ownership.

### Mass-assignment protection
Controllers map only documented body fields into service inputs; Prisma writes use explicit data objects. `slug` is normalized via `slugSchema`.

## Prisma models, relations, constraints, indexes

Modify `Workspace` in `apps/api/prisma/schema.prisma`:

```prisma
model Workspace {
  id          String   @id @default(cuid())
  name        String   @db.VarChar(80)
  slug        String   @unique @db.VarChar(48)
  description String?  @db.VarChar(500)
  logoUrl     String?  @map("logo_url") @db.VarChar(500)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  memberships   WorkspaceMembership[]
  invitations  WorkspaceInvitation[]

  @@map("workspaces")
}
```

- Migration: additive nullable columns `description`, `logo_url`; no data backfill; no changes to existing tables/indexes.
- `WorkspaceSummary` (backend + frontend) gains `description: string | null` and `logoUrl: string | null`.
- Deletion/retention: settings fields are part of the workspace row; no new retention rules. Workspace deletion lifecycle remains Feature 40.

## Query shape, selected fields, pagination, transaction/concurrency concerns, scale risks

- **Settings update:** single `prisma.workspace.update` with explicit `data` mapping (`name`, `slug`, `description`, `logoUrl` only when provided). `select` explicit fields. Catch `P2002` on slug → `409 WORKSPACE_SLUG_TAKEN`.
- **Ownership transfer:** transaction: (1) verify password outside transaction (argon2, no DB write); (2) transaction loads target membership; promotes target to `OWNER`; demotes actor to `ADMIN`. Both updates in one transaction. Unique constraint on `(workspaceId, userId)` unaffected.
- **Member list (existing):** `findMany` on `WorkspaceMembership` with `where: { workspaceId, ...filters }`, `include: { user: { select: { id, displayName, email } } }`, `orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]`, `skip`/`take`. Separate `count`. Max 50 per request.
- **Concurrency:** slug uniqueness via DB unique constraint; ownership transfer uses transaction; last-owner protection not needed because promotion precedes demotion, but verify owner count >= 1 before commit.
- **Scale risks:** settings updates are low-frequency single-row writes. No unbounded loads. Member list bounded by pagination (max 50).

## Service/repository decision

- **Service:** Extend `apps/api/src/services/workspace.service.ts` with `updateWorkspaceSettings` and `transferOwnership`. Justified: multi-step writes, permission checks, password verification, transaction. Reuse existing `getWorkspace` for reads.
- **Policy module:** Extend `apps/api/src/policies/workspace.policy.ts` with settings/transfer permission helpers. Justified: centralized, testable rules reusable by later features.
- **Repository:** Not needed. Prisma access is straightforward; a repository would add ceremony (per AGENTS decision tree). Revisit if query complexity grows (e.g., search in Feature 31).

## React routes/pages/components, API client, server-state/cache behavior, forms, shared types, loading/empty/error/accessibility states

- API client additions in `apps/web/src/features/workspaces/workspace-api.ts`:
  - `updateWorkspace(workspaceId, input)` → `PATCH /workspaces/:workspaceId`.
  - `transferOwnership(workspaceId, input)` → `POST /workspaces/:workspaceId/ownership/transfer`.
- Types in `apps/web/src/types/workspace.ts`: extend `WorkspaceSummary` with `description: string | null`, `logoUrl: string | null`; add `UpdateWorkspaceSettingsInput`, `TransferOwnershipInput`.
- Routes:
  - `/app/workspaces/:workspaceId/settings` → `WorkspaceSettingsPage` (protected, inside AppShell).
- `WorkspaceSettingsPage`:
  - General settings form: name, slug (owner only / disabled for admin), description, logoUrl. Role-aware: slug field hidden/disabled for non-owners.
  - Danger zone (owner only): ownership transfer form with member selector + current password + confirm dialog.
  - Links to Members and Invitations (existing MembersPage).
  - Workspace creation/update metadata display (createdAt, updatedAt).
  - Loading/empty/error states; permission-denied state for non-admins.
- `MembersPage` enhancements:
  - Search input (`q`), role filter, status filter, pagination controls using existing backend params.
  - Link to settings page.
- Server state: TanStack Query keys `['workspace', workspaceId]`, `['workspaces']`. Invalidate after settings/transfer mutations. Do not mirror in component state beyond form drafts.
- Forms: accessible labels, field-level errors, pending/disabled states, double-submission protection, confirm dialog for transfer.
- Accessibility: semantic headings, keyboard support, visible focus, `aria-label` on actions.

## Socket.IO events/auth/rooms/after-commit behavior

No new socket events in this feature. Workspace settings changes and ownership transfers take effect on the next API request (membership/role re-check). Socket-side enforcement of revoked/changed access lands in Feature 25. No after-commit broadcasts added here.

## S3 / BullMQ / Redis

Not applicable. No file storage or background jobs in this feature. Logo is a URL string only (A2); actual upload arrives with Feature 21.

## Test matrix

Backend (Vitest + Supertest, real MariaDB test DB):
- **Auth:** all endpoints 401 when unauthenticated.
- **Permission:** owner/admin can update settings; member/guest cannot; only owner can change slug; only owner can transfer ownership.
- **Settings validation:** name required non-empty/max 80; slug format/uniqueness; description max 500; logoUrl URL validation; at least one field required; empty/whitespace description → null.
- **Slug conflict:** duplicate slug → `409 WORKSPACE_SLUG_TAKEN`.
- **Slug permission:** admin submitting slug → `403 FORBIDDEN`.
- **Ownership transfer:** success promotes target and demotes actor; invalid password → `400`; non-owner actor → `403`; self-target → `409 CANNOT_TRANSFER_TO_SELF`; non-active target → `409 MEMBER_NOT_ACTIVE`; already-owner target → `409 ALREADY_OWNER`; missing target → `404 MEMBER_NOT_FOUND`; missing workspace → `404 WORKSPACE_NOT_FOUND`.
- **Ownerless protection:** after transfer, active owner count >= 1.
- **Scoping:** cross-workspace access → `404`; guessed IDs → `404`.
- **Member directory filters (existing):** `q`/`role`/`status`/pagination bounds; max 50.

Frontend (Vitest + Testing Library):
- Settings form validation and server error display.
- Role-aware slug field visibility/disabled.
- Ownership transfer confirm dialog and password handling.
- Member filter controls and pagination render.

Critical E2E (Playwright, optional/blocked): manual verification of settings update + ownership transfer acceptable.

## Security/performance risks

- **Re-authentication:** ownership transfer requires current password verified with argon2; prevents CSRF/replay by a hijacked session alone.
- **Privilege escalation:** slug/settings gated by policy; `OWNER` role cannot be granted via settings endpoint; only transfer endpoint creates owners.
- **Last-owner lockout:** promotion-before-demotion in a transaction; verify owner count.
- **Mass assignment:** explicit field mapping; no raw body spread.
- **Tenant isolation:** all queries scoped by `workspaceId` + verified membership; cross-workspace → 404.
- **Bounded lists:** max 50 per request.
- **Rate limiting:** transfer endpoint uses auth rate limiter; settings updates bounded by global limiter.
- **Secret safety:** password never logged; error messages do not leak internals.

## Rollout/compatibility notes

- Additive schema change (two nullable columns); no changes to existing tables, so existing workspace/auth/profile/member/invitation tests remain valid.
- Migration is additive and reversible by dropping the two columns (no production data yet). No backfill.
- No new env vars.
- Frontend changes are additive routes/components; existing routes remain functional.
- No breaking changes to existing endpoints (WorkspaceSummary gains optional fields; clients should tolerate).

## Implementation sequence

1. Prisma schema: add `description`, `logoUrl` to `Workspace`; generate migration SQL and review.
2. Apply migration to dev and test DBs (`db:deploy`, `db:migrate:test`); verify `db:status`/`db:status:test`.
3. Zod schemas in `apps/api/src/schemas/workspace.schemas.ts` (`updateWorkspaceSettingsSchema`, `transferOwnershipSchema`).
4. Policy: extend `apps/api/src/policies/workspace.policy.ts`.
5. Service: extend `apps/api/src/services/workspace.service.ts` (`updateWorkspaceSettings`, `transferOwnership`).
6. Controller: extend `apps/api/src/controllers/workspace.controller.ts` (update, transferOwnership handlers); routes in `workspaces.routes.ts`.
7. Frontend types + API client + `WorkspaceSettingsPage` + route registration + MembersPage filter enhancements.
8. Tests: backend integration + frontend unit/component tests.
9. Run verification commands; inspect final diff.

## Actual verification commands (repository)

- `pnpm test` (API + web)
- `pnpm --filter @taskforge/api typecheck`
- `pnpm --filter @taskforge/web typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm build`
- `pnpm db:status` and `pnpm db:status:test`
- Non-interactive migration: `pnpm --filter @taskforge/api exec prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` then `pnpm --filter @taskforge/api db:deploy` and `db:migrate:test`
- Targeted: `pnpm --filter @taskforge/api exec vitest run tests/workspaces.test.ts tests/memberships.test.ts tests/invitations.test.ts` (existing/new), `pnpm --filter @taskforge/web exec vitest run` (new settings tests)

---

Spec written; implementation requires explicit user approval via a later `/develop` request. STOP.