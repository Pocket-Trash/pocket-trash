import { Redis } from "ioredis";
import type { z } from "zod";

/**
 * Opens a validated durable checkpoint beside the application queues.
 *
 * @template T - Serializable checkpoint value.
 * @param options - Connection, namespaced key, validator, and recovery callback.
 * @returns Redis-backed checkpoint lifecycle without exposing its connection.
 */
export function createRedisCheckpointStore<T>(options: {
  /** Application-owned namespaced Redis key. */
  key: string;
  /** Redis connection shared with the application's queues. */
  redisUrl: string;
  /** Runtime checkpoint validator. */
  schema: z.ZodType<T>;
  /** Called when a Redis connection becomes ready, including after outages. */
  onReady(): void;
}) {
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
    async load(): Promise<T | undefined> {
      const value = await connection.get(options.key);
      return value === null
        ? undefined
        : options.schema.parse(JSON.parse(value));
    },
    /**
     * Validates and atomically replaces the checkpoint without expiring it.
     *
     * @param value - Checkpoint whose prerequisite effects are already durable.
     * @returns Redis acknowledgement.
     * @rejects When validation or persistence fails.
     */
    async save(value: T): Promise<void> {
      await connection.set(
        options.key,
        JSON.stringify(options.schema.parse(value)),
      );
    },
    /**
     * Closes the checkpoint connection and stops reconnect attempts.
     * @returns Disconnection completion.
     */
    close: () => connection.disconnect(),
  };
}
