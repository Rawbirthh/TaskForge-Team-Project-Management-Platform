# Project Overview — TaskForge Team Project Management Platform

> This document contains the product overview, business rules, architecture boundaries, and feature-by-feature backlog for TaskForge. Use it to identify **one feature at a time**. General engineering rules and implementation workflow live in `AGENTS.md` and `.opencode/commands/`; this file is the source of truth for product scope, feature dependencies, and acceptance criteria.
>
> TaskForge is a portfolio project. Build it to demonstrate sound SaaS architecture, secure multi-tenant data access, collaborative workflows, real-time updates, background processing, and a polished user experience. Do not introduce paid infrastructure or premature microservice complexity just to claim scalability.

## How to reference a feature in OpenCode

Features use simple, global numbers from **Feature 1** through **Feature 42**. Each feature has its own objective, dependencies, scope, rules, acceptance criteria, and test expectations. Features marked **deferred** are retained for future reference and are not part of the active portfolio implementation scope.

Architect one feature without coding:

```text
/architect Read project-overview.md. Architect Feature 1 only.
Inspect the existing repository, follow Feature 1 dependencies and acceptance criteria,
and write a specification under docs/specs/. Do not implement code yet or start
another feature. Wait for my approval.
```

After you review and approve the generated specification:

```text
/develop Implement only the approved specification for Feature 1.
Use project-overview.md as the product requirements source. Add or update the
relevant backend, frontend, and integration tests, run available checks, and
report results. Do not start Feature 2.
```

Replace `1` with the feature number you want. If dependencies are incomplete, the agent must report the blocker instead of silently implementing later features or bypassing prerequisites. A feature may be split into smaller implementation tasks in its approved specification, but it must remain within that feature's scope.

## Product summary

Build **TaskForge**, a web-based project and task management platform for small teams. Workspaces contain members and projects. Projects contain configurable workflows, tasks, boards, comments, files, and activity. Team members can assign work, track deadlines, collaborate in real time, and monitor delivery progress.

The product should feel like a focused, approachable mini Jira rather than an enterprise issue tracker. The first usable release should provide secure accounts, workspace collaboration, projects, tasks, a Kanban board, comments, and reliable authorization. Real-time collaboration, file uploads, notifications, reminders, activity history, search, and analytics follow in dependency order.

### Primary audiences

- **Workspace owners:** Create a workspace, manage its settings and membership, control access, and oversee projects.
- **Workspace administrators:** Manage members, invitations, settings, and workspace-level operations within their permissions.
- **Project managers:** Create projects, configure project workflows, invite or assign project participants, and organize delivery.
- **Contributors:** Create and update permitted tasks, collaborate through comments, and track assigned work.
- **Viewers / guests:** Read permitted project information without receiving write access. Access is limited to the projects explicitly shared with them where applicable.

### Recommended technical baseline

The user-selected stack is the product constraint. The following supporting choices are recommended defaults; Feature 1 must inspect the actual repository before installing or replacing anything.

| Area | Recommended baseline |
|---|---|
| Runtime / language | Node.js supported LTS release + TypeScript strict mode |
| Backend | Express, REST API under `/api/v1` |
| Frontend | React + TypeScript, Vite |
| Database | MySQL |
| ORM / migrations | Prisma ORM + Prisma Migrate |
| Real-time | Socket.IO (`socket.io` server and `socket.io-client`) |
| Server state | TanStack Query or the existing approved equivalent |
| Client routing | React Router or the existing approved equivalent |
| Drag and drop | A maintained accessible drag-and-drop library, such as `@dnd-kit`, after compatibility review |
| Validation | Zod for all backend runtime validation (params, query, body, and environment/config); optional shared schemas for frontend feedback |
| Background jobs | BullMQ + Redis when background processing is introduced |
| File storage | Private AWS S3 bucket using short-lived presigned URLs |
| UI | Tailwind CSS and accessible component primitives; use an existing UI system if already installed |
| Testing | Vitest, Supertest, a real MySQL test database, Socket.IO integration tests, and Playwright for critical end-to-end flows |
| Deployment | One Express API, one frontend build, MySQL, and Redis only when required by queued jobs or multi-instance real-time delivery |

Keep the architecture straightforward for a portfolio project: one Express API application, one React application, and a clear, easy-to-follow folder structure. Do not introduce a modular-monolith architecture, microservices, or enterprise-style layering. Use routes, controllers, middleware, Zod schemas, and services where they make the code clearer; add extra abstractions only when a concrete feature needs them. The API and MySQL database remain the source of truth; Socket.IO distributes events about committed changes and does not become a second data store.

## Shared product and business rules

These rules describe expected product behavior. They do not replace the project engineering standards in `AGENTS.md`. A feature specification may refine a rule, but it must document the decision before implementation.

### 1. Account and workspace model

- A user account is global and may belong to multiple workspaces.
- A workspace is the tenant boundary for its projects, tasks, members, invitations, files, activity, and notifications related to workspace work.
- A user must have an active workspace membership before accessing workspace-scoped resources.
- The currently selected workspace in the UI is a navigation preference only. It is never proof of authorization.
- A workspace creator becomes its initial owner through trusted server-side logic. The browser must never assign itself the owner role by submitting a role or membership ID.
- A workspace must always have at least one active owner. Ownership transfer must happen before the current last owner can leave, be removed, or be demoted.
- Deleting a user account, leaving a workspace, suspending membership, and deleting a workspace are separate operations with explicit effects on authored records and historical activity.

### 2. Default workspace roles

Start with a small, understandable role set. The approved permission matrix must be documented in the Feature 8 specification.

- `OWNER`: Full workspace control, including ownership transfer and workspace deletion.
- `ADMIN`: Manage workspace settings, members, invitations, and projects within the approved admin boundary. Cannot remove or demote the last owner or transfer ownership unless explicitly authorized by the owner.
- `MEMBER`: Participate in projects and perform normal work actions allowed by project access.
- `GUEST`: Restricted access to explicitly shared projects; read-only by default unless a project-level permission explicitly grants a narrow action.

Project access is separate from workspace membership. A workspace member does not automatically gain access to a private project. A workspace owner/admin may have an explicit administrative override for managing access, but that rule must be consistently enforced and tested.

### 3. Project visibility and lifecycle

- A project belongs to exactly one workspace.
- Initial visibility options: `WORKSPACE` (visible to eligible workspace members) and `PRIVATE` (visible only to explicitly authorized project members plus approved workspace administrators/owners).
- Project lifecycle: `ACTIVE`, `PAUSED`, `COMPLETED`, and `ARCHIVED`.
- Archived projects are read-only by default. Reopening an archived project requires an authorized action.
- A user cannot move a project to another workspace merely by changing a submitted `workspaceId`.
- Project deletion must not silently erase task comments, files, or activity. Prefer archive/retention behavior for normal user actions and define permanent deletion separately.

### 4. Task and workflow model

- Every task belongs to one project and one workspace. The workspace relationship must be consistent with the project's workspace.
- A task has a stable public key generated by the server, for example `TF-123`. Key generation must be concurrency-safe and unique within the agreed scope.
- A task has a title, description, workflow status, priority, creator/reporter, optional assignee, and timestamps. Due date, labels, estimates, parent task, and optional task relationships are added in their respective features.
- Default priorities: `LOW`, `MEDIUM`, `HIGH`, and `URGENT`. Store stable machine values separately from display labels.
- Workflow statuses are configurable per project. Each status has a stable key, display name, category (`TODO`, `IN_PROGRESS`, or `DONE`), display order, and optional visual color.
- A status change must be validated server-side and recorded in task history. Do not trust a client-provided status label or an arbitrary status ID without verifying that it belongs to the task's project.
- The board is a visual representation of task status. It must not introduce a separate task lifecycle or bypass the task update service.
- Moving a task between columns and reordering tasks within a column must be concurrency-aware. A stale drag operation must not silently overwrite a newer order or status.
- Completed tasks remain available in history and analytics according to the project's retention rules.

### 5. Multi-tenant security and authorization

- Every workspace-owned record must be accessed through a verified workspace membership and, where applicable, project membership.
- Derive the actor identity from the verified access token and its server-side session record. Never trust `userId`, `actorId`, `ownerId`, `workspaceId`, `projectId`, `assigneeId`, or role values merely because they appear in a request body.
- Every read, write, download, socket room join, and background job must enforce the same workspace and project access rules.
- Scope queries by the authorized tenant and resource relationship. Do not fetch a record globally by ID and assume its ID is unguessable.
- Enforce important relationships with database foreign keys, compound uniqueness constraints, and indexes. Where Prisma cannot express a required database constraint directly, use a reviewed SQL migration and document it.
- A user from Workspace A must never access records from Workspace B by guessing IDs, changing URL parameters, replaying requests, or subscribing to a socket room.
- When membership or project access is revoked, protected API access must stop immediately. Active socket subscriptions must also be removed or disconnected as appropriate.
- UI hiding is not authorization. Every protected action must be checked on the server.

### 6. Real-time collaboration rules

- Use Socket.IO for delivery of live events such as task updates, board changes, comments, activity notices, and notification counters.
- Use REST endpoints for authoritative reads and writes. A successful database commit is the source of truth; a socket event is a delivery signal.
- Authenticate socket connections using the same access-token verification and session-revocation check as the HTTP API.
- Authorize every room join on the server. Room names and IDs supplied by the browser are untrusted input.
- Use narrowly scoped rooms such as workspace, project, or user rooms only after verifying current access. Do not broadcast private data to a global room.
- Re-check permissions for sensitive socket actions and remove access after membership/project-role changes. A connection-level authentication check alone is not enough for long-lived sockets.
- Persist changes before emitting events. For important asynchronous side effects, use a transactional outbox or equivalent reliable dispatch mechanism so a committed change is not silently lost when the process stops.
- Events should contain only the minimum data needed to update the UI. Clients can refetch authoritative details from the API.
- Reconnection must recover missed state through API refetch or a bounded replay strategy. Do not assume every socket event is delivered exactly once.
- Redis Socket.IO adapter is a scale-out option when multiple backend instances are actually deployed; it is not required for the first local/MVP implementation.

### 7. Comments, files, and notifications

- Comments are attached to a task or another explicitly supported project resource. They are visible only to users with access to that resource.
- Mentions must resolve to an eligible member of the same workspace/project. Do not notify arbitrary external user IDs.
- Render user-authored text safely. If Markdown is supported, sanitize rendered output and do not execute arbitrary HTML.
- Files are private by default. Store metadata and opaque object keys in MySQL; store file bytes in S3. Never expose permanent public bucket URLs for private task attachments.
- Generate short-lived presigned URLs only after checking the current user's access. Validate actual uploaded object metadata before attaching it to a task/comment.
- Persist notifications before delivering them in real time or by email. A disconnected user must still see the notification later.
- Notification actions must be scoped to the notification recipient. Do not include private task descriptions or file contents in notification payloads unnecessarily.

### 8. Dates, time zones, and reminders

- Store timestamps in UTC using a consistent database strategy. Convert them for display using the user's configured IANA time zone.
- Store a user's preferred time zone explicitly; do not assume that every user is in the same location.
- Date-only deadlines must be treated as calendar dates, not accidentally shifted by UTC conversion.
- Reminder schedules must be idempotent. Retrying a worker job must not create duplicate notifications or send repeated reminders for the same schedule occurrence.
- A reminder is a notification, not an automatic task status change.

### 9. Activity and audit history

- Product activity (who changed a task, commented, moved a card, or uploaded a file) is distinct from security/admin audit logs.
- Activity records are append-only for ordinary users. Users must not be able to rewrite the actor or timestamp of an event.
- Record only the changed fields and safe metadata needed for history. Do not log passwords, session secrets, presigned URLs, file contents, or unnecessary personal data.
- A user may see only the activity associated with workspaces/projects they are currently authorized to access, subject to the approved historical-access policy.

### 10. Data lifecycle and privacy

- Archive is the normal reversible action for projects and work that should remain in reports/history.
- Permanent deletion must have explicit authorization, dependency handling, file cleanup, and audit behavior.
- Workspace deletion must define a confirmation/cooldown or recovery rule and clean up or schedule deletion of related S3 objects and queued jobs safely.
- Do not collect sensitive personal data that is not needed for project collaboration.
- Do not use task descriptions, comments, or activity content for AI training or external analysis.

## Shared engineering rules for this project

These rules supplement `AGENTS.md`. Keep them consistent with the approved repository conventions.

### Backend and API

- Use TypeScript strict mode. Avoid `any`; define request, response, domain, and event types explicitly.
- Use a simple, consistent backend folder structure for routes, controllers, middleware, Zod schemas, shared utilities, and Prisma access. Group related files when that improves navigation, but do not impose a modular-monolith structure or a complex domain architecture.
- Keep route handlers/controllers readable. Add a service when business logic is reused or substantial enough to separate; do not force every endpoint through multiple layers. Add repositories only for a demonstrated benefit, not as a default requirement.
- Use Zod as the required backend runtime-validation library for every API input boundary: route params, query strings, request bodies, and relevant configuration/environment values. TypeScript types alone do not validate runtime input. Return consistent, field-specific validation errors.
- Centralize authentication, authorization, validation, not-found, conflict, and unexpected-error handling. Never return stack traces or internal details to production clients.
- Use explicit API DTOs/serializers. Do not return raw Prisma models as public API contracts.
- Use transactions for multi-record changes that must succeed or fail together. Use optimistic concurrency/version checks for board ordering and other race-prone updates.
- Use database constraints for invariants where possible: foreign keys, unique constraints, not-null constraints, check constraints, and indexes.
- Avoid N+1 queries. Select only needed fields, include only needed relations, and inspect query behavior for board, dashboard, and analytics endpoints.
- Paginate list endpoints. Do not load every task, member, activity event, or notification into memory for a normal list or board request.
- Do not use unbounded `findMany` for user-facing lists. Board loading must use a bounded strategy such as per-column limits/cursors or an explicitly documented cap.
- Use consistent API response shapes and useful HTTP status codes. Distinguish validation errors, unauthorized access, forbidden access, missing records, and conflicting updates.
- Use idempotency for retried operations where duplicate work would be harmful (invitations, notifications, reminders, uploads, and background jobs as appropriate).
- Apply rate limits to authentication, invitation, upload-signing, and other abuse-prone endpoints.

### Database and Prisma

- MySQL is the selected relational database for this project. Keep MySQL as the database provider; do not switch databases as part of routine setup.
- Use Prisma Migrate for versioned schema changes. Do not use `db push` as the production migration strategy.
- Keep database foreign keys enabled unless a specific, documented technical reason requires otherwise.
- Define indexes for common access patterns, especially tenant-scoped queries such as `(workspaceId, projectId, statusId)`, `(workspaceId, createdAt)`, `(projectId, statusId, orderKey)`, and recipient/unread notification lookups where applicable.
- Add compound unique constraints for membership pairs, invitation tokens/emails where applicable, task keys, and other natural uniqueness rules.
- Include tenant IDs in unique/index strategy where it protects tenant-scoped operations. Ensure related records cannot accidentally cross workspaces.
- Use explicit select/include projections instead of returning entire records by default.
- Avoid destructive migrations without a reviewed data migration and rollback/recovery plan.

### Frontend

- Use typed API contracts and shared types/schemas where appropriate. Keep frontend types aligned with server DTOs without importing server-only implementation details into the browser.
- Treat server data as server state: use TanStack Query or the established query/cache layer. Do not mirror API data in component state without a clear reason.
- Use React state/hooks for local UI state only (open dialogs, selected tab, unsaved input, transient drag state, and similar concerns).
- Keep socket event handlers in a dedicated real-time layer/hooks and update or invalidate the relevant query cache. Avoid duplicating the whole application data model in a custom socket store.
- Make forms display server-side validation errors. Client validation is for user experience and never replaces backend validation.
- Include loading, empty, error, success, and permission-denied states for meaningful pages/actions.
- Use accessible controls, keyboard support, visible focus states, semantic headings, and responsive layouts.
- Keep navigation and actions permission-aware, but rely on server authorization for enforcement.

### Tests and quality gates

- Add or update tests for every important/critical behavior after implementation.
- Backend tests must cover authentication, tenant isolation, authorization, validation, lifecycle rules, and persistence behavior relevant to the feature.
- Frontend tests should cover critical user interactions, form states, optimistic update rollback, and permission-aware rendering where useful.
- Use integration tests against a real MySQL test database for Prisma behavior and constraints that cannot be proven with mocks alone.
- Test Socket.IO authentication, room authorization, event payloads, and forbidden cross-tenant subscriptions.
- Test workers for retries, idempotency, failure handling, and duplicate prevention.
- For each feature, run the relevant test suite plus TypeScript, lint, and build checks. Run the full suite before declaring a phase or release complete.
- Never claim a test, migration, build, or production configuration passed unless it was actually run and the result was checked.

## Roadmap and MVP boundary

Implement features in dependency order. The phases group related capabilities; they are not a request to implement a whole phase in one pass.

### Phase 0 — Foundation and account access

- **Feature 1 — Existing project foundation audit and verification**
- **Feature 2 — Backend API foundation and application architecture**
- **Feature 3 — MySQL and Prisma database foundation**
- **Feature 4 — React application foundation and shared UI system**
- **Feature 5 — Authentication and account lifecycle**
- **Feature 6 — User profile and account preferences**

### Phase 1 — Workspace and access management

- **Feature 7 — Workspace creation, onboarding, and switching**
- **Feature 8 — Workspace memberships, invitations, roles, and permissions**
- **Feature 9 — Workspace settings and member administration**

### Phase 2 — Project management

- **Feature 10 — Project CRUD and lifecycle management**
- **Feature 11 — Project membership and visibility controls**
- **Feature 12 — Project overview dashboard**

### Phase 3 — Tasks and Kanban workflow

- **Feature 13 — Project workflow statuses and board configuration**
- **Feature 14 — Task creation, editing, viewing, and archiving**
- **Feature 15 — Task assignment, priority, labels, dates, and estimates**
- **Feature 16 — Task list view, filters, sorting, and pagination**
- **Feature 17 — Kanban board view**
- **Feature 18 — Drag-and-drop task movement and ordering**
- **Feature 19 — Subtasks and parent-child task relationships**

### Phase 4 — Collaboration and work history

- **Feature 20 — Task comments and mentions**
- **Feature 21 — Private task attachments with AWS S3**
- **Feature 22 — Task activity history and change tracking**
- **Feature 23 — Project activity feed**
- **Feature 24 — Task watchers and followers**

### Phase 5 — Real-time collaboration and notifications

- **Feature 25 — Socket.IO authentication, authorization, and event foundation**
- **Feature 26 — Real-time project board and task updates**
- **Feature 27 — Real-time comments and collaborator presence**
- **Feature 28 — In-app notification center**
- **Feature 29 — Background jobs and reliable event processing**
- **Feature 30 — Due-date reminders and email notifications**

### Phase 6 — Productivity and insights

- **Feature 31 — Workspace-wide search and advanced filtering**
- **Feature 32 — Personal “My Work” dashboard**
- **Feature 33 — Saved views and reusable filters**
- **Feature 34 — Project analytics and team workload dashboard**

### Phase 7 — Advanced project planning

- **Feature 35 — Project milestones and release targets**
- **Feature 36 — Task dependencies and blocker relationships**
- **Feature 37 — Recurring tasks and schedules**
- **Feature 38 — Project templates and task checklists**

### Phase 8 — Production quality and portfolio completion

- **Feature 39 — Administrative audit log and security review tools**
- **Feature 40 — Workspace data export, archive, and deletion lifecycle**
- **Feature 41 — Production hardening, observability, and performance verification**
- **Feature 42 — CI/CD, deployment, demo environment, and project documentation**

### Deferred capabilities (not part of the active portfolio scope)

- Subscription billing, paid seats, and payment processing.
- Public marketplace, public project boards, and anonymous collaboration.
- Native mobile applications.
- Enterprise SSO/SAML, SCIM provisioning, and complex external identity integrations.
- Microservices, event streaming platforms, and multi-region deployment.
- AI task planning, AI-generated project plans, AI summaries, and automated people/workload scoring.
- Slack/Teams integrations, external webhooks, and a public developer API. These can be proposed later as separate features after the core platform is reliable.

### Recommended portfolio MVP

A convincing first public demo does not require all 42 features. Prioritize a complete vertical slice that a recruiter can understand and try:

1. Features 1–12: verified app foundation, secure accounts, workspace, membership/permissions, and projects.
2. Features 13–19: configurable task workflow, task management, list view, Kanban board, safe drag-and-drop, and subtasks.
3. Features 20–24: comments, private file attachments, activity history, project feed, and watchers.
4. Features 25–30: authorized real-time updates, persistent notifications, queue processing, and reminders.
5. Features 31–34: search, personal work dashboard, saved filters, and useful analytics.

Features 35–42 extend the product and strengthen its operational story. Complete core authorization, data integrity, tests, and deployment before adding advanced features merely to increase the feature count.

---

# Detailed feature specifications

## Feature 1 — Existing project foundation audit and verification

**Objective:** Audit and verify the repository so the roadmap is implemented against the actual installed Node.js, Express, React, TypeScript, Prisma, database, and testing setup rather than assumptions.

**Dependencies:** None.

**In scope:**

- Inspect the repository structure, package manager, Node.js version, TypeScript configuration, Express setup, React build tool, Prisma version, database provider, Socket.IO presence, styling/UI libraries, and test tools.
- Identify whether the repository is a monorepo or a single application and document its current frontend/backend boundaries.
- Verify install, environment-example safety, backend startup, frontend startup, database connectivity, migrations, tests, lint, type-check, and build commands where the environment permits.
- Identify existing conventions for routes, controllers, services, Prisma access, validation, API errors, frontend routing, query caching, and component organization.
- Recommend the smallest foundation corrections. Do not replace the architecture, install every recommended library, or upgrade unrelated dependencies without approval.
- Create or update `README.md` with verified setup instructions only. Mark any command or service that could not be verified.

**Out of scope:** Implementing authentication, workspace/project/task features, replacing the package manager, rewriting the app, or installing optional infrastructure without approval.

**Acceptance criteria:**

- The installed stack, key versions, repository structure, environment requirements, and test tools are documented.
- The backend and frontend can start using the documented instructions, or blockers are recorded precisely.
- Prisma can connect to the configured development database and migration status is understood.
- Existing tests, type checks, lint, and builds are run where possible; actual results are recorded.
- `.env.example` contains placeholders only and no secrets are committed.
- No broad refactor or dependency upgrade is performed without an approved specification.

**Tests/checks:** Run existing backend/frontend tests, TypeScript checks, lint, build, and a safe database connectivity/migration-status check. Do not run destructive reset commands against an existing database.

**Deliverables:** Stack audit, verified setup instructions, identified blockers, and a short verification report.

## Feature 2 — Backend API foundation and application architecture

**Objective:** Establish a reliable, typed Express API foundation for all future TaskForge backend features.

**Dependencies:** Feature 1.

**In scope:**

- Configure the Express application and HTTP server with TypeScript strict mode and clear development/production configuration.
- Establish a small, understandable Express API structure for routes, controllers, middleware, Zod schemas, shared utilities, and Prisma access. Add service files only for business logic that benefits from separation.
- Add `/api/v1` routing, request parsing limits, centralized error handling, not-found handling, and consistent success/error response conventions.
- Add request correlation IDs and structured server logging with safe redaction.
- Add health/readiness endpoints that distinguish application health from required dependency health where useful.
- Add environment-variable parsing and validation at startup. Fail fast with a safe configuration error when a required variable is missing or malformed.
- Configure CORS with an explicit allowlist, security headers, safe settings for the refresh-token cookie, and a documented local development origin strategy.
- Add Zod for backend runtime validation of request params, query strings, request bodies, and environment/configuration values. Create reusable schemas and a small validation middleware/helper so routes use a consistent pattern.
- Add rate-limit middleware infrastructure, but configure sensitive endpoint limits with the relevant features.
- Document the simple folder conventions and how to add an endpoint without introducing unnecessary abstractions or architecture layers.

**Out of scope:** Business endpoints, authentication implementation, database domain models, Socket.IO, background queues, and deployment infrastructure.

**Rules:** Keep the structure simple and consistent. Controllers should handle HTTP concerns while substantial business logic may live in a service. Use Zod for backend runtime validation; TypeScript types do not replace it. Never expose stack traces, SQL details, secrets, or internal error objects in production responses. Do not add mandatory repository, domain, or modular-monolith layers.

**Acceptance criteria:**

- The API starts with validated configuration and exposes the documented versioned route structure.
- Unknown routes return a consistent 404 response; validation and unexpected errors use centralized handling.
- Request IDs are available in logs and safe responses where appropriate.
- Logs do not contain passwords, cookies, authorization headers, tokens, or presigned URLs.
- CORS and security headers are configured explicitly rather than allowing every origin by default.
- Health/readiness endpoints return useful status without exposing secrets or sensitive infrastructure details.

**Tests:** Application startup/configuration validation, route not found, malformed body, validation failure, centralized error response, CORS allow/deny, request ID propagation, and log redaction checks where practical.

## Feature 3 — MySQL and Prisma database foundation

**Objective:** Set up MySQL and Prisma migrations as the reliable persistence foundation for TaskForge.

**Dependencies:** Feature 1, Feature 2.

**In scope:**

- Configure Prisma Client and MySQL using the repository's supported Prisma version.
- Establish migration, seed, local development, and test database workflows.
- Define shared conventions for IDs, timestamps, nullable fields, enums, indexes, foreign keys, and transaction usage.
- Add only the minimal initial schema required for health checks and the first account/workspace features; do not prebuild every future model.
- Add a safe Prisma client lifecycle strategy so the application does not create excess database connections during development reloads or shutdown.
- Create a repeatable seed strategy for development/test data without embedding production credentials or destructive resets.
- Document how schema changes are proposed, migrated, reviewed, and deployed.

**Out of scope:** Full domain schema, analytics tables, task records, S3 file metadata, or production data migration beyond the initial foundation.

**Rules:** Use versioned Prisma Migrate migrations. Keep foreign keys enabled. Add indexes for foreign-key and tenant-scoped access paths as tables are introduced. Never edit an already-applied migration to change production history. A migration that drops or rewrites data requires an explicit review and recovery plan.

**Acceptance criteria:**

- Prisma connects to MySQL through environment configuration parsed and validated with Zod.
- Migrations can create/update the development and test schemas reproducibly.
- Seed operations are safe to rerun and do not create uncontrolled duplicate records.
- Application shutdown handles the Prisma connection cleanly.
- Migration and test database commands are documented and do not target production by accident.

**Tests/checks:** Migration from an empty test database, seed repeatability, basic Prisma query, database connection failure handling, and migration status verification.

## Feature 4 — React application foundation and shared UI system

**Objective:** Establish the React + TypeScript frontend foundation with consistent routing, API access, server-state handling, and reusable UI primitives.

**Dependencies:** Feature 1, Feature 2.

**In scope:**

- Configure the existing React build setup and TypeScript strict mode.
- Establish page/layout/component organization and route-level loading/error boundaries.
- Create a typed API client with consistent error parsing, in-memory access-token handling with silent refresh through the refresh cookie, and request cancellation where needed.
- Configure TanStack Query or the existing approved server-state library for API data, caching, invalidation, and retries.
- Define shared design tokens, typography, spacing, responsive breakpoints, buttons, forms, dialogs, dropdowns, tables, badges, toasts, and skeletons using accessible primitives.
- Establish app shell patterns for public/authenticated pages and responsive navigation.
- Add a global error/empty/loading pattern and basic not-found page.
- Align the visual direction with a modern B2B SaaS dashboard: clear sidebar navigation, restrained neutral surfaces, readable data density, strong task status/priority cues, and responsive board layouts. Use the supplied Dribbble references as inspiration, not as assets to copy.

**Out of scope:** Real authentication pages, actual dashboards, workspace/project data, Kanban board, and detailed feature screens.

**Rules:** Keep API/server state in the query cache. Use React state for local UI concerns only. Do not create a large global store before a demonstrated need. Use semantic and keyboard-accessible components.

**Acceptance criteria:**

- Frontend builds and routes correctly using the documented API base configuration.
- Shared components have consistent visual behavior and accessible focus/keyboard states.
- API errors can be displayed in a consistent way without leaking server internals.
- Layout works at desktop, tablet, and mobile widths.
- TypeScript checks pass without introducing `any` to bypass type problems.

**Tests/checks:** Route rendering, shared component interactions, API client error handling, type check, lint, and production build.

## Feature 5 — Authentication and account lifecycle

**Objective:** Provide secure account registration, sign-in, sign-out, and recovery before protected workspace features are built.

**Dependencies:** Feature 2, Feature 3, Feature 4.

**In scope:**

- User registration with email and password.
- Login and logout.
- Password hashing using a current, well-maintained password hashing algorithm and safe parameters.
- JWT authentication: a short-lived access token (for example 10–15 minutes) sent in the `Authorization: Bearer` header and held only in browser memory, plus a rotating refresh token delivered in a Secure, HttpOnly, SameSite cookie scoped to the auth refresh path. Never store access or refresh tokens in `localStorage` or `sessionStorage`.
- A server-side session record per login in MySQL (via Prisma; Redis is not required), holding the refresh token only as a hash. The access token carries the session ID (`sid`) so a session can be revoked immediately.
- Refresh-token rotation with reuse detection (a reused refresh token revokes its whole session), and revocation on logout, password reset, and password change.
- Token verification: pin the signing algorithm; validate signature, `iss`, `aud`, and `exp`; load secrets/keys through the Zod-validated configuration. Tokens carry only identity and session claims (`sub`, `sid`), never roles, workspace membership, or permissions; those are always read from the database.
- Password reset flow using short-lived, single-use, securely stored reset tokens.
- Email verification flow or a documented local-development mail adapter.
- Authenticated API middleware and a `/me` endpoint that returns only safe account data.
- Frontend registration/login/logout/reset forms with server error states.
- Rate limiting for registration, login, and password reset.

**Out of scope:** Social login, SSO/SAML, MFA, workspace roles, invitations, and organization provisioning.

**Rules:** Never store plaintext passwords or reset tokens. Do not accept role, workspace membership, or privileged flags during public registration. A bearer-header access token is not CSRF-prone, but the cookie-authenticated refresh and logout endpoints need CSRF protection (origin check plus SameSite and a custom header or equivalent). Restrict login/reset responses to avoid account enumeration where practical. A logged-out or revoked session must no longer authorize API or socket access: the auth middleware checks the access token's `sid` against the session record on every request, so revocation does not wait for token expiry unless the approved spec documents a short, bounded exception.

**Acceptance criteria:**

- A user can register, verify email as configured, log in, and log out.
- Invalid credentials and invalid forms return safe, useful errors.
- Guests cannot call protected endpoints successfully.
- The refresh cookie uses the approved security settings in production, and access tokens are never persisted in browser storage.
- Password reset links are single-use and expire; password reset revokes prior sessions according to the approved policy.
- Public payloads cannot assign roles, workspaces, or privileged account fields.

**Tests:** Registration success/duplicate email, password hashing, login success/failure, guest denial, logout/session revocation, token tampering and expiry (bad signature, wrong algorithm, expired, wrong audience), refresh rotation and reuse detection, CSRF behavior on refresh/logout, password reset expiry/reuse, verification behavior, rate limits, and privilege-field tampering.

## Feature 6 — User profile and account preferences

**Objective:** Allow an authenticated user to manage the personal information and preferences required by TaskForge.

**Dependencies:** Feature 5.

**In scope:**

- View and update display name, avatar metadata where supported, and basic account profile information.
- Update preferred time zone and optional locale/display preferences.
- Change password with current-password verification.
- Resend email verification where applicable.
- Define account deactivation/deletion request behavior and its dependencies, without implementing full workspace data deletion in this feature.
- Show active session/security information from the session records.

**Out of scope:** Workspace profile/settings, workspace membership, public user profiles, and permanent account deletion workflow.

**Rules:** Users can update only their own profile. Do not allow profile updates to change account roles or memberships. Store valid IANA time-zone identifiers. Changing an email address requires verification before it becomes the login/contact email if that policy is adopted.

**Acceptance criteria:**

- A user can view and update permitted profile fields.
- Invalid time zones, email formats, and overlong fields are rejected server-side.
- A user cannot change another user's profile by changing an ID.
- Password change requires the correct current password and revokes sessions according to policy.
- Profile endpoints expose only fields needed by the current user.

**Tests:** Owner update, cross-user denial, validation, password change, email verification flow, invalid time zone, and safe response projection.

## Feature 7 — Workspace creation, onboarding, and switching

**Objective:** Let a user create a workspace and move between workspaces they are authorized to access.

**Dependencies:** Feature 5, Feature 6, Feature 3.

**In scope:**

- Create a workspace with a validated name and unique slug/identifier.
- Automatically create the creator's initial owner membership in the same database transaction.
- Provide an onboarding flow for the first workspace and a workspace switcher for users with multiple memberships.
- List only active workspaces belonging to the authenticated user.
- Persist the last selected workspace as a user preference or safe client navigation state.
- Provide an empty state when the user has no workspace membership.

**Out of scope:** Invitations, advanced member administration, project creation, workspace billing, and workspace deletion.

**Rules:** Workspace and owner membership creation must be atomic. The active workspace selection is not an authorization credential. All subsequent requests must verify membership independently. Prevent users from claiming an existing workspace by submitting its slug or ID.

**Acceptance criteria:**

- An authenticated user can create a workspace and becomes its initial owner.
- A failed membership creation rolls back the workspace creation.
- Users can switch only among their active memberships.
- Guessing another workspace ID or slug does not reveal workspace data.
- The UI handles users with zero, one, or multiple workspaces.

**Tests:** Workspace creation, atomic owner membership, duplicate slug, membership scoping, cross-workspace access denial, and switcher behavior.

## Feature 8 — Workspace memberships, invitations, roles, and permissions

**Objective:** Establish secure workspace collaboration with invitations and a clear role/permission model.

**Dependencies:** Feature 7, Feature 5.

**In scope:**

- Workspace membership records with active, invited, suspended, and removed states as appropriate.
- Default roles: owner, admin, member, and guest.
- A documented permission matrix for workspace settings, member management, invitations, project creation, and general workspace access.
- Invite an existing or new user by email using a high-entropy, single-use, expiring invitation token.
- Accept, decline, resend, revoke, and expire invitations.
- Prevent duplicate active memberships and handle invitations to existing members.
- Add server-side middleware/policies or an equivalent centralized authorization layer.
- Add a minimal member/invitation management UI appropriate to each role.

**Out of scope:** Project-specific access rules (Feature 11), public invitations, bulk invitations, SCIM, and enterprise directory sync.

**Rules:** Never trust a role submitted by the invitee. The inviter's permission determines the maximum role they can grant. Only an owner may grant or transfer owner privileges, using a separately protected flow. Invitation acceptance must re-check validity and workspace state. Prevent removal/demotion of the last owner. Revoked/suspended members immediately lose API and socket access.

**Acceptance criteria:**

- Authorized users can invite members and assign only roles they are allowed to grant.
- Invitation tokens expire, are single-use, and cannot be guessed from predictable IDs.
- Accepting an invitation creates exactly one membership.
- Unauthorized members cannot list, invite, remove, suspend, or change roles.
- The last owner cannot be removed or demoted without an ownership transfer.
- Role changes and membership revocation take effect on subsequent API requests and protected socket subscriptions.

**Tests:** Invitation lifecycle, duplicate/expired/replayed token, role escalation, last-owner protection, permission matrix, revoked-member access, and cross-workspace membership isolation.

## Feature 9 — Workspace settings and member administration

**Objective:** Provide a workspace settings area for authorized owners/admins to manage workspace identity and basic member operations.

**Dependencies:** Feature 8.

**In scope:**

- Update workspace name, slug under controlled validation, description, and optional logo.
- Paginated member directory with search/filter by role and membership status.
- Change eligible member roles, suspend/reactivate/remove members, and revoke pending invitations.
- Transfer ownership through explicit confirmation and re-authentication or other approved protection.
- Show workspace creation/update metadata and a clear settings navigation structure.

**Out of scope:** Billing, custom workspace domains, advanced audit reporting (Feature 39), and workspace deletion/data export (Feature 40).

**Rules:** Only permitted roles can change workspace settings. Role changes must be validated against the permission matrix. Workspace owners/admins may not silently gain access to private project content unless the project's approved access policy grants it. Member removal must revoke project memberships or make them ineffective immediately, without corrupting historical task authorship.

**Acceptance criteria:**

- Authorized owners/admins can update allowed workspace settings.
- Member lists are paginated and scoped to the active workspace.
- Unauthorized members cannot change roles or workspace settings.
- Ownership transfer cannot leave the workspace ownerless.
- Removing a member revokes their future workspace/project access while preserving safe historical attribution.

**Tests:** Settings authorization, member search/pagination, role change restrictions, suspension/removal, ownership transfer, and project-access revocation behavior.

## Feature 10 — Project CRUD and lifecycle management

**Objective:** Allow authorized workspace users to create, view, update, complete, pause, and archive projects.

**Dependencies:** Feature 7, Feature 8, Feature 9.

**In scope:**

- Create a project with name, key/prefix, description, visibility, start date, target date, and lifecycle state where appropriate.
- Generate a unique project key within the workspace or the approved product scope.
- View and edit project details.
- Support project lifecycle states: active, paused, completed, and archived.
- Provide a paginated project list with status/visibility filters and search by name/key.
- Show project owner/creator and timestamps.
- Provide project archive and restore actions.

**Out of scope:** Project members (Feature 11), board workflows, tasks, templates, and project analytics.

**Rules:** A project belongs to one workspace. Workspace membership and project permissions must be checked on every operation. Do not allow arbitrary workspace reassignment. Archived projects are read-only by default. Project keys must be generated and validated server-side and cannot collide within their uniqueness scope.

**Acceptance criteria:**

- Authorized users can create and manage projects within their workspace permissions.
- Project lists never include projects from another workspace.
- Private projects are not exposed to users without access.
- Archived projects cannot receive normal task mutations unless restored by an authorized user.
- Project key/name uniqueness and lifecycle rules are enforced server-side.

**Tests:** CRUD happy paths, duplicate key/name, workspace isolation, visibility, role access, lifecycle transitions, archive/restore, and pagination/filtering.

## Feature 11 — Project membership and visibility controls

**Objective:** Support workspace-visible and private projects with explicit project-level access.

**Dependencies:** Feature 8, Feature 10.

**In scope:**

- Project membership records for private project access and explicit project role overrides.
- Project-level roles such as manager, contributor, and viewer, mapped to a documented permission matrix.
- Add/remove project members and update eligible project roles.
- List project members and show the current user's access level.
- Define how workspace owner/admin overrides work and how guest access is restricted.
- Enforce membership changes throughout task, comment, attachment, activity, analytics, and socket access as those features are introduced.

**Out of scope:** External/anonymous project sharing, public read links, and cross-workspace collaboration.

**Rules:** Project members must also be active workspace members. A project membership cannot grant access to a different workspace. A private project must not be discoverable through list counts, search, analytics, or socket rooms by non-members. Removing project access immediately revokes protected resource access.

**Acceptance criteria:**

- Authorized managers can add/remove project members and assign allowed roles.
- Private project information is visible only to allowed members and approved workspace admins/owners.
- Workspace guests cannot access projects they were not explicitly granted.
- Project roles are enforced on API writes, not just hidden in the UI.
- Revoked members lose access to project pages, tasks, attachments, activity, and relevant socket rooms.

**Tests:** Role matrix, private/workspace visibility, cross-project access denial, non-member guessed-ID denial, guest boundaries, membership revocation, and admin override policy.

## Feature 12 — Project overview dashboard

**Objective:** Provide a useful landing page for each project before full analytics are introduced.

**Dependencies:** Feature 10, Feature 11.

**In scope:**

- Display project name, description, lifecycle, target dates, member summary, and primary actions allowed to the current user.
- Show task summary placeholders or counts when task features exist; do not fabricate metrics before the underlying data is available.
- Provide navigation to the board, task list, activity, and project settings as those features become available.
- Show recently updated project information when supported.
- Provide useful empty states for a new project.

**Out of scope:** Full analytics, workload charts, and task board implementation.

**Rules:** Dashboard queries must be scoped to the current project and workspace. Counts must use bounded database aggregation rather than loading all tasks. Do not leak private member details to viewers who should not see them.

**Acceptance criteria:**

- Authorized users see the correct project overview and actions.
- Private project access follows Feature 11.
- Dashboard metrics are derived from persisted data and have documented definitions.
- Empty projects show useful next steps without fake data.
- Query behavior avoids N+1 and unbounded collection loads.

**Tests:** Project scoping, role-aware actions, empty state, metric correctness when tasks exist, and query bounds.

## Feature 13 — Project workflow statuses and board configuration

**Objective:** Let authorized project managers configure the workflow columns used by the Kanban board.

**Dependencies:** Feature 10, Feature 11.

**In scope:**

- Seed a default workflow for a new project (for example Backlog, To Do, In Progress, Review, and Done).
- Create, rename, reorder, recolor, and deactivate workflow statuses within defined limits.
- Each status has a stable key, name, category, order, and active state.
- Support a small initial category set: TODO, IN_PROGRESS, DONE.
- Provide a configuration UI with preview of the board columns.
- Define how tasks are migrated when a status is renamed, deactivated, or removed.

**Out of scope:** Multiple independent boards per project, complex workflow automation, status transition rules engine, and custom per-role transition matrices.

**Rules:** A status belongs to one project and cannot be applied to a task from another project. Do not physically delete a status that still has tasks; require migration to another valid status or prevent deletion. Only authorized project managers can configure statuses. At least one usable TODO and one usable DONE status must remain, subject to the approved workflow model.

**Acceptance criteria:**

- New projects receive the documented default status set.
- Authorized managers can reorder and maintain statuses.
- Status order and category persist and render consistently.
- A status with active tasks cannot be deleted without a safe migration.
- Unauthorized users cannot alter a project's workflow.

**Tests:** Default workflow creation, CRUD/reorder, duplicate keys/names, minimum status protection, task migration, project scoping, and role denial.

## Feature 14 — Task creation, editing, viewing, and archiving

**Objective:** Provide the core task lifecycle within a project.

**Dependencies:** Feature 10, Feature 11, Feature 13.

**In scope:**

- Create a task with a title and description in an authorized project.
- Generate a stable task key server-side.
- View task detail and update editable fields.
- Set the task's initial workflow status from the project's active statuses.
- Archive and restore tasks with appropriate permissions.
- Show creator/reporter and created/updated timestamps.
- Add basic task detail UI with a clear summary and activity/collaboration areas reserved for later features.

**Out of scope:** Assignments, labels, dates, estimates (Feature 15), comments (Feature 20), attachments (Feature 21), and subtasks (Feature 19).

**Rules:** Derive the workspace from the authorized project. Do not trust submitted workspace, project, creator, reporter, or status values. Task keys must be concurrency-safe and unique. Archived tasks are read-only except for authorized restore/admin actions. Task content must be validated and safely rendered.

**Acceptance criteria:**

- Authorized users can create and update tasks in projects they can edit.
- A task cannot be created in a private project by a non-member.
- Generated task keys are unique under concurrent creation.
- Cross-project and cross-workspace ID tampering is rejected.
- Invalid status IDs, oversized content, and missing required fields are rejected.
- Archived tasks cannot be changed through normal update endpoints.

**Tests:** Create/read/update/archive/restore, task key concurrency/uniqueness, project authorization, status ownership, input validation, and forged IDs.

## Feature 15 — Task assignment, priority, labels, dates, and estimates

**Objective:** Add the task metadata required for teams to organize ownership, urgency, and deadlines.

**Dependencies:** Feature 14, Feature 8, Feature 11.

**In scope:**

- Assign or unassign a task to an eligible workspace/project member.
- Set priority using LOW, MEDIUM, HIGH, and URGENT.
- Add/remove project-scoped labels with stable IDs, names, and optional colors.
- Add start date and due date with explicit date-only semantics.
- Add optional estimate values using a single agreed unit (for example story points or hours) for the initial release.
- Display assignee, priority, labels, dates, and estimate consistently on task detail and list/board cards.
- Filter tasks by assignment, priority, label, and due-date state in later views using shared query logic.

**Out of scope:** Time tracking, workload capacity planning, billing of work hours, and complex custom fields.

**Rules:** Assignees must be active members with access to the task's project. Validate date ordering when both start and due dates are set. Do not allow a task to reference a label from another project/workspace. Define whether archived members remain visible as historical assignees. Do not compare estimates with actual hours unless time tracking is later implemented.

**Acceptance criteria:**

- Authorized users can set and update permitted task metadata.
- Invalid or unrelated assignee/label IDs are rejected.
- Start/due-date rules are validated consistently.
- Priority and label values are stable and filterable.
- Task cards and details show metadata without unnecessary API requests.

**Tests:** Assignment access, inactive/revoked member handling, priority validation, label scoping, date boundaries, estimate validation, and metadata serialization.

## Feature 16 — Task list view, filters, sorting, and pagination

**Objective:** Provide a scalable table/list view for finding and managing tasks in a project.

**Dependencies:** Feature 14, Feature 15.

**In scope:**

- Paginated list of project tasks.
- Search by task key and title, with description search only if query performance is acceptable.
- Filters for status, assignee, priority, label, due date, and archived state as appropriate.
- Sorting by created date, updated date, due date, priority, and task key.
- Preserve filters/sort/page state in URL query parameters where practical.
- Support useful bulk-safe selection UI only if bulk actions are separately scoped; do not silently implement bulk mutation.

**Out of scope:** Global search (Feature 31), saved views (Feature 33), and large-scale export.

**Rules:** Enforce project/workspace access before applying user filters. Use allowlisted sort fields/directions. Paginate using a bounded strategy; choose cursor or offset pagination based on the required UI and document the tradeoff. Do not load all project tasks into the browser.

**Acceptance criteria:**

- Users see only tasks from the authorized project.
- Search, filters, and sorting can be combined and reset.
- Pagination is stable and does not expose unbounded data.
- URL state can be refreshed/shared within the same authorized project where supported.
- Empty and no-match results are clear.

**Tests:** Tenant/project scoping, filter combinations, sort allowlist, pagination boundaries, invalid query parameters, and query performance for representative fixtures.

## Feature 17 — Kanban board view

**Objective:** Display project tasks in columns grouped by the project's configured workflow statuses.

**Dependencies:** Feature 13, Feature 14, Feature 15.

**In scope:**

- Render active workflow statuses as columns in configured order.
- Load a bounded set of tasks per column and display task key, title, priority, assignee, labels, and due date where available.
- Provide status counts and clear empty-column states.
- Open task detail from a board card.
- Provide filters for assignee, priority, label, and other approved criteria.
- Support a loading/error/empty state and responsive board scrolling.
- Provide an accessible non-drag way to change task status.

**Out of scope:** Drag-and-drop implementation (Feature 18), real-time updates (Feature 26), and advanced analytics.

**Rules:** Board data must be scoped to the current project and bounded by per-column limits/cursors. Do not send every task in a large project in one response. The board uses the same workflow/status source of truth as the task list. A user must not see private task data from another project.

**Acceptance criteria:**

- Authorized users see the project's columns and only permitted task cards.
- Each card shows accurate summary data without N+1 requests.
- Board filters and counts agree with server-side results.
- Users can change status through an accessible action menu if they cannot drag.
- Large columns have a documented load-more or bounded loading strategy.

**Tests:** Board authorization, status grouping, card data, filters/counts, pagination/bounds, non-member denial, and keyboard status action.

## Feature 18 — Drag-and-drop task movement and ordering

**Objective:** Allow authorized users to move task cards between columns and reorder them within a column.

**Dependencies:** Feature 17, Feature 13, Feature 14.

**In scope:**

- Add accessible drag-and-drop interactions to the Kanban board using a maintained library.
- Support moving a task to another status and reordering tasks within a status.
- Use optimistic UI updates with rollback/refetch on API failure.
- Persist order using a documented ordering strategy such as fractional/rank keys or controlled integer positions.
- Support concurrent updates using version numbers, updated timestamps, or another optimistic concurrency mechanism.
- Provide success/conflict feedback when another user has changed the task/order.

**Out of scope:** Cross-project drag-and-drop, bulk movement, complex automation, and offline-first editing.

**Rules:** The server revalidates project access, status ownership, and allowed movement. Do not accept a client-supplied arbitrary rank without checking the neighboring/order context. A stale update must return a conflict or trigger a safe refresh, not overwrite newer work. Drag-and-drop must not be the only way to change status.

**Acceptance criteria:**

- Authorized users can move and reorder task cards.
- Board order persists after refresh and across sessions.
- Concurrent or stale moves are handled without silent data corruption.
- Failed optimistic updates restore the correct server state.
- Keyboard and accessible alternative actions remain available.

**Tests:** Same-column reorder, cross-column move, permission denial, invalid status, stale version conflict, duplicate/out-of-range order handling, optimistic rollback, and concurrent move integration test.

## Feature 19 — Subtasks and parent-child task relationships

**Objective:** Let teams break a larger task into smaller actionable subtasks.

**Dependencies:** Feature 14, Feature 11.

**In scope:**

- Add a parent task reference within the same project.
- Create, view, edit, complete, and archive subtasks.
- Show subtask progress on the parent task.
- Display parent/child navigation and a bounded subtask list.
- Define initial hierarchy depth (recommended: one parent level) and enforce it.

**Out of scope:** Epic/story hierarchy, arbitrary nested levels, task dependencies (Feature 36), and automatic roll-up of parent status unless separately approved.

**Rules:** Parent and child must belong to the same project/workspace. Prevent self-parenting and cycles. Parent archival/deletion behavior must be explicit. Progress counts must exclude archived subtasks or follow another documented rule.

**Acceptance criteria:**

- Authorized users can create and manage subtasks.
- Cross-project parent IDs and cycles are rejected.
- Parent task shows an accurate completed/total subtask count.
- Archiving a parent does not silently delete children or break historical references.

**Tests:** Parent/child CRUD, same-project enforcement, cycle prevention, hierarchy depth, permissions, progress counts, and archive behavior.

## Feature 20 — Task comments and mentions

**Objective:** Enable project participants to discuss work in context through persistent task comments and member mentions.

**Dependencies:** Feature 14, Feature 11, Feature 8.

**In scope:**

- Create, list, and edit comments on a task.
- Record author and timestamps; preserve edit metadata.
- Support plain text or a deliberately limited Markdown subset.
- Mention eligible users using a validated member reference and readable display name.
- Provide paginated comment history and load-more behavior.
- Support comment deletion according to a documented policy (soft-delete with tombstone or restricted delete).
- Show comment counts/previews on task detail where useful.

**Out of scope:** Real-time delivery (Feature 27), file attachments (Feature 21), reactions, threaded replies, and external chat.

**Rules:** A comment is visible only to users who can access the task. Validate mentions against the same workspace/project. Never trust a mentioned user ID from the client. Escape/sanitize rendered content and do not render arbitrary HTML. Preserve safe history when a comment is edited or deleted.

**Acceptance criteria:**

- Authorized project users can create and view comments.
- Users cannot read or comment on tasks outside their access scope.
- Mentioned users are eligible project participants.
- Comments persist after refresh and paginate correctly.
- Malicious HTML/script input is displayed safely.
- Edit/delete behavior follows the approved history policy.

**Tests:** Comment CRUD, cross-project/tenant denial, mention validation, empty/oversized content, XSS payload handling, pagination, and author/edit permission rules.

## Feature 21 — Private task attachments with AWS S3

**Objective:** Allow authorized users to attach and retrieve files securely through private object storage.

**Dependencies:** Feature 14, Feature 11, Feature 2.

**In scope:**

- Configure a private S3 bucket and a storage service abstraction for file operations.
- Request a short-lived presigned upload URL after authorization and metadata validation.
- Confirm upload completion by checking the expected object key and actual object metadata.
- Store attachment metadata in MySQL: workspace/project/task, uploader, original display name, opaque object key, MIME type, size, checksum if available, and timestamps.
- Generate short-lived download URLs only after a fresh authorization check.
- List, remove, and download task attachments.
- Define a safe initial allowed MIME/extension list and maximum file size.
- Clean up abandoned pending uploads and deleted attachment objects through a controlled process.

**Out of scope:** Public file sharing, arbitrary file hosting, virus-scanning service integration unless separately approved, previews for every file format, and files attached to unrelated entities.

**Rules:** The bucket must not be public. Never trust the original filename, MIME type, size, or object key supplied by the browser. Use server-generated opaque object keys. A presigned URL grants temporary access and must not be persisted in the database or emitted in activity/notification events. Verify upload completion and actual object metadata before marking an attachment active. Removing a task attachment must not delete a shared object referenced elsewhere.

**Acceptance criteria:**

- Authorized users can upload, list, download, and remove permitted attachments.
- Users without task access cannot obtain upload/download URLs.
- Invalid type/size or mismatched upload metadata is rejected.
- Objects are private and use short-lived signed access.
- Database metadata and S3 object lifecycle remain consistent after failures/retries.

**Tests:** Authorization, upload-signing validation, object metadata confirmation, MIME/size rejection, unauthorized download, key tampering, cleanup retry, and S3 failure handling using a test double/local S3-compatible service where appropriate.

## Feature 22 — Task activity history and change tracking

**Objective:** Provide an immutable history of important task changes for accountability and collaboration.

**Dependencies:** Feature 14, Feature 15, Feature 18.

**In scope:**

- Record task creation, title/description changes, status changes, assignee changes, priority changes, due-date changes, label changes, archive/restore, comment creation, and attachment events as those features become available.
- Store actor, task, workspace, project, event type, timestamp, and safe structured metadata describing the change.
- Render a chronological task activity timeline.
- Paginate older events.
- Use a shared activity-writing approach so feature modules do not invent incompatible event formats.

**Out of scope:** Security/admin audit log (Feature 39), external analytics events, and unrestricted raw request logging.

**Rules:** Activity actor and timestamp are assigned by the server. Ordinary users cannot edit or delete activity records. Do not store secrets, file contents, complete request payloads, or unnecessary personal data. Activity visibility follows current task/project authorization. Ensure an activity record is committed with the business change when the event is required for integrity.

**Acceptance criteria:**

- Important task changes produce accurate activity entries.
- Entries identify the actor and event time.
- History is paginated and authorized.
- Activity metadata contains only approved fields and is safe to render.
- Failed business transactions do not leave misleading activity events.

**Tests:** Event creation for supported changes, transaction behavior, actor/timestamp integrity, authorization, pagination, and sensitive-data redaction.

## Feature 23 — Project activity feed

**Objective:** Provide a project-level chronological feed of important team actions.

**Dependencies:** Feature 22, Feature 11.

**In scope:**

- Aggregate approved project activity such as task creation/movement, assignment, comments, attachments, and project membership changes.
- Provide paginated feed with actor, action summary, task reference, and timestamp.
- Support basic filters by activity type and actor if query cost is acceptable.
- Link activity items to the corresponding task/project page.

**Out of scope:** Workspace-wide audit reporting, security event details, and real-time feed delivery (Feature 27).

**Rules:** Reuse the shared activity model; do not create a second incompatible history system. Respect private project membership. Avoid exposing comment bodies or attachment names if the viewer lacks permission to see the underlying resource. Use bounded queries and indexes.

**Acceptance criteria:**

- Project members see only authorized project activity.
- Activity summaries accurately describe persisted events.
- Feed pagination and filters are stable.
- Removed members cannot retrieve restricted activity through direct API calls.

**Tests:** Project scoping, event ordering, filter correctness, redaction, pagination, and revoked-member access.

## Feature 24 — Task watchers and followers

**Objective:** Let users follow tasks they care about and receive relevant updates without being assigned to the task.

**Dependencies:** Feature 14, Feature 11, Feature 28.

**In scope:**

- Watch/unwatch a task.
- List current watchers for users who are permitted to see the list.
- Automatically watch a task's creator or assignee only if explicitly approved in the feature spec.
- Use watcher relationships as recipient inputs for notification features.
- Prevent duplicate watcher rows and support revoked membership cleanup/ineffective access.

**Out of scope:** Cross-workspace following, public follower lists, custom notification rules, and social features.

**Rules:** A watcher must have current access to the task's project. Do not allow users to follow hidden tasks by guessing IDs. Watcher state is unique per user/task. Removing project access must stop future access and notification eligibility even if a historical watcher row remains.

**Acceptance criteria:**

- Authorized users can watch and unwatch accessible tasks.
- Duplicate requests do not create duplicate rows.
- Users cannot watch or enumerate inaccessible tasks.
- Watcher lists and notification recipient calculation respect current project access.

**Tests:** Watch/unwatch, uniqueness, cross-project denial, revoked membership, recipient filtering, and notification integration contract.

## Feature 25 — Socket.IO authentication, authorization, and event foundation

**Objective:** Establish a secure Socket.IO gateway and a typed event contract for real-time TaskForge features.

**Dependencies:** Feature 5, Feature 8, Feature 11, Feature 2.

**In scope:**

- Attach Socket.IO to the existing HTTP server with an explicit CORS/origin policy.
- Authenticate socket handshakes with the access token (sent in the handshake `auth` payload, never in a URL query string), using the same verification and session-revocation check as the API.
- Define typed client-to-server and server-to-client event contracts, payload validation, versioning expectations, and error acknowledgements.
- Define narrowly scoped server-managed room naming conventions for user, workspace, and project contexts.
- Add authorized join/leave operations that validate current workspace/project membership.
- Handle disconnect, reconnect, access-token expiry and refresh, session revocation, membership revocation, and role changes.
- Add connection/error logging with safe redaction and basic connection limits.
- Document how to add an event without bypassing authorization.

**Out of scope:** Actual task/board event publishing (Feature 26), comment live updates (Feature 27), presence indicators, Redis adapter, and background queue delivery.

**Rules:** A socket ID is not an identity. Never trust client-supplied room names or treat room membership as proof of current authorization. Authorize every join on the server and re-check access for sensitive socket actions. Do not broadcast sensitive data to global rooms. Do not expose session cookies/tokens in logs.

**Acceptance criteria:**

- Authenticated users can connect using the approved JWT mechanism.
- Guests and revoked sessions cannot connect to protected real-time features.
- Users can join only rooms corresponding to currently authorized resources.
- Cross-workspace/project room subscriptions are denied.
- Event payload validation and error acknowledgements are consistent.
- Membership revocation removes protected socket access in a documented way.

**Tests:** Authenticated/unauthenticated handshake, invalid/expired/revoked token, allowed/denied room joins, cross-tenant subscription, revocation, event schema validation, and safe error handling.

## Feature 26 — Real-time project board and task updates

**Objective:** Keep authorized project boards synchronized when teammates create, update, move, assign, or archive tasks.

**Dependencies:** Feature 25, Feature 17, Feature 18, Feature 22.

**In scope:**

- Publish task-created, task-updated, task-moved, task-archived, and relevant assignment/priority/date changes to authorized project rooms.
- Update or invalidate the corresponding frontend query cache for connected project members.
- Show a subtle live-update indicator or conflict message when another user changes a task currently being edited.
- Reconcile client state through API refetch after reconnect or missed events.
- Ensure event publication occurs only after the database transaction commits.

**Out of scope:** Cross-project global broadcasting, real-time comments (Feature 27), offline editing, and multi-region event delivery.

**Rules:** The API/database remains authoritative. Event handlers must not be the only place where state changes are persisted. Events contain minimal identifiers and safe summary fields; clients refetch sensitive/large details. Avoid duplicate application of events and handle stale updates. Do not publish events for rolled-back transactions.

**Acceptance criteria:**

- A task change by one connected user appears for other authorized project members without a page refresh.
- Users outside the project do not receive the event.
- A disconnected user can recover current state through API refetch after reconnect.
- Failed transactions do not emit success events.
- Board ordering/status remains consistent after concurrent updates or a conflict refresh.

**Tests:** Event after commit, no event after rollback, authorized room delivery, cross-project exclusion, query cache update/invalidation, reconnect refetch, duplicate/stale event handling, and concurrent board update.

## Feature 27 — Real-time comments and collaborator presence

**Objective:** Deliver task comments live and show lightweight collaboration context for users viewing the same project/task.

**Dependencies:** Feature 25, Feature 20, Feature 11.

**In scope:**

- Broadcast a newly persisted comment to authorized task/project viewers.
- Update comment query cache or invalidate the relevant paginated comment query.
- Add lightweight active-viewer presence for a project or task if useful, with a short expiry/heartbeat approach.
- Clearly distinguish online/active presence from persisted membership or task assignment.
- Clean up presence on disconnect, expiry, or revoked access.

**Out of scope:** Audio/video calls, typing indicators, direct messages, group chat, durable presence history, and guaranteed delivery of every transient presence event.

**Rules:** Persist comments before broadcasting. Presence is ephemeral and must never be used as an authorization decision. Do not reveal private project or task names to users without access. Avoid broadcasting comment bodies outside the authorized project/task scope.

**Acceptance criteria:**

- A newly posted comment appears for connected authorized viewers without refresh.
- Comment history remains available through the API after reconnect.
- Presence is limited to authorized users and expires after disconnect/timeout.
- Revoked users no longer receive project/task events or presence details.

**Tests:** Comment event authorization, persist-before-broadcast, XSS-safe rendering, reconnect history, presence join/leave/expiry, and revoked-access handling.

## Feature 28 — In-app notification center

**Objective:** Provide a persistent notification center for mentions, task assignments, watched-task changes, invitations, and other approved events.

**Dependencies:** Feature 5, Feature 8, Feature 14, Feature 20, Feature 24.

**In scope:**

- Persist notifications with recipient, type, concise safe payload/reference, created time, read time, and optional deduplication key.
- Paginated notification list and unread count.
- Mark one notification as read and mark all as read.
- Deep-link to the related task/project/workspace only after navigation re-checks access.
- Create notifications for approved events such as assignment, mention, invitation, watched-task update, and access change.
- Deliver notification-created and unread-count-changed signals over Socket.IO when available.

**Out of scope:** Email delivery (Feature 30), mobile push, user-defined notification rules, and third-party integrations.

**Rules:** Persist notification records before emitting socket events. A user can read/update only their own notifications. Do not store private comment text or sensitive file URLs in a notification payload. Use idempotency/deduplication for retried event processing. Deleted/revoked resource access must be handled safely when a user opens an old notification.

**Acceptance criteria:**

- Selected events create notifications for the correct recipients.
- Notifications and unread counts persist across refresh/relogin.
- Users cannot read or mark another user's notifications.
- Realtime delivery updates the notification UI without replacing persistent retrieval.
- Duplicate event processing does not create duplicate notifications where a deduplication key is defined.

**Tests:** Recipient selection, own-notification scoping, read/unread behavior, pagination, socket delivery, deduplication, revoked resource deep-link, and sensitive payload exclusion.

## Feature 29 — Background jobs and reliable event processing

**Objective:** Add a controlled worker system for tasks that should not block normal API requests.

**Dependencies:** Feature 2, Feature 3, Feature 28.

**In scope:**

- Introduce Redis and BullMQ when queue-backed processing is required.
- Separate API process lifecycle from worker process lifecycle.
- Define typed job payloads, retry/backoff policy, timeouts, job IDs/idempotency keys, and failure visibility.
- Process reliable side effects such as notification fan-out, email delivery, reminder scheduling, and attachment cleanup.
- Add a transactional outbox or equivalent durable dispatch mechanism for important events that originate in database transactions.
- Add safe job status/failed-job inspection for development and operations.
- Document local Redis and worker startup requirements.

**Out of scope:** Distributed workflow engine, Kafka/RabbitMQ, general-purpose microservices, and user-accessible arbitrary job execution.

**Rules:** Queue payloads contain identifiers and minimal data, not secrets or large file contents. Workers must re-check current access/eligibility before sending sensitive notifications. Jobs must be idempotent. Retries must not duplicate notifications/emails or delete active files. Do not claim a task was completed merely because it was enqueued.

**Acceptance criteria:**

- API requests enqueue supported jobs without waiting for slow side effects.
- Worker processes jobs with bounded retries and observable failures.
- Duplicate job delivery does not create duplicate user-visible side effects.
- Important outbox events are eventually dispatched after a committed database change.
- Local instructions explain how to run Redis and workers independently.

**Tests:** Successful job, retry/backoff, permanent failure, duplicate delivery/idempotency, outbox recovery, worker shutdown, and side-effect failure handling.

## Feature 30 — Due-date reminders and email notifications

**Objective:** Remind users about upcoming or overdue tasks and send selected account/work notifications by email.

**Dependencies:** Feature 6, Feature 15, Feature 28, Feature 29.

**In scope:**

- Define default reminder timing, such as one day before and/or at the due date, with a limited initial policy.
- Schedule reminders when due dates are created/changed and cancel or supersede outdated scheduled work.
- Send notifications to assignees and optionally watchers according to the approved recipient rule.
- Add email templates for selected high-value notifications and account flows.
- Provide notification preferences for email categories and reminder behavior where practical.
- Display overdue/upcoming status in task UI using the user's time zone.

**Out of scope:** SMS, paid messaging channels, complex calendar scheduling, and arbitrary per-task recurring reminder rules.

**Rules:** Reminder processing must be idempotent and time-zone aware. Date-only due dates must not shift because of UTC conversion. Changing or removing a due date must invalidate obsolete reminders. Email failures must be retried safely and must not roll back the original task update. Respect user preferences and avoid leaking private task details to unverified email addresses beyond the approved policy.

**Acceptance criteria:**

- Eligible tasks generate reminders according to the documented schedule.
- Changed/removed deadlines do not send obsolete reminders.
- Users receive notifications only for workspaces/projects they can access.
- Email and in-app notification preferences are respected.
- A worker retry does not send duplicate reminders for the same occurrence.

**Tests:** Time-zone/date boundaries, upcoming/overdue schedule, due-date update/cancel, recipient scoping, preferences, duplicate job delivery, and email retry/failure.

## Feature 31 — Workspace-wide search and advanced filtering

**Objective:** Help authorized users find projects and tasks across the workspaces they can access.

**Dependencies:** Feature 10, Feature 11, Feature 14, Feature 15, Feature 16.

**In scope:**

- Search tasks by key/title and approved text fields across accessible projects.
- Search projects by name/key.
- Filter by project, status, assignee, priority, label, due date, and task state.
- Provide grouped search results with useful summaries and deep links.
- Apply server-side pagination and query limits.
- Use MySQL indexes/full-text capabilities where justified by query needs; begin with a measured, maintainable approach.

**Out of scope:** External search clusters, fuzzy AI search, semantic/vector search, and public search indexing.

**Rules:** Search must apply workspace and project permissions before returning results. Do not infer access from a workspace selector or submitted list of project IDs. Use allowlisted filters/sort fields and bounded query complexity. Private project names and task titles must not leak into counts or suggestions.

**Acceptance criteria:**

- Users can search only resources they are authorized to see.
- Search/filter combinations return accurate paginated results.
- Private project information is not revealed in counts, autocomplete, or snippets.
- Common searches are backed by appropriate indexes and have acceptable representative performance.

**Tests:** Cross-workspace isolation, private project exclusion, filters, pagination, empty query handling, SQL wildcard/input handling, and representative query performance.

## Feature 32 — Personal “My Work” dashboard

**Objective:** Give each user a focused view of tasks they own, created, or follow across accessible projects.

**Dependencies:** Feature 14, Feature 15, Feature 16, Feature 24.

**In scope:**

- Show tasks assigned to the current user.
- Provide sections/filters for due soon, overdue, recently updated, and completed work where useful.
- Include tasks the user watches as a separate filter or tab.
- Show project context and concise task metadata.
- Support pagination and links to task detail.
- Display an actionable empty state for users with no assigned tasks.

**Out of scope:** Full workload forecasting, timesheets, and personal productivity scoring.

**Rules:** Derive the user from the verified access token. Query only projects the user can currently access. Do not show tasks from revoked/private projects because the user remains their historical assignee. Date grouping must respect the user's time zone.

**Acceptance criteria:**

- Users see their assigned/watched tasks across accessible projects only.
- Due-soon and overdue grouping use the documented date semantics.
- Results paginate and update after task assignment/status changes.
- Empty states and filters are clear and responsive.

**Tests:** Current-user scoping, project access revocation, due date/time-zone boundaries, watched tasks, pagination, and query performance.

## Feature 33 — Saved views and reusable filters

**Objective:** Let users save frequently used task filters and reopen them without rebuilding the same query.

**Dependencies:** Feature 16, Feature 31.

**In scope:**

- Save a named view with validated filter/sort configuration.
- Edit, duplicate, reorder, and delete the user's saved views.
- Support personal views initially; shared workspace views may be included only with a clearly defined permission model.
- Re-run the saved filter against current data and current access rules.
- Display a view selector in task list/search interfaces.

**Out of scope:** Full custom report builder, arbitrary SQL filters, and cross-workspace sharing.

**Rules:** Saved view ownership is server-controlled. A saved view cannot grant access to a project or task. Validate filter fields/operators against an allowlist. When a user's access changes, the saved view returns only currently authorized records.

**Acceptance criteria:**

- Users can create, update, and delete their own saved views.
- Unsupported or malformed filter definitions are rejected.
- Reopening a view returns current results under current permissions.
- Another user cannot edit/delete a personal view by changing its ID.

**Tests:** Ownership, filter validation, CRUD, permission changes, pagination, and invalid saved criteria behavior.

## Feature 34 — Project analytics and team workload dashboard

**Objective:** Provide understandable delivery and workload metrics based on persisted project/task history.

**Dependencies:** Feature 14, Feature 15, Feature 22, Feature 23, Feature 11.

**In scope:**

- Project status distribution and task totals.
- Completed vs created tasks over a selected date range.
- Overdue task count and due-date trend.
- Workload by assignee using active task counts and estimates if estimates are enabled.
- Cycle-time/lead-time summary only if the history events required for a reliable definition exist.
- Date filters and a clear definition for each metric.
- Workspace-level summary only for users with the required permission and only across projects they are allowed to see.

**Out of scope:** Predictive analytics, employee productivity scoring, AI ranking, financial time tracking, and claims about individual performance based on task counts.

**Rules:** Document every metric formula and date window. Do not compare estimates with actual hours unless both are consistently defined. Do not expose another private project's metrics. Avoid recalculating expensive historical aggregates on every request when measurement shows a need for pre-aggregation or caching. Workload is an operational view, not a performance score for employees.

**Acceptance criteria:**

- Metrics match known fixture data and documented formulas.
- Filters use consistent time-zone/date boundaries.
- Private project data is excluded unless the viewer has access.
- Charts include labels, accessible summaries, empty states, and clear date ranges.
- Query performance is measured against representative data.

**Tests:** Known-fixture calculations, date-range boundaries, archived/completed task rules, access scoping, workload aggregation, missing-history behavior, and query performance.

## Feature 35 — Project milestones and release targets

**Objective:** Let project teams define major delivery checkpoints and associate tasks with them.

**Dependencies:** Feature 10, Feature 11, Feature 14, Feature 15.

**In scope:**

- Create, edit, complete, and archive project milestones with name, description, target date, and status.
- Associate tasks with a milestone within the same project.
- Show milestone progress using a documented task-completion formula.
- Display milestones on project overview and appropriate task details/filters.
- Support milestone date changes and overdue state.

**Out of scope:** Sprint planning, release automation, version control integration, and cross-project portfolio roadmaps.

**Rules:** A milestone belongs to one project; an associated task must belong to that same project. Do not automatically change task status when a milestone is completed. Define behavior when a milestone is archived while tasks remain associated.

**Acceptance criteria:**

- Authorized project managers can manage milestones.
- Tasks can be associated only with milestones in their project.
- Progress matches the documented rule and updates as task states change.
- Milestone archive does not orphan or corrupt tasks.

**Tests:** CRUD, project scoping, task association, progress calculations, date boundaries, and archive behavior.

## Feature 36 — Task dependencies and blocker relationships

**Objective:** Allow teams to record that one task blocks or depends on another task in the same project.

**Dependencies:** Feature 14, Feature 11, Feature 22.

**In scope:**

- Add dependency relationship types such as `BLOCKS` / `IS_BLOCKED_BY` with a single canonical stored relationship direction.
- List blockers and dependencies on task detail.
- Show a blocked indicator when an incomplete prerequisite exists.
- Prevent duplicate and self-referential dependency relationships.
- Provide a simple dependency graph/list view.

**Out of scope:** Automatic scheduling, critical path calculation, cross-project dependencies, automatic status transitions, and advanced Gantt chart.

**Rules:** Both tasks must belong to the same project/workspace. Prevent dependency cycles. Do not automatically move a blocked task or change its status. Dependency visibility follows access to the project. Define whether archived/completed prerequisites continue to satisfy a dependency.

**Acceptance criteria:**

- Authorized users can create/remove valid task dependencies.
- Self-links, duplicate links, cross-project links, and cycles are rejected.
- Blocked state is computed consistently from current dependency state.
- Dependency changes are reflected in task history.

**Tests:** Valid link, duplicate/self/cross-project rejection, cycle prevention, blocked calculation, archive/completion rules, and authorization.

## Feature 37 — Recurring tasks and schedules

**Objective:** Allow authorized users to define repeat schedules for routine work without creating duplicate tasks.

**Dependencies:** Feature 14, Feature 15, Feature 29, Feature 30.

**In scope:**

- Define recurring rules using a constrained schedule model (for example daily, weekly, monthly, with interval and end condition).
- Generate future task instances through a worker job.
- Allow a recurrence to be paused, edited, or ended.
- Define which task fields carry over and whether comments/attachments/watchers are copied (default: do not copy comments or attachments).
- Show which recurrence generated a task where appropriate.

**Out of scope:** Full natural-language scheduling, complex calendar RRULE support unless approved, and copying sensitive history between tasks.

**Rules:** Generation must be idempotent and time-zone aware. A worker retry must not create duplicate instances for a schedule occurrence. Changing a recurrence must not rewrite already generated task history. Generated tasks must follow the same project permissions and workflow rules as manually created tasks.

**Acceptance criteria:**

- Authorized users can define, pause, update, and end recurring schedules.
- Worker runs generate one task per due occurrence.
- Schedule changes do not duplicate or silently rewrite existing tasks.
- Generated tasks use valid project status/assignee/labels and handle deactivated values safely.

**Tests:** Daily/weekly/monthly schedule boundaries, time zones/daylight-saving transitions, duplicate job delivery, pause/end, edited recurrence, and invalid copied metadata.

## Feature 38 — Project templates and task checklists

**Objective:** Help teams start common projects quickly using reusable project structures and lightweight task checklists.

**Dependencies:** Feature 10, Feature 13, Feature 14, Feature 15, Feature 11.

**In scope:**

- Create a project template from an authorized project or from a blank template form.
- Store template name/description, default workflow statuses, and task/checklist definitions.
- Create a project from a template with a new project key and new task IDs.
- Support reusable task checklists with ordered items and completed state.
- Allow authorized users to edit/archive workspace templates.

**Out of scope:** Marketplace templates, public template sharing, cross-workspace template marketplace, and complex automation rules.

**Rules:** Template use must not clone historical comments, private attachments, activity, user sessions, or sensitive personal data. Template tasks must be created atomically or use a resumable creation strategy with clear rollback. Validate all referenced workflow/status/label data for the destination workspace/project. Only authorized workspace users can manage templates.

**Acceptance criteria:**

- Authorized users can create and manage workspace templates.
- Creating a project from a template produces new records with correct ownership and relationships.
- Private history and file objects are not copied accidentally.
- Checklist item updates persist and respect task access.
- Failed template creation does not leave a confusing partially-created project.

**Tests:** Template CRUD, permissions, task/status copy, data isolation, no private history copy, transaction/rollback behavior, and checklist updates.

## Feature 39 — Administrative audit log and security review tools

**Objective:** Record sensitive workspace/admin actions for accountability and provide a restricted view for authorized administrators.

**Dependencies:** Feature 8, Feature 9, Feature 22.

**In scope:**

- Record sensitive actions such as role changes, invitations, membership removal/suspension, ownership transfer, project access changes, workspace settings changes, and data export/deletion requests.
- Store actor, action, target, workspace, timestamp, request correlation ID, and safe metadata.
- Provide a paginated/searchable audit view for users with the designated permission.
- Add filters for date, actor, action type, and target where appropriate.
- Protect audit records from ordinary user modification/deletion.

**Out of scope:** Full SIEM integration, IP intelligence, external compliance certification, and unrestricted request-body logging.

**Rules:** Do not log passwords, cookies, access tokens, reset/invitation tokens, presigned URLs, file contents, or unnecessary personal data. Audit entries should be append-only for application users. Access to audit logs is itself a sensitive action and may be recorded. Workspace scoping applies to all queries.

**Acceptance criteria:**

- Selected sensitive operations create accurate audit events.
- Unauthorized users cannot view or alter audit logs.
- Audit records identify actor, target, time, and safe action metadata.
- Log search is paginated and scoped.
- Secrets and sensitive payloads are redacted.

**Tests:** Audit creation, failed operation behavior, authorization, immutability, filter/pagination, workspace scoping, and redaction.

## Feature 40 — Workspace data export, archive, and deletion lifecycle

**Objective:** Provide controlled workspace offboarding and data lifecycle operations without orphaning records or leaking tenant data.

**Dependencies:** Feature 8, Feature 9, Feature 21, Feature 29, Feature 39.

**In scope:**

- Allow an authorized owner to request a workspace export containing approved project/task/member/activity metadata.
- Generate exports asynchronously and provide a short-lived authorized download link.
- Define workspace archive behavior that prevents normal writes while preserving authorized read-only access.
- Define permanent workspace deletion request, confirmation, delay/recovery window if selected, and final cleanup strategy.
- Clean up S3 objects and queued work safely after deletion is approved.
- Define account departure behavior for users who belong to multiple workspaces.

**Out of scope:** Legal compliance claims, complex retention policy management, external backup platform, and automated billing cancellation.

**Rules:** A workspace export must include only the requesting owner's authorized workspace data. Do not create a publicly accessible export object. Deletion must not run from an ordinary unconfirmed request. Protect the last owner. Use an explicit retention/cleanup plan for S3, database records, activity, and pending jobs. Ensure retries are safe and idempotent.

**Acceptance criteria:**

- Only authorized owners can request export/archive/deletion operations.
- Export is generated asynchronously and downloadable only by an authorized user through expiring access.
- Archived workspaces reject ordinary writes.
- Deletion requires the approved confirmation/recovery steps and cleans up dependent files/jobs safely.
- A user's removal from one workspace does not affect their other workspaces.

**Tests:** Owner authorization, export scoping, expiry/unauthorized download, archive write denial, deletion confirmation, retry/idempotency, S3 cleanup, last-owner protection, and multi-workspace account behavior.

## Feature 41 — Production hardening, observability, and performance verification

**Objective:** Verify that TaskForge is secure, observable, and performant enough for a realistic public portfolio deployment.

**Dependencies:** Features 2–40 as applicable; prioritize completion of core features before this release gate.

**In scope:**

- Review authentication/session security, tenant isolation, role enforcement, CORS, CSRF, security headers, input validation, rate limits, upload handling, and socket authorization.
- Add structured logs, request IDs, safe error monitoring, health/readiness checks, and worker failure visibility.
- Measure representative API queries and frontend loading behavior for project lists, task boards, search, notifications, and analytics.
- Inspect indexes, N+1 risks, pagination bounds, queue concurrency, connection pools, and large file handling.
- Add basic load tests or repeatable performance checks for high-value endpoints.
- Add backup/restore notes for MySQL and required storage configuration.
- Review secrets, dependency vulnerabilities, environment separation, and production error output.

**Out of scope:** Claiming support for millions of concurrent users, multi-region active-active architecture, microservices migration, and formal third-party penetration certification.

**Rules:** Fix demonstrated issues before adding speculative infrastructure. Do not expose user content or secrets in logs/monitoring. Performance targets must be measurable and written down for the tested environment. Production-like tests must not use real user data or production secrets.

**Acceptance criteria:**

- High-risk authorization and tenant-isolation paths have integration tests.
- No known critical/high security issue is knowingly ignored without a documented reason and mitigation.
- Representative endpoints have measured response/query behavior and no obvious unbounded loading.
- Error monitoring and worker failures are observable without leaking secrets.
- Backup/restore and environment setup instructions are documented and tested to the extent the environment permits.

**Tests/checks:** Full backend/frontend test suites, type checks, lint, production builds, dependency audit, tenant-isolation test matrix, representative load/performance checks, and backup/restore drill where possible.

## Feature 42 — CI/CD, deployment, demo environment, and project documentation

**Objective:** Deliver a reproducible, publicly demonstrable TaskForge deployment with clear technical documentation suitable for a portfolio and resume.

**Dependencies:** Feature 1, Feature 2, Feature 3, Feature 4, Feature 41.

**In scope:**

- Create CI checks for install, lint, TypeScript, unit/integration tests, migrations validation where supported, and production builds.
- Configure deployment for the frontend, API, MySQL, and Redis/worker where used.
- Configure production environment variables and secrets through the hosting platform's secret manager, not repository files.
- Document database migration execution as a release step.
- Add safe demo seed data and demo accounts without using real personal data or predictable production admin credentials.
- Provide a polished landing/login experience, sample workspace/projects/tasks, and a walkthrough for recruiters.
- Complete README sections: product overview, feature highlights, architecture diagram, stack, local setup, environment variables, database/Prisma workflow, Socket.IO design, worker setup, tests, deployment, limitations, and screenshots/demo link.
- Prepare a concise portfolio case study explaining major engineering decisions and tradeoffs.

**Out of scope:** Paid billing, production SLA claims, enterprise customer onboarding, and unsupported infrastructure features.

**Rules:** CI must not print secrets. Production migrations must be reviewed and applied in a controlled order. Demo accounts must have intentionally limited permissions and non-sensitive sample data. Do not claim features are complete if they are only mocked or represented by static UI.

**Acceptance criteria:**

- Pull requests or main-branch changes run the documented quality checks.
- The deployed frontend, API, database, socket server, and worker processes operate together where applicable.
- Production secrets are configured outside source control.
- Demo data allows a recruiter to explore workspaces, projects, tasks, Kanban, collaboration, and analytics without exposing real personal data.
- README setup instructions work from a clean checkout or clearly identify external prerequisites.
- Portfolio materials accurately describe implemented features, architecture, tests, and known limitations.

**Tests/checks:** CI pipeline run, clean install/build, migration deploy rehearsal, deployed smoke tests, authentication and workspace isolation smoke tests, socket connection test, worker/queue test, and demo-account walkthrough.

---

## Later capabilities and product boundaries

- TaskForge is a portfolio-first product. Do not add payment processing, subscriptions, paid seats, or billing dependencies to the active roadmap.
- Keep the architecture as one straightforward Express API and one React application. Do not introduce a modular-monolith design, microservices, or unnecessary architecture layers for this portfolio project.
- Use REST + MySQL as the authoritative business-data path. Socket.IO is a live delivery layer, not the persistence layer.
- Do not assume Redis is required for every environment. Introduce it when BullMQ or multi-instance Socket.IO delivery is implemented.
- Do not add a public bucket for task files. All private file access must be authorized and time-limited.
- Do not add direct messages or public chat as part of task comments. Conversations remain attached to authorized work resources.
- Do not add AI-generated plans, task ranking, employee productivity scoring, or automated management decisions.
- Do not add time tracking, Gantt scheduling, sprint planning, epics, custom fields, or complex workflow automation without a separate approved feature proposal.
- A workspace member is not automatically a member of every private project. Project authorization must remain distinct from workspace membership.
- Revoked membership must take effect across the API, file downloads, background jobs, notifications, and Socket.IO rooms.
- A feature should deliver a working, verifiable vertical slice with tests rather than a large UI mockup without persistence or authorization.
- Prefer a documented limitation over an untested claim of scale, security, availability, or completeness.

## External technical references

Use official documentation when implementing or verifying library-specific behavior. Confirm the documentation version against the package versions installed in the repository.

- [Express production security best practices](https://expressjs.com/en/advanced/best-practice-security/)
- [Prisma transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- [Prisma indexes](https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes)
- [Socket.IO middleware](https://socket.io/docs/v4/middlewares/)
- [Socket.IO rooms](https://socket.io/docs/v4/rooms/)
- [Socket.IO Redis adapter](https://socket.io/docs/v4/redis-adapter/)
- [Amazon S3 presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
