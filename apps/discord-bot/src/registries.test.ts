import { describe, expect, it, vi } from "vitest";
import {
  createInteractionRegistry,
  createMessageRegistry,
} from "./registries.js";

describe("bot registries", () => {
  it("requires role declarations and applies the runtime guard", async () => {
    const execute = vi.fn();
    const registry = createInteractionRegistry([
      { allowedRoleIds: ["owner"], id: "ticket:bug", execute },
    ]);
    const reply = vi.fn();

    expect(
      await registry.dispatch("ticket:bug", {
        memberRoleIds: ["member"],
        reply,
      }),
    ).toBe(true);
    expect(execute).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(() =>
      createInteractionRegistry([
        { allowedRoleIds: [], id: "invalid", execute },
      ]),
    ).toThrow("allowed role");
  });

  it("rejects message sources before handlers can inspect content", async () => {
    const handle = vi.fn();
    const registry = createMessageRegistry([
      {
        channelIds: ["channel"],
        handle,
        id: "axiom",
        webhookIds: ["webhook"],
      },
    ]);
    const rejected = {
      channelId: "other",
      /**
       * Proves rejected sources cannot inspect message content.
       *
       * @returns No content because access throws.
       * @throws Always when an untrusted source reads content.
       */
      get content(): string {
        throw new Error("content was inspected");
      },
      webhookId: "webhook",
    };

    expect(await registry.dispatch(rejected)).toBe(false);
    expect(handle).not.toHaveBeenCalled();
  });
});
