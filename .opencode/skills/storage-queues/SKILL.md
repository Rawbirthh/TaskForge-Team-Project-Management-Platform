---
name: storage-queues
description: Implement feature-driven private S3 uploads, presigned URLs, and BullMQ background jobs safely
compatibility: opencode
---

This skill applies only when a feature actually needs file storage or background processing. Do not install AWS SDK, BullMQ, or Redis as speculative baseline dependencies.

S3: use a private bucket. Authorize the user/resource before issuing a short-lived presigned URL. Validate allowed content type, size, ownership, and metadata server-side; do not trust browser MIME alone. Keep AWS credentials on the server. Avoid public ACLs and never log full presigned URLs. Define safe upload completion, orphan cleanup, and DB metadata/storage consistency.

BullMQ: introduce Redis only when asynchronous processing is required. Persist important events with a transactional outbox (or equivalent) so a committed change is dispatched even if the process stops. Jobs should be idempotent (reminder occurrences must not duplicate on retry), have bounded retry/backoff behavior, use minimal payloads (IDs rather than full/private records), and handle failure/poison messages observably. Consider duplicate delivery and worker shutdown. Do not perform irreversible external side effects inside an uncommitted DB transaction. Test retry/idempotency and failure paths relevant to the feature.
