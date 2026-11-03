# Accessibility

- Prefer semantic elements to ARIA. Give icon-only controls accessible names and keep every action keyboard-operable.
- Show visible `focus-visible` treatment using the ring token. Name dialogs, contain focus, support Escape and restore focus to the opener; reuse shared primitives.
- Expose selection through control state (`aria-pressed`/`aria-selected`) and a visible non-color cue.
- Give images useful alternative text; hide decorative icons from assistive technology. Underline links within copy.
- Check text, controls, focus and disabled contrast in both themes; retain usable touch targets.
- Respect safe-area insets and the on-screen keyboard when positioning fixed controls. Provide `motion-reduce` states for decorative transforms.
- Preserve accessibility during visual changes; update component tests or Storybook interactions for contractual behavior. Query by role, label or accessible name. Storybook accessibility violations fail tests; fix the cause and use per-story exceptions only when justified.
