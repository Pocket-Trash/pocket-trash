import { GatewayIntentBits } from "discord.js";
import { describe, expect, it } from "vitest";
import {
  assertGatewayDisconnectAllowed,
  discordGatewayIntents,
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
});
