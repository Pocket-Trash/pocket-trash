import {
  type Logger,
  loggerValues,
  parseClientLogEvents,
} from "@package/logger";
import { formatTranslation } from "@pocket-trash/localizations";

export async function handleLogIngestionRequest({
  clientLogKey,
  logger,
  request,
}: {
  clientLogKey?: string;
  logger: Logger;
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status,
  });
}
