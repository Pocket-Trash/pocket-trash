import { ChannelType, type Client, Collection } from "discord.js";
import { expect, it, vi } from "vitest";
import { readBounded } from "./http.js";
import type { TicketFile } from "./model.js";
import { createTicketReader, ticketFileType } from "./reader.js";

/** Canonical identifiers shared by the minimal gateway mock. */
const scope = {
  guildId: "123456789012345678",
  forumId: "623456789012345678",
  threadId: "223456789012345678",
};
/**
 * Builds only the Discord fields read by the adapter; no gateway is started.
 * @returns Reader and observable minimal message/HTTP boundaries.
 */
function fixture() {
  const attachment = {
    id: "523456789012345678",
    name: "a.txt",
    contentType: "text/plain",
    size: 3,
    url: `https://cdn.discordapp.com/attachments/${scope.threadId}/523456789012345678/a.txt?ex=fresh`,
  };
  const message = {
    id: "323456789012345678",
    author: { id: "423456789012345678", username: "Reporter", bot: false },
    member: null,
    webhookId: null,
    system: false,
    createdAt: new Date("2026-10-18T01:00:00Z"),
    content: "Export failed",
    attachments: new Collection([[attachment.id, attachment]]),
  };
  const fetchMessages = vi.fn().mockImplementation(async (options) =>
    options.message
      ? message
      : new Collection([
          [message.id, message],
          [
            "323456789012345679",
            {
              ...message,
              id: "323456789012345679",
              author: { ...message.author, bot: true },
              content: "ignore",
            },
          ],
        ]),
  );
  const channel = {
    /**
     * Identifies the minimal channel fixture as a thread.
     * @returns Whether the fixture is a thread.
     */
    isThread: () => true,
    type: ChannelType.PublicThread,
    guildId: scope.guildId,
    parentId: scope.forumId,
    messages: { fetch: fetchMessages },
  };
  // The fixture intentionally supplies only the gateway fields this adapter reads.
  const client = {
    channels: { fetch: vi.fn(async () => channel) },
  } as unknown as Client;
  const http = vi.fn<typeof fetch>().mockResolvedValue(new Response("abc"));
  const reader = createTicketReader({ ...scope, client, fetch: http });
  const file: TicketFile = {
    id: attachment.id,
    messageId: message.id,
    name: attachment.name,
    contentType: attachment.contentType,
    size: 3,
    status: "pending",
  };
  return { reader, message, attachment, channel, http, fetchMessages, file };
}

it("captures only human content, requests pages of 100 and never persists signed URLs", async () => {
  const f = fixture();
  const snapshot = await f.reader.snapshot(scope.threadId);
  expect(snapshot.messages).toHaveLength(1);
  expect(JSON.stringify(snapshot)).not.toContain("ex=fresh");
  expect(f.fetchMessages).toHaveBeenCalledWith({
    limit: 100,
    before: undefined,
    cache: false,
  });
});
it("refetches a fresh message/attachment before every byte download", async () => {
  const f = fixture();
  expect(await f.reader.readFile(f.file, scope.threadId)).toEqual(
    Buffer.from("abc"),
  );
  expect(f.fetchMessages).toHaveBeenCalledWith({
    message: f.message.id,
    force: true,
    cache: false,
  });
  expect(String(f.http.mock.calls[0]?.[0])).toContain("ex=fresh");
  expect(f.http.mock.calls[0]?.[1]?.redirect).toBe("error");
});
it("rejects foreign threads, changed attachments, unsafe CDN URLs and disguised executables", async () => {
  const f = fixture();
  f.channel.parentId = "723456789012345678";
  await expect(f.reader.snapshot(scope.threadId)).rejects.toThrow(
    "Unsupported",
  );
  f.channel.parentId = scope.forumId;
  f.attachment.size = 4;
  expect(await f.reader.readFile(f.file, scope.threadId)).toContain(
    "metadata changed",
  );
  f.attachment.size = 3;
  f.attachment.url = "https://example.com/a.txt";
  expect(await f.reader.readFile(f.file, scope.threadId)).toContain(
    "CDN scope",
  );
  f.attachment.url = `https://cdn.discordapp.com/attachments/${scope.threadId}/a.txt`;
  f.http.mockResolvedValueOnce(new Response("MZx"));
  expect(await f.reader.readFile(f.file, scope.threadId)).toContain(
    "Executable",
  );
});
it("limits actual streamed bytes even when Content-Length is missing", async () => {
  await expect(readBounded(new Response("oversized"), 3)).rejects.toThrow(
    "allowed size",
  );
  expect(ticketFileType("malware.exe", "application/octet-stream")).toBeNull();
  expect(ticketFileType("a.svg", "image/svg+xml")).toBeNull();
  expect(ticketFileType("a.png", "application/zip")).toBeNull();
  expect(ticketFileType("a.txt", null)).toBe("text/plain");
});
