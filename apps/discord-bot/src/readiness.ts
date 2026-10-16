/**
 * Creates mutable readiness state backed by a live Redis queue check.
 *
 * @param queueCounts - Live Redis-backed queue count operation.
 * @returns Mutable readiness state for the bot process.
 */
export function createReadiness(queueCounts: () => Promise<unknown>) {
  let gatewayReady = false;
  let workerStarted = false;

  return {
    /**
     * Returns healthy only when gateway, worker, and Redis are ready.
     *
     * @returns Current process readiness.
     */
    async check() {
      if (!gatewayReady || !workerStarted) return { ok: false } as const;
      try {
        await queueCounts();
        return { ok: true } as const;
      } catch {
        return { ok: false } as const;
      }
    },
    /**
     * Records current Discord gateway readiness.
     *
     * @param value - Whether Discord reports the gateway ready.
     */
    setGatewayReady(value: boolean) {
      gatewayReady = value;
    },
    /**
     * Records whether the continuous delivery worker is running.
     *
     * @param value - Whether worker startup completed.
     */
    setWorkerStarted(value: boolean) {
      workerStarted = value;
    },
  };
}

/** Mutable readiness controller returned by {@link createReadiness}. */
export type BotReadiness = ReturnType<typeof createReadiness>;
