import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Redirects legacy pen URLs to their canonical archive entries.
 */
export const Route = createFileRoute("/pens/$penId")({
  /**
   * Normalizes search parameters accepted by the route.
   *
   * @param search - Untrusted URL search parameters.
   * @returns Normalized route search state.
   */
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    /**
     * Optional image index selected from the archive.
     */
    img?: number;
  } => {
    const raw = search.img;
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) && n > 1 ? { img: Math.floor(n) } : {};
  },
  /**
   * Redirects a legacy pen URL to its canonical archive route.
   *
   * @param context - Route callback context.
   * @param context.params - Parsed route parameters.
   * @param context.search - Validated route search state.
   * @throws When navigation must continue at another route.
   */
  beforeLoad: ({ params, search }) => {
    throw redirect({
      params: { penId: params.penId },
      search,
      to: "/autmog/$penId",
    });
  },
});
