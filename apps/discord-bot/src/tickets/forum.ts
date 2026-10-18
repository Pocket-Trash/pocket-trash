import {
  ChannelType,
  type Interaction,
  type Message,
  MessageFlags,
  PermissionFlagsBits,
  type ThreadChannel,
} from "discord.js";
import { createTicketClassifier } from "./classification.js";
import {
  createTicketControls,
  renderTicketControls,
  ticketControlPrefix,
} from "./controls.js";
import type { TicketOperation } from "./model.js";
import { createTicketReader } from "./reader.js";
import { createTicketRuntime } from "./runtime.js";

/**
 * Identifies ticket components anywhere in a bot message's nested V2 containers.
 * @param value - Serialized Discord message components.
 * @returns Whether a versioned ticket action is present.
 */
export function hasTicketControls(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasTicketControls);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, item]) =>
      (key === "custom_id" &&
        typeof item === "string" &&
        item.startsWith(ticketControlPrefix)) ||
      (key === "components" && hasTicketControls(item)),
  );
}

/**
 * Compares presentation while ignoring Discord-generated component IDs and implicit container defaults.
 * @param current - Current API components.
 * @param desired - Canonical bot components.
 * @returns Whether another presentation write would change visible content or action state.
 */
export function ticketPresentationMatches(
  current: unknown,
  desired: unknown,
): boolean {
  /** Serializes only visible/action state.
   * @param value - API components or desired builders serialized to JSON.
   * @returns Stable JSON without platform-generated metadata.
   */
  const normalize = (value: unknown) =>
    JSON.stringify(value, (key, item) =>
      key === "id" ||
      (key === "accent_color" && item === null) ||
      (key === "spoiler" && item === false)
        ? undefined
        : item,
    );
  return normalize(current) === normalize(desired);
}

/**
 * Wires authorized forum presentation and interaction dispatch to durable ticket operations.
 * @param options - Configured Discord resources and approved provider settings.
 * @returns Explicit lifecycle, event hooks and active-thread reconciliation.
 * @rejects When a returned lifecycle operation cannot validate resources or repair Discord.
 */
export function createForumTickets(
  options: Parameters<typeof createTicketRuntime>[0] & {
    /** Authoritative Owners role, not moderators. */
    ownerRoleId: string;
    /** Pre-provisioned bug tag in the configured forum. */
    bugTagId: string;
    /** Pre-provisioned feature tag in the configured forum. */
    featureTagId: string;
    /** Records initial presentation failure without stopping notification delivery. */
    onRepairFailure(): void;
  },
) {
  const { client } = options;
  const persistence = createTicketRuntime(options);
  const reader = createTicketReader(options);
  const classifier = createTicketClassifier({
    apiKey: options.inferenceApiKey,
  });
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const revisions = new Map<string, symbol>();
  let closed = false;
  /**
   * Checks actual channel scope without fetching or reopening archived threads.
   * @param thread - Discord channel identity and metadata.
   * @returns Whether this is a configured active public support thread.
   */
  function inScope(
    thread:
      | {
          /** Actual Discord channel type. */
          type: ChannelType;
          /** Guild owning the thread. */
          guildId?: string;
          /** Parent forum identity. */
          parentId?: string | null;
          /** Archived threads must never be reopened. */
          archived?: boolean | null;
        }
      | null
      | undefined,
  ): boolean {
    return (
      thread?.type === ChannelType.PublicThread &&
      thread.guildId === options.guildId &&
      thread.parentId === options.forumId &&
      thread.archived === false
    );
  }
  /**
   * Refetches thread metadata before any presentation write.
   * @param threadId - Candidate active thread.
   * @returns Authorized active thread, never an archived/private channel.
   * @rejects When scope changed or the channel is unavailable.
   */
  async function thread(threadId: string) {
    const channel = await client.channels.fetch(threadId, { force: true });
    if (!channel?.isThread() || !inScope(channel))
      throw new Error(
        "Ticket thread is outside the configured active support forum.",
      );
    return channel;
  }
  /**
   * Repairs forum tags and every existing bot-owned control, publishing the canonical ticket link.
   * @param threadId - Authorized active thread.
   * @param operation - Fully persisted issue or no existing ticket.
   * @returns All presentation writes completed before Redis compaction.
   * @rejects When Discord permissions, scope or a presentation write fails.
   */
  async function present(threadId: string, operation?: TicketOperation) {
    const channel = await thread(threadId);
    const messages: Message[] = [];
    let before: string | undefined;
    for (let page = 0; page < 100; page++) {
      const batch = await channel.messages.fetch({
        limit: 100,
        cache: false,
        ...(before ? { before } : {}),
      });
      for (const message of batch.values())
        if (
          message.author.id === client.user?.id &&
          !message.webhookId &&
          hasTicketControls(
            message.components.map((component) => component.toJSON()),
          )
        )
          messages.push(message);
      if (batch.size < 100) break;
      before = batch.last()?.id;
      if (page === 99)
        throw new Error("Support control history exceeds the safe scan limit.");
    }
    if (operation) {
      if (!operation.issueUrl)
        throw new Error("Completed ticket has no canonical Linear URL.");
      const selected =
        operation.kind === "bug" ? options.bugTagId : options.featureTagId;
      const tags = [
        ...channel.appliedTags.filter(
          (tag) => tag !== options.bugTagId && tag !== options.featureTagId,
        ),
        selected,
      ];
      if (tags.length > 5)
        throw new Error("Support thread has no free forum-tag slot.");
      if (tags.join(",") !== channel.appliedTags.join(","))
        await channel.setAppliedTags(tags);
    }
    const payload = renderTicketControls(operation?.issueUrl);
    if (!messages.length) await channel.send(payload);
    else
      for (const message of messages) {
        if (
          !ticketPresentationMatches(
            message.components.map((component) => component.toJSON()),
            payload.components.map((component) => component.toJSON()),
          )
        )
          await message.edit(payload);
      }
  }
  const controls = createTicketControls({
    ownerRoleId: options.ownerRoleId,
    persistence,
    classifier,
    present,
  });
  /**
   * Invalidates advice immediately and debounces fresh human text without startup inference.
   * @param threadId - Changed active support thread.
   */
  function schedule(threadId: string) {
    classifier.invalidate(threadId);
    clearTimeout(timers.get(threadId));
    if (closed || (timers.size >= 500 && !timers.has(threadId))) return;
    if (revisions.size >= 500)
      revisions.delete(revisions.keys().next().value ?? "");
    const revision = Symbol();
    revisions.set(threadId, revision);
    timers.set(
      threadId,
      setTimeout(() => {
        timers.delete(threadId);
        void (async () => {
          if (closed || (await persistence.lookup(threadId))) return;
          const snapshot = await reader.snapshot(threadId);
          if (closed || revisions.get(threadId) !== revision) return;
          await classifier.precompute(snapshot);
        })().catch(() => {
          /* Advice failure never blocks manual controls. */
        });
      }, 10_000),
    );
  }
  return {
    /** Validates resources and permissions, connects ticket Redis and repairs active threads without inference.
     * @rejects When configured resources, permissions or ticket Redis are unavailable.
     */
    async start() {
      const guild = await client.guilds.fetch(options.guildId);
      const forum = await guild.channels.fetch(options.forumId);
      if (forum?.type !== ChannelType.GuildForum)
        throw new Error(
          "DISCORD_SUPPORT_FORUM_ID must identify a forum in the configured guild.",
        );
      if (
        ![options.bugTagId, options.featureTagId].every((id) =>
          forum.availableTags.some((tag) => tag.id === id),
        ) ||
        options.bugTagId === options.featureTagId
      )
        throw new Error(
          "Configured Bug and Feature Request forum tags must exist and be distinct.",
        );
      const me = await guild.members.fetchMe();
      const permissions = forum.permissionsFor(me);
      if (
        !permissions?.has([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.SendMessagesInThreads,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageThreads,
        ])
      )
        throw new Error(
          "Discord ticket forum requires View Channel, Send Messages, Send Messages in Threads, Read Message History and Manage Threads.",
        );
      await persistence.connect();
      try {
        await this.reconcile();
      } catch {
        options.onRepairFailure();
      }
    },
    /** Scans active threads only; never classifies, scans archived threads or reopens them.
     * @rejects When Discord or ticket lookup/repair is unavailable for an active thread.
     */
    async reconcile() {
      const guild = await client.guilds.fetch(options.guildId);
      const active = await guild.channels.fetchActiveThreads();
      const failures: unknown[] = [];
      for (const channel of active.threads.values())
        if (inScope(channel)) {
          try {
            await controls.reconcile(channel.id);
          } catch (error) {
            failures.push(error);
          }
        }
      if (failures.length)
        throw new Error(
          `Discord ticket reconciliation failed for ${failures.length} active threads.`,
        );
    },
    /**
     * Adds controls only for genuinely new public support threads.
     * @param channel - Gateway thread event.
     * @param newlyCreated - Discord's new-thread flag, excluding visibility events.
     */
    async created(channel: ThreadChannel, newlyCreated: boolean) {
      if (!newlyCreated || !inScope(channel) || closed) return;
      await controls.reconcile(channel.id);
      schedule(channel.id);
    },
    /**
     * Schedules advisory recomputation for scoped human creates, edits and deletions.
     * @param message - Full or partial message metadata, never used as a trusted transcript.
     */
    changed(message: {
      /** Channel metadata used for the forum scope guard. */
      channel: Message["channel"] | ThreadChannel;
      /** Known bots are excluded; partial deletes invalidate hints before a fresh human-only read. */
      author?: {
        /** Whether Discord marks the author as a bot. */ bot: boolean;
      } | null;
      /** Webhooks are excluded from human classification input. */
      webhookId?: string | null;
      /** System messages are not user-authored evidence. */
      system?: boolean | null;
    }) {
      if (
        message.author?.bot ||
        message.webhookId ||
        message.system ||
        !message.channel.isThread() ||
        !inScope(message.channel)
      )
        return;
      schedule(message.channel.id);
    },
    /**
     * Normalizes ticket interactions while preserving immediate acknowledgement.
     * @param interaction - Gateway interaction.
     * @returns Whether this interaction belongs to ticket controls.
     */
    async dispatch(interaction: Interaction) {
      if (
        (!interaction.isButton() && !interaction.isModalSubmit()) ||
        !interaction.inGuild() ||
        !interaction.channelId ||
        !interaction.customId.startsWith(ticketControlPrefix)
      )
        return false;
      const roles = interaction.member?.roles;
      return controls.dispatch({
        customId: interaction.customId,
        type: interaction.isButton() ? "button" : "submit",
        threadId: interaction.channelId,
        inScope:
          interaction.guildId === options.guildId &&
          inScope(interaction.channel),
        memberRoleIds: Array.isArray(roles)
          ? roles
          : [...(roles?.cache.keys() ?? [])],
        /** Reads submitted priority only after authorization and deferral.
         * @returns Staff-selected priority, or the feature default.
         */
        get priority() {
          return interaction.isModalSubmit() &&
            interaction.customId.endsWith(":bug")
            ? interaction.fields.getStringSelectValues("priority")[0]
            : "0";
        },
        /** Reads private modal context only after authorization and deferral.
         * @returns Optional staff note, excluded from Jev inputs.
         */
        get staffNote() {
          return interaction.isModalSubmit()
            ? interaction.fields.getTextInputValue("staffNote")
            : "";
        },
        /**
         * Sends a private role or scope refusal.
         * @param response - Guard refusal.
         * @returns Discord acknowledgement.
         */
        reply: (response) =>
          interaction.reply({
            content: response.content,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
          }),
        /**
         * Opens the already-built modal without awaiting inference.
         * @param modal - Frozen staff modal.
         * @returns Discord acknowledgement.
         */
        showModal: (modal) =>
          interaction.isButton()
            ? interaction.showModal(modal)
            : Promise.reject(new Error("Not a button.")),
        /** Acknowledges privately before the durable operation starts.
         * @returns Discord acknowledgement completion.
         */
        defer: () => interaction.deferReply({ flags: MessageFlags.Ephemeral }),
        /**
         * Edits only the staff member's private acknowledgement.
         * @param content - English catalog response.
         * @returns Discord response completion.
         */
        edit: (content) =>
          interaction.editReply({ content, allowedMentions: { parse: [] } }),
      });
    },
    /** Cancels pending advice and closes only ticket-owned Redis resources. */
    close() {
      closed = true;
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      revisions.clear();
      persistence.close();
    },
  };
}
