import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  escapeMarkdown,
  hyperlink,
  inlineCode,
  type MessageCreateOptions,
  MessageFlags,
  TextDisplayBuilder,
  TimestampStyles,
  time,
} from "discord.js";

/** Visual severity represented by a notification container's accent bar. */
export type DiscordNotificationTone = "success" | "info" | "warning" | "error";

/** External destination displayed below a notification. */
export interface DiscordNotificationAction {
  /** Concise button label. */
  label: string;
  /** Absolute external URL. */
  url: string;
}

/** Normalized content rendered as a Discord Components v2 notification. */
export interface DiscordNotification {
  /** External link buttons, limited by Discord to five per row. */
  actions?: readonly DiscordNotificationAction[];
  /** Concise event explanation. */
  description: string;
  /** Optional diagnostic lines displayed as a quote. */
  diagnostics?: readonly string[];
  /** Stable source, environment, and event metadata. */
  tags: readonly string[];
  /** Event occurrence time. */
  occurredAt: Date;
  /** Muted provenance shown beside the relative timestamp. */
  provenance: string;
  /** Short source label such as GitHub or Axiom. */
  source: string;
  /** Human-readable event state. */
  status: string;
  /** Primary notification subject. */
  title: string;
  /** Optional external link applied to the subject. */
  titleUrl?: string;
  /** Accent-bar severity. */
  tone: DiscordNotificationTone;
}

/** RGB accent colors used consistently across notification sources. */
const accentColors: Record<DiscordNotificationTone, number> = {
  success: 0x2da44e,
  info: 0x0969da,
  warning: 0xbf8700,
  error: 0xcf222e,
};

/**
 * Renders one normalized event as the selected bounded notification card.
 *
 * @param notification - Safe normalized notification fields.
 * @returns Discord message options using Components v2 with mentions disabled.
 * @throws {RangeError} When more than five actions are provided.
 * @throws {TypeError} When the occurrence time is invalid.
 */
export function renderDiscordNotification(
  notification: DiscordNotification,
): MessageCreateOptions {
  if ((notification.actions?.length ?? 0) > 5) {
    throw new RangeError("Discord notifications support at most five actions.");
  }
  if (Number.isNaN(notification.occurredAt.getTime())) {
    throw new TypeError("Discord notification occurrence time is invalid.");
  }

  const title = escapeMarkdown(notification.title);
  const linkedTitle = notification.titleUrl
    ? hyperlink(title, notification.titleUrl)
    : title;
  const diagnostics = notification.diagnostics?.length
    ? notification.diagnostics
        .map((line) => `> ${escapeMarkdown(line)}`)
        .join("\n")
    : "";
  const tags = notification.tags.map(inlineCode).join(" · ");
  const body = [
    `### ${linkedTitle}`,
    escapeMarkdown(notification.description),
    diagnostics,
    tags,
    `-# ${escapeMarkdown(notification.provenance)} · ${time(notification.occurredAt, TimestampStyles.RelativeTime)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const card = new ContainerBuilder()
    .setAccentColor(accentColors[notification.tone])
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# ${escapeMarkdown(notification.source)}\n## ${escapeMarkdown(notification.status)}`,
      ),
      new TextDisplayBuilder().setContent(body),
    );

  if (notification.actions?.length) {
    card.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        notification.actions.map((action) =>
          new ButtonBuilder()
            .setLabel(action.label)
            .setStyle(ButtonStyle.Link)
            .setURL(action.url),
        ),
      ),
    );
  }

  return {
    allowedMentions: { parse: [] },
    components: [card],
    flags: MessageFlags.IsComponentsV2,
  };
}
