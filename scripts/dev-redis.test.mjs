import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

/**
 * Executes the development launcher without letting an invalid URL reach a child.
 * @param redisUrl - Explicit Redis override, or undefined for the local default.
 * @param extra - Additional subprocess environment overrides.
 * @returns Captured launcher result.
 */
function launch(redisUrl, extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.REDIS_URL;
  if (redisUrl !== undefined) env.REDIS_URL = redisUrl;
  return spawnSync(
    process.execPath,
    [
      "scripts/dev-redis.mjs",
      process.execPath,
      "-e",
      "process.stdout.write('CHILD_STARTED')",
    ],
    { env, encoding: "utf8" },
  );
}

test("development startup rejects malformed Redis overrides without leaking credentials", () => {
  const result = launch("https://user:synthetic-secret@example.com");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /REDIS_URL/);
  assert.doesNotMatch(
    result.stdout + result.stderr,
    /synthetic-secret|CHILD_STARTED/,
  );
});

test("development startup rejects unresolved Railway references", () => {
  const result = launch("$" + "{{pocket-trash-queue.REDIS_URL}}");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /REDIS_URL/);
  assert.doesNotMatch(result.stdout, /CHILD_STARTED/);
});

test("development startup refuses private Railway and production contexts", () => {
  for (const [url, env] of [
    ["redis://queue.railway.internal:6379", {}],
    ["redis://localhost:4008", { APP_ENV: "production" }],
  ]) {
    const result = launch(url, env);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /production|REDIS_URL/);
    assert.doesNotMatch(result.stdout, /CHILD_STARTED/);
  }
});

test("an explicit reachable URL wins over the injected URL and never needs Docker", async () => {
  const server = createServer((socket) => {
    socket.on("data", (chunk) => {
      const commands = chunk.toString().match(/\*\d+\r\n/g) ?? [];
      socket.write("+PONG\r\n".repeat(commands.length));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `redis://127.0.0.1:${server.address().port}`;
  try {
    const child = spawn(
      process.execPath,
      [
        "scripts/dev-redis.mjs",
        process.execPath,
        "-e",
        "process.stdout.write(process.env.REDIS_URL === process.env.EXPECTED ? 'OVERRIDE_OK' : 'WRONG')",
      ],
      {
        env: {
          ...process.env,
          REDIS_URL: "invalid-injected",
          POCKET_TRASH_DEV_REDIS_URL: url,
          EXPECTED: url,
          PATH: "/no-docker",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stdout.on("data", (data) => {
      output += data;
    });
    const code = await new Promise((resolve) => child.on("close", resolve));
    assert.equal(code, 0);
    assert.equal(output, "OVERRIDE_OK");
  } finally {
    server.close();
  }
});

test("an unreachable explicit URL fails readiness without starting the child or leaking a password", () => {
  const result = launch("redis://user:synthetic-secret@127.0.0.1:1");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not ready/);
  assert.doesNotMatch(
    result.stdout + result.stderr,
    /synthetic-secret|CHILD_STARTED/,
  );
});

for (const coldStart of [false, true]) {
  test(`missing URL ${coldStart ? "waits for a cold image download" : "reuses local Redis"} and passes its port to the child`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "eng540-docker-"));
    const server = createServer((socket) =>
      socket.on("data", (chunk) => {
        socket.write(
          "+PONG\r\n".repeat(
            (chunk.toString().match(/\*\d+\r\n/g) ?? []).length,
          ),
        );
      }),
    );
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = String(server.address().port);
    writeFileSync(
      join(directory, "docker"),
      `#!/bin/sh\ncase "$1" in\nps) ${coldStart ? `[ -f '${directory}/created' ] && ` : ""}echo 'pocket-trash-scraper-redis Up 1 minute'; exit 0;;\nrun) /bin/sleep 11; /usr/bin/touch '${directory}/created';;\nport) echo '127.0.0.1:${port}';;\n*) exit 99;;\nesac\n`,
      { mode: 0o700 },
    );
    try {
      const env = { ...process.env, SCRAPER_REDIS_PORT: port, PATH: directory };
      delete env.REDIS_URL;
      delete env.POCKET_TRASH_DEV_REDIS_URL;
      const child = spawn(
        process.execPath,
        [
          "scripts/dev-redis.mjs",
          process.execPath,
          "-e",
          `process.stdout.write(process.env.REDIS_URL === 'redis://localhost:${port}' ? 'LOCAL_OK' : 'WRONG')`,
        ],
        { env },
      );
      let output = "";
      child.stdout.on("data", (data) => {
        output += data;
      });
      const code = await new Promise((resolve) => child.on("close", resolve));
      assert.equal(code, 0);
      assert.equal(output, "LOCAL_OK");
    } finally {
      server.close();
      rmSync(directory, { recursive: true });
    }
  });
}

test("missing Docker fails before starting the child", () => {
  const result = launch(undefined, { PATH: "/no-docker" });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /CHILD_STARTED/);
});
