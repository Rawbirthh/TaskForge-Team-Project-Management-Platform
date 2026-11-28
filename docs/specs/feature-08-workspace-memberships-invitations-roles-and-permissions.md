# Feature 08 — Workspace memberships, invitations, roles, and permissions

Spec status: Draft for review. No application code, migration, or package change is produced by this spec.

## Overview alignment

- Feature number/title: Feature 8 — Workspace memberships, invitations, roles, and permissions.
- Dependencies: Feature 7 (Workspace creation, onboarding, and switching), Feature 5 (Authentication and account lifecycle).
  - Dependency status: **met**.
  - Evidence: Feature 7 implemented and committed as `74c0285 feat(workspace): add workspace creation, onboarding, and switching` (git log); `docs/specs/feature-07-workspace-creation-onboarding-and-switching.md` exists; Feature 5 committed as `b343650`, `d25e701`, `d0bba48`. Auth middleware at `apps/api/src/middleware/auth.ts`; Prisma schema has `Workspace`, `WorkspaceMembership`, `WorkspaceRole`, `WorkspaceMembershipStatus`. `git status --short` is clean.
- In scope honored: workspace membership records with active/invited/suspended/removed states; default roles owner/admin/member/guest; a documented permission matrix; email invitations with high-entropy single-use expiring tokens; accept/decline/resend/revoke/expire; duplicate-active-membership prevention and handling of invitations to existing members; server-side middleware/policy authorization layer; minimal member/invitation management UI per role.
- Out of scope honored: project-specific access rules (Feature 11); public invitations; bulk invitations; SCIM/enterprise directory sync; workspace settings & full member administration UI (Feature 9); ownership transfer flow (Feature 9, though permission is defined here); workspace deletion/data export (Feature 40); Socket.IO rooms (Feature 25, though revocation semantics are defined here).
- Overview acceptance criteria mapped to the test matrix below.
- Documented refinements of overview rules:
  1. **Permission matrix (new, required by overview):** documented in the "Authentication and authorization" section. Roles: `OWNER`, `ADMIN`, `MEMBER`, `GUEST`. Workspace-level capability table + invitation grant table + member-management table are the approved matrix.
  2. **Invitation grant ceiling:** an inviter may grant only roles strictly below their own (OWNER → ADMIN/MEMBER/GUEST; ADMIN → MEMBER/GUEST). Invitations never grant `OWNER`; owner privileges are granted only through the separate ownership-transfer flow (Feature 9). This refines "Only an owner may grant or transfer owner privileges."
  3. **Role-change scope:** `PATCH` membership can set `ADMIN`, `MEMBER`, or `GUEST` only. `OWNER` is never set through this endpoint; it is granted only via ownership transfer (Feature 9).
  4. **Invitation storage:** invitations are stored in a new `WorkspaceInvitation` table (token hash only). Acceptance creates/activates a `WorkspaceMembership` (status `ACTIVE`) in the same transaction. For not-yet-registered invitees, acceptance requires an authenticated account whose email matches the invitation email (invitee registers first, then accepts).
  5. **Invitation rotation on re-invite:** creating an invitation for an email that already has a pending (non-accepted, non-revoked, non-expired) invitation revokes the prior invitation and issues a new token, rather than creating a duplicate. Resend regenerates the token in place.
  6. **Membership status transitions:** `REMOVED` is terminal (no reactivation); a removed user must be re-invited. `SUSPENDED` ↔ `ACTIVE` is allowed for eligible actors. This refines "active, invited, suspended, and removed states as appropriate."
  7. **Last-owner protection:** any demotion, suspension, or removal that would leave zero active owners is rejected with `409 LAST_OWNER_PROTECTED`.
  8. **Non-member invisibility:** a workspace a user cannot access is indistinguishable from a nonexistent one; endpoints return `404 WORKSPACE_NOT_FOUND` (carried over from Feature 7).
  9. **Member list visibility:** any active member may read the member list (names + roles); management actions are gated by the matrix. Guest may read but not manage.
  10. **Email matching on accept:** the authenticated user's email must match the invitation email (case-insensitive). Mismatch returns `403 INVITATION_EMAIL_MISMATCH`.
  11. **Idempotent accept:** accepting an already-accepted invitation by the same user returns the existing membership with `200` (no duplicate). Accepting when an active membership already exists marks the invitation accepted and returns the membership.
  12. **Invitation expiry default:** 7 days, configurable via `INVITATION_TOKEN_TTL_DAYS` (new env var, default 7, range 1–30).

## Goal

Establish secure workspace collaboration: a documented role/permission model, membership lifecycle (active/invited/suspended/removed), email invitations with single-use expiring tokens, and a centralized authorization policy that later features (projects, tasks, etc.) can reuse. Provide minimal management UI for owners/admins and an accept/decline flow for invitees.

## Non-goals

- Project-level access rules and project membership (Feature 11).
- Workspace settings UI beyond member/invitation management (Feature 9) — this feature provides the minimal member/invitation UI only; full settings land in Feature 9.
- Ownership transfer execution (Feature 9) — permission is defined here, flow is implemented there.
- Workspace deletion/data export (Feature 40).
- Bulk invitations, public invitations, SCIM/enterprise directory sync.
- Socket.IO rooms/events (Feature 25) — revocation semantics are defined here and enforced by Feature 25.
- Email delivery infrastructure beyond reusing the existing mailer (console/smtp/disabled).

## User flows

1. **Invite a member (owner/admin):** An owner/admin opens the members page for a workspace, enters an email and selects a role they are allowed to grant, and submits. The server validates permission, checks for existing active membership (409 if already a member), rotates any pending invitation for that email, creates a new invitation with a hashed token, and sends an invitation email with an accept link. The UI shows the pending invitation in the invitation list.
2. **Accept invitation (existing user):** The invitee clicks the link, logs in if needed, and the frontend calls `POST /invitations/accept` with the token. The server validates the token, email match, and workspace state, creates/activates a membership with the invited role, marks the invitation accepted, and returns the membership. The client refreshes workspaces and redirects to the app shell.
3. **Accept invitation (new user):** The invitee registers an account using the invitation email (standard registration), then visits the accept link and accepts. Same backend flow.
4. **Decline invitation:** The invitee calls `POST /invitations/decline`; the invitation is marked revoked; no membership is created.
5. **Resend invitation:** An owner/admin resends a pending invitation; the token is regenerated and expiry extended; a new email is sent.
6. **Revoke invitation:** An owner/admin revokes a pending invitation; it can no longer be accepted.
7. **Change member role:** An owner (or admin within boundary) changes an eligible member's role via the members page; last-owner protection applies.
8. **Suspend/reactivate/remove member:** An owner/admin suspends (blocks access without deleting), reactivates, or removes (terminal) an eligible member.
9. **Self-protection:** A user cannot remove/suspend/demote themselves if they are the last owner; otherwise self-removal (leave workspace) is allowed? Leaving is a self-service action. This feature allows a member to remove themselves (status REMOVED) if not the last owner. Documented as allowed.

## Assumptions

- **A1 (non-blocking):** Invitation expiry is 7 days, configurable via `INVITATION_TOKEN_TTL_DAYS` (default 7, range 1–30). Added to env schema.
- **A2 (non-blocking):** Invitation acceptance requires an authenticated user whose email matches the invitation email. Unauthenticated invitees must register/login first. This reuses Feature 5 auth and avoids a parallel registration-with-token flow.
- **A3 (non-blocking):** Member list and invitation list pagination uses offset (`page`/`limit`), default 20, max 50, sorted by `createdAt` desc then `id` desc, consistent with Feature 7.
- **A4 (non-blocking):** Member list returns `displayName` and `email` for all active members (including to guests). If stricter privacy is desired, email can be restricted to admins later.
- **A5 (non-blocking):** Search on member/invitation lists filters by `displayName`/`email` (members) and `email` (invitations) using case-insensitive `contains` (MySQL collation). Bounded by pagination.
- **A6 (non-blocking):** A removed membership row is retained (status `REMOVED`) for history; it is not hard-deleted. Re-inviting creates a new invitation and, on accept, reactivates the existing row (status → `ACTIVE`, role updated) rather than creating a duplicate, preserving the original membership id. If the row was hard-deleted previously, a new one is created.
- **A7 (non-blocking):** Suspending a member sets `status = SUSPENDED`; access checks require `status = ACTIVE`, so suspension takes effect on the next request. No session revocation is performed at the user-account level (membership ≠ session); socket access is re-checked per room join (Feature 25).
- **A8 (non-blocking):** Ownership transfer is not implemented here (Feature 9). The `OWNER` role cannot be assigned via invitation or role-change; only the existing owner-transfer flow (Feature 9) may create additional owners. Until Feature 9 ships, a workspace has exactly one owner (the creator), and last-owner protection means that owner cannot be demoted/removed/suspended.
- **A9 (non-blocking):** Minimal UI lives at `/app/workspaces/:workspaceId/members` (protected, requires active membership). Full settings navigation lands in Feature 9. Accept/decline UI lives at `/accept-invitation` (public layout, reads `?token=`).
- **A10 (non-blocking):** Email sending is fire-and-forget after commit (consistent with auth verification emails), with errors logged. Invitation creation succeeds even if email delivery fails; the invitation remains pending and can be resent.

## Acceptance criteria (overview Feature 8)

- Authorized users can invite members and assign only roles they are allowed to grant.
- Invitation tokens expire, are single-use, and cannot be guessed from predictable IDs.
- Accepting an invitation creates exactly one membership.
- Unauthorized members cannot list, invite, remove, suspend, or change roles.
- The last owner cannot be removed or demoted without an ownership transfer.
- Role changes and membership revocation take effect on subsequent API requests and protected socket subscriptions.

## API endpoints (`/api/v1`)

All endpoints require `requireAuth` unless noted. Envelopes: `{ data }` / `{ error: { code, message, requestId, details? } }`. Status codes: 200, 201, 204, 400/422 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 429 rate limited.

### Workspace-scoped (under `/workspaces/:workspaceId`)

`workspaceId` is validated by `workspaceIdParamSchema` (string, 1–64). Every endpoint below first resolves an `ACTIVE` membership for `(workspaceId, req.auth.userId)`; absence → `404 WORKSPACE_NOT_FOUND`. Role gating then applies.

#### `GET /workspaces/:workspaceId/members`

List members of a workspace.

- Permission: any active member (OWNER/ADMIN/MEMBER/GUEST) may read.
- Query (Zod `memberListQuerySchema`): `page` (coerced int, min 1, default 1), `limit` (coerced int, min 1, max 50, default 20), `role` (optional enum OWNER/ADMIN/MEMBER/GUEST), `status` (optional enum ACTIVE/INVITED/SUSPENDED/REMOVED), `q` (optional string, max 100, trimmed).
- Scope: `WorkspaceMembership` rows where `workspaceId = :workspaceId`, optional filters.
- Response 200: `{ data: { items: MemberListItem[], page, limit, total } }`.
  - `MemberListItem`: `{ membership: { id, userId, role, status, createdAt, updatedAt }, user: { id, displayName, email } }`.
- Errors: 401, 404 `WORKSPACE_NOT_FOUND`, 422.

#### `PATCH /workspaces/:workspaceId/members/:membershipId`

Change a member's role and/or status.

- Permission: see matrix. Actor must have an active membership. Target must belong to the same workspace.
- Params: `workspaceIdParamSchema`, `membershipIdParamSchema` (`membershipId` string, 1–64).
- Body (Zod `updateMemberSchema`): `{ role?: 'ADMIN'|'MEMBER'|'GUEST', status?: 'ACTIVE'|'SUSPENDED' }`. At least one required. `OWNER` is not an assignable role here.
- Rules: last-owner protection; admin boundary; self-demotion of the last owner blocked; cannot change own role to remove last owner; status `REMOVED` is not set here (use DELETE).
- Response 200: `{ data: { membership: { id, userId, role, status, updatedAt } } }`.
- Errors: 401, 403 `FORBIDDEN`, 404 `WORKSPACE_NOT_FOUND` / `MEMBER_NOT_FOUND`, 409 `LAST_OWNER_PROTECTED`, 422.

#### `DELETE /workspaces/:workspaceId/members/:membershipId`

Remove a member (status → `REMOVED`, terminal).

- Permission: see matrix.
- Response 204 (no body).
- Errors: 401, 403, 404, 409 `LAST_OWNER_PROTECTED`, 422.

#### `POST /workspaces/:workspaceId/invitations`

Create an invitation.

- Permission: OWNER or ADMIN.
- Body (Zod `createInvitationSchema`): `{ email: string (email, max 254, trimmed, lowercased), role: 'ADMIN'|'MEMBER'|'GUEST' }`. Role must be grantable by actor (validated server-side; schema allows the enum, policy enforces ceiling).
- Rules: if an active membership already exists for that email in this workspace → `409 ALREADY_MEMBER`. If a pending invitation exists for that email+workspace → revoke it and create a new one (rotation). Generate high-entropy token; store only hash; set expiry per `INVITATION_TOKEN_TTL_DAYS`.
- Response 201: `{ data: { invitation: InvitationSummary } }`.
  - `InvitationSummary`: `{ id, workspaceId, email, role, status: 'PENDING'|'ACCEPTED'|'REVOKED'|'EXPIRED', expiresAt, createdAt }`. (Token is never returned after creation; the raw token is sent only by email. The create response does not include the raw token.)
- Side effect (after commit): send invitation email containing the accept link with the raw token.
- Errors: 401, 403, 404 `WORKSPACE_NOT_FOUND`, 409 `ALREADY_MEMBER`, 422.

#### `GET /workspaces/:workspaceId/invitations`

List invitations.

- Permission: OWNER or ADMIN.
- Query (Zod `invitationListQuerySchema`): `page`, `limit` (same bounds), `status` (optional PENDING/ACCEPTED/REVOKED/EXPIRED), `q` (optional email search, max 254).
- Response 200: `{ data: { items: InvitationSummary[], page, limit, total } }`.
- Errors: 401, 403, 404, 422.

#### `POST /workspaces/:workspaceId/invitations/:invitationId/resend`

Resend a pending invitation (regenerate token + extend expiry).

- Permission: OWNER or ADMIN.
- Params: `invitationIdParamSchema`.
- Rules: invitation must be pending (not accepted/revoked/expired). Regenerate token hash + expiry; send email.
- Response 200: `{ data: { invitation: InvitationSummary } }`.
- Errors: 401, 403, 404, 409 `INVITATION_NOT_PENDING`, 422.

#### `DELETE /workspaces/:workspaceId/invitations/:invitationId`

Revoke a pending invitation.

- Permission: OWNER or ADMIN.
- Response 204.
- Errors: 401, 403, 404, 409 `INVITATION_NOT_PENDING`, 422.

### Top-level invitation acceptance (under `/invitations`)

Mounted at `/api/v1/invitations`. Both require `requireAuth`.

#### `POST /invitations/accept`

- Body (Zod `acceptInvitationSchema`): `{ token: string (min 1, max 256) }`.
- Rules: resolve invitation by token hash; must be pending (not expired/revoked/accepted); authenticated user's email must match invitation email (else `403 INVITATION_EMAIL_MISMATCH`); workspace must exist. Create or reactivate membership with the invited role (transaction). Mark invitation accepted (`acceptedAt`, `acceptedUserId`). Idempotent: if already accepted by the same user, return existing membership with 200.
- Response 200: `{ data: { workspace: WorkspaceSummary, membership: { id, role, status } } }`.
- Errors: 400 `INVALID_INVITATION_TOKEN`, 401, 403 `INVITATION_EMAIL_MISMATCH`, 404 `WORKSPACE_NOT_FOUND`, 409 `ALREADY_MEMBER` (if active membership exists and invitation cannot be reconciled — handled idempotently instead where possible), 422.

#### `POST /invitations/decline`

- Body: `{ token: string }`.
- Rules: resolve invitation by token hash; must be pending. Mark revoked (`revokedAt`). No membership created.
- Response 204.
- Errors: 400 `INVALID_INVITATION_TOKEN`, 401, 403 (email mismatch? decline allowed by token holder; require email match for consistency), 422.

## Zod schemas

New file `apps/api/src/schemas/membership.schemas.ts`:
- `membershipIdParamSchema`: `{ membershipId: z.string().min(1).max(64) }`.
- `updateMemberSchema`: `{ role: z.enum(['ADMIN','MEMBER','GUEST']).optional(), status: z.enum(['ACTIVE','SUSPENDED']).optional() }` with `.refine` requiring at least one field.
- `memberListQuerySchema`: `{ page, limit (same bounds), role: z.enum([...]).optional(), status: z.enum([...]).optional(), q: z.string().trim().max(100).optional() }`.
- `createInvitationSchema`: `{ email: z.string().trim().toLowerCase().email().max(254), role: z.enum(['ADMIN','MEMBER','GUEST']) }`.
- `invitationIdParamSchema`: `{ invitationId: z.string().min(1).max(64) }`.
- `invitationListQuerySchema`: `{ page, limit, status: z.enum(['PENDING','ACCEPTED','REVOKED','EXPIRED']).optional(), q: z.string().trim().max(254).optional() }`.
- `acceptInvitationSchema` / `declineInvitationSchema`: `{ token: z.string().min(1).max(256) }`.

Env changes: add `INVITATION_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7)` to `envSchema`.

## Authentication and authorization

### Auth middleware
All endpoints use `requireAuth` (resolves `req.auth.userId` + `sessionId`, session-revocation-aware).

### Centralized authorization policy
New module `apps/api/src/policies/workspace.policy.ts` (pure functions, no DB):
- `WORKSPACE_ROLES = ['OWNER','ADMIN','MEMBER','GUEST']`.
- `canReadWorkspace(role): boolean` — all active members.
- `canManageMembers(actorRole): boolean` — OWNER or ADMIN.
- `canInviteRole(actorRole, targetRole): boolean` — grant ceiling table (OWNER→ADMIN/MEMBER/GUEST; ADMIN→MEMBER/GUEST).
- `canChangeRole(actorRole, targetCurrentRole, targetNewRole): boolean` — boundary table.
- `canSuspendOrRemove(actorRole, targetCurrentRole): boolean` — boundary table.
- `isLastOwnerProtected(action, activeOwnerCount, targetRole): boolean` — true if target is OWNER and activeOwnerCount <= 1.

A service-level helper `getActiveMembership(workspaceId, userId)` resolves the membership or throws `WORKSPACE_NOT_FOUND` (404) / `FORBIDDEN` as appropriate. Controllers never trust client role values.

### Permission matrix (workspace-level)

| Capability | OWNER | ADMIN | MEMBER | GUEST |
|---|---|---|---|---|
| Read workspace + member list | ✓ | ✓ | ✓ | ✓ |
| Update workspace settings (F9) | ✓ | ✓ | ✗ | ✗ |
| Delete workspace (F40) | ✓ | ✗ | ✗ | ✗ |
| Invite members | ✓ (up to ADMIN) | ✓ (up to MEMBER) | ✗ | ✗ |
| List/revoke/resend invitations | ✓ | ✓ | ✗ | ✗ |
| Change member role | ✓ (any except last-owner demotion; cannot set OWNER) | ✓ (MEMBER↔GUEST only) | ✗ | ✗ |
| Suspend/reactivate/remove member | ✓ (any except last owner) | ✓ (MEMBER/GUEST only) | self only (leave) | self only (leave) |
| Transfer ownership (F9) | ✓ | ✗ | ✗ | ✗ |
| Create/manage projects (F10+) | ✓ | ✓ | per project | per project |

### Trusted server-derived fields
`userId` from `req.auth.userId`; `workspaceId` from URL param (validated against membership); `role`/`status`/`invitedByUserId`/`tokenHash`/`expiresAt`/`acceptedAt`/`acceptedUserId`/`revokedAt` set server-side. The client never submits `userId`, `workspaceId` as authority, `role` beyond the requested grant (which is ceiling-checked), `status`, `token`, or membership IDs as proof of access.

### Mass-assignment protection
Controllers map only the documented body fields into service inputs; Prisma writes use explicit data objects. `email` is normalized (trim + lowercase) server-side.

## Prisma models, relations, constraints, indexes

Add to `apps/api/prisma/schema.prisma`:

```prisma
model WorkspaceInvitation {
  id              String    @id @default(cuid())
  workspaceId     String    @map("workspace_id")
  email           String    @db.VarChar(254)
  role            WorkspaceRole @default(MEMBER)
  tokenHash       String    @unique @map("token_hash")
  invitedByUserId String    @map("invited_by_user_id")
  expiresAt       DateTime  @map("expires_at")
  acceptedAt      DateTime? @map("accepted_at")
  acceptedUserId  String?   @map("accepted_user_id")
  revokedAt       DateTime? @map("revoked_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  invitedBy    User      @relation("WorkspaceInvitationsSent", fields: [invitedByUserId], references: [id], onDelete: Cascade)
  acceptedUser User?     @relation("WorkspaceInvitationsAccepted", fields: [acceptedUserId], references: [id], onDelete: SetNull)

  @@index([workspaceId, email])
  @@index([workspaceId, createdAt])
  @@map("workspace_invitations")
}
```

- `Workspace` gains `invitations WorkspaceInvitation[]`.
- `User` gains `workspaceInvitationsSent WorkspaceInvitation[] @relation("WorkspaceInvitationsSent")` and `workspaceInvitationsAccepted WorkspaceInvitation[] @relation("WorkspaceInvitationsAccepted")`.

No changes to `WorkspaceMembership` (already supports INVITED/SUSPENDED/REMOVED). Migration: additive new table + FKs + indexes + unique `token_hash`. No data backfill. Review generated SQL for FK `ON DELETE` behavior (`Cascade` on workspace/user; `SetNull` on accepted user).

Deletion/retention: invitation rows are retained for audit-ish history (accepted/revoked/expired). Pending invitations are cleaned up only by revoke/accept/expiry. No hard delete of invitation rows in normal flow. Membership `REMOVED` rows retained.

## Query shape, selected fields, pagination, transaction/concurrency concerns, scale risks

- **Invite creation:** transaction: (1) check active membership for email → `ALREADY_MEMBER`; (2) revoke prior pending invitations for `(workspaceId, email)`; (3) create invitation with hashed token; (4) return. Email sent after commit.
- **Accept:** transaction: (1) load invitation by token hash; (2) validate pending + not expired; (3) email match; (4) workspace exists; (5) upsert membership (reactivate if REMOVED/SUSPENDED; create if absent) with invited role (preserve OWNER if existing); (6) mark invitation accepted. Use token hash unique constraint as concurrency guard; a concurrent accept of the same token returns `INVALID_INVITATION_TOKEN` or idempotent success.
- **Member list:** `findMany` on `WorkspaceMembership` with `where: { workspaceId, ...filters }`, `include: { user: { select: { id, displayName, email } } }`, `orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]`, `skip`/`take`. Separate `count`.
- **Invitation list:** `findMany` on `WorkspaceInvitation` with filters, `include: { invitedBy: { select: { id, displayName } } }`, same pagination.
- **Active owner count:** `count` where `workspaceId`, `role = OWNER`, `status = ACTIVE`. Used for last-owner protection.
- **Indexes:** existing `WorkspaceMembership` indexes (`userId,status`, `workspaceId,status`) support membership checks and member lists. New `WorkspaceInvitation` indexes support list/filter. Consider adding `@@index([workspaceId, status])` to `WorkspaceInvitation` for invitation list filtering — include in migration.
- **Concurrency:** token hash unique constraint guards duplicate accept; membership unique constraint `(workspaceId, userId)` guards duplicate membership. Service catches `P2002` and maps to appropriate conflict.
- **Scale risks:** invitation tokens are high-entropy (32 bytes base64url) and hashed (SHA-256), so lookup is by hash (unique index). No unbounded loads (paginated). Member list includes user select to avoid over-fetching.

## Service/repository decision

- **Service:** Add `apps/api/src/services/membership.service.ts` (member list, role change, suspend/reactivate, remove, last-owner protection, active-membership resolution) and `apps/api/src/services/invitation.service.ts` (create, list, resend, revoke, accept, decline). Justified: multi-step transactional writes, permission checks, and reused query logic across endpoints.
- **Policy module:** `apps/api/src/policies/workspace.policy.ts` (pure functions) for the permission matrix. Justified: centralized, testable authorization rules reusable by later features.
- **Repository:** Not needed. Prisma access is straightforward; a repository would add ceremony (per AGENTS decision tree). Revisit if query complexity grows (e.g., search in Feature 31).

## React routes/pages/components, API client, server-state/cache behavior, forms, shared types, loading/empty/error/accessibility states

- API client additions in `apps/web/src/features/workspaces/workspace-api.ts` (or new `membership-api.ts`): typed functions for member/invitation CRUD and accept/decline.
- Types in `apps/web/src/types/workspace.ts` (extend) or new `apps/web/src/types/membership.ts`: `MemberListItem`, `InvitationSummary`, `UpdateMemberInput`, `CreateInvitationInput`.
- Routes:
  - `/app/workspaces/:workspaceId/members` → `MembersPage` (protected, inside AppShell). Minimal management UI: member table (name, email, role, status), invite form (owner/admin), invitation table (email, role, status, expiry), actions (change role, suspend/reactivate/remove, resend/revoke invitation) gated by role.
  - `/accept-invitation` (public layout) → `AcceptInvitationPage` reads `?token=`, prompts login if needed, calls accept/decline.
- Server state: TanStack Query keys `['workspace-members', workspaceId]`, `['workspace-invitations', workspaceId]`. Invalidate after mutations. Do not mirror in component state beyond form drafts.
- Forms: invite form (email + role select), change-role select, confirm dialogs for remove/suspend/revoke. Display server field errors. Disable submit while pending; prevent double submission.
- Loading/empty/error: skeletons for tables; empty states ("No members yet", "No pending invitations"); error banner with retry; 403 shows permission-denied state; 404 clears stale workspace selection.
- Accessibility: tables with proper headers; actions as buttons with `aria-label`; dialogs with focus trap; keyboard support; visible focus.

## Socket.IO events/auth/rooms/after-commit behavior

No new socket events in this feature. Revocation semantics: membership status changes take effect on the next API request (status check) and on the next socket room join (Feature 25 will re-check membership). This feature defines the rule; Feature 25 implements socket-side enforcement. No after-commit broadcasts added here.

## S3 / BullMQ / Redis

Not applicable. No file storage or background jobs in this feature. Invitation emails are sent fire-and-forget via the existing mailer after commit (consistent with auth emails).

## Test matrix

Backend (Vitest + Supertest, real MariaDB test DB):

- **Auth:** all endpoints 401 when unauthenticated.
- **Permission matrix:** owner/admin/member/guest capabilities for list/invite/change/remove/suspend (table-driven tests).
- **Invitation lifecycle:** create → list (pending) → resend (token rotated, expiry extended) → revoke (409 if accept attempted) → accept (membership created, invitation marked accepted) → decline (revoked, no membership).
- **Token security:** expired token → 400; revoked → 400; already accepted → idempotent 200 for same user; guessed/invalid token → 400; token hash stored (raw never in DB).
- **Duplicate handling:** invite an existing active member → 409 `ALREADY_MEMBER`; re-inviting a pending email rotates the invitation.
- **Email matching:** accept by a user whose email differs → 403 `INVITATION_EMAIL_MISMATCH`.
- **Accept creates exactly one membership:** concurrent accepts of the same token do not create duplicate memberships (unique constraint).
- **Last-owner protection:** demote/remove/suspend the sole owner → 409 `LAST_OWNER_PROTECTED`. With two owners, demotion of one succeeds (but note: creating a second owner is not possible via this feature; this case is only reachable via Feature 9, so tests may seed directly).
- **Admin boundary:** admin cannot invite ADMIN/OWNER, cannot change/remove owners or admins, cannot manage invitations' roles beyond ceiling.
- **Scoping:** member/invitation lists scoped to workspace; cross-workspace access → 404; guessed IDs → 404.
- **Pagination:** page/limit bounds (max 50), invalid → 422; total count correct; filters (role/status/q) correct.
- **Revocation effect:** after removal/suspension, the user's subsequent `GET /workspaces/:id` (and member list) reflects the new status; suspended/removed users lose read access (404).
- **Self-removal:** a non-owner member can remove themselves; last owner cannot.
- **Idempotent accept:** repeated accept by same user returns 200 with existing membership, no duplicate.
- **Transactional integrity:** a failed membership creation during accept rolls back the invitation acceptance.

Frontend (Vitest + Testing Library):
- Invite form validation and server error display.
- Member/invitation tables render zero/one/many rows.
- Role-gated action visibility (owner vs admin vs member).
- Accept/decline page handles valid/invalid/expired tokens and login redirect.
- Stale workspace handling on 404.

Critical E2E (Playwright, optional/blocked): not required; manual verification of invite → accept flow acceptable.

## Security/performance risks

- **Token leakage:** raw token is sent only by email and never persisted or returned by the API after creation. Email links include the token in the query string; this is standard but exposes it in browser history/referrer. Mitigation: single-use, short expiry, email-match requirement, hash storage.
- **Enumeration:** non-member workspace reads return 404. Invitation accept with an invalid token returns 400 without revealing whether the workspace exists.
- **Mass assignment:** controllers map only documented fields; `role` grant is ceiling-checked; `status` transitions validated; `userId`/`workspaceId`/`token` never trusted as authority.
- **Privilege escalation:** grant ceiling enforced in policy + service; `OWNER` role cannot be assigned via invitation or role-change. Admin cannot promote to admin/owner.
- **Last-owner lockout:** protected server-side with an active-owner count check inside the transaction.
- **Race safety:** token hash unique constraint + membership unique constraint + transactional count check.
- **Tenant isolation:** all queries scoped by `workspaceId` and verified membership; no global lookups by guessable IDs.
- **Email privacy:** invitation emails are sent to the invited address only; notification payloads (none here) exclude sensitive data.
- **Rate limiting:** invitation creation/resend should be rate-limited (reuse global limiter; consider a stricter limiter if abuse appears). Accept/decline bounded by global limiter.
- **Bounded lists:** max 50 per request; no unbounded member/invitation loading.

## Rollout/compatibility notes

- Additive schema change (new `workspace_invitations` table + indexes + FKs); no changes to existing tables, so existing workspace/auth/profile tests remain valid.
- Migration is additive and reversible by dropping the new table (no production data yet). No backfill.
- New env var `INVITATION_TOKEN_TTL_DAYS` (default 7) — add to `.env.example` as a placeholder.
- Mailer interface gains `sendWorkspaceInvitationEmail`; console/smtp/disabled implementations updated.
- Frontend changes are additive routes/components; existing routes remain functional.
- No breaking changes to existing endpoints.

## Implementation sequence

1. Prisma schema: add `WorkspaceInvitation` model, relations on `Workspace` and `User`, indexes; generate migration SQL and review.
2. Apply migration to dev and test DBs (`db:deploy`, `db:migrate:test`); verify `db:status`/`db:status:test`.
3. Env: add `INVITATION_TOKEN_TTL_DAYS` to `envSchema` and `.env.example`.
4. Mailer: add `sendWorkspaceInvitationEmail` to interface + implementations.
5. Zod schemas in `apps/api/src/schemas/membership.schemas.ts`.
6. Policy module `apps/api/src/policies/workspace.policy.ts`.
7. Services: `membership.service.ts`, `invitation.service.ts`.
8. Controllers: `members.controller.ts`, `invitations.controller.ts`; routes `members` (under workspaces) and `invitations.routes.ts` (top-level); register in `routes/index.ts`.
9. Frontend types, API client, `MembersPage`, `AcceptInvitationPage`, route registration.
10. Tests: backend integration + frontend unit/component tests.
11. Run verification commands; inspect final diff.

## Actual verification commands (repository)

- `pnpm test` (API + web)
- `pnpm --filter @taskforge/api typecheck`
- `pnpm --filter @taskforge/web typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm build`
- `pnpm db:status` and `pnpm db:status:test`
- Non-interactive migration: `pnpm --filter @taskforge/api exec prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` then `pnpm --filter @taskforge/api db:deploy` and `db:migrate:test`
- Targeted: `pnpm --filter @taskforge/api exec vitest run tests/memberships.test.ts tests/invitations.test.ts` (new), `pnpm --filter @taskforge/web exec vitest run tests/members*.test.tsx tests/accept-invitation*.test.tsx` (new)

---

Spec written; implementation requires explicit user approval via a later `/develop` request. STOP.