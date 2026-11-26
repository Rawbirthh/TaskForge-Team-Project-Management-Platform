---
description: Diagnose a bug or stuck implementation and recover safely
agent: build
---

Recovery target: $ARGUMENTS

Use the JSM `/recover` approach. Root `AGENTS.md` is the shared baseline. Load `feature-architecture` only if the design must be reconsidered, `feature-testing` only when detailed regression-test design is needed, and backend/database/frontend/realtime skills only for the affected area. Inspect the actual error/output, recent diff, relevant files, Prisma/database state only when safe, and test evidence. Categorize before changing files:
- **TARGETED FIX:** localized defect with a clear root cause; fix it precisely and add a regression test.
- **RESET THE APPROACH:** current patching path is polluted or repeatedly failing; summarize what has been tried and propose a clean bounded approach. Do not discard user changes or reset Git history without explicit approval.
- **RETHINK THE DESIGN:** original architecture/spec is wrong or a prerequisite is missing; explain the incorrect assumption and propose a revised design, using `/architect` for a new approval-gated spec if needed.

Do not make speculative patches. State evidence, category, smallest safe action, risks, and verification plan. Ask before destructive operations, dependency changes, database resets/migrations affecting shared data, or widening scope. The primary agent handles localized recovery by default. Delegate a bounded backend/frontend slice only when diagnosis is complex or the work is substantial and independently actionable. Delegate `test-engineer` only for complex regression design; otherwise write the regression test directly. A regression test remains expected for meaningful bug fixes. The primary agent integrates, checks the diff, runs final relevant checks, and reports exact outcomes.
