import { ChannelType, type Client } from "discord.js";
import { readBounded } from "./http.js";
import { type TicketFile, ticketSnapshotSchema } from "./model.js";
import type { TicketReader } from "./persistence.js";

/** Filename allowlist deliberately excludes active SVG, archives and executables. */
const fileTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  txt: "text/plain",
  log: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
};

/**
 * Classifies an attachment by a narrow extension/MIME agreement before downloading.
 * @param name - Original attachment name.
 * @param supplied - Discord MIME metadata, if supplied.
 * @returns Allowed canonical MIME, or null for unsupported content.
 */
export function ticketFileType(
  name: string,
  supplied: string | null,
): string | null {
  const type = fileTypes[name.split(".").at(-1)?.toLowerCase() ?? ""];
  if (!type) return null;
  const mime = supplied?.split(";")[0]?.trim().toLowerCase();
  return !mime ||
    mime === type ||
    (type.startsWith("text/") && mime === "text/plain")
    ? type
    : null;
}

/**
 * Creates an authorized support-thread reader with fresh, bounded CDN downloads.
 * @param options - Gateway client and configured support scope.
 * @returns Frozen transcript and attachment read operations.
 * @rejects When returned operations cannot read authorized bounded content.
 */
export function createTicketReader(options: {
  /** Existing connected gateway client. */
  client: Client;
  /** Only accepted guild. */
  guildId: string;
  /** Only accepted public forum parent. */
  forumId: string;
  /** Injectable HTTP boundary for tests. */
  fetch?: typeof fetch;
}): TicketReader {
  /**
   * Resolves and authorizes the configured public support thread.
   * @param id - Requested thread identity.
   * @returns An authorized, readable thread.
   * @rejects When the channel is missing, private, or outside the support scope.
   */
  async function thread(id: string) {
    const channel = await options.client.channels.fetch(id);
    if (
      !channel?.isThread() ||
      channel.type !== ChannelType.PublicThread ||
      channel.guildId !== options.guildId ||
      channel.parentId !== options.forumId
    )
      throw new Error("Unsupported ticket thread.");
    return channel;
  }
  return {
    /**
     * Captures complete human history in chronological order without attachment URLs.
     * @param threadId - Authorized support thread.
     * @returns Canonical transcript frozen before external writes.
     * @rejects When history exceeds the bounded snapshot or Discord is unavailable.
     */
    async snapshot(threadId) {
      const channel = await thread(threadId);
      const messages = [];
      let before: string | undefined;
      let examined = 0;
      let bytes = 0;
      for (;;) {
        const page = await channel.messages.fetch({
          limit: 100,
          before,
          cache: false,
        });
        if (!page.size) break;
        const sorted = [...page.values()].sort((a, b) =>
          BigInt(a.id) < BigInt(b.id) ? -1 : 1,
        );
        before = sorted[0]?.id;
        examined += page.size;
        if (examined > 10_000)
          throw new Error("Ticket history exceeds the message limit.");
        for (const message of sorted) {
          if (message.author.bot || message.webhookId || message.system)
            continue;
          const item = {
            id: message.id,
            userId: message.author.id,
            username:
              message.member?.displayName ??
              message.author.globalName ??
              message.author.username,
            timestamp: message.createdAt.toISOString(),
            content: message.content,
            files: [...message.attachments.values()].map(
              (attachment): TicketFile => {
                const contentType = ticketFileType(
                  attachment.name,
                  attachment.contentType,
                );
                return {
                  id: attachment.id,
                  messageId: message.id,
                  name: attachment.name,
                  contentType:
                    contentType ??
                    attachment.contentType?.slice(0, 100) ??
                    "application/octet-stream",
                  size: attachment.size,
                  status: contentType ? "pending" : "omitted",
                  ...(!contentType
                    ? { reason: "Unsupported attachment type." }
                    : {}),
                };
              },
            ),
          };
          bytes += Buffer.byteLength(JSON.stringify(item));
          if (bytes > 8_000_000)
            throw new Error("Ticket history exceeds the snapshot size limit.");
          messages.push(item);
        }
        if (page.size < 100) break;
      }
      messages.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
      return ticketSnapshotSchema.parse({
        threadId,
        threadUrl: `https://discord.com/channels/${options.guildId}/${threadId}`,
        messages,
      });
    },
    /**
     * Refetches the source message to obtain a fresh signed CDN URL on every attempt.
     * @param file - Frozen attachment identity and expected metadata.
     * @param threadId - Authorized source thread.
     * @returns Bounded bytes or a permanent omission reason.
     * @rejects On transient Discord/network failures so the operation remains retryable.
     */
    async readFile(file, threadId) {
      const channel = await thread(threadId);
      const message = await channel.messages
        .fetch({ message: file.messageId, force: true, cache: false })
        .catch((error: unknown) => {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === 10008
          )
            return null;
          throw error;
        });
      const attachment = message?.attachments.get(file.id);
      if (!attachment || !message || message.author.bot)
        return "Attachment or its source message was deleted.";
      if (
        attachment.name !== file.name ||
        attachment.size !== file.size ||
        ticketFileType(attachment.name, attachment.contentType) !==
          file.contentType
      )
        return "Attachment metadata changed or is unsupported.";
      const url = new URL(attachment.url);
      if (
        url.protocol !== "https:" ||
        url.hostname !== "cdn.discordapp.com" ||
        !url.pathname.startsWith(`/attachments/${threadId}/`)
      )
        return "Attachment URL is outside the allowed Discord CDN scope.";
      const response = await (options.fetch ?? fetch)(url, {
        signal: AbortSignal.timeout(20_000),
        redirect: "error",
      });
      if ([404, 410].includes(response.status))
        return "Attachment content is no longer available.";
      if (!response.ok)
        throw new Error(
          `Discord attachment fetch failed (${response.status}).`,
        );
      const bytes = await readBounded(
        response,
        Math.min(file.size, 10_000_000),
      );
      const signature = Buffer.from(bytes.subarray(0, 8));
      if (
        signature.subarray(0, 2).toString() === "MZ" ||
        signature
          .subarray(0, 4)
          .equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) ||
        signature.subarray(0, 2).toString() === "PK" ||
        signature.subarray(0, 2).toString() === "#!"
      )
        return "Executable or archive content is not allowed.";
      if (
        file.contentType === "application/pdf" &&
        signature.subarray(0, 5).toString() !== "%PDF-"
      )
        return "Attachment is not a valid PDF.";
      if (
        !file.contentType.startsWith("image/") &&
        file.contentType !== "application/pdf"
      ) {
        try {
          new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch {
          return "Text attachment is not valid UTF-8.";
        }
      }
      return bytes;
    },
  };
}
