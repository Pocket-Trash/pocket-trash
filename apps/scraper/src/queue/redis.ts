import { Redis } from "ioredis";

/**
 * Creates the scraper Redis client with bounded reconnect attempts.
 *
 * @param redisUrl - Redis connection URL.
 *
 * @returns Configured Redis client.
 */
export function createRedisConnection(redisUrl: string): Redis {
  const redis = new Redis(redisUrl, {
    connectTimeout: 5_000,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    /**
     * Returns a bounded Redis reconnect delay for the current attempt.
     *
     * @param times - One-based Redis reconnect attempt number.
     *
     * @returns Reconnect delay in milliseconds, or `null` after three attempts.
     */
    retryStrategy(times) {
      return times <= 3 ? Math.min(times * 250, 1_000) : null;
    },
  });

  redis.on("error", () => {
    // Connection failures are surfaced by the command that is waiting on Redis.
  });

  return redis;
}
