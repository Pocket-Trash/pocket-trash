import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "@hono/zod-openapi";
import type { Logger } from "@package/logger";
import { loggerMessages } from "@package/logger";
import type { FeedbackService } from "@package/services";
import {
  forwardToTargets,
  WebhookForwardingError,
} from "./webhook-forwarding.js";

/** Public Linear webhook endpoint path. */
export const linearWebhookPath = "/api/v0/webhooks/linear";

/** Environment receiving or forwarded a Linear webhook. */
type TargetKind =
  | "development"
  | "local"
  | "preview"
  | "production"
  | "unknown";

/** Accepted Linear lifecycle webhook payload. */
export const linearWebhookSchema = z.object({
  action: z.enum(["create", "remove", "update"]),
  createdAt: z.string(),
  data: z.object({
    archivedAt: z.string().nullable().optional(),
    id: z.uuid(),
    state: z.object({ type: z.string() }).optional(),
    status: z.object({ type: z.string() }).optional(),
    updatedAt: z.string().optional(),
  }),
  type: z.enum(["Issue", "Project"]),
  webhookTimestamp: z.number().int(),
});

/**
 * Creates a verified Linear lifecycle webhook handler.
 *
 * @param options - Handler dependencies and configuration.
 * @returns A request handler for Linear webhook deliveries.
 */
export function createLinearWebhookHandler(options: {
  /** Feedback lifecycle service. */
  feedback: Pick<FeedbackService, "syncLinearStatus">;
  /** HTTP request implementation used for forwarding. */
  fetch?: typeof fetch;
  /** Delivery logger. */
  logger: Logger;
  /**
   * Provides the current time for replay protection.
   *
   * @returns The current time.
   */
  now?: () => Date;
  /** Linear webhook signing secret. */
  signingSecret: string;
  /** Shared development webhook target namespace. */
  targets?: KVNamespace;
}) {
  return async (
    request: Request,
    targetKind: TargetKind = "production",
  ): Promise<Response> => {
    const deliveryId = request.headers.get("linear-delivery") ?? "unknown";
    const rawBody = await request.arrayBuffer();
    if (
      !validSignature(
        request.headers.get("linear-signature"),
        rawBody,
        options.signingSecret,
      )
    ) {
      await logDelivery(options.logger, {
        deliveryId,
        failureCategory: "verification",
        status: 401,
        targetKind,
      });
      return new Response(null, { status: 401 });
    }

    let parsed: z.infer<typeof linearWebhookSchema>;
    try {
      parsed = linearWebhookSchema.parse(
        JSON.parse(new TextDecoder().decode(rawBody)),
      );
    } catch {
      await logDelivery(options.logger, {
        deliveryId,
        failureCategory: "payload",
        status: 400,
        targetKind,
      });
      return new Response(null, { status: 400 });
    }
    const currentTime = (options.now ?? (() => new Date()))().getTime();
    if (Math.abs(currentTime - parsed.webhookTimestamp) > 60_000) {
      await logDelivery(options.logger, {
        deliveryId,
        failureCategory: "replay",
        status: 401,
        targetKind,
      });
      return new Response(null, { status: 401 });
    }

    const occurredAt = new Date(parsed.data.updatedAt ?? parsed.createdAt);
    if (Number.isNaN(occurredAt.getTime())) {
      await logDelivery(options.logger, {
        deliveryId,
        failureCategory: "payload",
        status: 400,
        targetKind,
      });
      return new Response(null, { status: 400 });
    }
    try {
      await options.feedback.syncLinearStatus({
        action: parsed.action,
        archived: Boolean(parsed.data.archivedAt),
        entityType: parsed.type === "Issue" ? "issue" : "project",
        entityUuid: parsed.data.id,
        occurredAt,
        stateType:
          parsed.type === "Issue"
            ? parsed.data.state?.type
            : parsed.data.status?.type,
      });
    } catch {
      await logDelivery(options.logger, {
        deliveryId,
        eventType: `${parsed.type}.${parsed.action}`,
        failureCategory: "database",
        status: 500,
        targetKind,
      });
      return new Response(null, { status: 500 });
    }

    try {
      if (options.targets && targetKind === "development") {
        const forwarded = await forwardToTargets({
          body: rawBody,
          fetch: options.fetch,
          headers: request.headers,
          provider: "linear",
          targets: options.targets,
          webhookPath: linearWebhookPath,
        });
        for (const target of forwarded) {
          await logDelivery(options.logger, {
            deliveryId,
            eventType: `${parsed.type}.${parsed.action}`,
            status: target.status,
            targetKey: target.key,
            targetKind: target.kind,
          });
        }
      }
    } catch (error) {
      await logDelivery(options.logger, {
        deliveryId,
        eventType: `${parsed.type}.${parsed.action}`,
        failureCategory:
          error instanceof WebhookForwardingError
            ? error.failureCategory
            : "forwarding",
        status: 500,
        targetKey:
          error instanceof WebhookForwardingError ? error.targetKey : undefined,
        targetKind:
          error instanceof WebhookForwardingError
            ? error.targetKind
            : targetKind,
      });
      return new Response(null, { status: 500 });
    }

    await logDelivery(options.logger, {
      deliveryId,
      eventType: `${parsed.type}.${parsed.action}`,
      status: 200,
      targetKind,
    });
    return new Response(null, { status: 200 });
  };
}

/**
 * Verifies a Linear webhook signature against the exact request body.
 *
 * @param signature - Hex-encoded signature header.
 * @param body - Exact raw request body.
 * @param signingSecret - Linear webhook signing secret.
 * @returns Whether the signature is valid.
 */
function validSignature(
  signature: string | null,
  body: ArrayBuffer,
  signingSecret: string,
) {
  if (!signature || !/^[0-9a-f]{64}$/iu.test(signature)) return false;
  const expected = createHmac("sha256", signingSecret)
    .update(Buffer.from(body))
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

/**
 * Records and flushes a Linear webhook delivery result.
 *
 * @param logger - Delivery logger.
 * @param attributes - Safe delivery and target context.
 * @returns A promise that resolves after logs are flushed.
 */
async function logDelivery(
  logger: Logger,
  attributes: {
    /** Linear delivery identifier. */
    deliveryId: string;
    /** Linear event type and action. */
    eventType?: string;
    /** Safe failure classification. */
    failureCategory?:
      | "database"
      | "forwarding"
      | "payload"
      | "replay"
      | "target_validation"
      | "verification";
    /** HTTP delivery status. */
    status: number;
    /** KV key for the forwarded target. */
    targetKey?: string;
    /** Environment that handled the delivery. */
    targetKind: TargetKind;
  },
) {
  const data = { attributes };
  if (attributes.status >= 500)
    logger.error(loggerMessages.api.linearWebhookDelivery, data);
  else if (attributes.status >= 400)
    logger.warn(loggerMessages.api.linearWebhookDelivery, data);
  else logger.info(loggerMessages.api.linearWebhookDelivery, data);
  await logger.flush();
}
