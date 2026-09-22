import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  createNoopLogger,
  type Logger,
  loggerValues,
  logLevels,
  parseClientLogEvents,
} from "@package/logger";
import {
  maxCatalogImageFileBytes,
  maxCatalogImageFiles,
  maxSessionFileBytes,
} from "@package/resources";
import { Scalar } from "@scalar/hono-api-reference";
import {
  type CatalogImageActor,
  CatalogImageUploadError,
  type CatalogImageUploadSessionsService,
} from "./catalog-image-upload-sessions.js";
import {
  ResourceUploadSessionError,
  type ResourceUploadSessionInput,
  type ResourceUploadSessionsService,
} from "./resource-upload-sessions.js";

export const apiPrefix = "/api/v0";
export const healthPath = `${apiPrefix}/health`;
export const logsPath = `${apiPrefix}/logs`;
export const resourceUploadSessionsPath = `${apiPrefix}/resource-upload-sessions`;
export const catalogImageUploadSessionsPath = `${apiPrefix}/catalog-image-upload-sessions`;
export const openApiJsonPath = `${apiPrefix}/openapi.json`;
export const apiDocsPath = `${apiPrefix}/docs`;

export type ApiBindings = Omit<Env, "APP_ENV"> & {
  APP_ENV?: string;
  AXIOM_DATASET?: string;
  AXIOM_EDGE_DOMAIN?: string;
  AXIOM_TOKEN?: string;
  CLERK_SECRET_KEY?: string;
  DATABASE_URL?: string;
  LOGGER?: string;
  LOG_DEPLOYMENT_ID?: string;
  LOG_DEPLOYMENT_TARGET?: string;
  LOG_LEVEL?: string;
  LOG_PROXY_CLIENT_KEY?: string;
  BUNNY_CDN_BASE_URL?: string;
  BUNNY_RESOURCE_FOLDER_PREFIX?: string;
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
  getResourceUploadRuntime?: (
    bindings: ApiBindings,
  ) => Promise<ResourceUploadRuntime> | ResourceUploadRuntime;
  resourceUploadRuntime?: ResourceUploadRuntime;
  getCatalogImageUploadRuntime?: (
    bindings: ApiBindings,
  ) => Promise<CatalogImageUploadRuntime> | CatalogImageUploadRuntime;
  catalogImageUploadRuntime?: CatalogImageUploadRuntime;
};

export type ResourceUploadRuntime = {
  authenticate(request: Request): Promise<string | null>;
  isAllowedOrigin(origin: string): boolean;
  service: ResourceUploadSessionsService;
};

export type CatalogImageUploadRuntime = {
  authenticate(request: Request): Promise<CatalogImageActor | null>;
  isAllowedOrigin(origin: string): boolean;
  service: CatalogImageUploadSessionsService;
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

const ResourceUploadErrorSchema = z
  .object({ error: z.string().openapi({ example: "invalid_request" }) })
  .openapi("ResourceUploadError");

const ResourceUploadFileSchema = z.object({
  contentType: z.string().min(1).max(255),
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive().max(maxSessionFileBytes),
});

const CatalogImageUploadSessionSchema = z.object({
  files: z
    .array(
      z.object({
        contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        fileName: z.string().min(1).max(255),
        sha256: z.string().regex(/^[0-9a-f]{64}$/u),
        size: z.number().int().positive().max(maxCatalogImageFileBytes),
      }),
    )
    .min(1)
    .max(maxCatalogImageFiles),
  targetId: z.number().int().positive(),
  targetType: z.enum(["product", "collection", "collection_item"]),
});

const ResourceUploadSessionSchema = z.discriminatedUnion("operation", [
  z.object({
    categories: z.array(z.string().min(1).max(60)).min(1).max(10),
    description: z.string().min(1).max(5000),
    files: z.array(ResourceUploadFileSchema).min(1).max(10),
    images: z.array(ResourceUploadFileSchema).min(1).max(10),
    isPrivate: z.boolean().default(false),
    name: z.string().min(1).max(120),
    operation: z.literal("create"),
  }),
  z.object({
    files: z.array(ResourceUploadFileSchema).min(1).max(10),
    operation: z.literal("version"),
    resourceId: z.number().int().positive(),
  }),
]);

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

  for (const path of [
    "/resource-upload-sessions",
    "/resource-upload-sessions/*",
    "/catalog-image-upload-sessions",
    "/catalog-image-upload-sessions/*",
  ]) {
    api.use(path, async (context, next) => {
      const origin = context.req.header("origin");
      const runtime = path.startsWith("/catalog-image")
        ? await resolveCatalogImageUploadRuntime(dependencies, context.env)
        : await resolveResourceUploadRuntime(dependencies, context.env);
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
          "DELETE, PATCH, POST, PUT, OPTIONS",
        );
        return context.body(null, 204);
      }
      await next();
    });
  }

  api.post("/resource-upload-sessions", async (context) => {
    const runtime = await requireResourceUploadRuntime(
      dependencies,
      context.env,
    );
    const userId = await runtime.authenticate(context.req.raw);
    if (!userId) return context.json({ error: "unauthorized" }, 401);

    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_request" }, 400);
    }
    const parsed = ResourceUploadSessionSchema.safeParse(body);
    if (!parsed.success) {
      return context.json({ error: "invalid_request" }, 400);
    }

    try {
      return context.json(
        await runtime.service.create(
          parsed.data as ResourceUploadSessionInput,
          userId,
        ),
        201,
      );
    } catch (error) {
      return resourceUploadErrorResponse(error);
    }
  });

  api.put(
    "/resource-upload-sessions/:sessionId/files/:fileId",
    async (context) => {
      const runtime = await requireResourceUploadRuntime(
        dependencies,
        context.env,
      );
      const userId = await runtime.authenticate(context.req.raw);
      if (!userId) return context.json({ error: "unauthorized" }, 401);

      try {
        await runtime.service.upload(
          context.req.param("sessionId"),
          context.req.param("fileId"),
          userId,
          context.req.raw,
        );
        return context.body(null, 204);
      } catch (error) {
        return resourceUploadErrorResponse(error);
      }
    },
  );

  api.post("/resource-upload-sessions/:sessionId/complete", async (context) => {
    const runtime = await requireResourceUploadRuntime(
      dependencies,
      context.env,
    );
    const userId = await runtime.authenticate(context.req.raw);
    if (!userId) return context.json({ error: "unauthorized" }, 401);

    try {
      return context.json(
        await runtime.service.complete(context.req.param("sessionId"), userId),
        200,
      );
    } catch (error) {
      return resourceUploadErrorResponse(error);
    }
  });

  api.post("/catalog-image-upload-sessions", async (context) => {
    const runtime = await requireCatalogImageUploadRuntime(
      dependencies,
      context.env,
    );
    const actor = await runtime.authenticate(context.req.raw);
    if (!actor) return context.json({ error: "unauthorized" }, 401);
    const parsed = CatalogImageUploadSessionSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) return context.json({ error: "invalid_request" }, 400);
    try {
      return context.json(
        await runtime.service.create(parsed.data, actor),
        201,
      );
    } catch (error) {
      return catalogImageUploadErrorResponse(error);
    }
  });

  api.patch(
    "/catalog-image-upload-sessions/collections/:collectionId/cover",
    async (context) => {
      const runtime = await requireCatalogImageUploadRuntime(
        dependencies,
        context.env,
      );
      const actor = await runtime.authenticate(context.req.raw);
      if (!actor) return context.json({ error: "unauthorized" }, 401);
      const parsed = z
        .object({ imageId: z.number().int().positive().nullable() })
        .safeParse(await context.req.json().catch(() => null));
      const collectionId = Number(context.req.param("collectionId"));
      if (
        !parsed.success ||
        !Number.isSafeInteger(collectionId) ||
        collectionId <= 0
      ) {
        return context.json({ error: "invalid_request" }, 400);
      }
      try {
        await runtime.service.selectCollectionCover(
          collectionId,
          parsed.data.imageId,
          actor,
        );
        return context.body(null, 204);
      } catch (error) {
        return catalogImageUploadErrorResponse(error);
      }
    },
  );

  api.delete(
    "/catalog-image-upload-sessions/collections/:collectionId/covers/:imageId",
    async (context) => {
      const runtime = await requireCatalogImageUploadRuntime(
        dependencies,
        context.env,
      );
      const actor = await runtime.authenticate(context.req.raw);
      if (!actor) return context.json({ error: "unauthorized" }, 401);
      const collectionId = Number(context.req.param("collectionId"));
      const imageId = Number(context.req.param("imageId"));
      if (
        !Number.isSafeInteger(collectionId) ||
        collectionId <= 0 ||
        !Number.isSafeInteger(imageId) ||
        imageId <= 0
      ) {
        return context.json({ error: "invalid_request" }, 400);
      }
      try {
        await runtime.service.deleteCollectionCover(
          collectionId,
          imageId,
          actor,
        );
        return context.body(null, 204);
      } catch (error) {
        return catalogImageUploadErrorResponse(error);
      }
    },
  );

  api.put(
    "/catalog-image-upload-sessions/:sessionId/files/:fileId",
    async (context) => {
      const runtime = await requireCatalogImageUploadRuntime(
        dependencies,
        context.env,
      );
      const actor = await runtime.authenticate(context.req.raw);
      if (!actor) return context.json({ error: "unauthorized" }, 401);
      try {
        await runtime.service.upload(
          context.req.param("sessionId"),
          context.req.param("fileId"),
          actor,
          context.req.raw,
        );
        return context.body(null, 204);
      } catch (error) {
        return catalogImageUploadErrorResponse(error);
      }
    },
  );

  api.post(
    "/catalog-image-upload-sessions/:sessionId/complete",
    async (context) => {
      const runtime = await requireCatalogImageUploadRuntime(
        dependencies,
        context.env,
      );
      const actor = await runtime.authenticate(context.req.raw);
      if (!actor) return context.json({ error: "unauthorized" }, 401);
      try {
        await runtime.service.complete(context.req.param("sessionId"), actor);
        return context.json({ ok: true }, 200);
      } catch (error) {
        return catalogImageUploadErrorResponse(error);
      }
    },
  );

  api.openAPIRegistry.registerPath({
    method: "post",
    path: "/resource-upload-sessions",
    operationId: "createResourceUploadSession",
    summary: "Create a resource upload session",
    tags: ["Resources"],
    request: {
      body: {
        required: true,
        content: jsonContent(ResourceUploadSessionSchema),
      },
    },
    responses: {
      201: { description: "The upload session was created." },
      400: {
        description: "The upload declaration was invalid.",
        content: jsonContent(ResourceUploadErrorSchema),
      },
      401: {
        description: "Authentication is required.",
        content: jsonContent(ResourceUploadErrorSchema),
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

async function resolveResourceUploadRuntime(
  dependencies: AppDependencies,
  bindings: ApiBindings,
): Promise<ResourceUploadRuntime | undefined> {
  return (
    (await dependencies.getResourceUploadRuntime?.(bindings)) ??
    dependencies.resourceUploadRuntime
  );
}

async function requireResourceUploadRuntime(
  dependencies: AppDependencies,
  bindings: ApiBindings,
): Promise<ResourceUploadRuntime> {
  const runtime = await resolveResourceUploadRuntime(dependencies, bindings);
  if (!runtime) throw new Error("Resource uploads are not configured.");
  return runtime;
}

async function resolveCatalogImageUploadRuntime(
  dependencies: AppDependencies,
  bindings: ApiBindings,
) {
  return (
    (await dependencies.getCatalogImageUploadRuntime?.(bindings)) ??
    dependencies.catalogImageUploadRuntime
  );
}

async function requireCatalogImageUploadRuntime(
  dependencies: AppDependencies,
  bindings: ApiBindings,
) {
  const runtime = await resolveCatalogImageUploadRuntime(
    dependencies,
    bindings,
  );
  if (!runtime) throw new Error("Catalog image uploads are not configured.");
  return runtime;
}

function resourceUploadErrorResponse(error: unknown): Response {
  if (error instanceof ResourceUploadSessionError) {
    return Response.json({ error: error.code }, { status: error.status });
  }
  throw error;
}

function catalogImageUploadErrorResponse(error: unknown): Response {
  if (error instanceof CatalogImageUploadError) {
    return Response.json(
      {
        error: error.code,
        ...(error.imageId ? { imageId: error.imageId } : {}),
        ...(error.sha256 ? { sha256: error.sha256 } : {}),
      },
      { status: error.status },
    );
  }
  throw error;
}
