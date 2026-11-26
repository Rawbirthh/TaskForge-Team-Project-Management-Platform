---
name: feature-testing
description: Design meaningful Vitest, Supertest, Prisma/MySQL, Socket.IO, React, and Playwright tests for a feature or regression
compatibility: opencode
---

Inspect the actual package scripts, lockfile, test config, setup, and representative tests first. Follow installed compatible tools; do not install or migrate test infrastructure without approval.

Tests must prove observable behavior. For API behavior, prefer Supertest against the real Express app and cover success, invalid Zod input (params/query/body as applicable), authentication, resource authorization, persistence, error responses, pagination bounds, and data exposure. Use an isolated real MySQL test database for behavior that depends on MySQL/Prisma semantics; never use shared or production data. Use Vitest for isolated unit/component logic where it fits. Mock external providers at the boundary, not the application behavior under test.

Where a tenant boundary exists (for example workspaces and projects), cover cross-tenant access by guessed IDs, swapped URL parameters, and replayed requests; non-member and wrong-role access; and access after membership revocation, including socket subscriptions. For queued jobs and reminders, cover retries, duplicate delivery, and idempotency. For Prisma, cover constraints, transaction-related invariants, and safe data mapping when relevant. For Socket.IO, test authenticated connection, authorized rooms, event delivery after commit, payload validation, and unauthorized isolation. Use Playwright for critical end-to-end user journeys when configured. Include a regression test for bug fixes. Run targeted tests first; report exact commands, results, and blockers. Never claim skipped/unrun tests passed.
