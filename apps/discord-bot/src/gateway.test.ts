import { type Client, Events, GatewayIntentBits } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import {
  assertGatewayDisconnectAllowed,
  discordGatewayIntents,
  registerGatewayReadinessListeners,
} from "./gateway.js";

describe("Discord gateway", () => {
  it("requests only the required gateway intents", () => {
    expect(discordGatewayIntents).toEqual([
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ]);
  });

  it("reports a disabled privileged intent clearly", () => {
    expect(() => assertGatewayDisconnectAllowed(4014)).toThrow(
      "Message Content intent",
    );
    expect(() => assertGatewayDisconnectAllowed(1_000)).not.toThrow();
  });

  it("tracks ready and reconnecting gateway transitions", () => {
    const listeners = new Map<string, () => void>();
    const client = {
      on: vi.fn((event: string, listener: () => void) => {
        listeners.set(event, listener);
      }),
      once: vi.fn((event: string, listener: () => void) => {
        listeners.set(event, listener);
      }),
    } as unknown as Pick<Client, "on" | "once">;
    const setGatewayReady = vi.fn();

    registerGatewayReadinessListeners(client, setGatewayReady);
    listeners.get(Events.ClientReady)?.();
    listeners.get(Events.ShardReconnecting)?.();
    listeners.get(Events.ShardReady)?.();

    expect(setGatewayReady.mock.calls).toEqual([[true], [false], [true]]);
  });
});
