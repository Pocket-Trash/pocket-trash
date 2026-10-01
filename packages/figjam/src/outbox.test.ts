import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listPayloads } from "./outbox.js";
import { payloadSchemaVersion } from "./types.js";

/** Temporary outbox directories removed after each test. */
const temporaryDirectories: string[] = [];

/** Valid sticky-note payload used by outbox file tests. */
const payload = {
  fileKey: "board123",
  operations: [
    {
      color: "yellow",
      id: "sticky-1",
      text: "Implement filter drawer changes",
      type: "sticky",
      x: 100,
      y: 200,
    },
  ],
  payloadId: "payload-1",
  schemaVersion: payloadSchemaVersion,
  source: {
    agent: "codex",
    createdAt: "2026-07-06T20:00:00.000Z",
  },
};

describe("listPayloads", () => {
  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.map((directory) =>
        rm(directory, { force: true, recursive: true }),
      ),
    );
    temporaryDirectories.length = 0;
  });

  it("skips malformed payload files without failing the listing", async () => {
    const outboxDir = await mkdtemp(join(tmpdir(), "figjam-outbox-"));
    temporaryDirectories.push(outboxDir);

    await writeFile(
      join(outboxDir, "valid.json"),
      `${JSON.stringify(payload)}\n`,
    );
    await writeFile(join(outboxDir, "invalid.json"), "{not-json");

    await expect(listPayloads(outboxDir)).resolves.toMatchObject([
      {
        fileName: "valid.json",
        payload: { payloadId: "payload-1" },
      },
    ]);
  });
});
