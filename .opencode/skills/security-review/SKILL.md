---
name: security-review
description: Review Express, Zod, Prisma, React, Socket.IO, uploads, and external integrations for security and data-integrity risks
compatibility: opencode
---

Review the actual diff and related paths. Check authentication middleware, resource-level authorization/ownership, tenant isolation (actor and tenant derived from the session, not the request; membership and project access verified on every read, write, download, socket join, and job; queries scoped by tenant rather than fetched globally by ID; access revocation taking effect immediately), Zod validation of params/query/body/external payloads, environment validation, mass assignment (raw request data must never flow into Prisma writes), response DTOs and sensitive-field exposure, JWT handling (pinned algorithm, `iss`/`aud`/`exp` checks, no roles or membership trusted from claims, session-record check on each request, refresh-token hashing/rotation/reuse detection, no tokens in logs, URLs, or browser storage), consistent sanitized errors, CORS/CSRF as applicable (the cookie-authenticated refresh/logout endpoints), rate limits, webhook signature checks, and upload ownership/type/size controls.

For Prisma/MySQL, inspect foreign keys, unique constraints, indexes, migration safety, transaction boundaries, pagination limits, selected fields, N+1/query behavior, and concurrency/idempotency. For Socket.IO, check handshake authentication (access token in the handshake `auth` payload, not the URL; handling of expiry and revocation), room/resource authorization, event payload validation, private event isolation, and emission only after committed writes. For S3, verify private bucket assumptions, short-lived presigned URLs, backend authorization, and no credentials or full signed URLs in logs. For BullMQ, check idempotency, retries/backoff, payload minimization, and secret handling.

Distinguish verified vulnerabilities from risks and suggestions. Cite file/line evidence. Never inspect or reproduce secret values. Do not edit files when acting as a reviewer.
