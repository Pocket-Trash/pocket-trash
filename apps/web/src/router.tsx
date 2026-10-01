import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { NotFoundPage } from "@/pages/not-found-page";
import { RouteErrorPage } from "@/pages/route-error-page";
import { routeTree } from "./routeTree.gen";

/**
 * Creates the application router with generated routes and shared error pages.
 *
 * @returns Configured TanStack router with scroll restoration enabled.
 */
export function getRouter() {
  return createTanStackRouter({
    defaultErrorComponent: RouteErrorPage,
    defaultNotFoundComponent: NotFoundPage,
    routeTree,
    scrollRestoration: true,
  });
}

/**
 * Adds the application router type to TanStack Router's module registry.
 */
declare module "@tanstack/react-router" {
  /**
   * Application-specific TanStack Router registration.
   */
  interface Register {
    /**
     * Router created by {@link getRouter}.
     */
    router: ReturnType<typeof getRouter>;
  }
}
