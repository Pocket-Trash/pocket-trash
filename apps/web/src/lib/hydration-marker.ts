/**
 * Marks the current document ready when its interactive DOM commits.
 * @param node - Current application DOM surface.
 * @returns Cleanup that removes readiness when the surface disconnects.
 */
export function markHydrated(node: HTMLElement | null) {
  if (!node) return;
  const root = node.ownerDocument.documentElement;
  root.dataset.hydrated = "true";
  return () => {
    delete root.dataset.hydrated;
  };
}
