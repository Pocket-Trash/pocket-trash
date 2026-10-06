import { normalizeCatalogSearch as normalizePersistedCatalogSearch } from "@package/services/catalog-terminology";
import { describe, expect, it } from "vitest";
import {
  matchCatalogSearch,
  normalizeCatalogSearch,
  type SearchableCatalogAlias,
  type SearchableCatalogItem,
} from "./catalog-search";

/** Maker terminology used to verify global canonical-concept expansion. */
const aliases: SearchableCatalogAlias[] = [
  {
    canonicalKey: "slider-insert",
    canonicalNamespace: "product-type",
    isPreferred: true,
    label: "Cassette",
    makerId: 10,
    normalizedValue: "cassette",
  },
];

/**
 * Builds a minimal searchable catalog item for focused search assertions.
 *
 * @param productTypeSlug - Canonical product type assigned to the fixture.
 * @param overrides - Fields that specialize an individual assertion.
 * @returns Searchable catalog test fixture.
 */
function item(
  productTypeSlug: SearchableCatalogItem["productTypeSlug"],
  overrides: Partial<SearchableCatalogItem> = {},
): SearchableCatalogItem {
  return {
    activeTypeLabel: "Slider insert",
    englishTypeLabel: "Slider insert",
    makerId: 20,
    makerName: "Beta",
    name: "Rail insert",
    ownerDisplayName: null,
    productTypeSlug,
    ...overrides,
  };
}

describe("catalog search", () => {
  it("normalizes case, diacritics, and whitespace", () => {
    const input = "  CASSÉTTE\tInsert  ";
    expect(normalizeCatalogSearch(input)).toBe("cassette insert");
    expect(normalizeCatalogSearch(input)).toBe(
      normalizePersistedCatalogSearch(input),
    );
  });

  it("expands an exact recognized alias to every product of its canonical type", () => {
    expect(
      matchCatalogSearch(item("slider-insert"), "cassette", aliases),
    ).toEqual({
      matchedAlias: "Cassette",
      matchedOwner: null,
      matchedType: null,
    });
    expect(matchCatalogSearch(item("slider"), "cassette", aliases)).toBeNull();
  });

  it("uses normal fields and both localized type labels without descriptions", () => {
    expect(
      matchCatalogSearch(
        item("slider", { activeTypeLabel: "Deslizador", name: "Orbit" }),
        "deslizador",
        aliases,
      ),
    ).toEqual({
      matchedAlias: null,
      matchedOwner: null,
      matchedType: "Deslizador",
    });
    expect(
      matchCatalogSearch(
        item("slider", { activeTypeLabel: "Deslizador", name: "Orbit" }),
        "slider",
        aliases,
      ),
    ).toEqual({
      matchedAlias: null,
      matchedOwner: null,
      matchedType: "Slider insert",
    });
    expect(
      matchCatalogSearch(
        item("slider", { name: "Orbit", ownerDisplayName: "Roy Anger" }),
        "roy",
        aliases,
      ),
    ).toEqual({
      matchedAlias: null,
      matchedOwner: "Roy Anger",
      matchedType: null,
    });
    expect(
      matchCatalogSearch(item("slider"), "hidden description", aliases),
    ).toBeNull();
  });
});
