import { describe, expect, it } from "vitest";
import {
  branchResourcePrefix,
  buildMoves,
  destinationPath,
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
});
