import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { Redis } from "ioredis";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { TicketOperation } from "./model.js";
import { createTicketOperationStore } from "./store.js";

/** Disposable local process owned exclusively by this test file. */
let serverProcess: ChildProcess;
/** Ephemeral local URL, never a deployed/shared Redis connection. */
let url: string;
beforeAll(async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test address.");
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  serverProcess = spawn("redis-server", [
    "--bind",
    "127.0.0.1",
    "--save",
    "",
    "--appendonly",
    "no",
    "--port",
    String(address.port),
  ]);
  await new Promise<void>((resolve, reject) => {
    serverProcess.once("error", reject);
    serverProcess.stdout?.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("Ready to accept connections")) resolve();
    });
    serverProcess.once("exit", () =>
      reject(new Error("Redis exited before readiness.")),
    );
  });
  url = `redis://127.0.0.1:${address.port}`;
});
afterAll(() => serverProcess?.kill("SIGTERM"));

it("recovers durable state after reconnect and applies 90-day TTL only after compaction", async () => {
  const first = createTicketOperationStore(url);
  const second = createTicketOperationStore(url);
  const inspect = new Redis(url);
  const threadId = "223456789012345678";
  const key = `discord-bot:ticket:${threadId}`;
  const operation: TicketOperation = {
    version: 1,
    threadId,
    issueId: randomUUID(),
    kind: "bug",
    priority: 0,
    phase: "persisted",
    issueUrl: "https://linear.app/pocket-trash/issue/ENG-9999",
    commentIds: [],
  };
  try {
    await first.connect();
    await first.transact(threadId, (transaction) =>
      transaction.save(operation),
    );
    expect(await inspect.ttl(key)).toBe(-1);
    first.close();
    await second.connect();
    expect(
      await second.transact(threadId, (transaction) => transaction.load()),
    ).toEqual(operation);
    await second.transact(threadId, (transaction) =>
      transaction.save({ ...operation, phase: "finalized" }),
    );
    expect(await inspect.ttl(key)).toBeGreaterThan(90 * 86400 - 10);
  } finally {
    first.close();
    second.close();
    inspect.disconnect();
  }
});

it("serializes threads and fences stale writers without removing a replacement lease", async () => {
  const store = createTicketOperationStore(url);
  const inspect = new Redis(url);
  const threadId = "323456789012345678";
  const lock = `discord-bot:ticket:${threadId}:lease`;
  try {
    await store.connect();
    await store.transact(threadId, async (transaction) => {
      await expect(
        store.transact(threadId, async () => undefined),
      ).rejects.toThrow("already running");
      await inspect.set(lock, "replacement-owner", "PX", 30000);
      await expect(
        transaction.save({
          version: 1,
          threadId,
          issueId: randomUUID(),
          kind: "feature",
          priority: 0,
          phase: "processing",
          commentIds: [],
        }),
      ).rejects.toThrow("lease was lost");
    });
    expect(await inspect.get(lock)).toBe("replacement-owner");
  } finally {
    store.close();
    inspect.disconnect();
  }
});
