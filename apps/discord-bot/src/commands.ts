import { Routes } from "discord.js";

/** Minimal Discord REST boundary used for guild command registration. */
export type CommandRegistrationClient = {
  /**
   * Replaces registered guild commands at a Discord API route.
   *
   * @param route - Discord application-guild command route.
   * @param options - Complete command definition body.
   * @returns The Discord API result.
   */
  put(
    route: string,
    options: {
      /** Complete guild command definitions. */
      body: readonly unknown[];
    },
  ): Promise<unknown>;
};

/**
 * Registers commands only in the configured guild.
 *
 * @param client - Discord REST command-registration client.
 * @param applicationId - Discord application snowflake.
 * @param guildId - Discord guild snowflake.
 * @param definitions - Complete guild command definitions.
 * @returns A promise that resolves after Discord accepts the definitions.
 */
export async function registerGuildCommands(
  client: CommandRegistrationClient,
  applicationId: string,
  guildId: string,
  definitions: readonly unknown[],
) {
  await client.put(Routes.applicationGuildCommands(applicationId, guildId), {
    body: definitions,
  });
}
