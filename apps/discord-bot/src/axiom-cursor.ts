import { Redis } from "ioredis";
import { z } from "zod";
import type { AxiomCursor } from "./axiom-fallback.js";

/** Bot-owned cursor persisted only after its preceding intake work is durable. */
const cursorSchema = z.object({
  messageId: z.string().regex(/^[1-9]\d{16,19}$/u),
  checkedAt: z.number().int().nonnegative(),
});

/**
 * Opens the bot-local durable Axiom intake cursor.
 *
 * @param options - Connection, intake identities, and recovery callback.
 * @returns Redis-backed cursor lifecycle without exposing its connection.
 */
export function createAxiomCursorStore(options: {
  /** Guild whose intake history is tracked. */
  guildId: string;
  /** Private Axiom intake channel. */
  channelId: string;
  /** Redis connection shared with the application's queues. */
  redisUrl: string;
  /** Called when a Redis connection becomes ready, including after outages. */
  onReady(): void;
}) {
  const key = `discord-bot:axiom-cursor:${options.guildId}:${options.channelId}`;
  const connection = new Redis(options.redisUrl, {
    connectTimeout: 5_000,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  connection.on("error", () => {
    /* Callers observe operation failures. */
  });
  connection.on("ready", options.onReady);
  return {
    /**
     * Opens the initial Redis connection.
     * @returns Connection readiness.
     */
    connect: () => connection.connect(),
    /**
     * Reads and validates the persisted checkpoint.
     *
     * @returns Validated checkpoint, or undefined before the first save.
     * @rejects When Redis is unavailable or persisted data is malformed.
     */
    async load(): Promise<AxiomCursor | undefined> {
      const value = await connection.get(key);
      return value === null ? undefined : cursorSchema.parse(JSON.parse(value));
    },
    /**
     * Validates and atomically replaces the checkpoint without expiring it.
     *
     * @param value - Checkpoint whose prerequisite effects are already durable.
     * @returns Redis acknowledgement.
     * @rejects When validation or persistence fails.
     */
    async save(value: AxiomCursor): Promise<void> {
      await connection.set(key, JSON.stringify(cursorSchema.parse(value)));
    },
    /**
     * Closes the checkpoint connection and stops reconnect attempts.
     * @returns Disconnection completion.
     */
    close: () => connection.disconnect(),
  };
}
