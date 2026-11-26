---
description: Implement an approved feature with adaptive delegation, focused tests, and verified completion
agent: build
---

Implementation target: $ARGUMENTS

## 1. Approval and scope gate

1. Inspect `git status --short` and the requested/approved spec in `docs/specs/` (or the exact files named by the user). Never overwrite unrelated user changes.
2. If the request refers to an `/architect` spec, confirm the user explicitly approved that spec in the conversation. If approval is absent or the spec materially changed, stop and request approval.
   - For an overview feature, implement only that feature. Re-check its dependencies against `memory.md` and the repository; if one is incomplete, report the blocker instead of implementing later features or bypassing prerequisites. Read only the spec's overview-alignment section and the feature's acceptance criteria in `project-overview.md`; do not load the whole overview. Do not start the next feature.
3. Use the repository root `AGENTS.md` as the shared engineering baseline. Do not preload unrelated skills.
4. Read only relevant spec sections and inspect the closest existing implementation, tests, routes, schemas, Prisma models/migrations, API client, and UI patterns. Do not perform a broad repository audit unless required or no baseline exists.
5. Produce a concise implementation plan and identify dependencies, file ownership, interface contract, test scope, risks, and required approval points before editing.

## 2. Adaptive execution policy

The primary Build agent owns the feature from start to finish and implements directly by default. Delegate only when a specialist provides meaningful independent expertise or parallelism. Do not invoke an agent merely because a feature contains backend and frontend work.

- **Primary agent only (default):** small CRUD, localized bug fixes, simple one-layer changes, documentation, small UI changes, and tasks where delegation/context handoff costs more than doing the work.
- **Backend specialist:** delegate a bounded API/Prisma/auth/integration slice when domain logic, migrations/data integrity, complex queries, realtime/storage, or authorization is substantial.
- **Frontend specialist:** delegate a bounded React flow when screens, interactions, accessibility states, or frontend work are substantial and can proceed independently.
- **Backend + frontend in parallel:** only when both slices are substantial, the API contract can be defined first, and file ownership does not overlap. Specify endpoint methods, Zod input/output shape, auth/error contract, DTOs, shared types, and event contract before dispatch. Otherwise work sequentially.
- **Test specialist:** delegate only for complex edge-case matrices, security/authorization boundaries, transaction/concurrency tests, Socket.IO integration, or a substantial regression suite. For ordinary features/fixes, the primary agent writes and updates tests directly. The testing gate applies regardless of delegation.
- **Code reviewer:** invoke the independent read-only reviewer automatically only for critical/high-risk changes: authentication/session/token boundaries; resource authorization or privacy isolation; sensitive data exposure; destructive/data migrations; payment/security boundaries; file-upload access; concurrency/transaction integrity; critical realtime event authorization; or broad architecture refactors. Routine low-risk features do not need automatic review. The user can always run `/review`.

### Delegation discipline

- Keep delegation one level deep. The primary agent remains accountable for integration, tests, final diff, and truthful reporting.
- Give each specialist only the approved spec excerpt, bounded task, acceptance criteria, relevant paths, API/interface contract, constraints, and requested return format.
- Specialists should not rediscover the entire repository. Avoid overlapping edits; define file ownership and sequence when necessary.
- Parallelize only independent slices. Do not delegate sequential work that depends on unfinished output.
- Avoid repeated checks: specialists may run focused checks for their slice; the primary agent runs the integrated final verification once.
- If a specialist is unavailable or delegation is not justified, continue directly when safe and report the reason briefly.

## 3. Skill loading policy

Load skills just in time, only when they add detail beyond `AGENTS.md`:
- Express/API/auth/backend implementation: `node-backend`.
- Prisma schema, migrations, indexes, transactions, or query optimization: `prisma-mysql`.
- React/UI implementation: `react-frontend`; add `ui-consistency` only when modifying/establishing reusable patterns.
- Socket.IO changes: `socketio-realtime`.
- S3 uploads or BullMQ jobs: `storage-queues`.
- Meaningful test design or test-specialist delegation: `feature-testing`.
- Security-sensitive implementation/review: `security-review` for the relevant threat surface.

Do not load `feature-architecture` during normal development when an approved spec exists. A specialist loads only the skills relevant to its bounded assignment.

## 4. Implementation and quality gates

Follow the approved spec and root `AGENTS.md`. Keep scope focused; do not add packages, abstractions, services, repositories, or unrelated refactors without need and approval. A package explicitly listed in the approved spec counts as proposed; its install command still goes through the permission prompt.

For every meaningful feature or bug fix:
1. Implement backend Zod validation for all used params/query/body and relevant external payloads. Validate server-side even when frontend validation exists.
2. Enforce authentication middleware and resource-specific authorization where applicable. Map parsed/allowlisted fields explicitly into Prisma writes; return explicit response DTOs.
3. Keep list queries bounded/paginated; use selected fields, prevent N+1 behavior, and review indexes/transactions where relevant.
4. Add/update automated tests for changed behavior. Bug fixes should normally include regression tests. Cover happy path, validation, persistence, and applicable guest/auth/ownership/role/negative cases; do not force irrelevant cases.
5. Add Socket.IO authorization/after-commit integration tests, storage/job tests, or Playwright E2E only where the feature requires them and tooling is available.
6. Run the narrowest relevant tests first. Then run configured typecheck, lint, formatter, and production build when relevant.
7. Fix failures caused by the change and rerun affected checks. Do not weaken tests to obtain a green result.
8. Inspect `git diff` and `git status`; confirm no unrelated edits, secrets, generated artifacts, or accidental lockfile/dependency changes.
9. Review applicable auth, validation, DTO/data exposure, query, migration/index, transaction/concurrency, event ordering, upload, and UI-state risks.
10. For critical/high-risk changes, invoke `code-reviewer` after implementation and tests, then reconcile findings against repository evidence. Resolve critical findings and material warnings before reporting completion.

Do not claim a command passed unless it was actually run and its result inspected. If a check cannot run, report exact command and blocker. Do not install/update dependencies or edit lockfiles automatically just to make a check pass; ask first.

## 5. Completion report

Keep the report compact:
- Feature/spec and risk level; for overview features, each acceptance criterion marked met, unmet, or unverified.
- Execution mode: primary-only or specialists used, with a short reason.
- Main files/layers changed and why Services/Repositories were or were not added.
- Tests/checks run with exact commands and outcomes.
- Independent review: performed or not required, with reason.
- Manual verification status (never imply the agent performed the user's browser/device check).
- Remaining blockers/unverified items and next action.

Stop after reporting. Do not update `memory.md` automatically; the user controls the checkpoint with `/remember save`.
