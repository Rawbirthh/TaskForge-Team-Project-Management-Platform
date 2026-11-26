---
name: ui-consistency
description: Preserve and record reusable visual and accessibility patterns in the existing React application
compatibility: opencode
---

Read `docs/ui-registry.md` and inspect nearby screens/components before introducing a new pattern. Record only existing or user-approved patterns; do not invent branding. Compare hierarchy, spacing, typography, colors/tokens, radii/shadows, component anatomy, forms, tables, dialogs, loading/empty/error states, responsiveness, keyboard behavior, focus management, and accessible names.

Prefer the project's installed UI primitives and design tokens. Do not introduce shadcn/ui, another component system, or a new styling library automatically. If existing patterns conflict, report the inconsistency rather than broadening the task into an app-wide redesign. `/imprint` updates the registry with reusable rules and file references; it does not change application source merely to make patterns consistent.
