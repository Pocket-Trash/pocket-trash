import {
  ChannelType,
  type Client,
  Collection,
  type ThreadChannel,
} from "discord.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderTicketControls } from "./controls.js";
import {
  createForumTickets,
  hasTicketControls,
  ticketPresentationMatches,
} from "./forum.js";
import type { TicketOperation } from "./model.js";

/** Mocked durable engine; these tests never connect to Redis, Linear or inference. */
const engine = vi.hoisted(() => ({
  lookup: vi.fn(),
  persist: vi.fn(),
  finalize: vi.fn(),
  connect: vi.fn(),
  close: vi.fn(),
}));
/** Bounded reader snapshot mock for advisory event scheduling tests. */
const readSnapshot = vi.hoisted(() => vi.fn());
vi.mock("./runtime.js", () => ({
  /** Supplies the observable no-network persistence boundary.
   * @returns Mocked recoverable ticket operations.
   */
  createTicketRuntime: () => engine,
}));
vi.mock("./reader.js", () => ({
  /** Supplies the bounded advisory reader mock.
   * @returns Snapshot boundary that never fetches real support data.
   */
  createTicketReader: () => ({ snapshot: readSnapshot }),
}));
/** Completed issue recovered on startup, with no transcript retained. */
const completed: TicketOperation = {
  version: 1,
  threadId: "223456789012345678",
  issueId: "synthetic",
  kind: "bug",
  priority: 0,
  phase: "persisted",
  issueUrl: "https://linear.app/pocket-trash/issue/ENG-9999",
  commentIds: [],
};

/**
 * Builds minimal Discord SDK boundaries using the adapter's existing mock pattern.
 * @returns Observable thread/history/tag writes and configured runtime.
 */
function fixture() {
  const history = new Collection<
    string,
    {
      /** Synthetic message identity. */
      id: string;
      /** Bot identity used by control ownership detection. */
      author: { /** Synthetic bot user identity. */ id: string };
      /** Fixtures are not webhook messages. */
      webhookId: null;
      /** Mutable simulated Discord V2 presentation. */
      components: ReturnType<typeof renderTicketControls>["components"];
      /** Observable message edit. */
      edit: ReturnType<typeof vi.fn>;
    }
  >();
  const messages = vi.fn().mockImplementation(async () => history);
  const send = vi.fn().mockImplementation(async (payload) => {
    const id = String(history.size + 1);
    const message = {
      id,
      author: { id: "bot" },
      webhookId: null,
      components: payload.components,
      edit: vi.fn().mockImplementation(async (next) => {
        message.components = next.components;
      }),
    };
    history.set(id, message);
    return message;
  });
  const channel = {
    id: completed.threadId,
    type: ChannelType.PublicThread,
    guildId: "123456789012345678",
    parentId: "623456789012345678",
    archived: false,
    appliedTags: ["other"],
    messages: { fetch: messages },
    send,
    /** Identifies the adapter fixture as a public thread.
     * @returns Thread type guard fixture result.
     */
    isThread: () => true,
    setAppliedTags: vi.fn().mockImplementation(async (tags) => {
      channel.appliedTags = tags;
    }),
  };
  const active = new Collection([[channel.id, channel]]);
  const permission = vi.fn().mockReturnValue(true);
  const forum = {
    type: ChannelType.GuildForum,
    availableTags: [{ id: "bug" }, { id: "feature" }],
    permissionsFor: vi.fn(() => ({ has: permission })),
  };
  const guild = {
    channels: {
      fetch: vi.fn().mockResolvedValue(forum),
      fetchActiveThreads: vi.fn().mockResolvedValue({ threads: active }),
    },
    members: { fetchMe: vi.fn().mockResolvedValue({}) },
  };
  // The SDK fixture exposes only fields consumed by this adapter, like reader.test.ts.
  const client = {
    user: { id: "bot" },
    channels: { fetch: vi.fn().mockResolvedValue(channel) },
    guilds: { fetch: vi.fn().mockResolvedValue(guild) },
  } as unknown as Client;
  const onRepairFailure = vi.fn();
  const runtime = createForumTickets({
    client,
    guildId: channel.guildId,
    forumId: channel.parentId,
    redisUrl: "redis://localhost:6379",
    linearApiKey: "synthetic",
    inferenceApiKey: "synthetic",
    ownerRoleId: "owner",
    bugTagId: "bug",
    featureTagId: "feature",
    onRepairFailure,
  });
  return {
    runtime,
    channel,
    history,
    active,
    permission,
    forum,
    guild,
    messages,
    send,
    onRepairFailure,
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  engine.lookup.mockResolvedValue(undefined);
  engine.connect.mockResolvedValue(undefined);
  engine.finalize.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("active forum ticket recovery", () => {
  it("ignores API-generated component IDs without masking changed button state", () => {
    const desired = renderTicketControls().components.map((item) =>
      item.toJSON(),
    );
    const received = desired.map((item) => ({
      ...item,
      id: 42,
      spoiler: false,
      accent_color: null,
    }));
    expect(ticketPresentationMatches(received, desired)).toBe(true);
    expect(
      ticketPresentationMatches(
        received,
        renderTicketControls(completed.issueUrl).components.map((item) =>
          item.toJSON(),
        ),
      ),
    ).toBe(false);
  });
  it("debounces human activity without startup inference and cancels pending work on shutdown", async () => {
    vi.useFakeTimers();
    const network = vi.fn().mockImplementation(async () => new Response("{}"));
    vi.stubGlobal("fetch", network);
    const f = fixture();
    await f.runtime.start();
    readSnapshot.mockResolvedValue({
      threadId: f.channel.id,
      threadUrl: "https://discord.com/channels/synthetic",
      messages: [{ content: "Export failed with 409" }],
    });
    const human = {
      channel: f.channel as unknown as ThreadChannel,
      author: { bot: false },
      webhookId: null,
      system: false,
    };
    f.runtime.changed({ ...human, author: { bot: true } });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(network).not.toHaveBeenCalled();
    f.runtime.changed(human);
    f.runtime.changed(human);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(network).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(readSnapshot).toHaveBeenCalledTimes(1);
    expect(network).toHaveBeenCalledTimes(1);
    f.runtime.changed({ ...human, author: null });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(readSnapshot).toHaveBeenCalledTimes(2);
    expect(network).toHaveBeenCalledTimes(1);
    f.runtime.changed(human);
    f.runtime.close();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(network).toHaveBeenCalledTimes(1);
  });
  it("adds only missing controls and never infers or creates an issue during startup/repeated recovery", async () => {
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    const f = fixture();
    await f.runtime.start();
    await f.runtime.reconcile();
    expect(f.send).toHaveBeenCalledTimes(1);
    expect(f.messages).toHaveBeenCalledWith({ limit: 100, cache: false });
    expect(
      hasTicketControls(
        f.history.first()?.components.map((item) => item.toJSON()),
      ),
    ).toBe(true);
    expect(network).not.toHaveBeenCalled();
    expect(engine.persist).not.toHaveBeenCalled();
    f.runtime.close();
  });
  it("paginates control discovery in batches of at most 100 before posting missing controls", async () => {
    const f = fixture();
    const firstPage = new Collection(
      Array.from({ length: 100 }, (_, index) => {
        const id = String(index);
        return [
          id,
          {
            id,
            author: { id: "human" },
            webhookId: null,
            components: [],
            edit: vi.fn(),
          },
        ] as const;
      }),
    );
    f.messages.mockResolvedValueOnce(firstPage);
    await f.runtime.start();
    expect(f.messages).toHaveBeenNthCalledWith(2, {
      limit: 100,
      cache: false,
      before: "99",
    });
    expect(f.send).toHaveBeenCalledTimes(1);
    f.runtime.close();
  });
  it("repairs selected tag, disabled buttons and canonical URL before finalization, idempotently", async () => {
    const f = fixture();
    await f.runtime.start();
    engine.lookup.mockResolvedValue(completed);
    await f.runtime.reconcile();
    await f.runtime.reconcile();
    expect(f.channel.setAppliedTags).toHaveBeenCalledTimes(1);
    expect(f.channel.appliedTags).toEqual(["other", "bug"]);
    expect(f.history.first()?.edit).toHaveBeenCalledTimes(1);
    const rendered = JSON.stringify(
      f.history.first()?.components.map((item) => item.toJSON()),
    );
    expect(rendered).toContain(completed.issueUrl);
    expect(rendered.match(/"disabled":true/gu)).toHaveLength(2);
    expect(f.send).toHaveBeenCalledTimes(1);
    expect(engine.persist).not.toHaveBeenCalled();
    f.runtime.close();
  });
  it("leaves Redis uncompacted on partial Discord failure and repairs on the next scan", async () => {
    const f = fixture();
    await f.runtime.start();
    engine.lookup.mockResolvedValue(completed);
    f.channel.setAppliedTags.mockRejectedValueOnce(
      new Error("Missing Manage Threads"),
    );
    await expect(f.runtime.reconcile()).rejects.toThrow(
      "reconciliation failed",
    );
    expect(engine.finalize).not.toHaveBeenCalled();
    await f.runtime.reconcile();
    expect(engine.finalize).toHaveBeenCalledWith(completed.threadId);
    expect(f.send).toHaveBeenCalledTimes(1);
    f.runtime.close();
  });
  it("does not scan archived/private/foreign threads or handle visibility-only thread events", async () => {
    const f = fixture();
    f.channel.archived = true;
    await f.runtime.start();
    expect(f.messages).not.toHaveBeenCalled();
    f.channel.archived = false;
    await f.runtime.created(f.channel as unknown as ThreadChannel, false);
    expect(f.messages).not.toHaveBeenCalled();
    f.channel.parentId = "foreign";
    await f.runtime.created(f.channel as unknown as ThreadChannel, true);
    expect(f.messages).not.toHaveBeenCalled();
    f.runtime.close();
  });
  it("fails clearly on missing forum tags or permissions before connecting ticket Redis", async () => {
    const f = fixture();
    f.forum.availableTags = [];
    await expect(f.runtime.start()).rejects.toThrow("forum tags");
    expect(engine.connect).not.toHaveBeenCalled();
    f.forum.availableTags = [{ id: "bug" }, { id: "feature" }];
    f.permission.mockReturnValue(false);
    await expect(f.runtime.start()).rejects.toThrow("Manage Threads");
    expect(engine.connect).not.toHaveBeenCalled();
    f.runtime.close();
  });
  it("never silently removes unrelated tags when the forum tag limit is full", async () => {
    const f = fixture();
    engine.lookup.mockResolvedValue(completed);
    f.channel.appliedTags = ["1", "2", "3", "4", "5"];
    await f.runtime.start();
    expect(f.onRepairFailure).toHaveBeenCalledTimes(1);
    expect(f.channel.setAppliedTags).not.toHaveBeenCalled();
    expect(engine.finalize).not.toHaveBeenCalled();
    f.runtime.close();
  });
});
