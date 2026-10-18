import { describe, expect, it } from "vitest";
import { createDiscordBotEnv } from "./env.js";

/** Complete valid runtime environment used by validation tests. */
const validEnv = {
  AXIOM_INTAKE_WEBHOOK_URL:
    "https://discord.com/api/webhooks/423456789012345678/webhook-token",
  DISCORD_APPLICATION_ID: "123456789012345678",
  DISCORD_AXIOM_INTAKE_CHANNEL_ID: "323456789012345678",
  DISCORD_BUG_TAG_ID: "523456789012345678",
  DISCORD_FEATURE_REQUEST_TAG_ID: "623456789012345678",
  DISCORD_GITHUB_CHANNEL_ID: "723456789012345678",
  DISCORD_GITHUB_ERRORS_CHANNEL_ID: "823456789012345678",
  DISCORD_GUILD_ID: "223456789012345678",
  DISCORD_LOGGER_CHANNEL_ID: "923456789012345678",
  DISCORD_MODERATOR_ROLE_ID: "1560130642623074334",
  DISCORD_OWNER_ROLE_ID: "1522834871649829079",
  DISCORD_SUPPORT_FORUM_ID: "133456789012345678",
  DISCORD_TOKEN: "discord-token",
  GITHUB_WEBHOOK_SECRET: "github-webhook-secret-at-least-32-characters",
  LINEAR_API_KEY: "linear-api-key",
  LOGGER_NOTIFICATION_API_TOKEN: "a".repeat(32),
  LOGGER_NOTIFICATION_SCRAPER_TOKEN: "s".repeat(32),
  LOGGER_NOTIFICATION_WEB_TOKEN: "w".repeat(32),
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
    expect(() =>
      createDiscordBotEnv({
        ...validEnv,
        AXIOM_INTAKE_WEBHOOK_URL: undefined,
      }),
    ).toThrow("AXIOM_INTAKE_WEBHOOK_URL");
    expect(() =>
      createDiscordBotEnv({
        ...validEnv,
        AXIOM_INTAKE_WEBHOOK_URL: "https://example.com/not-discord",
      }),
    ).toThrow("AXIOM_INTAKE_WEBHOOK_URL");
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
