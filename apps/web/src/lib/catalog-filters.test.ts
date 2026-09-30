import type { CatalogColor, CatalogFinishOption } from "@package/services";
import { describe, expect, it } from "vitest";
import {
  buildCatalogFacets,
  emptyCatalogFilters,
  type FilterableCatalogItem,
  fadeKey,
  filtersFromSearch,
  filtersToSearch,
  matchesCatalogFilters,
  parseCatalogFilterSearch,
  pruneCatalogFilters,
} from "./catalog-filters";

const color = (id: number, name: string): CatalogColor => ({
  hex: "#808080",
  id,
  name,
  slug: name.toLowerCase(),
});
const lookup = (id: number, name: string) => ({
  id,
  name,
  slug: name.toLowerCase(),
});
const blue = color(1, "Blue");
const purple = color(2, "Purple");
const burple = color(3, "Burple");
const polished = lookup(11, "Polished");
const blackened = lookup(12, "Blackened");

function option(
  colors: CatalogColor[],
  finishes = [polished],
): CatalogFinishOption {
  return {
    colorEffect: lookup(20, "Fade"),
    colors,
    finishes,
    id: Math.random(),
  };
}

function item(finishOptions: CatalogFinishOption[]): FilterableCatalogItem {
  return {
    finishOptions,
    makerId: 100,
    makerName: "Maker",
    materials: [lookup(10, "Titanium")],
    productTypeName: "Spinner",
    productTypeSlug: "spinner",
  };
}

describe("catalog filters", () => {
  it("does not create an empty fade search parameter", () => {
    expect(parseCatalogFilterSearch({}).fade).toBeUndefined();
  });

  it("uses OR within facets, AND across facets, and one finish option", () => {
    const filters = {
      ...emptyCatalogFilters(),
      colorIds: [blue.id],
      finishIds: [polished.id],
      materialIds: [10],
    };
    expect(matchesCatalogFilters(item([option([blue])]), filters)).toBe(true);
    expect(
      matchesCatalogFilters(
        item([option([purple], [polished]), option([blue], [blackened])]),
        filters,
      ),
    ).toBe(false);
  });

  it("matches close fade variations and strict combined finishes", () => {
    const filters = {
      ...emptyCatalogFilters(),
      fadeColorSets: [[blue.id, purple.id]],
      finishIds: [polished.id, blackened.id],
      strict: true,
    };
    expect(
      matchesCatalogFilters(
        item([option([purple, burple, blue], [blackened, polished])]),
        filters,
      ),
    ).toBe(true);
    expect(
      matchesCatalogFilters(
        item([
          option([purple, blue], [polished]),
          option([purple, blue], [blackened]),
        ]),
        filters,
      ),
    ).toBe(false);
  });

  it("deduplicates reverse fades and keeps the most common display order", () => {
    const facets = buildCatalogFacets(
      [
        item([option([blue, purple])]),
        item([option([purple, blue])]),
        item([option([purple, blue])]),
      ],
      null,
    );
    expect(facets.fades).toHaveLength(1);
    expect(facets.fades[0]?.key).toBe(fadeKey([blue.id, purple.id]));
    expect(facets.fades[0]?.colors.map(({ id }) => id)).toEqual([
      purple.id,
      blue.id,
    ]);
  });

  it("parses and serializes stable URL filter values", () => {
    const search = parseCatalogFilterSearch({
      color: ["2", "1", "bad"],
      fade: ["2.1", "1.2"],
      strict: "true",
      type: "spinner",
    });
    expect(search).toEqual({
      color: [2, 1],
      fade: ["1.2"],
      finish: undefined,
      maker: undefined,
      material: undefined,
      strict: true,
      type: "spinner",
    });
    expect(
      filtersFromSearch(filtersToSearch(filtersFromSearch(search))),
    ).toEqual(filtersFromSearch(search));
  });

  it("drops selections unavailable for the selected product type", () => {
    const filters = {
      ...emptyCatalogFilters(),
      colorIds: [blue.id, 999],
      fadeColorSets: [
        [blue.id, purple.id],
        [blue.id, 999],
      ],
      makerIds: [100, 999],
      materialIds: [10, 999],
    };
    const facets = buildCatalogFacets([item([option([blue, purple])])], null);
    expect(pruneCatalogFilters(filters, facets)).toMatchObject({
      colorIds: [blue.id],
      fadeColorSets: [[blue.id, purple.id]],
      makerIds: [100],
      materialIds: [10],
    });
  });

  it("keeps product types stable while scoping the other facets", () => {
    const spinner = item([option([blue])]);
    const button = {
      ...item([option([purple])]),
      materials: [lookup(20, "Zirconium")],
      productTypeName: "Spinner Button",
      productTypeSlug: "spinner-button",
    };
    const facets = buildCatalogFacets([spinner, button], "spinner");

    expect(facets.productTypes.map(({ slug }) => slug)).toEqual([
      "spinner",
      "spinner-button",
    ]);
    expect(facets.materials.map(({ name }) => name)).toEqual(["Titanium"]);
    expect(facets.colors.map(({ name }) => name)).toEqual(["Blue"]);
  });
});
