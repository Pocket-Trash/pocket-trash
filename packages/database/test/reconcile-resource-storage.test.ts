import type { NeonQueryFunction } from "@neondatabase/serverless";
import { describe, expect, it, vi } from "vitest";
import {
  branchResourcePrefix,
  buildMoves,
  destinationPath,
  getPendingUploadPaths,
  type StoredObject,
} from "../scripts/reconcile-resource-storage.js";

describe("resource storage reconciliation", () => {
  it("maps Neon branches to their Bunny folders", () => {
    expect(branchResourcePrefix("development")).toBe("resources/dev");
    expect(branchResourcePrefix("dev_branch_roy")).toBe("resources/dev");
    expect(branchResourcePrefix("preview")).toBe("resources/preview");
    expect(branchResourcePrefix("preview-pr-147")).toBe(
      "resources/preview/pr-147",
    );
    expect(branchResourcePrefix("production")).toBeUndefined();
  });

  it("moves a preview reference out of the production folder", () => {
    expect(
      destinationPath(
        "preview",
        1000,
        "resources/files/GUIDE TRIM TOOL_No-Text.stl",
      ),
    ).toBe("resources/preview/1000/GUIDE TRIM TOOL_No-Text.stl");
  });

  it("copies a shared legacy object into each branch namespace", () => {
    const shared = {
      database: undefined as never,
      id: 1000,
      objectPath: "resources/files/shared.stl",
      resourceId: 1000,
      table: "resource",
    } satisfies Omit<StoredObject, "branchName">;

    expect(
      buildMoves([
        { ...shared, branchName: "dev_branch_roy" },
        { ...shared, branchName: "preview" },
      ]).map(({ destination }) => destination),
    ).toEqual([
      "resources/dev/1000/shared.stl",
      "resources/preview/1000/shared.stl",
    ]);
  });
  it.each([
    [
      "preview",
      "resources/files/1000/v2/hash.pdf",
      "resources/preview/1000/v2/hash.pdf",
    ],
    [
      "dev_branch_roy",
      "resources/dev/1000/v1/hash.pdf",
      "resources/dev/1000/v1/hash.pdf",
    ],
    [
      "preview-pr-147",
      "images/resources/1000/hash.png",
      "images/preview/pr-147/resources/1000/hash.png",
    ],
    [
      "preview",
      "images/preview/pr-147/resources/1000/hash.png",
      "images/preview/resources/1000/hash.png",
    ],
  ])("preserves the storage layout for %s", (branch, path, expected) => {
    expect(destinationPath(branch, 1000, path)).toBe(expected);
  });
  it.each([
    "upload_file",
    "resource_upload_files",
    undefined,
  ])("protects pending paths from %s", async (table) => {
    const database = vi.fn(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = strings.join("?");
        if (query.includes("to_regclass"))
          return [{ exists: values[0] === `public.${table}` }];
        expect(query).toBe(`select object_path from ${table}`);
        return [{ object_path: "resources/dev/1000/v2/pending.pdf" }];
      },
    );
    expect(
      await getPendingUploadPaths(
        database as unknown as NeonQueryFunction<false, false>,
      ),
    ).toEqual(table ? ["resources/dev/1000/v2/pending.pdf"] : []);
  });
});
