import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { NotFoundPage } from "@/pages/not-found-page";
import { RouteErrorPage } from "@/pages/route-error-page";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createTanStackRouter({
    defaultErrorComponent: RouteErrorPage,
    defaultNotFoundComponent: NotFoundPage,
    routeTree,
    scrollRestoration: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
