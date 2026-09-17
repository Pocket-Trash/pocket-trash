import {
  createAxiomTransport,
  createConsoleTransport,
  createLogger,
  isLogLevel,
  loggerMessages,
  loggerValues,
  normalizeConsoleTransportMode,
  normalizeLogLevel,
} from "@package/logger";
import { type ApiBindings, createApp } from "./app.js";

const app = createApp({
  getRuntimeConfig(bindings) {
    validateApiBindings(bindings);

    return {
      clientLogKey: bindings.LOG_PROXY_CLIENT_KEY,
      logger: createApiLogger(bindings),
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

function createApiLogger(env: ApiBindings) {
  const environment = env.APP_ENV ?? "unknown";
  const hasAxiom = Boolean(env.AXIOM_TOKEN && env.AXIOM_DATASET);
  const transports = [
    ...(hasAxiom
      ? [
          createAxiomTransport({
            dataset: env.AXIOM_DATASET as string,
            edgeDomain: env.AXIOM_EDGE_DOMAIN,
            token: env.AXIOM_TOKEN as string,
          }),
        ]
      : []),
    ...(environment === "development" || !hasAxiom
      ? [
          createConsoleTransport({
            mode: normalizeConsoleTransportMode(env.LOGGER),
          }),
        ]
      : []),
  ];

  return createLogger({
    app: loggerValues.apps.api,
    deploymentId: env.LOG_DEPLOYMENT_ID ?? environment,
    deploymentTarget: env.LOG_DEPLOYMENT_TARGET ?? "cloudflare-worker",
    environment,
    level: normalizeLogLevel(env.LOG_LEVEL),
    transports,
  });
}

async function logWorkerException(
  error: unknown,
  env: ApiBindings,
  request: Request,
) {
  const logger = createApiLogger(env);
  logger.error(loggerMessages.api.workerUnhandledException, {
    attributes: {
      method: request.method,
      path: new URL(request.url).pathname,
      source: "cloudflare-worker",
      trigger: "fetch",
    },
    error,
  });
  await logger.flush();
}

export default {
  fetch: handleWorkerFetch,
};
