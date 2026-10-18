import { formatTranslation } from "@pocket-trash/localizations";

/** Minimal interaction boundary used by the role guard. */
export type AuthorizedInteraction = {
  /** Discord roles held by the interacting guild member. */
  memberRoleIds: readonly string[];
  /** Optional chat-input values exposed only to an authorized command handler. */
  commandOptions?: {
    /** Selected help topic slug. */
    topic: string | null;
    /** Optional explicitly selected Discord user. */
    userId: string | null;
  };
  /**
   * Sends an interaction response.
   *
   * @param options - Localized response content and visibility.
   * @returns The Discord response result.
   */
  reply(options: {
    /** Localized response content. */
    content: string;
    /** Whether only the interacting member can see the response. */
    ephemeral: boolean;
    /** Restricts mentions to the explicitly selected user. */
    allowedMentions?: {
      /** Never automatically resolve roles, everyone, or text mentions. */
      parse: [];
      /** Explicit user IDs allowed to receive a mention. */
      users: string[];
    };
  }): Promise<unknown> | unknown;
};

/**
 * Applies the authoritative runtime role check to an interaction.
 *
 * @param interaction - Interaction member roles and response boundary.
 * @param allowedRoleIds - Discord role IDs authorized for the operation.
 * @returns Whether the interaction is authorized.
 */
export async function authorizeInteraction(
  interaction: AuthorizedInteraction,
  allowedRoleIds: readonly string[],
) {
  if (
    allowedRoleIds.some((roleId) => interaction.memberRoleIds.includes(roleId))
  ) {
    return true;
  }

  await interaction.reply({
    content: formatTranslation("web.feedback.admin.requests.denied"),
    ephemeral: true,
  });
  return false;
}
