import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createAxiomCursorStore } from "./axiom-cursor.js";

/** Disposable Redis owned only by these cursor persistence tests. */
let redis: ChildProcess;
/** Ephemeral local Redis endpoint, never a deployed connection. */
let redisUrl: string;
beforeAll(async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No cursor test port available.");
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  redis = spawn("redis-server", [
    "--save",
    "",
    "--appendonly",
    "no",
    "--port",
    String(address.port),
  ]);
  await new Promise<void>((resolve, reject) => {
    redis.once("error", reject);
    redis.stdout?.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("Ready to accept connections")) resolve();
    });
    redis.once("exit", (code) =>
      reject(new Error(`Cursor Redis exited: ${code}`)),
    );
  });
  redisUrl = `redis://127.0.0.1:${address.port}`;
});
afterAll(() => redis?.kill("SIGTERM"));

it("persists the bot-local cursor and notifies recovery without accepting invalid data", async () => {
  const onReady = vi.fn();
  const options = {
    guildId: "guild-one",
    channelId: "intake-one",
    redisUrl,
    onReady,
  };
  const cursor = { messageId: "1560912345678901234", checkedAt: 42 };
  const first = createAxiomCursorStore(options);
  await first.connect();
  expect(await first.load()).toBeUndefined();
  await first.save(cursor);
  first.close();
  const second = createAxiomCursorStore(options);
  const isolated = createAxiomCursorStore({
    ...options,
    channelId: "intake-two",
    onReady: vi.fn(),
  });
  try {
    await second.connect();
    await isolated.connect();
    expect(await second.load()).toEqual(cursor);
    expect(await isolated.load()).toBeUndefined();
    expect(onReady).toHaveBeenCalledTimes(2);
    execFileSync("redis-cli", [
      "-u",
      redisUrl,
      "CLIENT",
      "KILL",
      "TYPE",
      "normal",
    ]);
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(3));
    expect(await second.load()).toEqual(cursor);
    await expect(
      second.save({ ...cursor, checkedAt: Number.NaN }),
    ).rejects.toThrow();
    await expect(
      second.save({ ...cursor, messageId: "invalid" }),
    ).rejects.toThrow();
    expect(await second.load()).toEqual(cursor);
  } finally {
    second.close();
    isolated.close();
  }
});
