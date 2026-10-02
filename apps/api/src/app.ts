import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  createNoopLogger,
  type Logger,
  loggerValues,
  logLevels,
  parseClientLogEvents,
} from "@package/logger";
import {
  fileTypes,
  type StorageService,
  type UploadActor,
  UploadSessionError,
  uploadManifestSchema,
} from "@package/services";
import { Scalar } from "@scalar/hono-api-reference";
import { clerkWebhookPath } from "./clerk-webhooks.js";
import { linearWebhookPath } from "./linear-webhooks.js";

/** OpenAPI schema for storage upload error codes. */
const uploadErrorSchema = z.object({ error: z.string() });

/** Versioned prefix for public API routes. */
export const apiPrefix = "/api/v0";
/** Public health-check endpoint. */
export const healthPath = `${apiPrefix}/health`;
/** Client log-ingestion endpoint. */
export const logsPath = `${apiPrefix}/logs`;
/** Base endpoint for resumable storage sessions. */
export const uploadSessionsPath = `${apiPrefix}/storage/upload-sessions`;
/** Generated OpenAPI document endpoint. */
export const openApiJsonPath = `${apiPrefix}/openapi.json`;
/** Interactive API reference endpoint. */
export const apiDocsPath = `${apiPrefix}/docs`;
export { clerkWebhookPath, linearWebhookPath };

/** Cloudflare bindings used by the API worker. */
export type ApiBindings = Omit<Env, "APP_ENV" | "BUNNY_IMAGE_FOLDER_PREFIX"> & {
  /** Deployment environment name. */
  APP_ENV?: string;
  /** Axiom dataset receiving API logs. */
  AXIOM_DATASET?: string;
  /** Optional Axiom edge-ingestion domain. */
  AXIOM_EDGE_DOMAIN?: string;
  /** Axiom ingestion token. */
  AXIOM_TOKEN?: string;
  /** Clerk backend secret key. */
  CLERK_SECRET_KEY?: string;
  /** Secret used to verify Clerk webhook signatures. */
  CLERK_WEBHOOK_SIGNING_SECRET?: string;
  /** KV registry of downstream webhook forwarding targets. */
  CLERK_WEBHOOK_TARGETS?: KVNamespace;
  /** PostgreSQL connection string. */
  DATABASE_URL?: string;
  /** Secret used to pseudonymize erasure subjects. */
  ERASURE_HMAC_SECRET?: string;
  /** Console transport output mode. */
  LOGGER?: string;
  /** Deployment identifier attached to logs. */
  LOG_DEPLOYMENT_ID?: string;
  /** Deployment platform attached to logs. */
  LOG_DEPLOYMENT_TARGET?: string;
  /** Minimum emitted log level. */
  LOG_LEVEL?: string;
  /** Shared key accepted by the client log proxy. */
  LOG_PROXY_CLIENT_KEY?: string;
  /** Secret used to verify Linear webhook signatures. */
  LINEAR_WEBHOOK_SIGNING_SECRET?: string;
  /** Initials required for local webhook forwarding targets. */
  URL_INITIALS?: string;
  /** Bunny API key used for pull-zone operations. */
  BUNNY_API_KEY?: string;
  /** Public Bunny CDN base URL. */
  BUNNY_CDN_BASE_URL?: string;
  /** Bunny token-authentication key. */
  BUNNY_CDN_TOKEN_KEY?: string;
  /** Object prefix for resource files. */
  BUNNY_RESOURCE_FOLDER_PREFIX?: string;
  /** Object prefix for image files. */
  BUNNY_IMAGE_FOLDER_PREFIX?: string;
  /** Bunny storage-zone access key. */
  BUNNY_STORAGE_ACCESS_KEY?: string;
  /** Bunny storage API endpoint. */
  BUNNY_STORAGE_ENDPOINT?: string;
  /** Bunny storage-zone name. */
  BUNNY_STORAGE_ZONE_NAME?: string;
  /** Bunny pull-zone identifier. */
  BUNNY_PULL_ZONE_ID?: string;
};

/** Per-request logging configuration. */
type RuntimeConfig = {
  /** Shared key accepted by the client log proxy. */
  clientLogKey?: string;
  /** API request logger. */
  logger: Logger;
};

/** Injectable API application dependencies. */
type AppDependencies = {
  /**
   * Resolves request logging configuration from environment bindings.
   *
   * @param bindings - Cloudflare request bindings.
   * @returns Request logging configuration.
   */
  getRuntimeConfig?: (
    bindings: ApiBindings,
  ) => Promise<RuntimeConfig> | RuntimeConfig;
  /** Fixed request logging configuration used by tests. */
  runtimeConfig?: RuntimeConfig;
  /**
   * Resolves storage upload dependencies from environment bindings.
   *
   * @param bindings - Cloudflare request bindings.
   * @returns Upload runtime for the request.
   */
  getUploadRuntime?: (
    bindings: ApiBindings,
  ) => Promise<UploadRuntime> | UploadRuntime;
  /** Fixed upload runtime used by tests. */
  uploadRuntime?: UploadRuntime;
  /**
   * Resolves the Clerk webhook runtime for a request.
   *
   * @param bindings - Request environment bindings.
   * @returns The request's Clerk webhook runtime.
   */
  getClerkWebhookRuntime?: (
    bindings: ApiBindings,
  ) => Promise<ClerkWebhookRuntime> | ClerkWebhookRuntime;
  /** Fixed Clerk webhook runtime used by tests. */
  clerkWebhookRuntime?: ClerkWebhookRuntime;
  /**
   * Resolves the Linear webhook runtime for a request.
   *
   * @param bindings - Request environment bindings.
   * @returns The request's Linear webhook runtime.
   */
  getLinearWebhookRuntime?: (
    bindings: ApiBindings,
  ) => Promise<LinearWebhookRuntime> | LinearWebhookRuntime;
  /** Fixed Linear webhook runtime used by tests. */
  linearWebhookRuntime?: LinearWebhookRuntime;
};

/** Runtime capable of handling Clerk webhook requests. */
export type ClerkWebhookRuntime = {
  /** Expected initials for a local webhook target. */
  expectedInitials?: string;
  /**
   * Handles a Clerk webhook request.
   *
   * @param request - Incoming webhook request.
   * @param targetKind - Webhook target environment.
   * @returns The webhook response.
   */
  handle(request: Request, targetKind: "local" | "primary"): Promise<Response>;
};

/** Runtime capable of handling Linear webhook requests. */
export type LinearWebhookRuntime = {
  /** Expected initials for a local webhook target. */
  expectedInitials?: string;
  /**
   * Handles a Linear webhook request.
   *
   * @param request - Incoming webhook request.
   * @param targetKind - Webhook target environment.
   * @returns The webhook response.
   */
  handle(request: Request, targetKind: "local" | "primary"): Promise<Response>;
};

/** Authentication, origin policy, logging, and storage operations for upload routes. */
export type UploadRuntime = {
  /** Optional upload logger used for request flushing. */
  logger?: Logger;
  /**
   * Authenticates an upload request and verifies the account is active.
   *
   * @param request - Incoming upload request.
   * @returns Authenticated actor, or `null` when credentials or origin are invalid.
   * @rejects When authentication infrastructure fails without converting the result to `null`.
   */
  authenticate(request: Request): Promise<UploadActor | null>;
  /**
   * Checks whether an origin may call upload routes.
   *
   * @param origin - Request origin URL.
   * @returns Whether the origin is allowed for the deployment.
   */
  isAllowedOrigin(origin: string): boolean;
  /** Storage session service. */
  service: StorageService;
};

/**
 * Wraps a schema as OpenAPI JSON response content.
 *
 * @param schema - Response body schema.
 * @returns OpenAPI content map for `application/json`.
 */
const jsonContent = (schema: z.ZodType) => ({
  "application/json": { schema },
});

/** OpenAPI schema returned by the health endpoint. */
const HealthResponseSchema = z
  .object({
    ok: z.boolean().openapi({ example: true }),
    service: z.string().openapi({ example: "api" }),
  })
  .openapi("HealthResponse");

/** OpenAPI schema for a caller-visible API error. */
const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: "Expected a JSON request body." }),
  })
  .openapi("ErrorResponse");

/** Validates one structured client log event. */
const ClientLogEventSchema = z
  .object({
    app: z.string().min(1).max(64),
    attributes: z.record(z.string(), z.unknown()).optional(),
    context: z.record(z.string(), z.unknown()).optional(),
    deploymentId: z.string().min(1).max(64).optional(),
    deploymentTarget: z.string().min(1).max(64).optional(),
    environment: z.string().min(1).max(64),
    error: z.record(z.string(), z.unknown()).optional(),
    level: z.enum(logLevels),
    message: z.string().min(1).max(500),
    rawPayload: z.unknown().optional(),
    timestamp: z.string().optional(),
  })
  .openapi("ClientLogEvent");

/** Accepts one event, an event array, or an event-envelope for log ingestion. */
const ClientLogRequestSchema = z
  .union([
    ClientLogEventSchema,
    z
      .array(ClientLogEventSchema)
      .min(1)
      .max(loggerValues.logProxy.maxBatchSize),
    z.object({
      events: z
        .array(ClientLogEventSchema)
        .min(1)
        .max(loggerValues.logProxy.maxBatchSize),
    }),
  ])
  .openapi("ClientLogRequest");

/** OpenAPI health-check route definition. */
const HealthRoute = createRoute({
  method: "get",
  path: "/health",
  operationId: "getHealth",
  summary: "Check API health",
  tags: ["Health"],
  responses: {
    200: {
      description: "The API service is healthy.",
      content: jsonContent(HealthResponseSchema),
    },
  },
});

/**
 * Creates the API application.
 *
 * @param dependencies - Optional runtime dependencies.
 * @returns The configured API application.
 */
export function createApp(dependencies: AppDependencies = {}) {
  const app = new OpenAPIHono<{
    /** Cloudflare environment bindings. */
    Bindings: ApiBindings;
  }>();
  const api = new OpenAPIHono<{
    /** Cloudflare environment bindings. */
    Bindings: ApiBindings;
    /** Request-local Hono variables. */
    Variables: {
      /** Authenticated storage runtime attached by upload middleware. */
      uploadRuntime: UploadRuntime;
    };
  }>();

  api.openapi(HealthRoute, (context) =>
    context.json({ ok: true, service: "api" }, 200),
  );

  api.post("/webhooks/clerk", async (context) => {
    const runtime = await requireClerkWebhookRuntime(dependencies, context.env);
    return await runtime.handle(context.req.raw, "primary");
  });

  api.post("/webhooks/clerk/:initials", async (context) => {
    const runtime = await requireClerkWebhookRuntime(dependencies, context.env);
    const initials = context.req.param("initials").toUpperCase();
    if (!runtime.expectedInitials || initials !== runtime.expectedInitials) {
      return context.body(null, 404);
    }
    return await runtime.handle(context.req.raw, "local");
  });

  api.post("/webhooks/linear", async (context) => {
    const runtime = await requireLinearWebhookRuntime(
      dependencies,
      context.env,
    );
    return await runtime.handle(context.req.raw, "primary");
  });

  api.post("/webhooks/linear/:initials", async (context) => {
    const runtime = await requireLinearWebhookRuntime(
      dependencies,
      context.env,
    );
    const initials = context.req.param("initials").toUpperCase();
    if (!runtime.expectedInitials || initials !== runtime.expectedInitials) {
      return context.body(null, 404);
    }
    return await runtime.handle(context.req.raw, "local");
  });

  api.openAPIRegistry.registerPath({
    method: "post",
    path: "/logs",
    operationId: "createClientLogs",
    summary: "Accept client log events",
    tags: ["Logs"],
    request: {
      body: {
        required: true,
        content: jsonContent(ClientLogRequestSchema),
      },
    },
    responses: {
      200: {
        description: "The client log events were accepted.",
        content: jsonContent(
          z.object({ accepted: z.number().int().nonnegative() }),
        ),
      },
      400: {
        description: "The request body was not valid log event data.",
        content: jsonContent(ErrorResponseSchema),
      },
      401: {
        description: "The configured client log key did not match.",
        content: jsonContent(ErrorResponseSchema),
      },
    },
  });

  api.post("/logs", async (context) => {
    const runtime = (await dependencies.getRuntimeConfig?.(context.env)) ??
      dependencies.runtimeConfig ?? {
        logger: createNoopLogger(),
      };

    if (
      runtime.clientLogKey &&
      context.req.header(loggerValues.logProxy.clientKeyHeader) !==
        runtime.clientLogKey
    ) {
      return context.json({ error: "Invalid log client key." }, 401);
    }

    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "Expected a JSON request body." }, 400);
    }

    const events = parseClientLogEvents(body);
    if (!events.ok) {
      return context.json({ error: events.error }, 400);
    }

    const receivedAt = new Date().toISOString();
    const userAgent = context.req.header("user-agent");

    for (const event of events.value) {
      runtime.logger.forward(event, {
        attributes: {
          originalTimestamp: event.timestamp,
          receivedAt,
          source: loggerValues.logProxy.source,
          ...(userAgent ? { userAgent } : {}),
        },
      });
    }

    await runtime.logger.flush();
    return context.json({ accepted: events.value.length });
  });

  api.use("/storage/*", async (context, next) => {
    const runtime = await resolveUploadRuntime(dependencies, context.env);
    if (runtime) context.set("uploadRuntime", runtime);
    const origin = context.req.header("origin");
    if (origin && runtime?.isAllowedOrigin(origin)) {
      context.header("access-control-allow-origin", origin);
      context.header("vary", "Origin");
    }
    if (context.req.method === "OPTIONS") {
      context.header(
        "access-control-allow-headers",
        "authorization, content-type",
      );
      context.header(
        "access-control-allow-methods",
        "DELETE, POST, PUT, OPTIONS",
      );
      return context.body(null, 204);
    }
    try {
      await next();
    } finally {
      await runtime?.logger?.flush();
    }
  });
  api.post("/storage/upload-sessions", async (context) => {
    const runtime = requireUploadRuntime(context.get("uploadRuntime"));
    const actor = await runtime.authenticate(context.req.raw);
    if (!actor) return context.json({ error: "unauthorized" }, 401);
    const parsed = uploadManifestSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) return context.json({ error: "invalid_request" }, 400);
    try {
      return context.json(
        await runtime.service.create(parsed.data, actor),
        201,
      );
    } catch (error) {
      return uploadErrorResponse(error);
    }
  });
  api.put(
    "/storage/upload-sessions/:sessionId/files/:fileId",
    async (context) => {
      const runtime = requireUploadRuntime(context.get("uploadRuntime"));
      const actor = await runtime.authenticate(context.req.raw);
      if (!actor) return context.json({ error: "unauthorized" }, 401);
      const { sessionId, fileId } = context.req.param();
      if (
        !z.string().uuid().safeParse(sessionId).success ||
        !z.string().uuid().safeParse(fileId).success
      )
        return context.json({ error: "invalid_request" }, 400);
      try {
        await runtime.service.upload(sessionId, fileId, actor, context.req.raw);
        return context.body(null, 204);
      } catch (error) {
        return uploadErrorResponse(error);
      }
    },
  );
  api.post("/storage/upload-sessions/:sessionId/complete", async (context) => {
    const runtime = requireUploadRuntime(context.get("uploadRuntime"));
    const actor = await runtime.authenticate(context.req.raw);
    if (!actor) return context.json({ error: "unauthorized" }, 401);
    const sessionId = context.req.param("sessionId");
    if (!z.string().uuid().safeParse(sessionId).success)
      return context.json({ error: "invalid_request" }, 400);
    try {
      return context.json(
        await runtime.service.completeUpload(sessionId, actor),
      );
    } catch (error) {
      return uploadErrorResponse(error);
    }
  });
  api.delete("/storage/file/:fileType/:fileId", async (context) => {
    const runtime = requireUploadRuntime(context.get("uploadRuntime"));
    const actor = await runtime.authenticate(context.req.raw);
    if (!actor) return context.json({ error: "unauthorized" }, 401);
    const type = z.enum(fileTypes).safeParse(context.req.param("fileType"));
    const fileId = Number(context.req.param("fileId"));
    if (!type.success || !Number.isSafeInteger(fileId) || fileId <= 0)
      return context.json({ error: "invalid_request" }, 400);
    try {
      const body = await context.req.json().catch(() => ({}));
      const parsed = z
        .object({ reason: z.string().trim().max(1000).optional() })
        .safeParse(body);
      if (!parsed.success)
        return context.json({ error: "invalid_request" }, 400);
      await runtime.service.deleteFile({
        fileType: type.data,
        fileId,
        actor,
        reason: parsed.data.reason,
      });
      return context.body(null, 204);
    } catch (error) {
      return uploadErrorResponse(error);
    }
  });
  api.openAPIRegistry.registerPath({
    method: "post",
    path: "/storage/upload-sessions",
    operationId: "createUploadSession",
    summary: "Create an upload session",
    tags: ["Storage"],
    request: {
      body: { required: true, content: jsonContent(uploadManifestSchema) },
    },
    responses: {
      201: { description: "The upload session was created." },
      400: {
        description: "The upload declaration was invalid.",
        content: jsonContent(uploadErrorSchema),
      },
      401: {
        description: "Authentication is required.",
        content: jsonContent(uploadErrorSchema),
      },
    },
  });

  app.route(apiPrefix, api);
  app.get(openApiJsonPath, (context) =>
    context.json(
      app.getOpenAPI31Document(
        {
          openapi: "3.1.0",
          info: {
            title: "Pocket Trash API",
            version: "0.0.0",
            description: "API documentation for Pocket Trash services.",
          },
          servers: [
            { url: "https://api.pocket-trash.app", description: "Production" },
            { url: "http://localhost:4006", description: "Local development" },
          ],
        },
        { unionPreferredType: "oneOf" },
      ),
    ),
  );
  app.get(
    apiDocsPath,
    Scalar({
      pageTitle: "Pocket Trash API Reference",
      url: openApiJsonPath,
    }),
  );

  return app;
}

/**
 * Resolves the optional upload runtime.
 *
 * @param dependencies - Application dependencies.
 * @param bindings - Request environment bindings.
 * @returns The configured upload runtime, when available.
 */
async function resolveUploadRuntime(
  dependencies: AppDependencies,
  bindings: ApiBindings,
) {
  return (
    (await dependencies.getUploadRuntime?.(bindings)) ??
    dependencies.uploadRuntime
  );
}
/**
 * Requires an upload runtime.
 *
 * @param runtime - Optional upload runtime.
 * @returns The configured upload runtime.
 * @throws {Error} When uploads are not configured.
 */
function requireUploadRuntime(runtime: UploadRuntime | undefined) {
  if (!runtime) throw new Error("Storage uploads are not configured.");
  return runtime;
}

/**
 * Resolves the configured Clerk webhook runtime.
 *
 * @param dependencies - Application dependencies.
 * @param bindings - Request environment bindings.
 * @returns The configured Clerk webhook runtime.
 * @rejects When Clerk webhooks are not configured.
 */
async function requireClerkWebhookRuntime(
  dependencies: AppDependencies,
  bindings: ApiBindings,
): Promise<ClerkWebhookRuntime> {
  const runtime =
    (await dependencies.getClerkWebhookRuntime?.(bindings)) ??
    dependencies.clerkWebhookRuntime;
  if (!runtime) throw new Error("Clerk webhooks are not configured.");
  return runtime;
}

/**
 * Resolves the configured Linear webhook runtime.
 *
 * @param dependencies - Application dependencies.
 * @param bindings - Request environment bindings.
 * @returns The configured Linear webhook runtime.
 * @rejects When Linear webhooks are not configured.
 */
async function requireLinearWebhookRuntime(
  dependencies: AppDependencies,
  bindings: ApiBindings,
): Promise<LinearWebhookRuntime> {
  const runtime =
    (await dependencies.getLinearWebhookRuntime?.(bindings)) ??
    dependencies.linearWebhookRuntime;
  if (!runtime) throw new Error("Linear webhooks are not configured.");
  return runtime;
}

/**
 * Converts a storage-session failure into its caller-visible JSON response.
 *
 * @param error - Candidate error.
 * @returns Upload error body with the operation's HTTP status.
 * @throws When the failure is not an {@link UploadSessionError}.
 */
function uploadErrorResponse(error: unknown): Response {
  if (error instanceof UploadSessionError)
    return Response.json(
      {
        error: error.code,
        ...(error.imageId ? { imageId: error.imageId } : {}),
        ...(error.sha256 ? { sha256: error.sha256 } : {}),
      },
      { status: error.status },
    );
  throw new Error("Storage operation failed.");
}
