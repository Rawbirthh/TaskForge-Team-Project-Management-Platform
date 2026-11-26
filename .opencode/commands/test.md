---
description: Create and run focused tests for a feature, bug fix, or current diff
agent: build
---

Test target: $ARGUMENTS

Use the root `AGENTS.md` testing gate. Load `feature-testing` only when detailed test-design guidance is useful. Inspect the configured test runner, scripts, test setup, and a small number of representative tests before writing anything.

The primary agent handles ordinary focused tests directly. Delegate to `test-engineer` only when behavior has a complex edge-case matrix, substantial authorization/security boundaries, transaction/concurrency behavior, Socket.IO integration, or a broad regression suite that benefits from independent design. Do not invoke a subagent just to write/run a few straightforward assertions.

If no target is supplied, use the current diff and latest feature. Write/update tests that would fail if observable behavior regressed. Cover success, Zod validation, persistence, and applicable authentication/resource authorization/ownership/negative cases. Include a regression test for bug fixes. For MySQL-dependent behavior, use the isolated real MySQL test database; for realtime behavior, cover authorized/unauthorized event delivery where relevant. Use Playwright for critical E2E journeys when configured and practical. Do not install dependencies without approval.

Run targeted tests first and broader relevant checks when practical. Fix implementation defects rather than weakening tests. Report exact commands, outcomes, and blockers. Never claim a check passed unless it was run.
