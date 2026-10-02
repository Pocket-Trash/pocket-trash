import { clerkMiddleware } from "@clerk/tanstack-react-start/server";
import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

/** CSRF protection applied only to TanStack server functions. */
const csrfMiddleware = createCsrfMiddleware({
  /**
   * Selects server-function requests for CSRF validation.
   *
   * @param ctx - TanStack request handler context.
   * @returns Whether the middleware applies to the request.
   */
  filter: (ctx) => ctx.handlerType === "serverFn",
});

/** TanStack Start instance with CSRF and Clerk request middleware. */
export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, clerkMiddleware()],
}));
