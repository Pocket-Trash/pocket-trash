import {
  type LoggerNotificationEvent,
  loggerNotificationEventSchema,
  matchesLoggerNotificationRules,
} from "@package/logger";
import { formatTranslation } from "@pocket-trash/localizations";
import { z } from "zod";
import { createLoggerDelivery } from "./logger-webhook.js";
import type { DeliveryJob } from "./queue.js";

/** Maximum period covered by retained notification identities. */
export const axiomRecoveryWindowMs = 24 * 60 * 60 * 1_000;

/** Minimal Discord message boundary, shared by live handling and history. */
export interface AxiomIntakeMessage {
  /** Stable Discord message identifier. */
  id: string;
  /** Source channel checked before content. */
  channelId: string;
  /** Source webhook checked before content. */
  webhookId: string | null;
  /** Author identity checked before content; webhook authors also set bot=true. */
  authorId: string;
  /** Original message creation timestamp. */
  createdTimestamp: number;
  /** Content accessed only after checking source. */
  readonly content: string;
  /** Only the calibrated embed description is inspected. */
  readonly embeds: readonly {
    /** Calibrated fenced JSON text. */
    description?: string | null;
  }[];
}

/** Last durably processed message and successful scan timestamp. */
export interface AxiomCursor {
  /** Last terminally handled Discord message. */
  messageId: string;
  /** Last successful reconciliation in Unix milliseconds. */
  checkedAt: number;
}

/** Redis-backed persistence contract owned by the bot. */
export interface AxiomCursorStore {
  /**
   * Loads the existing durable cursor.
   * @returns Persisted position, or undefined for a new intake.
   */
  load(): Promise<AxiomCursor | undefined>;
  /**
   * Saves only after required queue operations complete.
   * @param cursor - Position whose prerequisites are durable.
   * @returns Persistence acknowledgement.
   */
  save(cursor: AxiomCursor): Promise<void>;
}

/** Strict schema for the live-calibrated Axiom projection. */
const projectionSchema = loggerNotificationEventSchema
  .omit({ error: true, version: true })
  .extend({
    errorName: z.string().max(200),
    errorMessage: z.string().max(1_000),
    attributes: loggerNotificationEventSchema.shape.attributes
      .nullable()
      .transform((value) => value ?? undefined),
    context: loggerNotificationEventSchema.shape.context
      .nullable()
      .transform((value) => value ?? undefined),
    deploymentId: loggerNotificationEventSchema.shape.deploymentId
      .nullable()
      .transform((value) => value ?? undefined),
    deploymentTarget: loggerNotificationEventSchema.shape.deploymentTarget
      .nullable()
      .transform((value) => value ?? undefined),
  });

/**
 * Parses exactly the fenced JSON description observed in live gateway captures.
 *
 * @param message - Source-authorized Discord message.
 * @returns Validated notification event using the direct-transport schema.
 * @throws When Axiom changes its shape or loses required projected data.
 */
export function parseAxiomMessage(
  message: Pick<AxiomIntakeMessage, "content" | "embeds">,
): LoggerNotificationEvent {
  if (message.content !== "" || message.embeds.length !== 1)
    throw new Error("axiom.shape");
  const description = message.embeds[0]?.description;
  if (!description?.startsWith("```{") || !description.endsWith("}```"))
    throw new Error("axiom.description");
  const projected = projectionSchema.parse(
    JSON.parse(description.slice(3, -3)),
  );
  return loggerNotificationEventSchema.parse({
    ...projected,
    error:
      projected.errorName || projected.errorMessage
        ? { name: projected.errorName, message: projected.errorMessage }
        : undefined,
    version: 1,
  });
}

/**
 * Creates a serialized reconciler used by startup, gateway events, and recovery.
 *
 * @param options - Trusted source, durable cursor, history, and delivery operations.
 * @returns Single-flight reconciliation and its startup readiness state.
 * @rejects When a reconciliation cannot safely complete its durable effects.
 */
export function createAxiomReconciler(options: {
  /** Private intake channel. */
  channelId: string;
  /** Webhook identity derived from the canonical URL. */
  webhookId: string;
  /** Bot user identity; its own messages are never trusted. */
  botUserId: string;
  /** Final operational/logger notification channel. */
  destinationChannelId: string;
  /** Durable Redis cursor. */
  cursor: AxiomCursorStore;
  /**
   * Fetches newest-first history pages without inspecting message content.
   * @param before - Exclusive oldest message from the preceding page.
   * @returns One metadata page with lazy content fields.
   */
  fetchPage(before?: string): Promise<readonly AxiomIntakeMessage[]>;
  /**
   * Durably enqueues under the supplied stable ID.
   * @param id - Shared event or operational notification identity.
   * @param payload - Safe notification envelope.
   * @returns Durable queue result.
   */
  enqueue(id: string, payload: DeliveryJob): Promise<unknown>;
  /**
   * Supplies the clock used by recovery and tests.
   * @returns Unix milliseconds.
   */
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  let running: Promise<void> | undefined;
  let requested = false;
  let started = false;

  /**
   * Queues a safe operational error without echoing source content.
   *
   * @param id - Stable message or stale-cursor identity.
   * @param code - Machine-readable failure kind.
   * @returns Durable notification acceptance.
   */
  async function report(id: string, code: string) {
    await options.enqueue(id, {
      deliveryId: id,
      destinationChannelId: options.destinationChannelId,
      kind: "system",
      version: 1,
      notification: {
        description: formatTranslation("error.generic"),
        diagnostics: [code, options.channelId, id],
        occurredAt: new Date(now()).toISOString(),
        provenance: options.channelId,
        source: "Axiom",
        status: code,
        tags: ["axiom", "parser-health"],
        title: formatTranslation("error.generic"),
        tone: "warning",
      },
    });
  }

  /**
   * Processes one authorized message before any duplicate check.
   *
   * @param message - History message with lazy content fields.
   * @returns Completion only after every required effect is durable.
   */
  async function handle(message: AxiomIntakeMessage) {
    if (
      message.channelId !== options.channelId ||
      message.webhookId !== options.webhookId ||
      message.authorId === options.botUserId
    )
      return;
    let event: LoggerNotificationEvent;
    try {
      event = parseAxiomMessage(message);
    } catch {
      await report(`axiom-parser-error:${message.id}`, "axiom.payload.invalid");
      return;
    }
    if (!matchesLoggerNotificationRules(event)) return;
    if (now() - Date.parse(event.timestamp) >= axiomRecoveryWindowMs) {
      await report(
        `axiom-parser-error:${message.id}`,
        "axiom.event.outside-recovery-window",
      );
      return;
    }
    await options.enqueue(
      event.eventId,
      createLoggerDelivery(event, options.destinationChannelId),
    );
  }

  /**
   * Reads a bounded-time history snapshot and commits oldest-first progress.
   *
   * @returns Completion of one durable scan.
   * @rejects When Discord or Redis cannot complete required work.
   */
  async function scan() {
    const scanTime = now();
    const cutoff = scanTime - axiomRecoveryWindowMs;
    let cursor = await options.cursor.load();
    if (cursor && cursor.checkedAt <= cutoff) {
      await report(
        `axiom-recovery-error:${cursor.messageId}`,
        "axiom.cursor.outside-recovery-window",
      );
      throw new Error("Axiom cursor requires manual recovery.");
    }
    cursor ??= {
      messageId: ((BigInt(cutoff) - 1420070400000n) << 22n).toString(),
      checkedAt: scanTime,
    };
    const messages: AxiomIntakeMessage[] = [];
    let before: string | undefined;
    while (true) {
      const page = await options.fetchPage(before);
      if (!page.length) break;
      let reachedCursor = false;
      for (const message of page) {
        if (
          BigInt(message.id) <= BigInt(cursor.messageId) ||
          message.createdTimestamp < cutoff
        ) {
          reachedCursor = true;
          continue;
        }
        messages.push(message);
      }
      const oldest = page.reduce((a, b) =>
        BigInt(a.id) < BigInt(b.id) ? a : b,
      );
      if (reachedCursor || oldest.id === before) break;
      before = oldest.id;
    }
    messages.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
    for (const message of messages) {
      await handle(message);
      cursor = { messageId: message.id, checkedAt: scanTime };
      await options.cursor.save(cursor);
    }
    await options.cursor.save({ ...cursor, checkedAt: scanTime });
    started = true;
  }

  return {
    /**
     * Reports whether startup reconciliation completed.
     * @returns Whether at least one scan succeeded.
     */
    started: () => started,
    /**
     * Coalesces concurrent triggers while requesting another scan when needed.
     *
     * @returns Completion of all currently requested scans.
     */
    reconcile(): Promise<void> {
      requested = true;
      if (!running) {
        running = (async () => {
          do {
            requested = false;
            await scan();
          } while (requested);
        })().finally(() => {
          running = undefined;
        });
      }
      return running;
    },
  };
}
