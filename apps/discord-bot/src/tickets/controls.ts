import { formatTranslation } from "@pocket-trash/localizations";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  LabelBuilder,
  type MessageCreateOptions,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  type AuthorizedInteraction,
  authorizeInteraction,
} from "../authorization.js";
import type { createTicketClassifier } from "./classification.js";
import type { TicketOperation, TicketRequest } from "./model.js";

/** Versioned component namespace used to detect and repair bot-owned controls. */
export const ticketControlPrefix = "ticket:v1:";
/** Explicit English staff UI, independent of the interacting Discord user's locale.
 * @param key - Published staff message key.
 * @param values - Named interpolation values.
 * @returns English catalog text.
 */
const text = (key: Parameters<typeof formatTranslation>[0], values = {}) =>
  formatTranslation(key, values, "en-US");

/**
 * Renders the approved bounded container, with both actions always visible.
 * @param issueUrl - Durable completed ticket URL, if present.
 * @returns Discord Components V2 payload with no automatic mentions.
 */
export function renderTicketControls(issueUrl?: string) {
  return {
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
    components: [
      new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            issueUrl
              ? text("discord.tickets.created", { url: issueUrl })
              : text("discord.tickets.prompt"),
          ),
        )
        .addActionRowComponents(
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`${ticketControlPrefix}button:bug`)
              .setLabel(text("discord.tickets.bug"))
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(Boolean(issueUrl)),
            new ButtonBuilder()
              .setCustomId(`${ticketControlPrefix}button:feature`)
              .setLabel(text("discord.tickets.feature"))
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(Boolean(issueUrl)),
          ),
        ),
    ],
  } satisfies MessageCreateOptions;
}

/**
 * Creates an English staff modal using only a suggestion already present in memory.
 * @param kind - Staff-selected ticket type, never selected by inference.
 * @param priority - Cached advisory bug priority or zero.
 * @returns Immediately displayable modal; no asynchronous work is performed.
 */
export function renderTicketModal(kind: "bug" | "feature", priority = 0) {
  const modal = new ModalBuilder()
    .setCustomId(`${ticketControlPrefix}submit:${kind}`)
    .setTitle(
      text(kind === "bug" ? "discord.tickets.bug" : "discord.tickets.feature"),
    );
  if (kind === "bug")
    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel(text("discord.tickets.priority"))
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId("priority")
            .setRequired(true)
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
              (["noPriority", "urgent", "high", "medium", "low"] as const).map(
                (name, value) => ({
                  label: text(`discord.tickets.${name}`),
                  value: String(value),
                  default: value === priority,
                }),
              ),
            ),
        ),
    );
  return modal.addLabelComponents(
    new LabelBuilder()
      .setLabel(text("discord.tickets.staffNote"))
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId("staffNote")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(4000),
      ),
  );
}

/** Minimal interaction boundary, normalized only after Discord identifies a ticket component. */
export interface TicketInteraction extends AuthorizedInteraction {
  /** Versioned action identifier. */
  customId: string;
  /** Button opens a modal; submit starts persistence. */
  type: "button" | "submit";
  /** Actual channel identity, not an identity embedded in user input. */
  threadId: string;
  /** True only for an unarchived public thread in the configured guild/forum. */
  inScope: boolean;
  /** Staff-selected modal priority, including zero. */
  priority?: string;
  /** Optional private staff context, never sent to Jev. */
  staffNote?: string;
  /**
   * Acknowledges the click by immediately opening a modal.
   * @param modal - English modal with a frozen default.
   * @returns Discord acknowledgement completion.
   */
  showModal(modal: ModalBuilder): Promise<unknown>;
  /** Acknowledges submission ephemerally before any network or inference work.
   * @returns Discord acknowledgement completion.
   */
  defer(): Promise<unknown>;
  /**
   * Updates the private deferred response without mentions.
   * @param content - English catalog message.
   * @returns Discord response completion.
   */
  edit(content: string): Promise<unknown>;
}

/**
 * Coordinates authorized controls and repairable Discord presentation around the durable engine.
 * @param options - Configured authorization, persistence and scoped presentation boundaries.
 * @returns Ticket dispatch and idempotent per-thread reconciliation.
 */
export function createTicketControls(options: {
  /** Owner role is the only staff authority for ticket creation. */
  ownerRoleId: string;
  /** Recoverable engine; only fully persisted operations can finalize. */
  persistence: {
    /**
     * Recovers existing work without creating a ticket.
     * @param threadId - Authorized thread.
     * @returns Existing operation, if any.
     */
    lookup(threadId: string): Promise<TicketOperation | undefined>;
    /**
     * Creates or resumes the first accepted staff request.
     * @param request - Authorized immutable staff intent.
     * @returns Fully persisted operation.
     */
    persist(request: TicketRequest): Promise<TicketOperation>;
    /**
     * Compacts only after every Discord presentation step succeeds.
     * @param threadId - Successfully finalized thread.
     * @returns Compaction completion.
     */
    finalize(threadId: string): Promise<void>;
  };
  /** Optional cached advice; never awaited by interaction dispatch. */
  classifier?: Pick<ReturnType<typeof createTicketClassifier>, "peek">;
  /**
   * Repairs scoped controls, selected tag and visible source link.
   * @param threadId - Active configured support thread.
   * @param operation - Completed operation or undefined for enabled controls.
   * @returns All Discord presentation writes completed.
   */
  present(threadId: string, operation?: TicketOperation): Promise<void>;
}) {
  const repairs = new Map<string, Promise<void>>();
  /**
   * Serializes same-process thread repairs and never creates a Linear issue.
   * @param threadId - Active configured thread.
   * @returns Presentation and optional compaction completion.
   */
  function reconcile(threadId: string): Promise<void> {
    const existing = repairs.get(threadId);
    const action = (existing ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        const operation = await options.persistence.lookup(threadId);
        const completed =
          operation?.phase !== "processing" ? operation : undefined;
        await options.present(threadId, completed);
        if (completed) await options.persistence.finalize(threadId);
      })
      .finally(() => {
        if (repairs.get(threadId) === action) repairs.delete(threadId);
      });
    repairs.set(threadId, action);
    return action;
  }
  return {
    reconcile,
    /**
     * Handles only valid ticket interactions; role/scope checks precede modal values and persistence.
     * @param interaction - Discord-normalized action and response methods.
     * @returns Whether this component belongs to the ticket feature.
     */
    async dispatch(interaction: TicketInteraction): Promise<boolean> {
      const match = /^ticket:v1:(button|submit):(bug|feature)$/u.exec(
        interaction.customId,
      );
      if (!match || match[1] !== interaction.type) return false;
      if (!(await authorizeInteraction(interaction, [options.ownerRoleId])))
        return true;
      if (!interaction.inScope) {
        await interaction.reply({
          content: text("discord.tickets.unavailable"),
          ephemeral: true,
        });
        return true;
      }
      const kind = match[2] === "bug" ? "bug" : "feature";
      if (interaction.type === "button") {
        await interaction.showModal(
          renderTicketModal(
            kind,
            options.classifier?.peek(interaction.threadId)?.priority ?? 0,
          ),
        );
        return true;
      }
      await interaction.defer();
      try {
        const priority = kind === "bug" ? Number(interaction.priority) : 0;
        if (
          !Number.isInteger(priority) ||
          priority < 0 ||
          priority > 4 ||
          (kind === "bug" && !/^[0-4]$/u.test(interaction.priority ?? ""))
        )
          throw new Error("Invalid staff priority.");
        const operation = await options.persistence.persist({
          threadId: interaction.threadId,
          kind,
          priority,
          staffNote: interaction.staffNote ?? "",
        });
        await reconcile(interaction.threadId);
        await interaction.edit(
          text("discord.tickets.created", { url: operation.issueUrl }),
        );
      } catch {
        // Do not expose provider errors, staff notes, URLs containing credentials or transcript bodies.
        await interaction.edit(text("discord.tickets.retry"));
      }
      return true;
    },
  };
}
