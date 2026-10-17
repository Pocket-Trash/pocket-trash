import { describe, expect, it } from "vitest";
import { createDiscordBotEnv } from "./env.js";

/** Complete valid runtime environment used by validation tests. */
const validEnv = {
  DISCORD_APPLICATION_ID: "123456789012345678",
  DISCORD_GUILD_ID: "223456789012345678",
  DISCORD_MODERATOR_ROLE_ID: "1560130642623074334",
  DISCORD_OWNER_ROLE_ID: "1522834871649829079",
  DISCORD_TOKEN: "discord-token",
  LINEAR_API_KEY: "linear-api-key",
  REDIS_URL: "redis://localhost:6379",
};

describe("Discord bot environment", () => {
  it("validates required secrets and snowflake IDs", () => {
    expect(createDiscordBotEnv(validEnv)).toMatchObject({
      DISCORD_APPLICATION_ID: validEnv.DISCORD_APPLICATION_ID,
      PORT: 4009,
    });
    expect(() =>
      createDiscordBotEnv({ ...validEnv, DISCORD_GUILD_ID: "guild" }),
    ).toThrow("DISCORD_GUILD_ID");
    expect(() =>
      createDiscordBotEnv({ ...validEnv, DISCORD_TOKEN: "" }),
    ).toThrow("DISCORD_TOKEN");
    expect(() =>
      createDiscordBotEnv({ ...validEnv, LINEAR_API_KEY: "" }),
    ).toThrow("LINEAR_API_KEY");
  });

  it("rejects unresolved and non-Redis queue URLs", () => {
    for (const REDIS_URL of [
      "${{pocket-trash-queue.REDIS_URL}}",
      "https://example.com",
    ]) {
      expect(() => createDiscordBotEnv({ ...validEnv, REDIS_URL })).toThrow(
        "REDIS_URL",
      );
    }
  });
});
