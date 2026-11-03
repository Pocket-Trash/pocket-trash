# UI design

- Read the component and adjacent stories first. Build compact, technical, image-led archival interfaces with factual copy, short labels and clear dense-data hierarchy.
- Reuse [primitives](../../apps/web/src/components/ui), extending existing variants and interaction states. Use [AppShell](../../apps/web/src/components/app-shell.tsx) and [PageFooter](../../apps/web/src/components/page-footer.tsx); keep route state outside global chrome.
- Use semantic paired tokens, square geometry, mono typography and shared radius/spacing/shadow utilities from [styles.css](../../apps/web/src/styles.css). Use chart-2 for size, chart-1 for material, chart-3 for refill, chart-4 for tip/nose and accent for archived/highlighted states; preserve and light/dark/system behavior; avoid raw colors when tokens fit.
- Build narrow-first: avoid horizontal scrolling, reduce grid columns, reserve image/text/control space, and reuse component breakpoints; share new cross-component boundaries.
- Use transient overlays without shifting grids; narrow layouts use shared sheets/drawers owning focus, dismissal, scroll and swipe.
- Keep motion short with shared easing. Follow [accessibility](accessibility.md) and [state management](state-management.md); catalog utilities own matching, pruning and commit timing.
