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
import { Hono, type MiddlewareHandler } from "hono";
import { clerkWebhookPath } from "./clerk-webhooks.js";
import { linearWebhookPath, linearWebhookSchema } from "./linear-webhooks.js";

/** OpenAPI schema for storage upload error codes. */
const uploadErrorSchema = z.object({
  error: z.string(),
  imageId: z.number().int().positive().optional(),
  sha256: z.string().optional(),
});

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
  /**
   * Secret used to pseudonymize erasure subjects.
   * Must match the web value in the same environment and remain stable until all receipts expire.
   */
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
  /**
   * Secret used to verify Linear webhook signatures.
   * Production uses the production endpoint value; development and preview share the development endpoint value.
   */
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

/** Request bindings and variables shared by API routes and their middleware. */
type ApiEnv = {
  /** Cloudflare environment bindings. */
  Bindings: ApiBindings;
  /** Request-local state. */
  Variables: {
    /** Authenticated storage runtime attached by upload middleware. */
    uploadRuntime: UploadRuntime;
  };
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

/** Deployed worker response for an unhandled infrastructure or handler failure. */
const internalErrorResponse = {
  description: "An unhandled runtime, service, or logging failure occurred.",
  content: jsonContent(ErrorResponseSchema),
};

/** Optional audit reason accepted when deleting a storage attachment. */
const DeleteFileRequestSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

/** Bearer credentials required by storage routes. */
const storageSecurity = [{ ClerkBearer: [] }];

/** Session identifier shared by upload and completion operations. */
const sessionParams = z.object({ sessionId: z.uuid() });

/** Successful session reservation and its ordered file upload descriptors. */
const UploadSessionResponseSchema = z
  .object({
    id: z.uuid(),
    expiresAt: z.iso.datetime(),
    uploads: z.array(
      uploadManifestSchema.shape.files.element
        .omit({ sha256: true })
        .extend({ id: z.uuid() }),
    ),
  })
  .openapi("UploadSessionResponse");

/** Identity returned when an upload session completes, including retries. */
const UploadCompletionResponseSchema = z
  .union([
    z.object({
      resourceId: z.number().int().positive(),
      version: z.number().int().positive(),
    }),
    z.object({ targetId: z.number().int().positive() }),
  ])
  .openapi("UploadCompletionResponse");

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
  const app = new OpenAPIHono<ApiEnv>();
  const api = new OpenAPIHono<ApiEnv>();

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
      headers: z.object({
        [loggerValues.logProxy.clientKeyHeader]: z.string().optional().openapi({
          description: "Must match LOG_PROXY_CLIENT_KEY when configured.",
        }),
      }),
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
      500: internalErrorResponse,
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

  /**
   * Configures storage requests and serves preflight before authentication.
   *
   * @param context - Storage request context.
   * @param next - Next handler for non-preflight requests.
   * @returns Empty preflight response, or completion of the next handler.
   * @rejects When runtime resolution, the handler, or logger flushing fails.
   */
  const storageMiddleware: MiddlewareHandler<ApiEnv> = async (
    context,
    next,
  ) => {
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
  };
  api.options("/storage/*", storageMiddleware);
  api.post("/storage/upload-sessions", storageMiddleware, async (context) => {
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
    storageMiddleware,
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
  api.post(
    "/storage/upload-sessions/:sessionId/complete",
    storageMiddleware,
    async (context) => {
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
    },
  );
  api.delete(
    "/storage/file/:fileType/:fileId",
    storageMiddleware,
    async (context) => {
      const runtime = requireUploadRuntime(context.get("uploadRuntime"));
      const actor = await runtime.authenticate(context.req.raw);
      if (!actor) return context.json({ error: "unauthorized" }, 401);
      const type = z.enum(fileTypes).safeParse(context.req.param("fileType"));
      const fileId = Number(context.req.param("fileId"));
      if (!type.success || !Number.isSafeInteger(fileId) || fileId <= 0)
        return context.json({ error: "invalid_request" }, 400);
      try {
        const body = await context.req.json().catch(() => ({}));
        const parsed = DeleteFileRequestSchema.safeParse(body);
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
    },
  );
  api.openAPIRegistry.registerPath({
    method: "post",
    path: "/storage/upload-sessions",
    operationId: "createUploadSession",
    summary: "Create an upload session",
    tags: ["Storage"],
    security: storageSecurity,
    request: {
      body: { required: true, content: jsonContent(uploadManifestSchema) },
    },
    responses: {
      201: {
        description: "The upload session was created.",
        content: jsonContent(UploadSessionResponseSchema),
      },
      400: {
        description: "The upload declaration was invalid.",
        content: jsonContent(uploadErrorSchema),
      },
      401: {
        description: "Authentication is required.",
        content: jsonContent(uploadErrorSchema),
      },
      404: {
        description: "The upload target was not found.",
        content: jsonContent(uploadErrorSchema),
      },
      409: {
        description:
          "An active upload or duplicate image conflicts with this declaration.",
        content: jsonContent(uploadErrorSchema),
      },
      500: internalErrorResponse,
    },
  });

  api.openAPIRegistry.registerComponent("securitySchemes", "ClerkBearer", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description:
      "Clerk session token. Storage also checks account activity, origin, and ownership or editor permissions.",
  });
  for (const header of [
    "svix-id",
    "svix-timestamp",
    "svix-signature",
    "linear-signature",
  ]) {
    api.openAPIRegistry.registerComponent("securitySchemes", header, {
      type: "apiKey",
      in: "header",
      name: header,
      description:
        "Provider signature metadata verified against the unchanged raw request body.",
    });
  }
  for (const provider of ["clerk", "linear"] as const) {
    for (const local of [false, true]) {
      api.openAPIRegistry.registerPath({
        method: "post",
        path: `/webhooks/${provider}${local ? "/{initials}" : ""}`,
        operationId: `${provider}${local ? "Local" : "Primary"}Webhook`,
        summary: `Receive ${provider === "clerk" ? "Clerk" : "Linear"} ${local ? "local forwarded" : "primary"} webhook deliveries`,
        description:
          provider === "linear"
            ? "Verifies the raw body with HMAC-SHA256 and rejects timestamps more than 60 seconds from server time."
            : "Verifies Clerk deliveries with Svix before synchronizing users or account erasure.",
        tags: ["Webhooks"],
        security:
          provider === "clerk"
            ? [{ "svix-id": [], "svix-timestamp": [], "svix-signature": [] }]
            : [{ "linear-signature": [] }],
        request: {
          ...(local
            ? {
                params: z.object({
                  initials: z.string().openapi({
                    description:
                      "Case-insensitive initials matching URL_INITIALS; other values return 404.",
                  }),
                }),
              }
            : {}),
          ...(provider === "linear"
            ? {
                headers: z.object({ "linear-delivery": z.string().optional() }),
              }
            : {}),
          body: {
            required: true,
            content: jsonContent(
              provider === "linear"
                ? linearWebhookSchema
                : z
                    .object({
                      type: z.string(),
                      data: z.record(z.string(), z.unknown()),
                    })
                    .passthrough(),
            ),
          },
        },
        responses: {
          [provider === "clerk" ? 204 : 200]: {
            description:
              "The signed delivery was processed. The response body is empty.",
          },
          400: {
            description:
              provider === "clerk"
                ? "Webhook verification failed."
                : "The signed payload or event date was invalid.",
          },
          ...(provider === "linear"
            ? {
                401: {
                  description:
                    "Signature verification or replay protection failed.",
                },
              }
            : {}),
          ...(local
            ? {
                404: {
                  description: "The initials did not match the local target.",
                },
              }
            : {}),
          500: {
            description:
              "Webhook runtime configuration, processing, or forwarding failed; processing failures return an empty body.",
            content: jsonContent(ErrorResponseSchema),
          },
        },
      });
    }
  }
  api.openAPIRegistry.registerPath({
    method: "put",
    path: "/storage/upload-sessions/{sessionId}/files/{fileId}",
    operationId: "uploadSessionFile",
    summary: "Upload reserved file bytes",
    tags: ["Storage"],
    security: storageSecurity,
    description:
      "Uploads exactly the declared content type, length, and SHA-256 digest. Retrying a stored file or completed session succeeds without another write.",
    request: {
      params: sessionParams.extend({ fileId: z.uuid() }),
      headers: z.object({
        "content-length": z.string().optional().openapi({
          description:
            "Exact declared byte count; required before the first upload.",
        }),
        "content-type": z.string().optional().openapi({
          description:
            "Must match the manifest contentType; required before the first upload.",
        }),
      }),
      body: {
        required: false,
        description:
          "Exact declared bytes are required for the first upload; retries may omit the body.",
        content: { "*/*": { schema: { type: "string", format: "binary" } } },
      },
    },
    responses: {
      204: {
        description:
          "The file was stored or already uploaded; the response body is empty.",
      },
      400: {
        description: "Parameters, type, length, or digest were invalid.",
        content: jsonContent(uploadErrorSchema),
      },
      401: {
        description: "Authentication is required.",
        content: jsonContent(uploadErrorSchema),
      },
      404: {
        description: "An owned session or its reserved file was not found.",
        content: jsonContent(uploadErrorSchema),
      },
      409: {
        description: "The session expired.",
        content: jsonContent(uploadErrorSchema),
      },
      411: {
        description: "A valid content-length header is required.",
        content: jsonContent(uploadErrorSchema),
      },
      502: {
        description: "Object storage rejected the upload.",
        content: jsonContent(uploadErrorSchema),
      },
      500: internalErrorResponse,
    },
  });
  api.openAPIRegistry.registerPath({
    method: "post",
    path: "/storage/upload-sessions/{sessionId}/complete",
    operationId: "completeUploadSession",
    summary: "Complete an upload session",
    tags: ["Storage"],
    security: storageSecurity,
    description:
      "Attaches uploaded files atomically. Retrying a completed session returns its recorded identity.",
    request: { params: sessionParams },
    responses: {
      200: {
        description: "The upload completed or was already completed.",
        content: jsonContent(UploadCompletionResponseSchema),
      },
      400: {
        description: "The session identifier or stored payload was invalid.",
        content: jsonContent(uploadErrorSchema),
      },
      401: {
        description: "Authentication is required.",
        content: jsonContent(uploadErrorSchema),
      },
      404: {
        description: "An owned session was not found.",
        content: jsonContent(uploadErrorSchema),
      },
      409: {
        description: "The session expired or uploads are incomplete.",
        content: jsonContent(uploadErrorSchema),
      },
      500: internalErrorResponse,
    },
  });
  api.openAPIRegistry.registerPath({
    method: "delete",
    path: "/storage/file/{fileType}/{fileId}",
    operationId: "deleteStorageFile",
    summary: "Delete an authorized file attachment",
    tags: ["Storage"],
    security: storageSecurity,
    request: {
      params: z.object({
        fileType: z.enum(fileTypes),
        fileId: z.string().openapi({
          description:
            "Positive safe integer identifying the persisted attachment.",
        }),
      }),
      body: {
        required: false,
        content: jsonContent(DeleteFileRequestSchema),
      },
    },
    responses: {
      204: {
        description:
          "The attachment was removed and object cleanup was queued; the response body is empty.",
      },
      400: {
        description:
          "Parameters or reason were invalid, or the final file/image cannot be removed.",
        content: jsonContent(uploadErrorSchema),
      },
      401: {
        description: "Authentication is required.",
        content: jsonContent(uploadErrorSchema),
      },
      404: {
        description: "The attachment or its target was not found.",
        content: jsonContent(uploadErrorSchema),
      },
      500: internalErrorResponse,
    },
  });
  api.openAPIRegistry.registerPath({
    method: "options",
    path: "/storage/{path}",
    operationId: "storagePreflight",
    summary: "Serve storage CORS preflight",
    description:
      "The path parameter is a greedy tail including slashes. Preflight also responds for unknown storage paths and requires no authentication. Allowed origins receive access-control-allow-origin and Vary: Origin.",
    tags: ["Storage"],
    "x-hono-path": `${apiPrefix}/storage/*`,
    request: {
      params: z.object({
        path: z.string().openapi({
          description: "Remaining storage path, including embedded slashes.",
        }),
      }),
      headers: z.object({ origin: z.string().optional() }),
    },
    responses: {
      204: {
        description: "Empty preflight response.",
        headers: {
          "access-control-allow-headers": {
            schema: { type: "string", const: "authorization, content-type" },
          },
          "access-control-allow-methods": {
            schema: { type: "string", const: "DELETE, POST, PUT, OPTIONS" },
          },
          "access-control-allow-origin": {
            schema: { type: "string" },
            description: "Included only for an allowed origin.",
          },
          vary: {
            schema: { type: "string", const: "Origin" },
            description: "Included only for an allowed origin.",
          },
        },
      },
      500: internalErrorResponse,
    },
  });

  app.route(apiPrefix, api);
  app.openAPIRegistry.registerPath({
    method: "get",
    path: openApiJsonPath,
    operationId: "getOpenApiDocument",
    summary: "Read the OpenAPI document",
    tags: ["Documentation"],
    responses: {
      200: {
        description: "The current OpenAPI 3.1 document.",
        content: jsonContent(
          z
            .object({
              openapi: z.literal("3.1.0"),
              info: z
                .object({ title: z.string(), version: z.string() })
                .passthrough(),
              paths: z.record(z.string(), z.unknown()),
            })
            .passthrough(),
        ),
      },
    },
  });
  app.openAPIRegistry.registerPath({
    method: "get",
    path: apiDocsPath,
    operationId: "getApiReference",
    summary: "Read the interactive API reference",
    tags: ["Documentation"],
    responses: {
      200: {
        description: "Scalar reference HTML using the live OpenAPI document.",
        content: { "text/html": { schema: z.string() } },
      },
    },
  });
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

  /** Default Hono fallback retained for unknown storage routes and HTTP methods. */
  const notFoundApp = new Hono<ApiEnv>();
  app.notFound(async (context) => {
    const path = context.req.path;
    if (
      path === `${apiPrefix}/storage` ||
      path.startsWith(`${apiPrefix}/storage/`)
    ) {
      await storageMiddleware(context, async () => {
        const response = await notFoundApp.fetch(context.req.raw, context.env);
        context.res = context.newResponse(response.body, response);
      });
      return context.res;
    }
    return notFoundApp.fetch(context.req.raw, context.env);
  });

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
