---
description: Run an independent, read-only review of current changes
agent: build
---

Review scope: $ARGUMENTS

This command is an explicit request for independent review, so invoke the configured read-only `code-reviewer` subagent. Load `security-review` and the backend/frontend/database/realtime skills only for portions of the diff that need them. Inspect `git status`, the exact diff, and relevant surrounding files; avoid a broad repository scan. If no argument is supplied, review the current uncommitted diff and related tests.

The reviewer must not edit files. Reconcile every finding against repository evidence rather than accepting findings blindly. Review plan alignment (approved spec and, for overview features, the feature's acceptance criteria and scope in `project-overview.md`); tenant isolation (session-derived actor, membership and project access checks, tenant-scoped queries, cross-tenant access, revoked access); route/middleware authentication; resource authorization/ownership; Zod validation for params/query/body and external payloads; safe Prisma input mapping; response DTOs and sensitive data; pagination/unbounded queries; N+1/select/query shape; Prisma migration safety, relations, constraints/indexes; transactions and side effects; Socket.IO authentication/rooms/after-commit events; S3 access and presigned URL risks; BullMQ idempotency/retries; React/TypeScript/server-state correctness; UI loading/empty/error/accessibility; and test/verification coverage as applicable.

If the reviewer cannot be invoked, explain the blocker and perform the review directly while clearly stating independent delegation did not happen. Report 🔴 Critical, 🟡 Warning, and 🔵 Suggestion findings with file/line evidence when available. State what was and was not verified. Do not edit files. Always finish with `✅ What was done correctly`.
