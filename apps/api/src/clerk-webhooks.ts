import { verifyWebhook } from "@clerk/backend/webhooks";
import type { Logger } from "@package/logger";
import { loggerMessages } from "@package/logger";
import type { UsersService } from "@package/services";

export const clerkWebhookPath = "/api/v0/webhooks/clerk";

type TargetKind =
  | "development"
  | "local"
  | "preview"
  | "production"
  | "unknown";

class ForwardingError extends Error {
  constructor(
    readonly targetKind: TargetKind,
    readonly failureCategory: "forwarding" | "target_validation",
  ) {
    super("Clerk webhook forwarding failed.");
  }
}

export type ClerkWebhookTargetMetadata = {
  kind: "local" | "preview";
  url: string;
};

export type ClerkWebhookHandlerOptions = {
  fetch?: typeof fetch;
  logger: Logger;
  signingSecret: string;
  targets?: KVNamespace;
  users: Pick<UsersService, "syncFromClerk">;
  verify?: typeof verifyWebhook;
};

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
        const forwarded = await forwardToTargets(
          options.targets,
          request.headers,
          rawBody,
          options.fetch ?? fetch,
        );
        for (const target of forwarded) {
          await logDelivery(options.logger, {
            deliveryId,
            eventType: event.type,
            status: target.status,
            targetKind: target.kind,
          });
        }
      }
    } catch (error) {
      await logDelivery(options.logger, {
        deliveryId,
        eventType: event.type,
        failureCategory:
          error instanceof ForwardingError
            ? error.failureCategory
            : "forwarding",
        status: 500,
        targetKind:
          error instanceof ForwardingError ? error.targetKind : targetKind,
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

export async function forwardToTargets(
  targets: KVNamespace,
  headers: Headers,
  body: ArrayBuffer,
  request: typeof fetch = fetch,
): Promise<{ kind: "local" | "preview"; status: number }[]> {
  const result = await targets.list<ClerkWebhookTargetMetadata>({
    prefix: "target:",
  });
  return await Promise.all(
    result.keys.map(async ({ metadata, name }) => {
      if (!metadata || !isValidTarget(name, metadata)) {
        throw new ForwardingError(
          metadata?.kind === "local" || metadata?.kind === "preview"
            ? metadata.kind
            : "unknown",
          "target_validation",
        );
      }
      let response: Response;
      try {
        response = await request(metadata.url, {
          body,
          headers: {
            "content-type": headers.get("content-type") ?? "application/json",
            "svix-id": headers.get("svix-id") ?? "",
            "svix-signature": headers.get("svix-signature") ?? "",
            "svix-timestamp": headers.get("svix-timestamp") ?? "",
          },
          method: "POST",
        });
      } catch {
        throw new ForwardingError(metadata.kind, "forwarding");
      }
      if (!response.ok) {
        throw new ForwardingError(metadata.kind, "forwarding");
      }
      return { kind: metadata.kind, status: response.status };
    }),
  );
}

export function isValidTarget(
  key: string,
  metadata: ClerkWebhookTargetMetadata,
): boolean {
  let url: URL;
  try {
    url = new URL(metadata.url);
  } catch {
    return false;
  }
  if (url.username || url.password || url.search || url.hash) return false;

  if (metadata.kind === "local") {
    return (
      /^target:local:[A-Z0-9]+$/u.test(key) &&
      url.protocol === "https:" &&
      url.hostname === "webhooks.clerk.com" &&
      /^\/in\/c_[0-9A-Za-z]{10}\/$/u.test(url.pathname)
    );
  }

  const prNumber = key.match(/^target:preview:(\d+)$/u)?.[1];
  return Boolean(
    prNumber &&
      url.protocol === "https:" &&
      url.pathname === clerkWebhookPath &&
      url.hostname.match(
        new RegExp(
          `^pr-${prNumber}-pocket-trash-api-preview\\.[a-z0-9-]+\\.workers\\.dev$`,
          "u",
        ),
      ),
  );
}

async function logDelivery(
  logger: Logger,
  attributes: {
    deliveryId: string;
    eventType?: string;
    failureCategory?:
      | "database"
      | "forwarding"
      | "target_validation"
      | "verification";
    status: number;
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
