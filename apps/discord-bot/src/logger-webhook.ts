import { createHash, timingSafeEqual } from "node:crypto";
import {
  type LoggerNotificationEvent,
  loggerNotificationEventSchema,
  matchesLoggerNotificationRules,
} from "@package/logger";
import { type WebhookDelivery, WebhookIntakeError } from "./app.js";
import type { DeliveryJob, QueuedNotification } from "./queue.js";

/** Maximum accepted logger webhook body size. */
const maximumBodyBytes = 64 * 1024;

/** App-bound credentials accepted by the logger intake. */
export type LoggerWebhookTokens = Readonly<
  Record<"api" | "scraper" | "web", string>
>;

/**
 * Creates the authenticated logger webhook normalizer.
 *
 * @param options - Destination channel and app-bound credentials.
 * @returns A request normalizer that produces queue deliveries for matching events.
 * @rejects When authentication, body size, or payload validation fails.
 */
export function createLoggerWebhookNormalizer(options: {
  /** Discord channel that receives logger notifications. */
  channelId: string;
  /** Credentials bound to each allowed source app. */
  tokens: LoggerWebhookTokens;
}) {
  return async (
    request: Request,
  ): Promise<WebhookDelivery<DeliveryJob> | undefined> => {
    const authenticatedApp = authenticateApp(
      request.headers.get("authorization"),
      options.tokens,
    );
    if (!authenticatedApp)
      throw new WebhookIntakeError(401, "Invalid bearer token.");

    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > maximumBodyBytes) {
      throw new WebhookIntakeError(
        400,
        "Logger notification body is too large.",
      );
    }
    const body = await request.text();
    if (Buffer.byteLength(body) > maximumBodyBytes) {
      throw new WebhookIntakeError(
        400,
        "Logger notification body is too large.",
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new WebhookIntakeError(
        400,
        "Logger notification body is not JSON.",
      );
    }
    const parsed = loggerNotificationEventSchema.safeParse(json);
    if (!parsed.success || parsed.data.app !== authenticatedApp) {
      throw new WebhookIntakeError(
        400,
        "Logger notification payload is invalid.",
      );
    }
    if (!matchesLoggerNotificationRules(parsed.data)) return undefined;

    return {
      id: parsed.data.eventId,
      payload: createLoggerDelivery(parsed.data, options.channelId),
    };
  };
}

/**
 * Creates the identical safe queue envelope for direct and Axiom delivery.
 *
 * @param event - Validated projected event.
 * @param channelId - Final notification channel.
 * @returns Serializable delivery without original source payloads.
 */
export function createLoggerDelivery(
  event: LoggerNotificationEvent,
  channelId: string,
): DeliveryJob {
  return {
    deliveryId: event.eventId,
    destinationChannelId: channelId,
    kind: "logger",
    notification: renderInput(event),
    version: 1,
  };
}

/**
 * Authenticates without leaking which app token matched.
 *
 * @param authorization - Incoming HTTP Authorization header.
 * @param tokens - App-bound accepted credentials.
 * @returns The authenticated app, or `undefined` when no token matches.
 */
function authenticateApp(
  authorization: string | null,
  tokens: LoggerWebhookTokens,
): keyof LoggerWebhookTokens | undefined {
  const supplied = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  let match: keyof LoggerWebhookTokens | undefined;
  for (const [app, token] of Object.entries(tokens) as [
    keyof LoggerWebhookTokens,
    string,
  ][]) {
    const tokenDigest = createHash("sha256").update(token).digest();
    if (timingSafeEqual(suppliedDigest, tokenDigest)) match = app;
  }
  return match;
}

/**
 * Converts a safe logger event into the approved Discord card input.
 *
 * @param event - Validated logger notification event.
 * @returns The bounded container-card input.
 */
function renderInput(event: LoggerNotificationEvent): QueuedNotification {
  const errorTitle = (event.error?.message ?? event.message).slice(0, 300);
  return {
    description: `A ${event.level} event was reported by ${event.app}.`,
    diagnostics: event.error
      ? [`${event.error.name}: ${event.error.message}`.slice(0, 1_000)]
      : undefined,
    occurredAt: event.timestamp,
    provenance: event.deploymentId ?? event.deploymentTarget ?? event.eventId,
    source: "Logger",
    status: `${event.environment} ${event.level}`,
    tags: [event.app, event.environment, event.message.slice(0, 100)],
    title: errorTitle,
    tone: "error",
  };
}
