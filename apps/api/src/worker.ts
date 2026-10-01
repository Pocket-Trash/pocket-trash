import { createClerkClient, verifyToken } from "@clerk/backend";
import { isLogLevel, loggerMessages } from "@package/logger";
import { type Actor, normalizeActor } from "@package/services/authorization";
import { type ApiBindings, createApp } from "./app.js";
import { drainAuditQueue } from "./audit.js";
import { findClerkOrphans } from "./clerk-orphans.js";
import { createClerkWebhookHandler } from "./clerk-webhooks.js";
import { createErasureOperations, drainErasureQueue } from "./erasure.js";
import { createApiLogger, createApiServices } from "./lib/services.js";
import { createLinearWebhookHandler } from "./linear-webhooks.js";

/** API application configured for the Cloudflare worker runtime. */
const app = createApp({
  /**
   * Creates the Clerk webhook runtime for a request.
   *
   * @param bindings - Worker environment bindings.
   * @returns The configured Clerk webhook runtime.
   */
  getClerkWebhookRuntime(bindings) {
    validateClerkWebhookBindings(bindings);
    const { logger, services } = createApiServices(bindings);
    const handle = createClerkWebhookHandler({
      erasure: services.db.erasure,
      erasureHmacSecret: bindings.ERASURE_HMAC_SECRET,
      logger,
      signingSecret: bindings.CLERK_WEBHOOK_SIGNING_SECRET as string,
      targets: bindings.CLERK_WEBHOOK_TARGETS,
      users: services.db.users,
    });

    return {
      expectedInitials: bindings.URL_INITIALS?.trim().toUpperCase(),
      /**
       * Routes a delivery with the current environment kind.
       *
       * @param request - Incoming webhook request.
       * @param target - Routed target kind.
       * @returns The webhook response.
       */
      handle: (request, target) =>
        handle(
          request,
          target === "local"
            ? "local"
            : bindings.APP_ENV === "production"
              ? "production"
              : bindings.APP_ENV === "preview"
                ? "preview"
                : "development",
        ),
    };
  },
  /**
   * Creates request logging configuration.
   *
   * @param bindings - Worker environment bindings.
   * @returns The request logging configuration.
   */
  getRuntimeConfig(bindings) {
    validateApiBindings(bindings);

    return {
      clientLogKey: bindings.LOG_PROXY_CLIENT_KEY,
      logger: createApiLogger(bindings),
    };
  },
  /**
   * Creates the Linear webhook runtime for a request.
   *
   * @param bindings - Worker environment bindings.
   * @returns The configured Linear webhook runtime.
   */
  getLinearWebhookRuntime(bindings) {
    validateLinearWebhookBindings(bindings);
    const { logger, services } = createApiServices(bindings);
    const handle = createLinearWebhookHandler({
      feedback: services.db.feedback,
      logger,
      signingSecret: bindings.LINEAR_WEBHOOK_SIGNING_SECRET as string,
      targets: bindings.CLERK_WEBHOOK_TARGETS,
    });
    return {
      expectedInitials: bindings.URL_INITIALS?.trim().toUpperCase(),
      /**
       * Routes a delivery with the current environment kind.
       *
       * @param request - Incoming webhook request.
       * @param target - Routed target kind.
       * @returns The webhook response.
       */
      handle: (request, target) =>
        handle(
          request,
          target === "local"
            ? "local"
            : bindings.APP_ENV === "production"
              ? "production"
              : bindings.APP_ENV === "preview"
                ? "preview"
                : "development",
        ),
    };
  },
  /**
   * Creates storage and authentication dependencies for upload routes.
   *
   * @param bindings - Worker environment bindings.
   * @returns Configured upload runtime.
   * @throws {ApiEnvValidationError} When a required upload binding is missing.
   */
  getUploadRuntime(bindings) {
    const { logger, services } = storageRuntime(bindings);
    return {
      logger,
      /**
       * Authenticates an upload request and verifies that its account is active.
       *
       * @param request - Incoming upload request.
       * @returns Authenticated actor, or `null` for invalid credentials, origins, or accounts.
       */
      authenticate: (request: Request) =>
        authenticateClerkRequest(
          request,
          bindings,
          services.db.erasure.assertAccountActive,
        ),
      /**
       * Applies the current deployment's upload origin policy.
       *
       * @param origin - Candidate request origin.
       * @returns Whether the origin may use upload routes.
       */
      isAllowedOrigin: (origin: string) =>
        isAllowedWebOrigin(origin, bindings.APP_ENV),
      service: services.storage,
    };
  },
});
/** Cloudflare execution context accepted by the configured Hono application. */
type HonoExecutionContext = Parameters<typeof app.fetch>[2];

/**
 * Verifies that a Clerk account may act.
 *
 * @param clerkId - Clerk account identifier.
 * @returns Promise that resolves when the account is active.
 * @rejects When account access is blocked or verification fails.
 */
type AssertAccountActive = (clerkId: string) => Promise<void>;

/** Reports missing or invalid API worker bindings. */
export class ApiEnvValidationError extends Error {
  /**
   * Creates an environment validation error listing invalid bindings.
   *
   * @param variables - Missing or invalid binding names.
   */
  constructor(readonly variables: readonly string[]) {
    super(`Invalid environment variables: ${variables.join(", ")}`);
    this.name = "ApiEnvValidationError";
  }
}

/**
 * Validates optional logger and Axiom binding combinations.
 *
 * @param env - Worker environment bindings.
 * @throws {ApiEnvValidationError} When a logger value is invalid or an Axiom credential is unpaired.
 */
export function validateApiBindings(env: ApiBindings) {
  const invalidVariables: string[] = [];

  if (env.LOG_LEVEL !== undefined && !isLogLevel(env.LOG_LEVEL)) {
    invalidVariables.push("LOG_LEVEL");
  }
  if (
    env.LOGGER !== undefined &&
    !["compact", "verbose"].includes(env.LOGGER)
  ) {
    invalidVariables.push("LOGGER");
  }
  if (Boolean(env.AXIOM_TOKEN) !== Boolean(env.AXIOM_DATASET)) {
    invalidVariables.push(env.AXIOM_TOKEN ? "AXIOM_DATASET" : "AXIOM_TOKEN");
  }

  if (invalidVariables.length > 0) {
    throw new ApiEnvValidationError(invalidVariables);
  }
}

/**
 * Validates bindings required by upload routes.
 *
 * @param env - Worker environment bindings.
 * @throws {ApiEnvValidationError} When a required upload binding is missing.
 */
export function validateUploadBindings(env: ApiBindings) {
  const required = [
    "CLERK_SECRET_KEY",
    "DATABASE_URL",
    "BUNNY_CDN_BASE_URL",
    "BUNNY_RESOURCE_FOLDER_PREFIX",
    "BUNNY_IMAGE_FOLDER_PREFIX",
    "BUNNY_STORAGE_ACCESS_KEY",
    "BUNNY_STORAGE_ENDPOINT",
    "BUNNY_STORAGE_ZONE_NAME",
  ] as const;
  const invalidVariables = required.filter((name) => !env[name]?.trim());

  if (invalidVariables.length > 0) {
    throw new ApiEnvValidationError(invalidVariables);
  }
}

/**
 * Validates bindings required by Clerk webhooks.
 *
 * @param env - Worker environment bindings.
 * @throws {ApiEnvValidationError} When a required binding is missing.
 */
export function validateClerkWebhookBindings(env: ApiBindings) {
  const required = [
    "CLERK_WEBHOOK_SIGNING_SECRET",
    "DATABASE_URL",
    "ERASURE_HMAC_SECRET",
  ] as const;
  const invalidVariables = required.filter((name) => !env[name]?.trim());
  if (invalidVariables.length > 0) {
    throw new ApiEnvValidationError(invalidVariables);
  }
}

/**
 * Validates bindings required by Linear webhooks.
 *
 * @param env - Worker environment bindings.
 * @throws {ApiEnvValidationError} When a required binding is missing.
 */
export function validateLinearWebhookBindings(env: ApiBindings) {
  const required = ["DATABASE_URL", "LINEAR_WEBHOOK_SIGNING_SECRET"] as const;
  const invalidVariables = required.filter((name) => !env[name]?.trim());
  if (invalidVariables.length > 0) {
    throw new ApiEnvValidationError(invalidVariables);
  }
}

app.onError(async (error, context) => {
  await logWorkerException(error, context.env, context.req.raw);
  return context.json({ error: "Internal server error." }, 500);
});

/**
 * Dispatches an API request and converts unhandled failures into a generic response.
 *
 * @param request - Incoming worker request.
 * @param env - Worker environment bindings.
 * @param context - Cloudflare execution context.
 * @returns API response.
 * @rejects When exception logging fails.
 */
export async function handleWorkerFetch(
  request: Request,
  env: ApiBindings,
  context: HonoExecutionContext,
): Promise<Response> {
  try {
    return await app.fetch(request, env, context);
  } catch (error) {
    await logWorkerException(error, env, request);
    return Response.json({ error: "Internal server error." }, { status: 500 });
  }
}

/**
 * Runs bounded production maintenance from the Cloudflare schedule.
 *
 * @param _controller - Schedule metadata for the current invocation.
 * @param env - Worker bindings used by maintenance services.
 * @param context - Execution context retaining background work.
 * @returns Completion after maintenance is scheduled.
 */
export async function handleWorkerScheduled(
  _controller: ScheduledController,
  env: ApiBindings,
  context: ExecutionContext,
): Promise<void> {
  if (env.APP_ENV !== "production") return;

  context.waitUntil(
    (async () => {
      let runtime: ReturnType<typeof storageRuntime> | undefined;
      try {
        runtime = storageRuntime(env);
        const clerk = createClerkClient({
          secretKey: env.CLERK_SECRET_KEY as string,
        });
        await drainAuditQueue(runtime.services.db.audit);
        await drainErasureQueue(
          runtime.services.db.erasure,
          createErasureOperations({
            clerk: clerk.users,
            erasure: runtime.services.db.erasure,
            storage: runtime.services.storage,
          }),
        );
        if (new Date(_controller.scheduledTime).getUTCHours() === 0) {
          const candidates = await findClerkOrphans(
            clerk.users,
            runtime.services.db.users,
          );
          if (candidates.length > 0) {
            runtime.logger.error(
              loggerMessages.database.erasure.orphanCandidates,
              {
                attributes: {
                  adminLink: "https://pocket-trash.app/admin/account-erasure",
                  candidateCount: candidates.length,
                  state: "needs_attention",
                },
              },
            );
          }
        }
        await Promise.all([
          runtime.services.storage.cleanupExpired(),
          runtime.services.db.erasure.purgeExpiredReceipts(),
        ]);
      } catch {
        await logWorkerException(
          new Error("Scheduled maintenance failed."),
          env,
          new Request("https://api.pocket-trash.app/__scheduled"),
          "scheduled",
        );
      } finally {
        await runtime?.logger.flush();
      }
    })(),
  );
}

/**
 * Checks whether a request origin is trusted in the current deployment.
 *
 * @param origin - Candidate origin URL.
 * @param environment - Deployment environment name.
 * @returns Whether the origin matches the development, preview, or production policy.
 */
export function isAllowedWebOrigin(
  origin: string,
  environment = "unknown",
): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (
    environment === "development" &&
    url.protocol === "http:" &&
    url.hostname === "localhost"
  ) {
    return true;
  }
  if (url.protocol !== "https:") return false;
  if (environment === "preview") return url.hostname.endsWith(".vercel.app");
  return ["pocket-trash.app", "www.pocket-trash.app"].includes(url.hostname);
}

/**
 * Authenticates a Clerk bearer token from an allowed web origin.
 *
 * @param request - Incoming upload request.
 * @param env - Worker environment bindings.
 * @param assertAccountActive - Verifies that the authenticated account may act.
 * @returns Normalized actor, or `null` when authentication or account validation fails.
 */
async function authenticateClerkRequest(
  request: Request,
  env: ApiBindings,
  assertAccountActive: AssertAccountActive,
): Promise<Actor | null> {
  const authorization = request.headers.get("authorization");
  const origin = request.headers.get("origin");
  const token = authorization?.match(/^Bearer (.+)$/u)?.[1];
  if (
    !token ||
    !origin ||
    !env.CLERK_SECRET_KEY ||
    !isAllowedWebOrigin(origin, env.APP_ENV)
  ) {
    return null;
  }

  try {
    const payload = await verifyToken(token, {
      authorizedParties: [origin],
      secretKey: env.CLERK_SECRET_KEY,
    });
    await assertAccountActive(payload.sub);
    return normalizeActor(payload.sub, payload);
  } catch {
    return null;
  }
}

/**
 * Records an unhandled worker failure without logging request secrets.
 *
 * @param error - Failure to record.
 * @param env - Worker environment bindings.
 * @param request - Failed request.
 * @param trigger - Worker entry point that failed.
 * @rejects When the logger cannot flush the event.
 */
async function logWorkerException(
  error: unknown,
  env: ApiBindings,
  request: Request,
  trigger = "fetch",
) {
  const logger = createApiLogger(env);
  logger.error(loggerMessages.api.workerUnhandledException, {
    attributes: {
      method: request.method,
      path: new URL(request.url).pathname,
      source: "cloudflare-worker",
      trigger,
    },
    error,
  });
  await logger.flush();
}

export default {
  fetch: handleWorkerFetch,
  scheduled: handleWorkerScheduled,
} satisfies ExportedHandler<ApiBindings>;

/**
 * Creates the configured services used by storage and maintenance routes.
 *
 * @param bindings - Worker environment bindings.
 * @returns API logger and service registry with storage enabled.
 * @throws {ApiEnvValidationError} When a required upload binding is missing.
 */
function storageRuntime(bindings: ApiBindings) {
  validateUploadBindings(bindings);
  return createApiServices(bindings, { storage: true });
}
