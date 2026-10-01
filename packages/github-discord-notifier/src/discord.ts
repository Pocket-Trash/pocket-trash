import type { DiscordPayload } from "./format.js";

/** Reports a rejected Discord webhook delivery. */
export class DiscordNotificationError extends Error {
  /** Stable error name used by callers and diagnostics. */
  override name = "DiscordNotificationError";
}

/**
 * Sends one GitHub event notification to a Discord webhook.
 *
 * @param webhookUrl - Validated Discord webhook endpoint.
 * @param payload - Discord embed and link-button payload.
 * @returns A promise that resolves after Discord accepts the request.
 * @rejects When networking, serialization, or Discord delivery fails.
 */
export async function sendDiscordNotification(
  webhookUrl: string,
  payload: DiscordPayload,
): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new DiscordNotificationError(
      `Discord webhook failed with ${response.status}: ${responseText}`,
    );
  }
}
