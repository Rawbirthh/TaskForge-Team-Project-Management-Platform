---
name: react-frontend
description: Build typed React and Vite interfaces with accessible UI, routing, forms, and server-state integration
compatibility: opencode
---

Inspect installed React/Vite/TypeScript versions, router, UI system, styling tokens, API client, server-state library, and test setup. Preserve the existing choices; recommended defaults such as TanStack Query, React Router, and Tailwind are not reasons to replace working equivalents.

Use the router that already exists. Use the approved query/server-state layer for remote data; do not hand-roll fetch-in-useEffect patterns when TanStack Query or an equivalent already exists. Keep local React state for transient UI state, not as a second source of truth for backend records. Type props, API responses, mutations, query keys, and form payloads. No `any` without narrow justification. Backend Zod validation is mandatory even when frontend schemas are shared for immediate feedback.

Build accessible forms with labels, field errors, pending/disabled state, keyboard support, and clear feedback. Include a permission-denied state next to loading, empty, and error. Keep Socket.IO handlers in a dedicated real-time layer that updates or invalidates the query cache, and roll back optimistic updates on failure or conflict. Lists use backend pagination/filtering for large datasets. Include loading, empty, error, and responsive states. Use existing primitives/tokens and avoid adding a competing component library. Keep the access token in memory only (never `localStorage` or `sessionStorage`) and refresh it silently through the refresh cookie; client-side route guards are UX only, not authorization. Reconcile data through query invalidation/refetch after mutations; the API and MySQL remain canonical.
