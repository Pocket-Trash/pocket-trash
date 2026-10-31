import type { AnyRouter } from "@tanstack/react-router";

/**
 * Allows deferred search commits only for the current route and parsed entity IDs.
 * @param router - Router whose current location owns navigation.
 * @param routeId - Route that created the deferred search action.
 * @param params - Parsed entity identifiers required by that route.
 * @returns Whether the current destination still owns the search action.
 */
export function canCommitSearch(
  router: AnyRouter,
  routeId: string,
  params: Record<string, string | number> = {},
) {
  const match = router
    .matchRoutes(router.state.location)
    .find((candidate) => candidate.routeId === routeId);
  return match
    ? Object.entries(params).every(
        ([key, value]) => match.params[key] === value,
      )
    : false;
}
