import { verifyToken } from "@clerk/backend";
import { isLogLevel, loggerMessages } from "@package/logger";
import { type ApiBindings, createApp } from "./app.js";
import { createClerkWebhookHandler } from "./clerk-webhooks.js";
import { createApiLogger, createApiServices } from "./lib/services.js";

const app = createApp({
  getClerkWebhookRuntime(bindings) {
    validateClerkWebhookBindings(bindings);
    const { logger, services } = createApiServices(bindings);
    const handle = createClerkWebhookHandler({
      logger,
      signingSecret: bindings.CLERK_WEBHOOK_SIGNING_SECRET as string,
      targets: bindings.CLERK_WEBHOOK_TARGETS,
      users: services.db.users,
    });

    return {
      expectedInitials: bindings.URL_INITIALS?.trim().toUpperCase(),
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
  getRuntimeConfig(bindings) {
    validateApiBindings(bindings);

    return {
      clientLogKey: bindings.LOG_PROXY_CLIENT_KEY,
      logger: createApiLogger(bindings),
    };
  },
  getUploadRuntime(bindings) {
    return {
      authenticate: (request: Request) =>
        authenticateClerkRequest(request, bindings),
      isAllowedOrigin: (origin: string) =>
        isAllowedWebOrigin(origin, bindings.APP_ENV),
      service: storageService(bindings),
    };
  },
});
type HonoExecutionContext = Parameters<typeof app.fetch>[2];

export class ApiEnvValidationError extends Error {
  constructor(readonly variables: readonly string[]) {
    super(`Invalid environment variables: ${variables.join(", ")}`);
    this.name = "ApiEnvValidationError";
  }
}

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

export function validateClerkWebhookBindings(env: ApiBindings) {
  const required = ["CLERK_WEBHOOK_SIGNING_SECRET", "DATABASE_URL"] as const;
  const invalidVariables = required.filter((name) => !env[name]?.trim());
  if (invalidVariables.length > 0) {
    throw new ApiEnvValidationError(invalidVariables);
  }
}

app.onError(async (error, context) => {
  await logWorkerException(error, context.env, context.req.raw);
  return context.json({ error: "Internal server error." }, 500);
});

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

export async function handleWorkerScheduled(
  _controller: ScheduledController,
  env: ApiBindings,
  context: ExecutionContext,
): Promise<void> {
  if (env.APP_ENV !== "production") return;

  context.waitUntil(
    (async () => {
      try {
        await storageService(env).cleanupExpired();
      } catch (error) {
        await logWorkerException(
          error,
          env,
          new Request("https://api.pocket-trash.app/__scheduled"),
          "scheduled",
        );
      }
    })(),
  );
}

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

async function authenticateClerkRequest(
  request: Request,
  env: ApiBindings,
): Promise<{ clerkId: string; isAdmin: boolean } | null> {
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
    return {
      clerkId: payload.sub,
      isAdmin: (payload as { role?: unknown }).role === "admin",
    };
  } catch {
    return null;
  }
}

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

function storageService(bindings: ApiBindings) {
  validateUploadBindings(bindings);
  const { services } = createApiServices(bindings, true);
  return services.storage;
}
