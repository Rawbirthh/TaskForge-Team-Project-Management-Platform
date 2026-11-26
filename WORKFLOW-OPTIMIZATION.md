# Workflow Optimization Notes

## Chosen operating mode

- `/architect`: primary agent inspects only relevant code, writes a focused feature specification, and stops for explicit user approval.
- `/develop`: adaptive. The primary Build agent implements simple/localized work directly; specialists are used only for substantial independent slices, complex test design, or valuable expertise.
- Independent code review: automatic in `/develop` only for critical/high-risk changes. Explicit `/review` always requests an independent read-only review.
- Testing: the implementation/testing gate is mandatory for meaningful behavior and bug fixes. Test-specialist delegation is conditional; it does not change the gate.
- `/remember save` and `/remember restore`: preserved as the user's session boundary and project handoff.

## Why this should be faster

1. `/develop` does not preload backend, frontend, database, realtime, testing, and security skills for every feature.
2. The primary agent does not delegate just because a feature touches both API and UI.
3. Specialists receive bounded assignments with explicit acceptance criteria, contracts, and file ownership.
4. Backend/frontend work runs in parallel only when the API contract is clear and files do not overlap.
5. Specialists can run focused checks, while the primary agent performs one integrated final verification pass.
6. Memory save/restore checks only the active feature, relevant diffs, and evidence rather than rereading the entire repository.
6a. `project-overview.md` is large (about 100 KB). Agents load its shared rules plus one feature section and its dependencies, never the whole file; this keeps `/architect` and `/develop` context small.
7. Services and repositories are introduced only when actual complexity or reuse justifies them; no framework layers are created by default.

## Preserved safeguards

- Explicit spec approval before implementation.
- One feature at a time, with a dependency check against `memory.md` and the repository before architecting or implementing it.
- Root `AGENTS.md` engineering/security rules.
- Zod validation at backend trust boundaries; authentication middleware plus resource-level authorization; safe Prisma input mapping; explicit response DTOs; bounded/paginated reads; selected fields; relational constraints/indexes; transactions; after-commit Socket.IO events; typed React code.
- Automated tests for meaningful behavior, regression tests for bug fixes, targeted test execution, relevant type/lint/build checks, fix-and-rerun behavior, final diff inspection, and truthful reporting.
- Manual browser verification remains the user's check and is recorded as user-confirmed, not as an agent-run test.
- Durable project context and current feature handoff in `memory.md`.

## Important limitation

This configuration guides model behavior; it cannot guarantee a fixed number of model calls or make every provider/tool response fast. Actual speed depends on the selected model/provider, context size, repository size, tool latency, and task complexity. Validate the files against the installed OpenCode version with `opencode debug config` and `opencode agent list` after installation.
