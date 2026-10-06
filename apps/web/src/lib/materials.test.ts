import type { PublicMaterialSummary } from "@package/services";
import { describe, expect, it } from "vitest";
import {
  clampMaterialPage,
  getMaterialInitial,
  getMaterialPageSize,
  groupMaterials,
  sortPopularMaterials,
} from "./materials";

/**
 * Creates a material summary for directory helper tests.
 *
 * @param name - Material name.
 * @param productCount - Public product count.
 * @param collectionItemCount - Public collection-item count.
 * @returns A material summary fixture.
 */
function material(
  name: string,
  productCount = 0,
  collectionItemCount = 0,
): PublicMaterialSummary {
  return {
    collectionItemCount,
    id: name.length,
    leadImage: null,
    name,
    productCount,
    slug: name.toLowerCase().replaceAll(" ", "-"),
  };
}

describe("material directory helpers", () => {
  it("groups A-Z names and sends non-letter initials to Other", () => {
    expect(getMaterialInitial("  aluminum")).toBe("A");
    expect(getMaterialInitial("Ébonite")).toBe("E");
    expect(getMaterialInitial("# Resin")).toBe("Other");
    expect(
      groupMaterials([
        material("Steel"),
        material("# Resin"),
        material("Aluminum"),
      ]),
    ).toEqual([
      ["A", [expect.objectContaining({ name: "Aluminum" })]],
      ["S", [expect.objectContaining({ name: "Steel" })]],
      ["Other", [expect.objectContaining({ name: "# Resin" })]],
    ]);
  });

  it("ranks popularity by direct collection-item count, then name", () => {
    expect(
      sortPopularMaterials([
        material("Steel", 99, 1),
        material("Aluminum", 0, 3),
        material("Titanium", 0, 3),
      ]).map(({ name }) => name),
    ).toEqual(["Aluminum", "Titanium", "Steel"]);
  });

  it("uses responsive page sizes and clamps stale one-based pages", () => {
    expect(getMaterialPageSize(480)).toBe(8);
    expect(getMaterialPageSize(481)).toBe(12);
    expect(getMaterialPageSize(1280)).toBe(12);
    expect(getMaterialPageSize(1281)).toBe(20);
    expect(clampMaterialPage(9, 13, 12)).toBe(2);
    expect(clampMaterialPage(-1, 0, 12)).toBe(1);
  });
});
