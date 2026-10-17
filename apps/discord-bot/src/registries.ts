import {
  type AuthorizedInteraction,
  authorizeInteraction,
} from "./authorization.js";

/** Command, component, or modal handler protected by Discord roles. */
export type InteractionHandler = {
  /** Role IDs permitted to execute this handler. */
  allowedRoleIds: readonly string[];
  /** Stable command name or custom identifier. */
  id: string;
  /**
   * Executes the authorized interaction.
   *
   * @param interaction - Role-validated interaction boundary.
   * @returns The handler result.
   */
  execute(interaction: AuthorizedInteraction): Promise<void> | void;
};

/** Message metadata checked before content is handed to a parser. */
export type SourceMessage = {
  /** Discord channel containing the message. */
  channelId: string;
  /** Message content that remains unread until source authorization succeeds. */
  readonly content: string;
  /** Discord webhook that created the message, when any. */
  webhookId: string | null;
};

/** Message handler restricted to configured channels and webhook identities. */
export type MessageHandler = {
  /** Channels accepted by this handler. */
  channelIds: readonly string[];
  /**
   * Parses and handles one trusted-source message.
   *
   * @param message - Message whose source IDs were authorized.
   * @returns The handler result.
   */
  handle(message: SourceMessage): Promise<void> | void;
  /** Stable registry identifier. */
  id: string;
  /** Webhook identities accepted by this handler. */
  webhookIds: readonly string[];
};

/**
 * Creates a small role-protected interaction registry.
 *
 * @param handlers - Interaction handlers with explicit role policies.
 * @returns A role-protected interaction dispatcher.
 * @throws When a handler omits its allowed roles.
 */
export function createInteractionRegistry(
  handlers: readonly InteractionHandler[],
) {
  for (const handler of handlers) {
    if (handler.allowedRoleIds.length === 0) {
      throw new Error(`${handler.id} must declare at least one allowed role.`);
    }
  }
  const byId = new Map(handlers.map((handler) => [handler.id, handler]));

  return {
    /**
     * Dispatches a known interaction after its role check.
     *
     * @param id - Command or component identifier.
     * @param interaction - Member roles and response boundary.
     * @returns Whether a registered handler matched.
     */
    async dispatch(id: string, interaction: AuthorizedInteraction) {
      const handler = byId.get(id);
      if (!handler) return false;
      if (await authorizeInteraction(interaction, handler.allowedRoleIds)) {
        await handler.execute(interaction);
      }
      return true;
    },
  };
}

/**
 * Creates a registry that rejects untrusted message sources before parsing.
 *
 * @param handlers - Message handlers and their trusted source IDs.
 * @returns A trusted-source message dispatcher.
 */
export function createMessageRegistry(handlers: readonly MessageHandler[]) {
  return {
    /**
     * Dispatches only to a handler whose channel and webhook both match.
     *
     * @param message - Discord message metadata and lazily read content.
     * @returns Whether a registered handler matched.
     */
    async dispatch(message: SourceMessage) {
      const handler = handlers.find(
        (candidate) =>
          candidate.channelIds.includes(message.channelId) &&
          message.webhookId !== null &&
          candidate.webhookIds.includes(message.webhookId),
      );
      if (!handler) return false;
      await handler.handle(message);
      return true;
    },
  };
}
