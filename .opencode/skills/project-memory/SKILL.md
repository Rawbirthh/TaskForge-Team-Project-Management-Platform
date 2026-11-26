---
name: project-memory
description: Save and restore a concise, verified project and feature handoff across OpenCode sessions
compatibility: opencode
---

Follow the root `/remember` command and `memory.md` format. Memory is a compact handoff, not a transcript. Save only confirmed product constraints, architecture choices, active spec/status, important paths, exact checks and outcomes, blockers, and next action. Separate agent-run checks from user-reported manual verification. Never store secrets, `.env` values, tokens, private keys, personal data, or speculation. On restore, verify the referenced spec, relevant changed files, test evidence, and Git status; label stale/unverified details and stop for the user's next instruction.
