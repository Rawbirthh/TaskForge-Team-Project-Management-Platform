---
name: node-backend
description: Implement and review Express REST APIs with TypeScript, Zod, middleware, controllers, and pragmatic services
compatibility: opencode
---

Inspect the actual Node, TypeScript, Express versions, package manager, scripts, route layout, auth method, error handler, and API conventions before changing code. The API stays under `/api/v1`.

Use Express middleware for cross-cutting concerns and route-level authentication/role boundaries. Use Zod to parse params, query, body, webhook payloads, and other untrusted inputs. Validate environment variables at startup. Use parsed outputs downstream; avoid casts and `any`. Map validated fields explicitly into service/Prisma inputs. Never pass raw `req.body` or broad spreads into database writes. Keep controllers focused on HTTP orchestration and response mapping. Add Services only for long, multi-step, transactional, integration-heavy, or reused business logic. Add a Repository/query helper only for long, complex, or reused queries; do not build a generic repository framework.

Perform resource-specific ownership/permission checks where a record/action is known. Return consistent sanitized errors through centralized Express error handling. Respect CORS allowlists, CSRF protection on the cookie-authenticated refresh/logout endpoints, the JWT rules in `AGENTS.md` section 5, rate limiting, Helmet, request lifecycle, and graceful Prisma Client shutdown where applicable. Tests are required for meaningful behavior. Do not install packages or alter lockfiles without approval.
