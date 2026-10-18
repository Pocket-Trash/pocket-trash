import type { Client } from "discord.js";
import { createTicketLinear } from "./linear.js";
import { createTicketPersistence } from "./persistence.js";
import { createTicketReader } from "./reader.js";
import { createTicketOperationStore } from "./store.js";
import { createTicketSummarizer } from "./summary.js";

/**
 * Composes the recoverable ticket engine without registering controls or starting inference.
 * @param options - Existing bot connections, configured scope and approved provider settings.
 * @returns Durable ticket operations and explicit Redis lifecycle.
 */
export function createTicketRuntime(options: {
  /** Existing authenticated Discord client. */
  client: Client;
  /** Configured guild identity. */
  guildId: string;
  /** Configured public support forum identity. */
  forumId: string;
  /** Shared Redis URL, separate from queue transport payloads. */
  redisUrl: string;
  /** Dedicated bot-member Linear credential validated by bot startup. */
  linearApiKey: string;
  /** Approved inference credential; no secret provisioning occurs here. */
  inferenceApiKey: string;
  /** Configurable provider, restricted to the reviewed boundary. */
  provider?: string;
  /** Configurable summary model, separate from future advisory classification. */
  model?: string;
  /** Configurable reviewed gateway URL. */
  baseUrl?: string;
}) {
  const store = createTicketOperationStore(options.redisUrl);
  const reader = createTicketReader(options);
  const linear = createTicketLinear({ apiKey: options.linearApiKey });
  const summarize = createTicketSummarizer({
    apiKey: options.inferenceApiKey,
    provider: options.provider,
    model: options.model,
    baseUrl: options.baseUrl,
  });
  return {
    ...createTicketPersistence({
      guildId: options.guildId,
      store,
      reader,
      linear,
      summarize,
    }),
    connect: store.connect,
    close: store.close,
  };
}
