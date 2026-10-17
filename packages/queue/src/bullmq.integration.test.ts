import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import { afterAll, beforeAll, describe } from "vitest";
import { createBullMqQueueAdapter } from "./index.js";
import { defineQueueAdapterContract } from "./test-contract.js";

describe("BullMQ queue adapter", () => {
  let redis: ChildProcess;
  let redisUrl: string;

  beforeAll(async () => {
    const port = await getAvailablePort();
    redis = spawn("redis-server", [
      "--save",
      "",
      "--appendonly",
      "no",
      "--port",
      String(port),
    ]);
    await waitForRedis(redis);
    redisUrl = `redis://127.0.0.1:${port}`;
  });

  afterAll(() => redis?.kill("SIGTERM"));

  defineQueueAdapterContract(
    "contract",
    /** @returns A BullMQ adapter connected to the test Redis process. */
    () => createBullMqQueueAdapter({ redisUrl }),
  );
});

/**
 * Reserves and releases one local TCP port for the Redis fixture.
 *
 * @returns An available local TCP port.
 * @rejects When the server cannot listen or close.
 */
async function getAvailablePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No test port available.");
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

/**
 * Waits until the Redis test process reports readiness.
 *
 * @param redis - Redis child process to observe.
 * @returns When Redis is ready.
 * @rejects When Redis fails to start.
 */
async function waitForRedis(redis: ChildProcess) {
  await new Promise<void>((resolve, reject) => {
    redis.once("error", reject);
    redis.stdout?.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("Ready to accept connections")) resolve();
    });
    redis.once("exit", (code) =>
      reject(new Error(`Redis exited with code ${code}.`)),
    );
  });
}
