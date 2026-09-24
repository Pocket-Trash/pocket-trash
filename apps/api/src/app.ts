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

const uploadErrorSchema = z.object({ error: z.string() });

export const apiPrefix = "/api/v0";
export const healthPath = `${apiPrefix}/health`;
export const logsPath = `${apiPrefix}/logs`;
export const uploadSessionsPath = `${apiPrefix}/storage/upload-sessions`;
export const openApiJsonPath = `${apiPrefix}/openapi.json`;
export const apiDocsPath = `${apiPrefix}/docs`;
export { clerkWebhookPath };

export type ApiBindings = Omit<Env, "APP_ENV" | "BUNNY_IMAGE_FOLDER_PREFIX"> & {
  APP_ENV?: string;
  AXIOM_DATASET?: string;
  AXIOM_EDGE_DOMAIN?: string;
  AXIOM_TOKEN?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_WEBHOOK_SIGNING_SECRET?: string;
  CLERK_WEBHOOK_TARGETS?: KVNamespace;
  DATABASE_URL?: string;
  LOGGER?: string;
  LOG_DEPLOYMENT_ID?: string;
  LOG_DEPLOYMENT_TARGET?: string;
  LOG_LEVEL?: string;
  LOG_PROXY_CLIENT_KEY?: string;
  URL_INITIALS?: string;
  BUNNY_CDN_BASE_URL?: string;
  BUNNY_RESOURCE_FOLDER_PREFIX?: string;
  BUNNY_IMAGE_FOLDER_PREFIX?: string;
  BUNNY_STORAGE_ACCESS_KEY?: string;
  BUNNY_STORAGE_ENDPOINT?: string;
  BUNNY_STORAGE_ZONE_NAME?: string;
};

type RuntimeConfig = {
  clientLogKey?: string;
  logger: Logger;
};

type AppDependencies = {
  getRuntimeConfig?: (
    bindings: ApiBindings,
  ) => Promise<RuntimeConfig> | RuntimeConfig;
  runtimeConfig?: RuntimeConfig;
  getUploadRuntime?: (
    bindings: ApiBindings,
  ) => Promise<UploadRuntime> | UploadRuntime;
  uploadRuntime?: UploadRuntime;
  getClerkWebhookRuntime?: (
    bindings: ApiBindings,
  ) => Promise<ClerkWebhookRuntime> | ClerkWebhookRuntime;
  clerkWebhookRuntime?: ClerkWebhookRuntime;
};

export type ClerkWebhookRuntime = {
  expectedInitials?: string;
  handle(request: Request, targetKind: "local" | "primary"): Promise<Response>;
};

export type UploadRuntime = {
  authenticate(request: Request): Promise<UploadActor | null>;
  isAllowedOrigin(origin: string): boolean;
  service: StorageService;
};

const jsonContent = (schema: z.ZodType) => ({
  "application/json": { schema },
});

const HealthResponseSchema = z
  .object({
    ok: z.boolean().openapi({ example: true }),
    service: z.string().openapi({ example: "api" }),
  })
  .openapi("HealthResponse");

const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: "Expected a JSON request body." }),
  })
  .openapi("ErrorResponse");

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

export function createApp(dependencies: AppDependencies = {}) {
  const app = new OpenAPIHono<{ Bindings: ApiBindings }>();
  const api = new OpenAPIHono<{ Bindings: ApiBindings }>();

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
    await next();
  });
  api.post("/storage/upload-sessions", async (context) => {
    const runtime = await requireUploadRuntime(dependencies, context.env);
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
      const runtime = await requireUploadRuntime(dependencies, context.env);
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
    const runtime = await requireUploadRuntime(dependencies, context.env);
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
    const runtime = await requireUploadRuntime(dependencies, context.env);
    const actor = await runtime.authenticate(context.req.raw);
    if (!actor) return context.json({ error: "unauthorized" }, 401);
    const type = z.enum(fileTypes).safeParse(context.req.param("fileType"));
    const fileId = Number(context.req.param("fileId"));
    if (!type.success || !Number.isSafeInteger(fileId) || fileId <= 0)
      return context.json({ error: "invalid_request" }, 400);
    try {
      await runtime.service.deleteFile({ fileType: type.data, fileId, actor });
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

async function resolveUploadRuntime(
  dependencies: AppDependencies,
  bindings: ApiBindings,
) {
  return (
    (await dependencies.getUploadRuntime?.(bindings)) ??
    dependencies.uploadRuntime
  );
}
async function requireUploadRuntime(
  dependencies: AppDependencies,
  bindings: ApiBindings,
) {
  const runtime = await resolveUploadRuntime(dependencies, bindings);
  if (!runtime) throw new Error("Storage uploads are not configured.");
  return runtime;
}

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
  throw error;
}
