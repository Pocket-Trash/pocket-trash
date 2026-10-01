import type { AuditService } from "@package/services";

/**
 * Drains a bounded number of due audit deliveries.
 *
 * @param audit - Audit service that claims one due delivery at a time.
 * @param maximum - Maximum deliveries processed in one scheduled run.
 * @returns Number of deliveries claimed.
 */
export async function drainAuditQueue(
  audit: Pick<AuditService, "processDue">,
  maximum = 25,
): Promise<number> {
  let processed = 0;
  while (processed < maximum && (await audit.processDue())) processed += 1;
  return processed;
}
