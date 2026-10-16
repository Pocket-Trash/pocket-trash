import { GatewayIntentBits } from "discord.js";

/** Exact Discord gateway intents required by the bot plan. */
export const discordGatewayIntents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
] as const;

/**
 * Fails clearly when Discord rejects the privileged Message Content intent.
 *
 * @param code - Discord gateway close code.
 * @throws When code 4014 reports a disallowed privileged intent.
 */
export function assertGatewayDisconnectAllowed(code: number) {
  if (code === 4_014) {
    throw new Error(
      "Discord rejected the gateway session because Message Content intent is not enabled.",
    );
  }
}
