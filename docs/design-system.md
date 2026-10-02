# Design System

Use this policy when you add or change Pocket Trash UI. Read the relevant
component and its stories before editing it.

## Source ownership

Keep exact values and component behavior beside the code that implements them:

| Contract | Source |
| --- | --- |
| Theme values, fonts, radii, shadows, global CSS, and safe-area utilities | [`apps/web/src/styles.css`](../apps/web/src/styles.css) |
| Primitive variants, states, and focus treatment | [`apps/web/src/components/ui`](../apps/web/src/components/ui) |
| Shared page chrome | [`AppShell`](../apps/web/src/components/app-shell.tsx) and [`PageFooter`](../apps/web/src/components/page-footer.tsx) |
| Catalog filter presentation | [`CatalogFilterBar`](../apps/web/src/components/catalog-filter-bar.tsx) |
| Catalog matching and URL state | [`catalog-filters.ts`](../apps/web/src/lib/catalog-filters.ts) and [`use-catalog-filters.ts`](../apps/web/src/lib/use-catalog-filters.ts) |
| Archive filters and product details | [`FilterSidebar`](../apps/web/src/components/filter-sidebar.tsx) and [`ProductLightbox`](../apps/web/src/components/product-lightbox.tsx) |
| Catalog cards and image dialogs | [`ProductCard`](../apps/web/src/components/product-card.tsx) and [`ImageGallery`](../apps/web/src/components/image-gallery.tsx) |

Use Storybook stories in `apps/web/src/components` to inspect supported states.
Do not copy CSS values or component inventories into this document.

## Brand

Pocket Trash is an archival product browser for machined goods. Build compact,
technical, image-led interfaces that help users scan specifications, materials,
and product photography.

Use direct, factual copy and short labels. Prefer the feel of a precision-tool
catalog or enthusiast archive over a marketing site. Dense data is welcome when
the hierarchy remains clear.

## Tokens and visual language

Use semantic Tailwind tokens. Choose a token for its role, then let
`styles.css` supply its current value for light and dark themes.

- Use `background` and `foreground` for page content.
- Use `card`, `popover`, and `sidebar` token pairs for their matching
  surfaces.
- Use `primary` for primary actions and selected controls. Use `secondary`
  for lower-emphasis controls.
- Use `muted-foreground` for supporting text, `destructive` for destructive
  actions, and `ring` for keyboard focus.
- Use `border` for surface boundaries and `input` for interactive control
  boundaries.

Use the chart tokens for category tags so tag meaning remains consistent:

- `chart-2`: size
- `chart-1`: material
- `chart-3`: refill
- `chart-4`: tip or nose

Use `accent` for archived or highlighted states. Pair each background token
with its foreground token. Do not add raw color values in components when a
semantic token fits.

The app uses square geometry and a mono type system. Use the tokenized radius,
font, spacing, and shadow utilities from `styles.css`. Check the source before
choosing an exact size.

The document root carries `.dark` in dark mode. System mode follows
`prefers-color-scheme` and responds to preference changes without a reload.

## Layout

Use `AppShell` for shared header, breadcrumbs, global controls, and the content
region. Keep route filters, actions, and route metadata in route content or the
shell's extension slots. Do not add route-specific state to global chrome.

Build narrow layouts first, then add space for wider viewports:

- Keep primary content usable without horizontal scrolling.
- Convert dense sidebars and anchored overlays to sheets or drawers on narrow
  viewports.
- Let repeated-card grids reduce their column count with available width.
- Reserve space for dynamic labels, metadata, and controls to limit layout
  shifts.
- Respect device safe-area insets for fixed headers, toolbars, drawers, and
  bottom actions.

Reuse the breakpoints and presentation tiers in the matching component. If a new
cross-component breakpoint becomes necessary, define one shared boundary in
source and update the affected components together.

## Components and interaction

Start with a primitive from `components/ui`. Extend its existing variants
before adding a one-off control. Keep hover, active, disabled, open, and keyboard
focus states consistent with the primitive.

Keep shareable catalog state in URL search parameters. Matching, pruning, and
commit timing belong in the catalog filter utilities linked above.

Use overlays for transient controls so opening a filter or menu does not move
the result grid. On narrow viewports, use the shared sheet or drawer primitives.
Let those primitives own focus, dismissal, scroll locking, and swipe behavior.

Use motion to explain a state change. Keep it short, preserve the shared easing
language, and provide a `motion-reduce` state for decorative transforms.

Product and resource cards should preserve image space and predictable text
space so mixed content does not make grids jump. Put detailed behavior in the
card or detail component JSDoc.

## Accessibility

- Use semantic elements before ARIA.
- Give icon-only controls accessible names.
- Keep all actions reachable and operable with a keyboard.
- Show a visible `focus-visible` treatment that uses the ring token.
- Give dialogs a name, contain focus, support Escape, and return focus to the
  control that opened them.
- Expose selection through control state such as `aria-pressed` or
  `aria-selected` and a visible non-color cue.
- Give images useful alternative text. Hide decorative icons from assistive
  technology.
- Underline text links in surrounding copy so the link does not depend on
  color.
- Check light and dark states for text, control, focus, and disabled contrast.
- Keep touch targets usable and avoid placing fixed controls under device safe
  areas or the on-screen keyboard.

Do not remove an accessibility behavior when changing visual presentation.
Update the component test or Storybook interaction when the behavior forms part
of the component contract.
