import { describe, expect, it } from "vitest";
import { payloadSchemaVersion } from "./types.js";
import {
  assertAllowedFileKey,
  parseAllowedFileKeys,
  validatePayload,
} from "./validation.js";

/** Valid sticky-note payload used as the baseline for validation tests. */
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
    task: "Update design board",
  },
};

describe("parseAllowedFileKeys", () => {
  it("trims comma-separated file keys", () => {
    expect(parseAllowedFileKeys(" board123,design456 ,, ")).toEqual([
      "board123",
      "design456",
    ]);
  });
});

describe("assertAllowedFileKey", () => {
  it("allows configured file keys", () => {
    expect(() =>
      assertAllowedFileKey("design456", ["board123", "design456"]),
    ).not.toThrow();
  });

  it("rejects unconfigured file keys", () => {
    expect(() =>
      assertAllowedFileKey("other", ["board123", "design456"]),
    ).toThrow("not in FIGMA_FIGJAM_ALLOWED_FILE_KEYS");
  });
});

describe("validatePayload", () => {
  it("validates a supported payload", () => {
    expect(
      validatePayload(payload, { allowedFileKeys: ["board123"] }),
    ).toMatchObject({
      fileKey: "board123",
      operations: [{ id: "sticky-1", type: "sticky" }],
      source: { agent: "codex" },
    });
  });

  it("rejects duplicate operation ids", () => {
    expect(() =>
      validatePayload({
        ...payload,
        operations: [payload.operations[0], payload.operations[0]],
      }),
    ).toThrow("duplicates");
  });

  it("rejects payloads for files outside the allowlist", () => {
    expect(() =>
      validatePayload(
        {
          ...payload,
          fileKey: "other",
        },
        { allowedFileKeys: ["board123"] },
      ),
    ).toThrow("not in FIGMA_FIGJAM_ALLOWED_FILE_KEYS");
  });

  it("preserves styled shape fields", () => {
    expect(
      validatePayload({
        ...payload,
        operations: [
          {
            fill: "#f8fafc",
            fontSize: 14,
            height: 120,
            id: "screen-frame",
            radius: 12,
            stroke: "#cbd5e1",
            text: "Archive shell",
            textAlign: "left",
            textColor: "#0f172a",
            textPadding: 16,
            textPosition: "top-left",
            type: "shape",
            width: 320,
            x: 100,
            y: 200,
          },
        ],
      }).operations[0],
    ).toMatchObject({
      fill: "#f8fafc",
      radius: 12,
      stroke: "#cbd5e1",
      textAlign: "left",
      textPosition: "top-left",
      type: "shape",
    });
  });

  it("rejects invalid shape colors", () => {
    expect(() =>
      validatePayload({
        ...payload,
        operations: [
          {
            fill: "gray",
            height: 120,
            id: "screen-frame",
            type: "shape",
            width: 320,
            x: 100,
            y: 200,
          },
        ],
      }),
    ).toThrow("six-digit hex color");
  });
});
