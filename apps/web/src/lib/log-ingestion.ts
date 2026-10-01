import {
  type Logger,
  loggerValues,
  parseClientLogEvents,
} from "@package/logger";
import { formatTranslation } from "@pocket-trash/localizations";

/** Validates and forwards a client log ingestion request.
 *
 * @param input - Log ingestion request dependencies.
 * @param input.clientLogKey - Optional shared key required from clients.
 * @param input.logger - Server logger receiving validated events.
 * @param input.request - HTTP request containing client log events.
 * @returns A JSON response reporting acceptance or validation failure.
 * @rejects When forwarding or flushing validated events fails.
 */
export async function handleLogIngestionRequest({
  clientLogKey,
  logger,
  request,
}: {
  /** Optional shared key required from clients. */
  clientLogKey?: string;
  /** Server logger receiving validated events. */
  logger: Logger;
  /** HTTP request containing client log events. */
  request: Request;
}): Promise<Response> {
  if (clientLogKey) {
    const providedClientKey = request.headers.get(
      loggerValues.logProxy.clientKeyHeader,
    );

    if (providedClientKey !== clientLogKey) {
      return json(
        { error: formatTranslation("web.error.invalidLogClientKey") },
        401,
      );
    }
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json(
      { error: formatTranslation("web.error.expectedJsonRequestBody") },
      400,
    );
  }

  const events = parseClientLogEvents(body);

  if (!events.ok) {
    return json({ error: events.error }, 400);
  }

  const receivedAt = new Date().toISOString();
  const userAgent = request.headers.get("user-agent");

  for (const event of events.value) {
    const attributes: Record<string, unknown> = {
      originalTimestamp: event.timestamp,
      receivedAt,
      source: loggerValues.logProxy.source,
    };

    if (userAgent) {
      attributes.userAgent = userAgent;
    }

    logger.forward(event, { attributes });
  }

  await logger.flush();

  return json({ accepted: events.value.length });
}

/** Creates a JSON HTTP response.
 *
 * @param body - Value serialized into the response body.
 * @param status - HTTP status code, defaulting to success.
 * @returns A JSON response with the requested status.
 */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status,
  });
}
