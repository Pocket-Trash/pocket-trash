/** Minimum viewport width for the regular two-pane layout.
 * Keep this aligned with Tailwind's `md` breakpoint.
 */
export const TWO_PANE_MIN_WIDTH = 768;

/** Media query matching viewports strictly below the two-pane breakpoint.
 * The fractional boundary avoids a gap with Tailwind's inclusive `md` query.
 */
export const compactMediaQuery = `(max-width: ${TWO_PANE_MIN_WIDTH - 0.02}px)`;
