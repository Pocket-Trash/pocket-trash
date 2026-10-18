import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  renderTranscript,
  type TicketFile,
  type TicketOperation,
  type TicketRequest,
  type TicketSnapshot,
} from "./model.js";
import {
  createTicketPersistence,
  type TicketIssue,
  type TicketLinear,
} from "./persistence.js";
import type { TicketOperationStore, TicketTransaction } from "./store.js";

/** Canonical configured guild and support thread for all synthetic tests. */
const guildId = "123456789012345678";
/** Canonical support thread, distinct from its parent forum. */
const threadId = "223456789012345678";
/** Authorized synthetic staff request, including explicit no-priority support. */
const request: TicketRequest = {
  threadId,
  kind: "bug",
  priority: 0,
  staffNote: "Staff checked the report.",
};
/** Synthetic model output, not a paid inference request. */
const summary = {
  title: "Export omits an archived pen",
  summary: "Export has 36 instead of 37 pens.",
  reproductionSteps: ["Export CSV"],
  expectedBehavior: "37 pens",
  actualBehavior: "36 pens",
  environment: ["Firefox"],
  userImpact: "Cannot reconcile backup",
  openQuestions: [],
};

/**
 * Creates isolated provider mocks and clone-on-write durable state.
 * @returns A complete synthetic persistence scenario and observable boundaries.
 */
function fixture() {
  const states = new Map<string, TicketOperation>();
  const locked = new Set<string>();
  const store: TicketOperationStore = {
    /**
     * Holds one thread lease and clones every durable read/write.
     * @template T - Workflow result.
     * @param id - Thread identity.
     * @param action - Transaction action.
     * @returns Action completion.
     * @rejects When another action owns this thread or a provider fails.
     */
    async transact<T>(
      id: string,
      action: (transaction: TicketTransaction) => Promise<T>,
    ): Promise<T> {
      if (locked.has(id)) throw new Error("Already running");
      locked.add(id);
      try {
        return await action({
          /**
           * Reads a detached durable state snapshot.
           * @returns The current stored operation, if present.
           */
          load: async () => structuredClone(states.get(id)),
          /**
           * Persists a detached operation snapshot.
           * @param operation - Current state to checkpoint.
           * @returns Write completion.
           */
          async save(operation) {
            states.set(id, structuredClone(operation));
          },
        });
      } finally {
        locked.delete(id);
      }
    },
  };
  const snapshot: TicketSnapshot = {
    threadId,
    threadUrl: `https://discord.com/channels/${guildId}/${threadId}`,
    messages: [
      {
        id: "323456789012345678",
        userId: "423456789012345678",
        username: "Synthetic reporter",
        timestamp: "2026-10-18T01:00:00Z",
        content: "My export is missing a pen.",
        files: [
          {
            id: "523456789012345678",
            messageId: "323456789012345678",
            name: "report.txt",
            contentType: "text/plain",
            size: 3,
            status: "pending",
          },
        ],
      },
    ],
  };
  const issues = new Map<string, TicketIssue>();
  const comments = new Map<string, string>();
  const assets = new Set<string>();
  const slot = {
    assetUrl: "https://uploads.linear.app/synthetic/report",
    uploadUrl: "https://storage.googleapis.com/synthetic",
    headers: { "content-type": "text/plain" },
  };
  const linear: TicketLinear = {
    findIssue: vi.fn(async (id) => issues.get(id) ?? null),
    findByThread: vi.fn(async () => null),
    createIssue: vi.fn(async (operation) => {
      const issue = {
        id: operation.issueId,
        url: "https://linear.app/pocket-trash/issue/ENG-9999",
        kind: operation.kind,
      };
      issues.set(issue.id, issue);
      return issue;
    }),
    hasComment: vi.fn(async (id) => comments.has(id)),
    createComment: vi.fn(async (id, _issueId, body) => {
      comments.set(id, body);
    }),
    linkThread: vi.fn(async () => {}),
    prepareUpload: vi.fn(async () => slot),
    putUpload: vi.fn(async (upload) => {
      assets.add(upload.assetUrl);
      return true;
    }),
    assetExists: vi.fn(async (url) => assets.has(url)),
  };
  const reader = {
    snapshot: vi.fn(async () => structuredClone(snapshot)),
    readFile: vi.fn(async (file: TicketFile) =>
      Buffer.from("abc").subarray(0, file.size),
    ),
  };
  const summarize = vi.fn(async () => summary);
  const service = createTicketPersistence({
    guildId,
    store,
    reader,
    linear,
    summarize,
  });
  return {
    service,
    states,
    snapshot,
    issues,
    comments,
    assets,
    slot,
    linear,
    reader,
    summarize,
  };
}

describe("recoverable Discord-to-Linear persistence", () => {
  it("creates immediately with no preview, preserves no priority, and compacts only after Discord succeeds", async () => {
    const f = fixture();
    const result = await f.service.persist(request);
    expect(result).toMatchObject({
      kind: "bug",
      priority: 0,
      phase: "persisted",
      summary,
    });
    expect(f.issues.size).toBe(1);
    expect(f.comments.size).toBe(1);
    expect([...f.comments.values()][0]).toContain(
      "Discord ID 423456789012345678",
    );
    expect([...f.comments.values()][0]).toContain(f.slot.assetUrl);
    expect(f.linear.linkThread).toHaveBeenCalledWith(
      result.issueId,
      f.snapshot.threadUrl,
      [f.slot.assetUrl],
    );
    expect(f.states.get(threadId)?.snapshot).toBeDefined();
    await f.service.finalize(threadId);
    expect(f.states.get(threadId)).toEqual({
      version: 1,
      threadId,
      issueId: result.issueId,
      issueUrl: result.issueUrl,
      kind: "bug",
      priority: 0,
      phase: "finalized",
      commentIds: result.commentIds,
    });
  });

  it("forces feature priority to none and retains the first durable intent on retry", async () => {
    const f = fixture();
    f.summarize.mockRejectedValueOnce(new Error("AI unavailable"));
    await expect(
      f.service.persist({ ...request, kind: "feature", priority: 1 }),
    ).rejects.toThrow();
    const id = f.states.get(threadId)?.issueId;
    const result = await f.service.persist(request);
    expect(result).toMatchObject({ issueId: id, kind: "feature", priority: 0 });
    expect(f.reader.snapshot).toHaveBeenCalledTimes(1);
    expect(f.issues.size).toBe(1);
  });

  it("leaves AI failure retryable without a Linear issue or replacement UUID", async () => {
    const f = fixture();
    f.summarize.mockRejectedValueOnce(new Error("AI unavailable"));
    await expect(f.service.persist(request)).rejects.toThrow("AI unavailable");
    const id = f.states.get(threadId)?.issueId;
    expect(id).toBeDefined();
    expect(f.issues.size).toBe(0);
    expect((await f.service.persist(request)).issueId).toBe(id);
  });

  it("queries the stored UUID after an ambiguous issue write", async () => {
    const f = fixture();
    vi.mocked(f.linear.createIssue).mockImplementationOnce(
      async (operation) => {
        f.issues.set(operation.issueId, {
          id: operation.issueId,
          url: "https://linear.app/pocket-trash/issue/ENG-9999",
          kind: "bug",
        });
        throw new Error("Response lost");
      },
    );
    const result = await f.service.persist(request);
    await f.service.persist(request);
    expect(f.issues.size).toBe(1);
    expect(f.linear.createIssue).toHaveBeenCalledTimes(1);
    expect(result.phase).toBe("persisted");
  });

  it("reuses comment identities after a partial write or ambiguous comment response", async () => {
    const f = fixture();
    vi.mocked(f.linear.createComment).mockImplementationOnce(
      async (id, _issueId, body) => {
        f.comments.set(id, body);
        throw new Error("Response lost");
      },
    );
    vi.mocked(f.linear.linkThread).mockRejectedValueOnce(
      new Error("Link unavailable"),
    );
    await expect(f.service.persist(request)).rejects.toThrow(
      "Link unavailable",
    );
    const ids = f.states.get(threadId)?.commentIds;
    const result = await f.service.persist(request);
    expect(result.commentIds).toEqual(ids);
    expect(f.comments.size).toBe(1);
    expect(f.linear.createComment).toHaveBeenCalledTimes(1);
    expect(f.linear.putUpload).toHaveBeenCalledTimes(1);
    expect(f.reader.readFile).toHaveBeenCalledTimes(1);
  });

  it("recovers an accepted upload after its response was lost without duplicate visible links", async () => {
    const f = fixture();
    vi.mocked(f.linear.putUpload).mockImplementationOnce(async (slot) => {
      f.assets.add(slot.assetUrl);
      throw new Error("Upload response lost");
    });
    await expect(f.service.persist(request)).rejects.toThrow(
      "Upload response lost",
    );
    await f.service.persist(request);
    expect(f.linear.prepareUpload).toHaveBeenCalledTimes(1);
    expect(f.linear.putUpload).toHaveBeenCalledTimes(1);
    expect([...f.comments.values()][0]?.split(f.slot.assetUrl)).toHaveLength(2);
    expect(f.reader.readFile).toHaveBeenCalledTimes(2);
  });

  it.each([
    "metadata",
    "bytes",
  ])("records rejected %s without dropping the ticket", async (stage) => {
    const f = fixture();
    if (stage === "metadata")
      vi.mocked(f.linear.prepareUpload).mockResolvedValueOnce(null);
    else vi.mocked(f.linear.putUpload).mockResolvedValueOnce(false);
    const result = await f.service.persist(request);
    expect(result.phase).toBe("persisted");
    expect(result.files?.[0]?.status).toBe("omitted");
    expect([...f.comments.values()][0]).toContain("omitted");
  });

  it("enforces both per-file and aggregate attachment caps before reading bytes", async () => {
    const f = fixture();
    const message = f.snapshot.messages[0];
    if (!message) throw new Error("Fixture missing");
    const base = message.files[0];
    if (!base) throw new Error("Fixture missing");
    message.files = [0, 1, 2, 3].map((index) => ({
      ...base,
      id: `62345678901234567${index}`,
      size: index === 0 ? 10_000_001 : 10_000_000,
    }));
    f.reader.readFile.mockImplementation(async (file) =>
      Buffer.alloc(file.size),
    );
    const result = await f.service.persist(request);
    expect(result.files?.map((file) => file.status)).toEqual([
      "omitted",
      "uploaded",
      "uploaded",
      "omitted",
    ]);
    expect(f.reader.readFile).toHaveBeenCalledTimes(2);
  });

  it("serializes concurrent clicks and repeated successful calls create no additional issue", async () => {
    const f = fixture();
    const results = await Promise.allSettled([
      f.service.persist(request),
      f.service.persist({ ...request, kind: "feature" }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    await f.service.persist(request);
    expect(f.issues.size).toBe(1);
    expect(f.linear.createIssue).toHaveBeenCalledTimes(1);
  });

  it("uses Linear source lookup after a finalized Redis mapping expires", async () => {
    const f = fixture();
    const issue = {
      id: randomUUID(),
      url: "https://linear.app/pocket-trash/issue/ENG-9999",
      kind: "feature" as const,
    };
    vi.mocked(f.linear.findByThread).mockResolvedValue(issue);
    const result = await f.service.persist(request);
    expect(result).toMatchObject({
      issueId: issue.id,
      kind: "feature",
      phase: "persisted",
    });
    expect(f.linear.createIssue).not.toHaveBeenCalled();
    expect(f.reader.snapshot).not.toHaveBeenCalled();
  });

  it("splits transcripts deterministically without cutting surrogate pairs or losing text", () => {
    const f = fixture();
    const message = f.snapshot.messages[0];
    if (!message) throw new Error("Fixture missing");
    message.content = "A😀".repeat(15_000);
    const chunks = renderTranscript(f.snapshot, []);
    expect(chunks).toHaveLength(3);
    expect(
      chunks.every(
        (chunk) => chunk.length <= 20_000 && !/[\uD800-\uDBFF]$/u.test(chunk),
      ),
    ).toBe(true);
    expect(renderTranscript(f.snapshot, [])).toEqual(chunks);
  });
});
