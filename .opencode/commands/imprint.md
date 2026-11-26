---
description: Capture and audit reusable UI conventions for consistent React components
---

Load the `ui-consistency` skill. Target component/path or action: $ARGUMENTS

Use the JSM `/imprint` approach. If a component/path is supplied, inspect its implementation, styles/tokens, responsive behavior, accessibility, and surrounding screens; otherwise inspect the most recently changed UI. If the argument is `audit`, inspect existing UI patterns and identify repetition/inconsistency before proposing a baseline.

Update `docs/ui-registry.md` with only patterns evidenced in the code or explicitly approved by the user: layout, spacing, typography, colors/tokens, radius/shadows, component anatomy, responsive rules, loading/empty/error states, and accessibility conventions. Prefer existing UI primitives and styling. Do not invent branding, install a design system, or perform broad UI refactors just to make the registry consistent. If application-code changes are needed, describe their scope first and ask before a broad redesign. Report captured patterns and conflicts found.
