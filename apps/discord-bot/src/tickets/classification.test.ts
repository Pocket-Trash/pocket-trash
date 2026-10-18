import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classificationInput,
  createTicketClassifier,
} from "./classification.js";
import type { TicketSnapshot } from "./model.js";

/**
 * Creates tiny inline human text with attachment metadata that must never reach Jev.
 * @param content - Human-authored text.
 * @param threadId - Synthetic support thread identity.
 * @returns Authorized reader-shaped snapshot, not real user data.
 */
function snapshot(
  content = "Saving quantity returns 409, expected 2; workaround: recreate item.",
  threadId = "223456789012345678",
): TicketSnapshot {
  return {
    threadId,
    threadUrl: `https://discord.com/channels/123456789012345678/${threadId}`,
    messages: [
      {
        id: "323456789012345678",
        userId: "423456789012345678",
        username: "Synthetic",
        timestamp: "2026-10-18T01:00:00Z",
        content,
        files: [
          {
            id: "523456789012345678",
            messageId: "323456789012345678",
            name: "private-attachment.txt",
            size: 3,
            status: "pending",
            contentType: "text/plain",
          },
        ],
      },
    ],
  };
}
/**
 * Creates a valid typed decision response without making a paid request.
 * @returns Settled ZDR response and complete normalized probability distributions.
 */
function receipt() {
  return {
    billing: { status: "settled", zero_data_retention: true },
    answers: [
      {
        type: "choice",
        name: "kind",
        choice: "bug",
        confidence: 1,
        probabilities: ["bug", "feature", "question", "other"].map((value) => ({
          value,
          probability: value === "bug" ? 1 : 0,
        })),
      },
      { type: "predicate", name: "ready", probability: 0.1 },
      {
        type: "choice",
        name: "priority",
        choice: "high",
        confidence: 1,
        probabilities: ["none", "low", "normal", "high", "urgent"].map(
          (value) => ({ value, probability: value === "high" ? 1 : 0 }),
        ),
      },
    ],
  };
}
afterEach(() => vi.unstubAllGlobals());
describe("Jev advisory classification", () => {
  it("sends bounded text only to the fixed ZDR route and caches unchanged revisions", async () => {
    const network = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(receipt())));
    vi.stubGlobal("fetch", network);
    const classifier = createTicketClassifier({ apiKey: "synthetic" });
    const input = snapshot(
      "Report: https://cdn.discordapp.com/signed?secret=value " +
        "a".repeat(20_000),
    );
    await classifier.precompute(input);
    await classifier.precompute(input);
    classifier.invalidate(input.threadId);
    await classifier.precompute(input);
    expect(network).toHaveBeenCalledTimes(1);
    const [url, options] = network.mock.calls[0] ?? [];
    expect(url).toBe("https://api.cheaperinference.com/v1/decisions");
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({ model: "jev-1.13", zdr: true });
    expect(body.input.length).toBeLessThanOrEqual(16_000);
    expect(options.body).not.toContain("private-attachment");
    expect(options.body).not.toContain("secret=value");
    expect(classifier.peek(input.threadId)).toEqual({
      kind: "bug",
      ready: false,
      priority: 2,
    });
  });
  it("invalidates stale and in-flight suggestions on edits without overriding an opened modal", async () => {
    /** Releases the mocked in-flight HTTP response.
     * @param value - Synthetic provider response.
     */
    let finish = (value: Response) => {
      void value;
    };
    const pending = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const network = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", network);
    const classifier = createTicketClassifier({ apiKey: "synthetic" });
    const input = snapshot();
    const first = classifier.precompute(input);
    await classifier.precompute(input);
    classifier.invalidate(input.threadId);
    finish(new Response(JSON.stringify(receipt())));
    await first;
    expect(network).toHaveBeenCalledTimes(1);
    expect(classifier.peek(input.threadId)).toBeUndefined();
  });
  it.each([
    "non-zdr",
    "unsettled",
    "refusal",
    "bad-distribution",
    "wrong-options",
    "timeout",
    "unavailable",
    "malformed",
  ])("returns no suggestion on %s with no retry", async (mode) => {
    const body = receipt();
    if (mode === "non-zdr") body.billing.zero_data_retention = false;
    if (mode === "unsettled") body.billing.status = "pending";
    if (mode === "refusal") {
      const answer = body.answers[0];
      if (answer) answer.type = "refusal";
    }
    if (mode === "bad-distribution")
      body.answers[0]?.probabilities?.push({ value: "bug", probability: 1 });
    if (mode === "wrong-options") {
      const answer = body.answers[2];
      if (answer) answer.choice = "invented";
    }
    const network = vi.fn().mockImplementation(async () => {
      if (mode === "timeout") throw new Error("Network timeout");
      return new Response(
        mode === "malformed" ? "{not JSON" : JSON.stringify(body),
        { status: mode === "unavailable" ? 503 : 200 },
      );
    });
    vi.stubGlobal("fetch", network);
    const classifier = createTicketClassifier({ apiKey: "synthetic" });
    await classifier.precompute(snapshot());
    await classifier.precompute(snapshot());
    expect(classifier.peek(snapshot().threadId)).toBeUndefined();
    expect(network).toHaveBeenCalledTimes(1);
  });
  it("bounds hourly calls and expires hints without any inference from a cache read", async () => {
    let clock = 1;
    const network = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify(receipt())));
    vi.stubGlobal("fetch", network);
    const classifier = createTicketClassifier({
      apiKey: "synthetic",
      /** Returns the deterministic test clock.
       * @returns Epoch milliseconds used by the cache.
       */
      now: () => clock,
    });
    for (let index = 0; index < 65; index++)
      await classifier.precompute(
        snapshot("Different report " + index, String(index)),
      );
    expect(network).toHaveBeenCalledTimes(60);
    clock += 15 * 60_000;
    expect(classifier.peek("0")).toBeUndefined();
    expect(network).toHaveBeenCalledTimes(60);
    expect(
      classificationInput(snapshot("https://example.com/private")).input,
    ).toBe("[link omitted]");
  });
});
