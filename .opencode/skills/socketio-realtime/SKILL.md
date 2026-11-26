---
name: socketio-realtime
description: Design and test Socket.IO connections, authorization, rooms, typed events, and after-commit notifications
compatibility: opencode
---

Treat REST + committed MySQL data as the sole source of truth. Socket.IO distributes notifications about committed state; it is not a second database. Inspect the actual authentication flow and verify Socket.IO handshake authentication: send the access token in the handshake `auth` payload (never the URL), apply the same verification and session-revocation check as the HTTP API, and disconnect or require re-authentication when the token expires or the session is revoked. Validate inbound event payloads with Zod. Authorize each room join/subscription against the specific resource; do not trust client-provided IDs or room names. Keep private payloads out of broad rooms.

Emit events only after the related Prisma transaction commits. When losing an event would matter (notifications, reminders, queued work), write an outbox record in the same transaction and dispatch it after commit. Re-check access when membership or project roles change, and remove or disconnect affected sockets and room subscriptions; connection-time authentication alone is not enough for long-lived sockets. Make event handlers idempotent where clients may retry, and consider duplicate delivery, reconnects, ordering, stale clients, and refetching canonical API state. Use typed event maps/payloads. Add Redis adapter only when multiple API instances require cross-instance delivery; don't add Redis to a single-instance app solely for Socket.IO. Integration tests should cover authorized and unauthorized connections/rooms and event delivery after commit.
