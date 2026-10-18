import { createInMemoryQueueAdapter } from "@package/queue";
import { describe, expect, it, vi } from "vitest";
import {
  type AxiomCursor,
  type AxiomIntakeMessage,
  axiomRecoveryWindowMs,
  createAxiomReconciler,
  parseAxiomMessage,
} from "./axiom-fallback.js";
import fixture from "./fixtures/axiom-match.json" with { type: "json" };
import { createLoggerWebhookNormalizer } from "./logger-webhook.js";
import { createDeliveryQueueRuntime } from "./queue.js";

/** Exact embed description retained by the redacted live fixture. */
const capturedDescription = fixture.embeds[0]?.description ?? "";

/** Fixed clock shortly after the captured synthetic event. */
const now = Date.parse("2026-10-18T05:26:00.000Z");
/** Source identities used by fixtures. */
const source = {
  channelId: "1560909883811827724",
  webhookId: "1560909959170891796",
  botUserId: "123456789012345678",
  destinationChannelId: "1560141390510428210",
};

/**
 * Constructs a source-authorized message from the redacted gateway fixture.
 *
 * @param overrides - Metadata or content variations.
 * @returns One intake message.
 */
function message(
  overrides: Partial<AxiomIntakeMessage> = {},
): AxiomIntakeMessage {
  return {
    ...fixture,
    id: "1561248854672810076",
    channelId: source.channelId,
    webhookId: source.webhookId,
    authorId: source.webhookId,
    createdTimestamp: now - 30_000,
    ...overrides,
  };
}

/**
 * Creates an isolated reconciliation harness with a mutable durable checkpoint.
 *
 * @param messages - Newest-first history pages.
 * @returns Reconciler, cursor access, and test doubles.
 */
function harness(messages: AxiomIntakeMessage[] = [message()]) {
  let saved: AxiomCursor | undefined;
  const save = vi.fn(async (value: AxiomCursor) => {
    saved = value;
  });
  const enqueue = vi.fn().mockResolvedValue({ accepted: true });
  const fetchPage = vi.fn(async (before?: string) => (before ? [] : messages));
  const cursor = { load: vi.fn(async () => saved), save };
  const reconciler = createAxiomReconciler({
    ...source,
    cursor,
    enqueue,
    fetchPage,
    /**
     * Supplies a deterministic recovery clock.
     * @returns Fixed Unix milliseconds.
     */
    now: () => now,
  });
  return {
    reconciler,
    enqueue,
    fetchPage,
    cursor,
    /**
     * Reads the last acknowledged checkpoint.
     * @returns Saved position, if any.
     */
    saved: () => saved,
  };
}

describe("calibrated Axiom fallback", () => {
  it("parses the captured gateway layout and matches the direct envelope", async () => {
    const event = parseAxiomMessage(fixture);
    expect(event).toMatchObject({
      eventId: "eng502-calibration-redacted-error",
      error: { name: "CalibrationError" },
      attributes: { count: 42 },
      context: { source: "axiom-fallback-calibration" },
    });
    const token = "a".repeat(32);
    const direct = await createLoggerWebhookNormalizer({
      channelId: source.destinationChannelId,
      tokens: { api: token, web: "w".repeat(32), scraper: "s".repeat(32) },
    })(
      new Request("https://bot.example/webhooks/logger", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(event),
      }),
    );
    const h = harness();
    await h.reconciler.reconcile();
    expect(h.enqueue).toHaveBeenCalledWith(event.eventId, direct?.payload);
  });

  it.each([
    "content",
    "fields",
    "missing",
    "truncated",
  ])("rejects uncalibrated %s shapes", (shape) => {
    const bad =
      shape === "content"
        ? { content: capturedDescription, embeds: [] }
        : {
            content: "",
            embeds:
              shape === "missing"
                ? []
                : [{ description: shape === "truncated" ? "```{..." : null }],
          };
    expect(() => parseAxiomMessage(bad)).toThrow();
  });

  it("accepts nullable optional projected columns and strips unprojected fields", () => {
    const value = {
      ...JSON.parse(capturedDescription.slice(3, -3)),
      attributes: null,
      context: null,
      deploymentId: null,
      deploymentTarget: null,
      rawPayload: "never persist",
      stack: "never persist",
    };
    const event = parseAxiomMessage({
      content: "",
      embeds: [{ description: `\`\`\`${JSON.stringify(value)}\`\`\`` }],
    });
    expect(event.attributes).toBeUndefined();
    expect(event).not.toHaveProperty("rawPayload");
    expect(event).not.toHaveProperty("stack");
  });

  it.each([
    "wrong-channel",
    "wrong-webhook",
    "own-bot",
  ])("rejects %s before inspecting content", async (kind) => {
    const untrusted = message({
      channelId: kind === "wrong-channel" ? "other" : source.channelId,
      webhookId: kind === "wrong-webhook" ? "other" : source.webhookId,
      authorId: kind === "own-bot" ? source.botUserId : source.webhookId,
    });
    Object.defineProperties(untrusted, {
      content: {
        /**
         * Detects unauthorized content inspection.
         * @throws Always when content is inspected.
         */
        get() {
          throw Error("content was inspected");
        },
      },
      embeds: {
        /**
         * Detects unauthorized embed inspection.
         * @throws Always when embeds are inspected.
         */
        get() {
          throw Error("embeds were inspected");
        },
      },
    });
    const h = harness([untrusted]);
    await h.reconciler.reconcile();
    expect(h.enqueue).not.toHaveBeenCalled();
    expect(h.saved()?.messageId).toBe(untrusted.id);
  });

  it("persists parser health before advancing even for an already delivered event", async () => {
    const h = harness([message({ embeds: [{ description: "invalid" }] })]);
    await h.reconciler.reconcile();
    expect(h.enqueue).toHaveBeenCalledWith(
      "axiom-parser-error:1561248854672810076",
      expect.objectContaining({ kind: "system" }),
    );
    expect(h.saved()?.messageId).toBe(message().id);
  });

  it("does not advance on Redis failures, and recovers on the next trigger", async () => {
    const h = harness();
    h.enqueue.mockRejectedValueOnce(Error("Redis offline"));
    await expect(h.reconciler.reconcile()).rejects.toThrow("Redis offline");
    expect(h.saved()).toBeUndefined();
    expect(h.reconciler.started()).toBe(false);
    await h.reconciler.reconcile();
    expect(h.saved()?.messageId).toBe(message().id);
    expect(h.reconciler.started()).toBe(true);
  });

  it("does not advance when a parser-health job cannot be persisted", async () => {
    const h = harness([message({ embeds: [] })]);
    h.enqueue.mockRejectedValueOnce(Error("Redis offline"));
    await expect(h.reconciler.reconcile()).rejects.toThrow();
    expect(h.saved()).toBeUndefined();
  });

  it("replays safely when cursor persistence fails after durable enqueue", async () => {
    const h = harness();
    h.cursor.save.mockRejectedValueOnce(Error("cursor offline"));
    await expect(h.reconciler.reconcile()).rejects.toThrow();
    expect(h.saved()).toBeUndefined();
    h.enqueue.mockResolvedValue({ accepted: false });
    await h.reconciler.reconcile();
    expect(h.enqueue).toHaveBeenCalledTimes(2);
    expect(h.saved()?.messageId).toBe(message().id);
  });

  it("reapplies shared rules before queue deduplication", async () => {
    const description = capturedDescription.replace(
      '"production"',
      '"preview"',
    );
    const h = harness([message({ embeds: [{ description }] })]);
    await h.reconciler.reconcile();
    expect(h.enqueue).not.toHaveBeenCalled();
    expect(h.saved()?.messageId).toBe(message().id);
  });

  it("stops stale cursors with a durable operational error", async () => {
    const h = harness();
    await h.cursor.save({
      messageId: message().id,
      checkedAt: now - axiomRecoveryWindowMs,
    });
    await expect(h.reconciler.reconcile()).rejects.toThrow("manual recovery");
    expect(h.fetchPage).not.toHaveBeenCalled();
    expect(h.enqueue).toHaveBeenCalledWith(
      `axiom-recovery-error:${message().id}`,
      expect.objectContaining({ kind: "system" }),
    );
    expect(h.saved()?.checkedAt).toBe(now - axiomRecoveryWindowMs);
  });

  it("coalesces live and reconnect triggers without overlapping cursor writes", async () => {
    const h = harness();
    const first = h.reconciler.reconcile();
    const second = h.reconciler.reconcile();
    expect(second).toBe(first);
    await Promise.all([first, second]);
    expect(h.enqueue).toHaveBeenCalledTimes(1);
    expect(h.saved()?.messageId).toBe(message().id);
  });

  it("reports delayed events outside the retained identity window instead of delivering twice", async () => {
    const data = JSON.parse(capturedDescription.slice(3, -3));
    data.timestamp = new Date(now - axiomRecoveryWindowMs).toISOString();
    const h = harness([
      message({
        embeds: [{ description: `\`\`\`${JSON.stringify(data)}\`\`\`` }],
      }),
    ]);
    await h.reconciler.reconcile();
    expect(h.enqueue).toHaveBeenCalledWith(
      `axiom-parser-error:${message().id}`,
      expect.objectContaining({ kind: "system" }),
    );
    expect(h.enqueue).not.toHaveBeenCalledWith(data.eventId, expect.anything());
  });

  it("paginates newest-first but processes oldest-first without replaying the cursor", async () => {
    const h = harness();
    const older = message({ id: "1561248853833814198" });
    h.fetchPage.mockImplementation(async (before) =>
      before === message().id
        ? [older]
        : before === older.id
          ? []
          : [message()],
    );
    await h.reconciler.reconcile();
    expect(h.cursor.save.mock.calls.map(([value]) => value.messageId)).toEqual([
      older.id,
      message().id,
      message().id,
    ]);
    h.enqueue.mockClear();
    await h.reconciler.reconcile();
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it.each([
    "direct-first",
    "fallback-first",
    "concurrent",
  ])("shares retained queue identity for %s arrival", async (order) => {
    const adapter = createInMemoryQueueAdapter();
    const deliver = vi.fn().mockResolvedValue(undefined);
    const queue = createDeliveryQueueRuntime({ adapter, deliver });
    const h = harness();
    h.enqueue.mockImplementation((id, payload) =>
      queue.enqueue({ id, name: "notification", payload }),
    );
    /**
     * Simulates direct acceptance and timeout-after-acceptance retries.
     * @returns Durable enqueue completion.
     */
    const direct = async () => {
      const event = parseAxiomMessage(fixture);
      const { createLoggerDelivery } = await import("./logger-webhook.js");
      await queue.enqueue({
        id: event.eventId,
        name: "direct",
        payload: createLoggerDelivery(event, source.destinationChannelId),
      });
    };
    if (order === "concurrent")
      await Promise.all([direct(), h.reconciler.reconcile()]);
    else if (order === "direct-first") {
      await direct();
      await h.reconciler.reconcile();
    } else {
      await h.reconciler.reconcile();
      await direct();
    }
    await queue.start();
    await vi.waitFor(() => expect(deliver).toHaveBeenCalledTimes(1));
    await direct();
    expect(deliver).toHaveBeenCalledTimes(1);
    await queue.close();
  });
});
