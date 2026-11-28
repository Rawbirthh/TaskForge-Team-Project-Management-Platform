# Feature 10 — Project CRUD and lifecycle management

Spec status: Draft for review. No application code, migration, or package change is produced by this spec.

## Overview alignment

- Feature number/title: Feature 10 — Project CRUD and lifecycle management.
- Dependencies: Feature 7, Feature 8, Feature 9.
  - Dependency status: **met**.
  - Evidence: Feature 7 committed as `74c0285 feat(workspace): add workspace creation, onboarding, and switching`; Feature 8 committed as `7e14d86 feat(workspace): add workspace memberships, invitations, roles, and permissions`; Feature 9 committed as `d44dc62 feat(workspace): add workspace settings and member administration` (working tree clean at spec time; `git log --oneline -5`). Specs exist at `docs/specs/feature-07-workspace-creation-onboarding-and-switching.md`, `docs/specs/feature-08-workspace-memberships-invitations-roles-and-permissions.md`, `docs/specs/feature-09-workspace-settings-and-member-administration.md`. `memory.md` records F7–F9 as specced, implemented, and verified. Repository evidence: `apps/api/src/services/membership.service.ts` (`getActiveMembership`), `apps/api/src/policies/workspace.policy.ts`, `apps/api/src/routes/workspaces.routes.ts`, `apps/api/prisma/schema.prisma` (Workspace/WorkspaceMembership models).
  - Note: F8's permission matrix marks "Create/manage projects (F10+)" as OWNER/ADMIN ✓, MEMBER/GUEST "per project". The "per project" part depends on project membership (Feature 11, out of scope here) and is explicitly refined below.
- In scope honored: create with name/key prefix/description/visibility/start date/target date/initial lifecycle; server-generated/validated key unique within the workspace; view and edit details; `ACTIVE`/`PAUSED`/`COMPLETED`/`ARCHIVED` lifecycle; paginated list with status/visibility filters and name/key search; creator and timestamps; archive/restore actions.
- Out of scope honored: project membership and visibility overrides (Feature 11), board workflows/statuses (Feature 13), tasks (Feature 14+), templates (Feature 38), analytics (Feature 12/34), Socket.IO (Feature 25+), permanent project deletion, and workspace deletion/export (Feature 40).
- Overview acceptance criteria → test matrix:
  - "Authorized users can create and manage projects within their workspace permissions" → T1, T2, T7, T8.
  - "Project lists never include projects from another workspace" → T9, T10.
  - "Private projects are not exposed to users without access" → T11, T12, T13.
  - "Archived projects cannot receive normal task mutations unless restored" → T14 (project-level mutation boundary; task mutations themselves are Feature 14 and out of scope).
  - "Project key/name uniqueness and lifecycle rules are enforced server-side" → T15, T16, T14, T17.
  - Overview test list (CRUD happy paths, duplicate key/name, workspace isolation, visibility, role access, lifecycle transitions, archive/restore, pagination/filtering) → T1–T18.
- Documented refinements of overview rules (must be implemented as written if approved):
  1. **Key generation/collision:** the client submits a `key` *prefix*; the server trims/uppercases/validates it and stores it as the project key (the client never supplies a final ID). Uniqueness scope is `(workspaceId, key)` enforced by a DB unique constraint; a collision returns `409 PROJECT_KEY_TAKEN` rather than silently suffixing. Rationale: overview says "Generate a unique project key within the workspace" and also lists `key/prefix` as a create input; a server-normalized, DB-unique prefix satisfies both. Task keys (`<PROJECT_KEY>-<n>`, Feature 14) are out of scope but constrain the format.
  2. **Name uniqueness scope:** `name` is unique within the workspace (`@@unique([workspaceId, name])`), with `409 PROJECT_NAME_TAKEN`. Rationale: overview acceptance criteria require "duplicate key/name" tests; the workspace is the tenant boundary.
  3. **PRIVATE visibility before Feature 11:** because project membership does not yet exist, a `PRIVATE` project is readable only by its creator and active workspace `OWNER`/`ADMIN`; all other active members receive `404`. This follows shared product rule 3 ("approved workspace administrators/owners") and does not silently grant admin access to unrelated private content beyond that approved class. Feature 11 will replace this with explicit project membership and a documented override policy. This resolves the apparent tension with Feature 9's "owners/admins may not silently gain access to private project content unless the project's approved access policy grants it": the overview's visibility definition is the grant.
  4. **Create/manage roles:** OWNER and ADMIN may create/manage any project in their workspace. MEMBER/GUEST creation and management remain unavailable until Feature 11 introduces project-level roles; they may only list/read `WORKSPACE`-visible projects. This is a temporary refinement of F8's "per project" cell.
  5. **"Owner/creator":** store only `createdByUserId` (server-derived from the session). Explicit project owner/role assignment belongs to Feature 11. Public DTO exposes creator as `{ id, displayName }` (no email).
  6. **Date semantics:** start/target dates are MySQL `DATE` columns and are transported as `YYYY-MM-DD` strings; they are never parsed through local-time `new Date(value)` or shifted by the user's time zone (shared rule 8).
  7. **No permanent delete:** archive is the only reversible "removal" action in this feature; no `DELETE` endpoint and no `deletedAt` column because the lifecycle is already modeled by `status`/`archivedAt` (AGENTS.md §6).

## Goal

Give authorized workspace users a secure, paginated vertical slice for creating, viewing, editing, and lifecycle-managing projects, with tenant isolation, visibility rules, and server-enforced unique keys — without introducing project members, tasks, or a board.

## Non-goals

- Project membership, private-project overrides, project-level roles (Feature 11).
- Project overview dashboard/analytics (Features 12, 34).
- Workflow statuses, task creation, board, drag-and-drop (Features 13–18).
- Realtime events, notifications, queues, file storage (Features 21–30).
- Permanent project deletion, export, workspace deletion (Feature 40).
- Key-availability lookup endpoint (uniqueness is reported by `409` on create).

## User flows

1. **Create:** an owner/admin opens `/app/projects/new`, enters name, key prefix, optional description/visibility/dates/initial status, submits, and lands on the new project's detail page.
2. **List/filter:** an active member opens `/app/projects`, searches by name/key, filters by status and visibility, and pages through bounded results; `PRIVATE` rows are absent for non-authorized roles.
3. **Edit:** an owner/admin opens a project detail page, edits allowed fields (key is immutable), and sees field-level or banner errors.
4. **Pause/complete/reopen:** an owner/admin changes the lifecycle state from the detail page.
5. **Archive/restore:** an owner/admin archives a project (sets `ARCHIVED`, `archivedAt`) and can later restore it to `ACTIVE`; archived projects reject normal edits with `409`.

## Acceptance criteria

1. OWNER/ADMIN can create, read, update, archive, and restore projects in a workspace where they hold an active membership.
2. All active members can list/read `WORKSPACE` projects; only creator + OWNER/ADMIN can read `PRIVATE` projects; non-members get `404`.
3. Project lists are paginated (max 50), filterable by status/visibility, searchable by name/key, and contain only rows from the authorized workspace and visibility scope.
4. `workspaceId` is derived from the URL and verified against the active membership; `createdByUserId` from `req.auth.userId`; submitted `workspaceId`, `id`, `createdByUserId`, `archivedAt`, and timestamps are ignored/rejected.
5. Keys and names are validated and unique per workspace; collisions produce `409` and no duplicate rows.
6. `ARCHIVED` projects reject all PATCH updates and re-archive attempts; only an authorized restore returns them to `ACTIVE`.
7. Dates round-trip as calendar dates without time-zone shifts; `targetDate >= startDate` when both are present.
8. Responses use explicit DTOs; no password hashes, tokens, session data, internal flags, or private storage keys are exposed.

## Assumptions

- Name length ≤ 120 chars, description ≤ 2000 chars, key prefix 2–16 uppercase alphanumeric chars starting with a letter, search query ≤ 100 chars. The overview does not give lengths, so these are conservative limits aligned with existing field caps.
- Archived projects remain readable by authorized users; read-only applies to mutations, not reads.
- Reactivation from `ARCHIVED` always returns to `ACTIVE` (not to the prior state); the prior state is not stored.
- Only the creator + workspace OWNER/ADMIN are authorized for `PRIVATE` projects until F11 (refinement 3).
- Default page size 20, max 50 — identical to `workspaceListQuerySchema`.
- `startDate`/`targetDate` are optional and independent; a target date without a start date is valid.

## Unresolved questions (non-blocking; do not implement without a decision)

- Whether MEMBER/GUEST should gain project creation through an explicitly approved F10 rule before F11 (current plan: no; defer to F11).
- Whether name uniqueness should be case-sensitive (MySQL's default collation is case-insensitive; the spec assumes case-insensitive collisions).
- Exact handling of task mutations on archived projects is Feature 14's concern; F10 only blocks project-record mutations.
- Whether future project keys need a reserved-word blocklist analogous to workspace slugs (not defined in the overview).

No blocking questions: the overview supplies enough product direction to design a safe slice with the documented refinements above.

## API endpoints (`/api/v1`)

All routes are nested under `/api/v1/workspaces/:workspaceId/projects` and require `requireAuth`. Every route re-resolves the actor's active membership via `getActiveMembership(workspaceId, userId)` (404 if absent), then verifies `projectId` belongs to that workspace (404 otherwise). Success envelope `{ data: ... }`; errors `{ error: { code, message, requestId, details? } }` from the centralized handler.

| Method | Path | Status | Response `data` | Notes |
|---|---|---|---|---|
| POST | `/workspaces/:workspaceId/projects` | 201 | `{ project: ProjectDto }` | OWNER/ADMIN only; 409 key/name collision. |
| GET | `/workspaces/:workspaceId/projects` | 200 | `{ items: ProjectDto[], page, limit, total }` | Bounded, filtered; private rows excluded by visibility rules. |
| GET | `/workspaces/:workspaceId/projects/:projectId` | 200 | `{ project: ProjectDto }` | 404 for wrong workspace or unauthorized private project. |
| PATCH | `/workspaces/:workspaceId/projects/:projectId` | 200 | `{ project: ProjectDto }` | OWNER/ADMIN only; 409 `PROJECT_ARCHIVED`; key immutable. |
| POST | `/workspaces/:workspaceId/projects/:projectId/archive` | 200 | `{ project: ProjectDto }` | OWNER/ADMIN only; idempotent-ish: 409 if already archived. |
| POST | `/workspaces/:workspaceId/projects/:projectId/restore` | 200 | `{ project: ProjectDto }` | OWNER/ADMIN only; 409 if not archived. |

`ProjectDto` (all fields always present; dates as `YYYY-MM-DD | null`, timestamps as ISO strings via JSON):

```ts
{
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string | null;
  visibility: 'WORKSPACE' | 'PRIVATE';
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  startDate: string | null;
  targetDate: string | null;
  createdBy: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}
```

Error codes (all sanitized; no stack/SQL details): `UNAUTHENTICATED` 401, `VALIDATION_ERROR` 400 with field `details`, `FORBIDDEN` 403, `WORKSPACE_NOT_FOUND` 404, `PROJECT_NOT_FOUND` 404, `PROJECT_KEY_TAKEN` 409, `PROJECT_NAME_TAKEN` 409, `PROJECT_ARCHIVED` 409, `INVALID_LIFECYCLE_TRANSITION` 409, `INTERNAL_SERVER_ERROR` 500. No dedicated rate limiter is introduced: project CRUD is not in the overview's abuse-prone set (auth/invitation/upload); the global `/api/v1` limiter applies.

## Zod schemas

New file `apps/api/src/schemas/project.schemas.ts`, used through the existing `validate({ params, query, body })` middleware in `apps/api/src/middleware/validate.ts`; controllers read only `getValidated<T>()` values.

```ts
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => { /* validate calendar date with Date.UTC only; never local time */ });

const projectKeySchema = z.string().trim().min(2).max(16)
  .transform((v) => v.toUpperCase())
  .pipe(z.string().regex(/^[A-Z][A-Z0-9]{1,15}$/));

export const projectIdParamSchema = z.object({
  workspaceId: z.string().min(1).max(64),
  projectId: z.string().min(1).max(64),
});

export const projectListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
  visibility: z.enum(['WORKSPACE', 'PRIVATE']).optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

export const createProjectSchema = z.object({
  key: projectKeySchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  visibility: z.enum(['WORKSPACE', 'PRIVATE']).default('WORKSPACE'),
  startDate: dateOnlySchema.optional(),
  targetDate: dateOnlySchema.optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED']).default('ACTIVE'),
}).refine((v) => !v.startDate || !v.targetDate || v.startDate <= v.targetDate,
  { path: ['targetDate'], message: 'Target date must not precede start date' });

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  visibility: z.enum(['WORKSPACE', 'PRIVATE']).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED']).optional(),
  startDate: dateOnlySchema.nullable().optional(),
  targetDate: dateOnlySchema.nullable().optional(),
}).refine((v) => Object.values(v).some((f) => f !== undefined), {
  message: 'At least one project field is required',
});
```

- Effective date order after merging a partial update with stored dates is validated in the service (Zod cannot see stored state); failures use `AppError(400, 'VALIDATION_ERROR', ..., [{ path: 'targetDate', message: ... }])`.
- `ARCHIVED` is not accepted in `createProjectSchema.status` or `updateProjectSchema.status`; use the dedicated archive/restore endpoints.
- No new environment variables or external payload schemas are required.

## Authentication and authorization

### Auth middleware

`requireAuth` (`apps/api/src/middleware/auth.ts`) verifies the bearer JWT and session on every request and sets `req.auth = { userId, sessionId }`. Controllers use `req.auth.userId` only; roles, memberships, and permissions are read from MySQL on every request (never from JWT claims).

### Resource-level authorization

1. `getActiveMembership(workspaceId, req.auth.userId)` (`apps/api/src/services/membership.service.ts`) — throws `404 WORKSPACE_NOT_FOUND` when the actor has no `ACTIVE` membership. This enforces tenant isolation and immediately reflects suspension/removal.
2. Extend `apps/api/src/policies/workspace.policy.ts` with pure helpers:
   - `canCreateProject(role)` → OWNER/ADMIN.
   - `canManageProject(role)` → OWNER/ADMIN (F10 scope; MEMBER/GUEST deferred to F11).
   - `canArchiveProject(role)` / `canRestoreProject(role)` → OWNER/ADMIN.
   - `canReadProject(role, project, actorUserId)` → `WORKSPACE` for any active member; `PRIVATE` only when `actorUserId === project.createdByUserId` or role is OWNER/ADMIN.
3. A service helper resolves `{ workspaceId, projectId }` with `where: { id: projectId, workspaceId }` and throws `404 PROJECT_NOT_FOUND` if absent — guessed IDs, swapped URL params, and replayed requests cannot cross tenant boundaries.
4. List `where` combines workspace scope and visibility: `(visibility = WORKSPACE) OR (actor is creator) OR (actor role in OWNER/ADMIN)`; the same `where` drives `count()` so private projects do not leak through totals.

### Permission matrix used by F10 (workspace-level, from F8 with documented refinements)

| Capability | OWNER | ADMIN | MEMBER | GUEST |
|---|---|---|---|---|
| List/read `WORKSPACE` projects | ✓ | ✓ | ✓ | ✓ |
| List/read `PRIVATE` projects | ✓ | ✓ | creator only | creator only |
| Create projects | ✓ | ✓ | ✗ (F11) | ✗ (F11) |
| Edit details / visibility / lifecycle | ✓ | ✓ | ✗ (F11) | ✗ (F11) |
| Archive / restore | ✓ | ✓ | ✗ (F11) | ✗ (F11) |

### Trusted server-derived fields

`workspaceId` from the validated URL param (authorization checked); `createdByUserId`, `createdAt`, `updatedAt`, `archivedAt`, `id`, `status` transitions from the server. The client supplies only name, key prefix, description, visibility, dates, and an allowed initial status. Unknown/extra keys are stripped by Zod and never spread into Prisma.

### Mass-assignment protection

Controllers map only parsed fields into explicit service inputs; services build explicit Prisma `data` objects. `workspaceId` is never accepted in a body. Archived-state guards are evaluated with conditional `updateMany` predicates server-side, not from client state.

## Prisma models, relations, constraints, indexes

Add to `apps/api/prisma/schema.prisma` (alongside existing Workspace/User models):

```prisma
enum ProjectVisibility {
  WORKSPACE
  PRIVATE

  @@map("project_visibility")
}

enum ProjectStatus {
  ACTIVE
  PAUSED
  COMPLETED
  ARCHIVED

  @@map("project_status")
}

model Project {
  id              String            @id @default(cuid())
  workspaceId     String            @map("workspace_id")
  key             String            @db.VarChar(16)
  name            String            @db.VarChar(120)
  description     String?           @db.VarChar(2000)
  visibility      ProjectVisibility @default(WORKSPACE)
  status          ProjectStatus     @default(ACTIVE)
  startDate       DateTime?         @map("start_date") @db.Date
  targetDate      DateTime?         @map("target_date") @db.Date
  createdByUserId String            @map("created_by_user_id")
  archivedAt      DateTime?         @map("archived_at")
  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  createdBy User      @relation(fields: [createdByUserId], references: [id], onDelete: Restrict)

  @@unique([workspaceId, key])
  @@unique([workspaceId, name])
  @@index([workspaceId, status, visibility])
  @@index([workspaceId, updatedAt, id])
  @@index([workspaceId, createdAt])
  @@map("projects")
}
```

Also add back-relations: `Workspace.projects Project[]` and `User.createdProjects Project[]`.

- **Relations/deletion:** workspace cascade matches existing workspace-owned tables (memberships, invitations). `createdBy` uses `Restrict` to preserve attribution; account-deletion flows (F6/F40) must handle authored projects explicitly rather than relying on cascade. F40 must revisit workspace cascade in favor of its controlled deletion/recovery plan.
- **Indexes:** `(workspaceId, status, visibility)` serves filtered lists; `(workspaceId, updatedAt, id)` serves stable default ordering; `(workspaceId, createdAt)` serves alternate sorting; both unique indexes enforce tenant-scoped key/name rules. Estimated MySQL unique index widths are within the InnoDB 3072-byte limit (`workspaceId` varchar(191) + name varchar(120) ≈ 1244 bytes). No speculative indexes beyond these observed access paths.
- **Migration:** new non-interactive migration (proposed name `20261129000000_project_crud_lifecycle/`) containing two enums, one table, and four indexes/unique keys — no destructive change. Generate SQL via `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script`, review, then apply with `db:deploy` + `db:migrate:test`, regenerate the client with `db:generate`, verify `db:status` / `db:status:test`. Never edit applied migrations.
- **Retention:** no `deletedAt`; `ARCHIVED` + `archivedAt` model the reversible lifecycle, matching AGENTS.md §6 and shared rule 10. Permanent deletion is explicitly out of scope.
- **Test cleanup:** existing integration cleanup deletes workspaces before users, so cascade removes projects before the `Restrict` user deletion runs; this ordering must be preserved.

## Query shape, selected fields, pagination, transaction/concurrency concerns, scale risks

- `projectSelect` includes exactly the DTO fields plus `createdBy: { select: { id: true, displayName: true } }`; no full records, no email/PII, no nested workspace payload. Explicit `toProjectDto()` maps dates to `YYYY-MM-DD`.
- List uses one `findMany({ where, select, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip, take: limit })` and one `count({ where })` in `Promise.all`; no per-row queries. `limit` ≤ 50, `page` ≥ 1. Search uses `OR: [{ name: { contains: q } }, { key: { contains: q } }]` under the same workspace/visibility `where`.
- Create is a single guarded `create` with DB unique constraints; `P2002` is translated to 409 `PROJECT_KEY_TAKEN`/`PROJECT_NAME_TAKEN` by inspecting the error meta target. No multi-write transaction is needed yet (activity/history belong to F22 and would be added inside a transaction then).
- Update/archive/restore use conditional `updateMany` predicates (`id`, `workspaceId`, plus required current `status`) to avoid read-then-write races: archive requires `status != ARCHIVED`, restore requires `status = ARCHIVED`, PATCH requires `status != ARCHIVED`. Zero affected rows triggers an existence re-check to distinguish `404` from `409 PROJECT_ARCHIVED` / `INVALID_LIFECYCLE_TRANSITION`. Clients receive the canonical row via a subsequent `findFirst`.
- No optimistic version field is added in F10 (no ordering/ranking). `updatedAt` is sufficient for future stale-check work in F18.
- Scale risks: unbounded lists (mitigated by `limit` cap + count), private-project leakage via count/search (mitigated by shared `where`), N+1 creator fetches (mitigated by nested select), and an extra indexed membership lookup per request (acceptable at portfolio scale; measured later in F41).

## Service/repository decision

- **Service — needed:** new `apps/api/src/services/project.service.ts`. It owns: membership/role/visibility checks, `ProjectDto` mapping with date serialization, effective date-order validation, collision translation, conditional lifecycle updates, and list query construction. Justified by reused logic across six endpoints and several nontrivial invariants; consistent with `workspace.service.ts` / `membership.service.ts`.
- **Policy — reuse/extend:** add small pure functions to the existing `apps/api/src/policies/workspace.policy.ts`; a separate `project.policy.ts` is not warranted yet (same role source, few functions).
- **Repository — not needed:** all Prisma queries are short, localized in one service, and have no complex joins/aggregations beyond `count`; a repository interface/implementation would add ceremony without a demonstrated benefit (AGENTS.md §3). Revisit only if F12/34 introduce heavy aggregations.
- **Controller — thin:** new `apps/api/src/controllers/project.controller.ts` parses validated inputs, calls the service, and shapes responses; registered via new `apps/api/src/routes/projects.routes.ts` mounted at `/workspaces/:workspaceId/projects` in `apps/api/src/routes/index.ts` (before or after `/workspaces/:workspaceId` — Express matches full paths, but declare the nested router ahead of the generic `GET /:workspaceId` for clarity).

## React routes/pages/components, API client, server-state/cache behavior, forms, shared types, loading/empty/error/accessibility states

- Routes in `apps/web/src/app/routes.tsx` under the existing `/app` protected `AppShell`: `projects` (list), `projects/new` (create), `projects/:projectId` (detail/edit). Enable the existing "Projects" nav item in `apps/web/src/components/layout/app-shell.tsx` (currently `soon: true`) to link to `/app/projects`.
- New pages: `ProjectsPage`, `ProjectCreatePage`, `ProjectDetailPage`; small components: `ProjectForm` (shared create/edit fields), `ProjectLifecycleActions` (pause/complete/archive/restore), `ProjectStatusBadge`/`ProjectVisibilityBadge` using existing `badgeVariants`. No new component system.
- API client `apps/web/src/features/projects/project-api.ts` with `listProjects`, `createProject`, `getProject`, `updateProject`, `archiveProject`, `restoreProject` using the existing `apiRequest` helper. Shared types in `apps/web/src/types/project.ts` mirroring `ProjectDto`, inputs, and the paginated response (dates as strings). No Zod in the browser is required; server errors are authoritative.
- Server state via TanStack Query: keys include the selected workspace ID (F8 convention): `['projects', workspaceId, { page, limit, status, visibility, q }]` and `['project', workspaceId, projectId]`. Mutations invalidate those keys on success; no duplicate local mirror of server data. Selected workspace remains navigation-only (localStorage), never authorization.
- Forms: accessible `<label>`/`htmlFor`, field-level messages from `ApiError.details` (`VALIDATION_ERROR` details have `{ path, message, code }`), pending/disabled submit with double-submit guard, success feedback via existing Sonner toasts, error banner with retry. Dates use `<input type="date">` with raw `YYYY-MM-DD` strings and are never timezone-converted in the browser. Key field is disabled on edit.
- States: skeleton/loading rows, empty state ("No projects yet" / "No projects match these filters"), error banner, 403 permission-denied panel, 404 not-found panel with back link. Lists are server-driven (page/limit/filters in URL query params where practical); no unbounded client filtering.
- Accessibility/responsive: semantic headings, table with column headers and accessible status/visibility badges, keyboard-operable actions with visible focus, card-style stacking at narrow widths.

## Socket.IO events/auth/rooms/after-commit behavior

Not needed in Feature 10. No socket events are introduced; realtime project/task updates are Feature 25/26 and must be designed after their auth/room foundation is approved. The REST response and committed MySQL row are the only source of truth here.

## S3 / BullMQ / Redis

Not needed. No file storage, background jobs, or queue infrastructure is introduced; the overview makes these feature-driven and F10 has no storage/async requirement.

## Test matrix

Backend integration tests (Supertest + real `taskforge_test` MariaDB, following `apps/api/tests/workspace-settings.test.ts`): file `apps/api/tests/projects.test.ts`.

| ID | Case | Expected |
|---|---|---|
| T1 | Owner creates project with all fields; read back | 201; row persisted; DTO field-exact; dates `YYYY-MM-DD`. |
| T2 | Admin creates project | 201. |
| T3 | Missing/invalid key, name, visibility, status, dates | 400 `VALIDATION_ERROR` with field `details`. |
| T4 | target date before start date (create; partial update) | 400 with `details.path === 'targetDate'`. |
| T5 | Date-only round-trip (no TZ shift) | Stored/read value equals input string. |
| T6 | Body tries to set `workspaceId`, `createdByUserId`, `archivedAt`, `status: ARCHIVED` | Extra fields ignored/rejected; server-derived values win; 400 for ARCHIVED. |
| T7 | MEMBER/GUEST create and PATCH/archive/restore | 403 `FORBIDDEN`. |
| T8 | Suspended/removed member calls create/list/detail | 404 `WORKSPACE_NOT_FOUND`. |
| T9 | User in workspace A guesses workspace B `workspaceId` | 404; no project data. |
| T10 | Owner of A requests `/workspaces/A/projects/:projectIdOfB` / swapped params / replay | 404 `PROJECT_NOT_FOUND`. |
| T11 | MEMBER/GUEST lists with `PRIVATE` rows present | `items` and `total` exclude private rows. |
| T12 | MEMBER/GUEST GETs private project (guessed ID) | 404 `PROJECT_NOT_FOUND` (no enumeration). |
| T13 | Creator MEMBER reads own private project; OWNER/ADMIN reads private project | 200. |
| T14 | Lifecycle transitions: ACTIVE→PAUSED/COMPLETED, PAUSED→ACTIVE, COMPLETED→ACTIVE, archive, restore | Expected 200; `archivedAt` set/cleared. |
| T15 | Duplicate key and duplicate name in same workspace; same values in another workspace | 409 `PROJECT_KEY_TAKEN` / `PROJECT_NAME_TAKEN`; cross-workspace 201. |
| T16 | Concurrency: two parallel creates with same key | Exactly one 201, one 409; one row. |
| T17 | Archived project PATCH and re-archive; restore then PATCH | 409 `PROJECT_ARCHIVED` / `INVALID_LIFECYCLE_TRANSITION`; restore 200; PATCH 200. |
| T18 | Pagination/filter/search: page/limit bounds, status+visibility+q combined, stable order, reset | Bounded to 50; correct items/total; invalid query 400. |
| T19 | Response DTO inspection | No `passwordHash`, tokens, session fields, or creator email. |
| T20 | Guest/unauthenticated on all endpoints | 401 `UNAUTHENTICATED`. |

Frontend tests (Vitest + Testing Library, jsdom; new `apps/web/tests/project-api.test.ts`, `projects-page.test.tsx`, `project-create-page.test.tsx`):

| ID | Case | Expected |
|---|---|---|
| F1 | List renders items, empty, loading, error states | Correct accessible output; retry action present. |
| F2 | Filters/search/pagination update query args and URL state | Server called with correct params; stale workspace cache not reused. |
| F3 | Create form shows field-level errors from API `details` | Error text rendered next to the field; no double submit while pending. |
| F4 | Archive/restore mutations invalidate list/detail queries | Refetched canonical data shown; success/error feedback. |
| F5 | Permission-aware rendering for MEMBER/GUEST | Create/manage actions hidden; read states still usable (server remains authoritative). |
| F6 | Dates render/submit as `YYYY-MM-DD` | No timezone shift in jsdom with non-UTC TZ. |

E2E: a critical Playwright journey (`create → list → edit → archive → restore`) may be added under `apps/web/e2e/`; it is not mandatory for this feature and is currently blocked by missing browser binaries (see blockers).

## Security/performance risks

- Tenant isolation: every route resolves membership + project-by-`(id, workspaceId)`; list `where` and `count` share the same predicate. Test T9/T10/T11.
- Private-project enumeration: uniform 404 for wrong workspace, wrong project, and unauthorized private project; no totals leakage. Tests T11/T12.
- Role enforcement immediate: `getActiveMembership` on every request; suspension/removal takes effect without a token refresh. Test T8.
- Mass assignment / trusted fields: explicit DTO mapping; no `req.body` spread; `workspaceId` only from URL. Test T6.
- Unique collisions/races: DB unique keys + conditional updates + `P2002` translation. Tests T15/T16/T17.
- Archived bypass: conditional `updateMany` guard closes read-then-write races. Test T17.
- Date/time-zone: `DATE` columns and string transport; no local-time parsing. Tests T4/T5/F6.
- Query bounds/N+1: limit ≤ 50, indexed filters/order, nested creator select, shared count predicate. Tests T18.
- Response leakage: explicit DTO excludes email/PII and internal fields. Test T19.
- Sensitive data in logs: existing Pino redaction remains; no token/password values are logged here.
- Rollout: additive-only migration; no existing data rewrite; clients built before the new endpoints simply do not show the Projects link yet. Regenerate Prisma client before typecheck/build. Workspace cascade deletion must be reviewed when F40 introduces controlled deletion.

## Implementation sequence

1. Prisma schema: enums, `Project` model, back-relations, unique keys/indexes; generate and review migration SQL.
2. Apply migration to dev/test DBs (`db:deploy`, `db:migrate:test`); regenerate client (`db:generate`); verify `db:status`, `db:status:test`.
3. Zod schemas in `apps/api/src/schemas/project.schemas.ts`.
4. Policy helpers in `apps/api/src/policies/workspace.policy.ts`.
5. Service `apps/api/src/services/project.service.ts` (authorization, DTO, date validation, queries, collision handling, lifecycle guards).
6. Controller `apps/api/src/controllers/project.controller.ts` + route `apps/api/src/routes/projects.routes.ts`; mount in `apps/api/src/routes/index.ts`.
7. Frontend types, API client, routes/pages/components, nav link, query invalidation.
8. Backend + frontend tests.
9. Run checks, inspect final diff, report; no commit/push without user approval.

## Actual verification commands (repository)

- `pnpm test` (API + web)
- `pnpm --filter @taskforge/api exec vitest run tests/projects.test.ts`
- `pnpm --filter @taskforge/web exec vitest run tests/project-api.test.ts tests/projects-page.test.tsx tests/project-create-page.test.tsx`
- `pnpm typecheck` (or `pnpm --filter @taskforge/api typecheck` / `pnpm --filter @taskforge/web typecheck`)
- `pnpm lint`, `pnpm format:check`, `pnpm build`
- `pnpm db:status`, `pnpm db:status:test`
- Migration: `pnpm --filter @taskforge/api exec prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script`, then `pnpm db:deploy`, `pnpm db:migrate:test`, `pnpm db:generate`
- Optional E2E: `pnpm test:e2e` (currently blocked locally by missing Playwright browser binaries)

## Known blockers/unverified items carried into implementation

- Playwright browser binaries are unavailable locally, so E2E cannot be run until installed.
- No test or code in this spec has been executed; all checks above are commands available in the repository, not results.

---

Spec written; implementation requires explicit user approval via a later `/develop` request. STOP.
