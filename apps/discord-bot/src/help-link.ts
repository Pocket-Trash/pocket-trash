import { formatTranslation } from "@pocket-trash/localizations";
import { escapeMarkdown, SlashCommandBuilder } from "discord.js";
import { z } from "zod";
import { helpTopics } from "./help-topics.generated.js";
import type { HelpTopic } from "./help-topics-source.js";
import type { InteractionHandler } from "./registries.js";

/**
 * Creates the single staff command using build-time English help metadata.
 *
 * @param options - Configured staff roles and optional test metadata.
 * @returns Guild command definition and existing-registry handler.
 * @throws When compiled metadata is empty, malformed, or beyond Discord limits.
 */
export function createHelpLinkCommand(options: {
  /** Owners role configured for this environment. */
  ownerRoleId: string;
  /** Moderator role configured for this environment. */
  moderatorRoleId: string;
  /** Build-time topics; injectable only for validation and tests. */
  topics?: readonly HelpTopic[];
}) {
  const topics = z
    .array(
      z.object({
        slug: z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
          .max(100),
        title: z.string().trim().min(1).max(100),
      }),
    )
    .min(1)
    .max(25)
    .parse(options.topics ?? helpTopics);
  if (new Set(topics.map((topic) => topic.slug)).size !== topics.length)
    throw new Error("Duplicate compiled help topic slug.");
  const definition = new SlashCommandBuilder()
    .setName("help-link")
    .setDescription(formatTranslation("web.help.topics", {}, "en-US"))
    .addStringOption((option) =>
      option
        .setName("topic")
        .setDescription(formatTranslation("web.help.topics", {}, "en-US"))
        .setRequired(true)
        .addChoices(
          topics.map((topic) => ({ name: topic.title, value: topic.slug })),
        ),
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription(formatTranslation("web.navigation.user", {}, "en-US")),
    );
  const handler: InteractionHandler = {
    id: "help-link",
    allowedRoleIds: [options.ownerRoleId, options.moderatorRoleId],
    /**
     * Publishes the selected English title and visible canonical help URL.
     *
     * @param interaction - Role-authorized command values and reply boundary.
     * @returns Discord reply completion.
     */
    async execute(interaction) {
      const topic = topics.find(
        (candidate) => candidate.slug === interaction.commandOptions?.topic,
      );
      const userId = interaction.commandOptions?.userId;
      if (!topic || (userId && !/^[1-9]\d{16,19}$/u.test(userId))) {
        await interaction.reply({
          content: formatTranslation("error.generic", {}, "en-US"),
          ephemeral: true,
        });
        return;
      }
      await interaction.reply({
        content: `${userId ? `<@${userId}>\n` : ""}${escapeMarkdown(topic.title)}\nhttps://pocket-trash.app/help/${topic.slug}`,
        ephemeral: false,
        allowedMentions: { parse: [], users: userId ? [userId] : [] },
      });
    },
  };
  return { definition: definition.toJSON(), handler };
}
