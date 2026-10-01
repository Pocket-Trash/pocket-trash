/** Supported webhook providers for development forwarding. */
export type WebhookProvider = "clerk" | "linear";

/** Metadata stored with a development webhook target. */
export type WebhookTargetMetadata = {
  /** Target environment kind. */
  kind: "local" | "preview";
  /** Public HTTPS destination. */
  url: string;
};

/** Forwarding failure with safe target context for structured logs. */
export class WebhookForwardingError extends Error {
  /**
   * Creates a forwarding failure.
   *
   * @param targetKey - KV key identifying the failed target.
   * @param targetKind - Target environment kind.
   * @param failureCategory - Safe failure classification.
   */
  constructor(
    readonly targetKey: string,
    readonly targetKind: "local" | "preview" | "unknown",
    readonly failureCategory: "forwarding" | "target_validation",
  ) {
    super("Webhook forwarding failed.");
  }
}

/** Required signature headers forwarded for each provider. */
const providerHeaders = {
  clerk: ["svix-id", "svix-signature", "svix-timestamp"],
  linear: [
    "linear-delivery",
    "linear-event",
    "linear-signature",
    "linear-timestamp",
  ],
} as const;

/**
 * Forwards an exact signed webhook body to registered targets.
 *
 * @param options - Forwarding configuration.
 * @param options.body - Exact signed request body.
 * @param options.fetch - HTTP request implementation.
 * @param options.headers - Original request headers.
 * @param options.provider - Webhook provider.
 * @param options.targets - Shared development target namespace.
 * @param options.webhookPath - Provider webhook path.
 * @returns Successful target delivery results.
 * @rejects When target validation or delivery fails.
 */
export async function forwardToTargets(options: {
  /** Exact signed request body. */
  body: ArrayBuffer;
  /** HTTP request implementation. */
  fetch?: typeof fetch;
  /** Original request headers. */
  headers: Headers;
  /** Webhook provider. */
  provider: WebhookProvider;
  /** Shared development target namespace. */
  targets: KVNamespace;
  /** Provider webhook path. */
  webhookPath: string;
}): Promise<
  {
    /** KV target key. */
    key: string;
    /** Target environment kind. */
    kind: "local" | "preview";
    /** HTTP response status. */
    status: number;
  }[]
> {
  const result = await options.targets.list<WebhookTargetMetadata>({
    prefix: `${options.provider === "clerk" ? "" : "linear-"}target:`,
  });
  const request = options.fetch ?? fetch;

  return await Promise.all(
    result.keys.map(async ({ metadata, name }) => {
      if (
        !metadata ||
        !isValidTarget(options.provider, name, metadata, options.webhookPath)
      ) {
        throw new WebhookForwardingError(
          name,
          metadata?.kind === "local" || metadata?.kind === "preview"
            ? metadata.kind
            : "unknown",
          "target_validation",
        );
      }

      let response: Response;
      try {
        response = await request(metadata.url, {
          body: options.body,
          headers: Object.fromEntries([
            [
              "content-type",
              options.headers.get("content-type") ?? "application/json",
            ],
            ...providerHeaders[options.provider].map(
              (header) => [header, options.headers.get(header) ?? ""] as const,
            ),
          ]),
          method: "POST",
        });
      } catch {
        throw new WebhookForwardingError(name, metadata.kind, "forwarding");
      }
      if (!response.ok) {
        throw new WebhookForwardingError(name, metadata.kind, "forwarding");
      }
      return { key: name, kind: metadata.kind, status: response.status };
    }),
  );
}

/**
 * Validates a provider-specific webhook target.
 *
 * @param provider - Webhook provider.
 * @param key - KV target key.
 * @param metadata - Stored target metadata.
 * @param webhookPath - Provider webhook path.
 * @returns Whether the key and URL form an allowed target.
 */
export function isValidTarget(
  provider: WebhookProvider,
  key: string,
  metadata: WebhookTargetMetadata,
  webhookPath: string,
): boolean {
  let url: URL;
  try {
    url = new URL(metadata.url);
  } catch {
    return false;
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    return false;
  }

  const prefix = provider === "clerk" ? "target" : "linear-target";
  const initials = key.match(
    new RegExp(`^${prefix}:local:([A-Z0-9]+)$`, "u"),
  )?.[1];
  if (metadata.kind === "local") {
    if (!initials) return false;
    if (provider === "clerk") {
      return (
        url.hostname === "webhooks.clerk.com" &&
        /^\/in\/c_[0-9A-Za-z]{10}\/$/u.test(url.pathname)
      );
    }
    return (
      /^[a-z0-9-]+\.trycloudflare\.com$/u.test(url.hostname) &&
      url.pathname === `${webhookPath}/${initials.toLowerCase()}`
    );
  }

  const prNumber = key.match(
    new RegExp(`^${prefix}:preview:(\\d+)$`, "u"),
  )?.[1];
  return Boolean(
    prNumber &&
      url.pathname === webhookPath &&
      url.hostname.match(
        new RegExp(
          `^pr-${prNumber}-pocket-trash-api-preview\\.[a-z0-9-]+\\.workers\\.dev$`,
          "u",
        ),
      ),
  );
}
