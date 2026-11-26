---
description: Create an evidence-based feature specification and stop for explicit user approval
---

Load the `feature-architecture` skill. Feature request: $ARGUMENTS

Act as the feature architect. Use root `AGENTS.md` as the engineering baseline and `project-overview.md` as the product source of truth.

**Feature resolution.** If the request names a feature (for example "Feature 8"), read only: the overview's shared business and engineering rules, that feature's `## Feature N —` section, and the sections of its listed dependencies. Never load the whole overview. Check each dependency against `memory.md` feature progress and repository evidence; if one is incomplete, report the blocker and stop instead of designing around it. Architect that one feature only and keep to its In scope / Out of scope. If `docs/architecture/baseline.md` exists, use it as repository evidence (for Feature 1 it is the main input; run `/audit` first if it is missing). Inspect only relevant existing routes, controllers, middleware, Zod schemas, services/repositories, Prisma schema/migrations, tests, React pages/components, and existing specs. Avoid broad scans and repeated inspection. Check `git status --short` before editing documentation and preserve unrelated changes.

Create or update one focused spec under `docs/specs/` named `feature-<NN>-<slug>.md` for overview features (NN zero-padded, for example `feature-08-workspace-memberships.md`) or a descriptive slug otherwise. Include:
- Overview alignment: feature number/title, dependency status with evidence, the in-scope and out-of-scope items being honored, overview acceptance criteria mapped to the test matrix, and every documented refinement of an overview rule (a refinement must be written down here before implementation).
- Goal, non-goals, user flows, acceptance criteria, assumptions, and unresolved questions.
- API endpoints under `/api/v1`: methods, request/response shapes, status codes, pagination, and errors.
- Zod params/query/body and external-payload schemas; environment changes if required.
- Authentication middleware, resource-level authorization/ownership rules, and trusted server-derived fields.
- Prisma models, relations, constraints, unique keys, indexes, MySQL migration and deletion/retention semantics.
- Query shape, selected fields, pagination, transaction/concurrency concerns, and scale risks.
- Service decision for long/reusable business logic; Repository/query-helper decision for long/complex/reused queries. Explain why each is or is not needed.
- React routes/pages/components, API client, server-state/cache behavior, forms, shared types, and loading/empty/error/accessibility states.
- Socket.IO events/auth/rooms/after-commit behavior, S3 or BullMQ/Redis only if needed.
- Test matrix for success, validation, persistence, applicable auth/authorization, edge cases, realtime, and critical E2E.
- Security/performance risks, rollout/compatibility notes, implementation sequence, and actual verification commands found in the repository.

Do not invent domain rules, roles, auth method, schema, dependencies, or deployment choices beyond what `project-overview.md` defines; label anything the overview leaves open as an assumption. Ask only questions that block a safe design; label non-blocking assumptions. Do not write application code, create migrations, install packages, or run destructive commands. Present the spec path and concise key decisions, then STOP. Implementation requires explicit user approval in a later `/develop` request.
