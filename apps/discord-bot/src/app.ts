import { Hono } from "hono";
import type { BotReadiness } from "./readiness.js";

/** Dependencies required by the bot HTTP application. */
type CreateAppOptions = {
  /** Live readiness controller. */
  readiness: Pick<BotReadiness, "check">;
  /** Source-specific webhook routes to mount. */
  webhookRoutes?: readonly WebhookRoute[];
};

/** Authenticated source-specific webhook route. */
type WebhookRoute = {
  /**
   * Handles one source webhook request.
   *
   * @param request - Untrusted source request.
   * @returns Source acknowledgement response.
   */
  handle(request: Request): Promise<Response>;
  /** Absolute Hono route path. */
  path: string;
};

/**
 * Normalized source delivery persisted before acknowledgement.
 *
 * @template TPayload - Normalized source payload.
 */
export type WebhookDelivery<TPayload> = {
  /** Stable delivery identifier. */
  id: string;
  /** Normalized source payload. */
  payload: TPayload;
};

/**
 * Source-specific operations used by the shared webhook boundary.
 *
 * @template TPayload - Normalized source payload.
 */
type WebhookIntakeOptions<TPayload> = {
  /**
   * Persists one normalized job.
   *
   * @param input - Stable delivery identifier and normalized payload.
   * @returns The queue persistence result.
   */
  enqueue(input: WebhookDelivery<TPayload>): Promise<unknown>;
  /**
   * Authenticates and normalizes a request before queue access.
   *
   * @param request - Untrusted source request.
   * @returns The stable identifier and normalized payload.
   */
  normalize(request: Request): Promise<WebhookDelivery<TPayload> | undefined>;
};

/** Expected client error raised while authenticating or validating a webhook. */
export class WebhookIntakeError extends Error {
  /** HTTP response status returned to the webhook source. */
  readonly status: 400 | 401;

  /**
   * Creates an expected webhook intake error.
   *
   * @param status - HTTP status exposed to the source.
   * @param message - Internal diagnostic message.
   */
  constructor(status: 400 | 401, message: string) {
    super(message);
    this.name = "WebhookIntakeError";
    this.status = status;
  }
}

/**
 * Creates the bot HTTP application and readiness endpoint.
 *
 * @param options - Runtime readiness dependency.
 * @returns The configured Hono application.
 */
export function createApp(options: CreateAppOptions) {
  const app = new Hono();
  app.get("/health", async (context) => {
    const readiness = await options.readiness.check();
    return context.json(
      { app: "discord-bot", ok: readiness.ok },
      readiness.ok ? 200 : 503,
    );
  });
  for (const route of options.webhookRoutes ?? []) {
    app.post(route.path, (context) => route.handle(context.req.raw));
  }
  return app;
}

/**
 * Creates the authenticate/normalize/enqueue HTTP boundary used by later adapters.
 *
 * @template TPayload - Normalized source payload.
 * @param options - Source normalization and queue persistence operations.
 * @returns A request handler that acknowledges only persisted work.
 */
export function createWebhookIntake<TPayload>(
  options: WebhookIntakeOptions<TPayload>,
): (request: Request) => Promise<Response> {
  /**
   * Handles one source-specific webhook request.
   *
   * @param request - Untrusted source request.
   * @returns A retriable response unless work was durably queued.
   */
  return async (request: Request) => {
    let normalized: WebhookDelivery<TPayload> | undefined;
    try {
      normalized = await options.normalize(request);
    } catch (error) {
      const status = error instanceof WebhookIntakeError ? error.status : 400;
      return Response.json({ ok: false }, { status });
    }

    if (!normalized) return new Response(null, { status: 204 });

    try {
      await options.enqueue(normalized);
      return Response.json({ ok: true }, { status: 202 });
    } catch {
      return Response.json({ ok: false }, { status: 503 });
    }
  };
}
