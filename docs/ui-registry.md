# UI Registry

This file is maintained by `/imprint`. It records only reusable visual patterns grounded in the existing app. No brand identity is claimed beyond the foundation styles already implemented.

## Product design direction (from `project-overview.md`, Feature 4)
- Modern B2B SaaS dashboard: clear sidebar navigation, restrained neutral surfaces, readable data density, strong task status/priority cues, responsive board layouts. Dribbble references are inspiration only, not assets to copy.

## Design tokens (observed in `apps/web/src/styles/index.css`)
- Colors: `canvas #f6f7f9`, `surface #ffffff`, `surface-muted #eef1f5`, `ink #172033`, `muted #5f6b7c`, `line #dfe4eb`, `brand #2563eb`, `brand-strong #1d4ed8`, `brand-soft #e8efff`.
- Status badge variants: `neutral`, `info`, `success`, `warning`, `danger` (Tailwind border/bg/text pairs).
- Typography: Inter → system sans stack; `text-xs/sm/base` for dense data, `text-2xl/3xl/4xl/5xl` for headings.
- Radius/shadow: `rounded-lg` controls, `rounded-xl` cards, `shadow-sm` surfaces, `shadow-2xl` dialogs/demo panel.
- Global: light `color-scheme`, visible `focus-visible` outline in brand color, reduced-motion media query, antialiased body.

## Layout patterns (observed)
- Public layout: sticky header with `Brand`, secondary nav link, primary "Open app" action; centered `max-w-6xl` content; footer.
- App shell: skip link, fixed mobile sidebar with scrim button and `Escape` to close, static `lg` sidebar, sticky header with workspace label and account dropdown, `max-w-6xl` main content.
- Page headers: title + supporting description, optional right-aligned action (e.g. `SetupCommandsDialog`).
- Responsive: mobile-first flex/grid; `sm`, `lg` breakpoints; sidebar collapses below `lg`.

## Component conventions (observed)
- `Button` (`cva` variants `primary|secondary|ghost|danger`, sizes `sm|md|lg|icon`, `isLoading` sets disabled + `aria-busy`).
- `Badge` semantic variants for status/priority cues.
- `Card` family: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
- `Input`, `Skeleton`, `PageState` (`LoadingState`, `ErrorState` with retry, `EmptyState` with optional action).
- `Dialog` and `DropdownMenu` wrap Radix primitives with portal, overlay, focus styles, titles/descriptions, and close controls.
- `cn()` uses `clsx` + `tailwind-merge`. Variant constants live in `button-variants.ts` / `badge-variants.ts` so primitive files export only components (Fast Refresh).

## Reference components
- `apps/web/src/pages/landing-page.tsx` — hero, foundation cards, roadmap card.
- `apps/web/src/pages/dashboard-page.tsx` — status list, API status card, next-feature and out-of-scope cards.
- `apps/web/src/features/foundation/api-status-card.tsx` — TanStack Query loading/error/success states with retry.
- `apps/web/src/features/foundation/setup-commands-dialog.tsx` — copyable command list with toasts.

## Known inconsistencies / follow-ups
- No project/task status colors exist yet; Feature 13+ should extend the `Badge` variants rather than inventing a second status system.
- Vite build emits a >500 kB chunk advisory; consider route-level lazy loading when feature pages grow.
