import { verifyWebhook } from "@clerk/backend/webhooks";
import type { Logger } from "@package/logger";
import { loggerMessages } from "@package/logger";
import type { UsersService } from "@package/services";
import {
  createErasureSubjectHmac,
  type ErasureService,
} from "@package/services";
import {
  forwardToTargets,
  WebhookForwardingError,
} from "./webhook-forwarding.js";

/** Public API path that receives Clerk webhook deliveries. */
export const clerkWebhookPath = "/api/v0/webhooks/clerk";

/** Deployment category recorded for a webhook delivery target. */
type TargetKind =
  | "development"
  | "local"
  | "preview"
  | "production"
  | "unknown";

/** Dependencies and secrets for verified Clerk webhook processing. */
export type ClerkWebhookHandlerOptions = {
  /** Erasure service required for Clerk user-deletion events. */
  erasure?: Pick<ErasureService, "handleClerkDeletion">;
  /** Secret used to pseudonymize deleted Clerk identities. */
  erasureHmacSecret?: string;
  /** HTTP client used to forward verified deliveries. */
  fetch?: typeof fetch;
  /** Delivery logger. */
  logger: Logger;
  /** Clerk webhook signing secret. */
  signingSecret: string;
  /** Optional KV registry of downstream webhook targets. */
  targets?: KVNamespace;
  /** User synchronization service for create and update events. */
  users: Pick<UsersService, "syncFromClerk">;
  /** Webhook verifier override used by tests. */
  verify?: typeof verifyWebhook;
};

/**
 * Creates a verified Clerk user webhook handler.
 *
 * @param options - Handler dependencies and configuration.
 * @returns A request handler for Clerk webhook deliveries.
 */
export function createClerkWebhookHandler(options: ClerkWebhookHandlerOptions) {
  return async (
    request: Request,
    targetKind: TargetKind,
  ): Promise<Response> => {
    const deliveryId = request.headers.get("svix-id") ?? "unknown";
    const rawBody = await request.arrayBuffer();
    let event: Awaited<ReturnType<typeof verifyWebhook>>;

    try {
      event = await (options.verify ?? verifyWebhook)(
        new Request(request.url, {
          body: rawBody,
          headers: request.headers,
          method: request.method,
        }),
        { signingSecret: options.signingSecret },
      );
    } catch {
      await logDelivery(options.logger, {
        deliveryId,
        failureCategory: "verification",
        status: 400,
        targetKind,
      });
      return new Response(null, { status: 400 });
    }

    try {
      if (event.type === "user.created" || event.type === "user.updated") {
        await options.users.syncFromClerk({
          clerkId: event.data.id,
          clerkUpdatedAt: new Date(event.data.updated_at),
          username: event.data.username ?? "",
        });
      } else if (event.type === "user.deleted") {
        if (!options.erasure || !options.erasureHmacSecret || !event.data.id) {
          throw new Error("Erasure webhook handling is not configured.");
        }
        await options.erasure.handleClerkDeletion({
          subjectHmac: await createErasureSubjectHmac(
            event.data.id,
            options.erasureHmacSecret,
          ),
          targetClerkId: event.data.id,
        });
      }
    } catch {
      await logDelivery(options.logger, {
        deliveryId,
        eventType: event.type,
        failureCategory: "database",
        status: 500,
        targetKind,
      });
      return new Response(null, { status: 500 });
    }

    try {
      if (options.targets) {
        const forwarded = await forwardToTargets({
          body: rawBody,
          fetch: options.fetch,
          headers: request.headers,
          provider: "clerk",
          targets: options.targets,
          webhookPath: clerkWebhookPath,
        });
        for (const target of forwarded) {
          await logDelivery(options.logger, {
            deliveryId,
            eventType: event.type,
            status: target.status,
            targetKey: target.key,
            targetKind: target.kind,
          });
        }
      }
    } catch (error) {
      await logDelivery(options.logger, {
        deliveryId,
        eventType: event.type,
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
      eventType: event.type,
      status: 204,
      targetKind,
    });
    return new Response(null, { status: 204 });
  };
}

/**
 * Records and flushes a Clerk webhook delivery result.
 *
 * @param logger - Delivery logger.
 * @param attributes - Safe delivery and target context.
 * @returns A promise that resolves after logs are flushed.
 */
async function logDelivery(
  logger: Logger,
  attributes: {
    /** Svix delivery identifier, or `unknown` when absent. */
    deliveryId: string;
    /** Verified Clerk event type, when verification succeeded. */
    eventType?: string;
    /** Processing stage responsible for an unsuccessful response. */
    failureCategory?:
      | "database"
      | "forwarding"
      | "target_validation"
      | "verification";
    /** HTTP delivery status. */
    status: number;
    /** KV key for the forwarded target. */
    targetKey?: string;
    /** Deployment category receiving or forwarding the delivery. */
    targetKind: TargetKind;
  },
) {
  const data = { attributes };
  if (attributes.status >= 500) {
    logger.error(loggerMessages.api.clerkWebhookDelivery, data);
  } else if (attributes.status >= 400) {
    logger.warn(loggerMessages.api.clerkWebhookDelivery, data);
  } else {
    logger.info(loggerMessages.api.clerkWebhookDelivery, data);
  }
  await logger.flush();
}
