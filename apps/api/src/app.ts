import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  createNoopLogger,
  type Logger,
  loggerValues,
  logLevels,
  parseClientLogEvents,
} from "@package/logger";
import { Scalar } from "@scalar/hono-api-reference";

export const apiPrefix = "/api/v0";
export const healthPath = `${apiPrefix}/health`;
export const logsPath = `${apiPrefix}/logs`;
export const openApiJsonPath = `${apiPrefix}/openapi.json`;
export const apiDocsPath = `${apiPrefix}/docs`;

export type ApiBindings = Omit<Env, "APP_ENV"> & {
  APP_ENV?: string;
  AXIOM_DATASET?: string;
  AXIOM_EDGE_DOMAIN?: string;
  AXIOM_TOKEN?: string;
  LOGGER?: string;
  LOG_DEPLOYMENT_ID?: string;
  LOG_DEPLOYMENT_TARGET?: string;
  LOG_LEVEL?: string;
  LOG_PROXY_CLIENT_KEY?: string;
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
