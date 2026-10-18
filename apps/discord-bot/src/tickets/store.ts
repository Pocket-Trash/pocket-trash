import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";
import {
  type TicketOperation,
  ticketOperationSchema,
  ticketSnowflake,
} from "./model.js";

/** Operations exposed only while holding this thread's renewable Redis lease. */
export interface TicketTransaction {
  /**
   * Reads the operation protected by this transaction.
   * @returns The validated operation, if it exists.
   */
  load(): Promise<TicketOperation | undefined>;
  /**
   * Atomically saves state only while this transaction still owns the lease.
   * @param operation - Complete validated replacement state.
   * @returns Persistence completion.
   */
  save(operation: TicketOperation): Promise<void>;
}
/** Bot-local persistence boundary; no Redis transport leaks into ticket handlers. */
export interface TicketOperationStore {
  /**
   * Serializes one thread across callbacks and processes.
   * @template T - Action result.
   * @param threadId - Canonical Discord thread identity.
   * @param action - Work executed under a renewable, owner-checked lease.
   * @returns The action result; contention or lost ownership is retryable.
   */
  transact<T>(
    threadId: string,
    action: (transaction: TicketTransaction) => Promise<T>,
  ): Promise<T>;
}

/**
 * Creates the bot-owned Redis operation store with fenced writes and final TTLs.
 * @param redisUrl - Shared queue Redis URL, never exposed in operation payloads.
 * @returns Thread transactions and explicit connection shutdown.
 */
export function createTicketOperationStore(redisUrl: string) {
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
  });
  redis.on("error", () => {
    /* Operation failures propagate to the interaction boundary. */
  });
  return {
    /**
     * Connects this bot-local store before serving ticket interactions.
     * @returns Initial Redis connection readiness.
     */
    connect: () => redis.connect(),
    /** Stops Redis reconnects during graceful shutdown. */
    close(): void {
      redis.disconnect();
    },
    /**
     * Runs work under one renewable thread lease; stale owners cannot save state.
     * @template T - Result returned by the ticket workflow.
     * @param threadId - Validated Discord thread snowflake.
     * @param action - Workflow action using owner-checked durable operations.
     * @returns The workflow result.
     * @rejects When contended, Redis fails, or lease ownership is lost.
     */
    async transact<T>(
      threadId: string,
      action: (transaction: TicketTransaction) => Promise<T>,
    ): Promise<T> {
      ticketSnowflake.parse(threadId);
      const key = `discord-bot:ticket:${threadId}`;
      const lock = `${key}:lease`;
      const owner = randomUUID();
      if ((await redis.set(lock, owner, "PX", 30_000, "NX")) !== "OK")
        throw new Error("Ticket operation is already running; retry shortly.");
      let lost = false;
      const heartbeat = setInterval(() => {
        void redis
          .eval(
            "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('pexpire',KEYS[1],30000) else return 0 end",
            1,
            lock,
            owner,
          )
          .then((renewed) => {
            if (renewed !== 1) lost = true;
          })
          .catch(() => {
            lost = true;
          });
      }, 10_000);
      heartbeat.unref();
      try {
        return await action({
          /**
           * Reads and validates state protected by this thread's lease.
           * @returns State protected by this thread's lease.
           * @rejects When Redis fails, state is corrupt, or the lease is lost.
           */
          async load() {
            if (lost) throw new Error("Ticket lease was lost.");
            const value = await redis.get(key);
            if (value === null) return undefined;
            const operation = ticketOperationSchema.parse(JSON.parse(value));
            if (operation.threadId !== threadId)
              throw new Error("Ticket state belongs to another thread.");
            return operation;
          },
          /**
           * Saves only if the caller still holds the current lease.
           * @param operation - Validated operation with stable identities.
           * @returns Durable write completion.
           * @rejects When ownership is lost, state is invalid, or Redis fails.
           */
          async save(operation) {
            if (lost) throw new Error("Ticket lease was lost.");
            const value = ticketOperationSchema.parse(operation);
            if (value.threadId !== threadId)
              throw new Error("Ticket state belongs to another thread.");
            const ttl = value.phase === "finalized" ? 90 * 24 * 60 * 60 : 0;
            const saved = await redis.eval(
              "if redis.call('get',KEYS[1]) ~= ARGV[1] then return 0 end redis.call('set',KEYS[2],ARGV[2]); if tonumber(ARGV[3]) > 0 then redis.call('expire',KEYS[2],ARGV[3]) end return 1",
              2,
              lock,
              key,
              owner,
              JSON.stringify(value),
              String(ttl),
            );
            if (saved !== 1)
              throw new Error("Ticket lease was lost before persistence.");
          },
        });
      } finally {
        clearInterval(heartbeat);
        await redis
          .eval(
            "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
            1,
            lock,
            owner,
          )
          .catch(() => {
            /* The bounded lease expires without deleting another owner's lock. */
          });
      }
    },
  };
}
