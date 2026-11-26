---
name: feature-architecture
description: Inspect a feature's requirements and existing Node/Express/React/Prisma architecture to create an approval-gated specification
compatibility: opencode
---

Architect the requested feature from repository evidence. Read the root `AGENTS.md` if needed and inspect only nearby routes, controllers, middleware, Zod schemas, services/repositories, Prisma schema/migrations, tests, React pages/components, and existing specs. Check `git status` before editing docs.

For an overview feature, resolve it as `/architect` describes: read only the shared rules, that feature's section, and its dependencies' sections from `project-overview.md`, and check dependencies before designing. Create one focused `docs/specs/<feature-slug>.md` (`feature-<NN>-<slug>.md` for overview features) with an overview-alignment section (dependency status, scope boundaries, acceptance criteria mapped to tests, documented rule refinements), goal/non-goals, user flows, assumptions, acceptance criteria, API paths/methods/status/response contracts, Zod params/query/body schemas, authentication and resource authorization, Prisma models/relations/constraints/indexes/migration risks, query select/pagination strategy, Service/Repository decision and concrete reason, React routes/pages/components/server-state/UI states, Socket.IO/S3/queue needs if applicable, test matrix, risks, implementation order, and commands available in the actual repository.

Do not invent the domain, roles, auth method, schema, package choices, or API contracts. Label assumptions. Ask only questions that block safe design; otherwise state conservative assumptions. Do not write application code, migrations, package changes, or run destructive commands. Present the spec path and key decisions, then STOP and wait for explicit approval.
