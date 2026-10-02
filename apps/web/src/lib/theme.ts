/** User-selectable color theme preference. */
export type ThemeMode = "light" | "dark" | "system";

/** Browser storage key for the anonymous theme preference. */
export const themeStorageKey = "pocket-trash.theme";

/** Reports whether a stored value is a supported theme mode.
 *
 * @param value - Browser storage value to validate.
 * @returns Whether the value is a supported theme mode.
 */
export function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

/** Resolves a theme preference to a concrete light or dark theme.
 *
 * @param theme - Theme preference to resolve.
 * @returns The explicit theme, browser preference, or light during server rendering.
 */
export function resolvedTheme(theme: ThemeMode) {
  if (theme !== "system") return theme;

  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Applies a theme preference to the document root when available.
 *
 * @param theme - Theme preference to apply.
 */
export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;

  document.documentElement.classList.toggle(
    "dark",
    resolvedTheme(theme) === "dark",
  );
}
