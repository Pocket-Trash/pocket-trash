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
  parseCatalogProductsSearch,
  pruneCatalogFilters,
} from "./catalog-filters";

/**
 * Builds a color lookup test fixture.
 *
 * @param id - Positive numeric entity identifier.
 * @param name - Human-readable name.
 * @returns A color lookup fixture.
 */
const color = (id: number, name: string): CatalogColor => ({
  hex: "#808080",
  id,
  name,
  slug: name.toLowerCase(),
});
/**
 * Builds a catalog lookup test fixture.
 *
 * @param id - Positive numeric entity identifier.
 * @param name - Human-readable name.
 * @returns A catalog lookup fixture.
 */
const lookup = (id: number, name: string) => ({
  id,
  name,
  slug: name.toLowerCase(),
});
/**
 * Blue color lookup fixture.
 */
const blue = color(1, "Blue");
/**
 * Purple color lookup fixture.
 */
const purple = color(2, "Purple");
/**
 * Burple color lookup fixture.
 */
const burple = color(3, "Burple");
/**
 * Polished finish lookup fixture.
 */
const polished = lookup(11, "Polished");
/**
 * Blackened finish lookup fixture.
 */
const blackened = lookup(12, "Blackened");

/**
 * Builds a finish-option test fixture.
 *
 * @param colors - Colors assigned to the fixture finish option.
 * @param finishes - Finishes assigned to the fixture finish option.
 * @returns A finish-option fixture.
 */
function option(
  colors: CatalogColor[],
  finishes = [polished],
): CatalogFinishOption {
  return {
    colorEffect: lookup(20, "Fade"),
    colors,
    finishes,
    id: Math.random(),
    pattern: null,
  };
}

/**
 * Builds a filterable catalog-item test fixture.
 *
 * @param finishOptions - Finish options assigned to the fixture item.
 * @returns A filterable item fixture.
 */
function item(finishOptions: CatalogFinishOption[]): FilterableCatalogItem {
  return {
    finishOptions,
    makerId: 100,
    makerName: "Maker",
    materials: [lookup(10, "Titanium")],
    patterns: [],
    plateComponents: [],
    productTypeName: "Spinner",
    productTypeSlug: "spinner",
    spinnerButtonComponents: [],
  };
}

describe("catalog filters", () => {
  it("accepts only the explicit products list view", () => {
    expect(
      parseCatalogProductsSearch({ type: "spinner", view: "all" }),
    ).toEqual(expect.objectContaining({ type: "spinner", view: "all" }));
    expect(parseCatalogProductsSearch({ view: "grid" }).view).toBeUndefined();
  });

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
      q: "  CASSÉTTE  ",
      strict: "true",
      type: "spinner",
    });
    expect(search).toEqual({
      button: undefined,
      color: [2, 1],
      fade: ["1.2"],
      family: undefined,
      finish: undefined,
      maker: undefined,
      material: undefined,
      pattern: undefined,
      plate: undefined,
      q: "CASSÉTTE",
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

  it("matches pattern facets only from the displayed item", () => {
    const candidate = {
      ...item([option([blue])]),
      patterns: [lookup(201, "Ripple")],
    };

    expect(
      matchesCatalogFilters(candidate, {
        ...emptyCatalogFilters(),
        patternIds: [201],
      }),
    ).toBe(true);
  });

  it("matches exact components only on qualifying parent assemblies", () => {
    const slider = {
      ...item([]),
      plateComponents: [lookup(401, "V2 plate")],
      productTypeName: "Slider",
      productTypeSlug: "slider",
    };
    const standalonePlate = {
      ...item([]),
      productTypeName: "Slider plate",
      productTypeSlug: "slider-plate",
    };
    const spinner = {
      ...item([]),
      productTypeName: "Spinner",
      productTypeSlug: "spinner",
      spinnerButtonComponents: [lookup(501, "Soft click button")],
    };

    expect(
      matchesCatalogFilters(slider, {
        ...emptyCatalogFilters(),
        plateIds: [401],
      }),
    ).toBe(true);
    expect(
      matchesCatalogFilters(standalonePlate, {
        ...emptyCatalogFilters(),
        plateIds: [401],
      }),
    ).toBe(false);
    expect(
      matchesCatalogFilters(spinner, {
        ...emptyCatalogFilters(),
        spinnerButtonIds: [501],
      }),
    ).toBe(true);
  });

  it("counts and round-trips the dedicated discovery facets", () => {
    const candidate = {
      ...item([]),
      patterns: [lookup(201, "Ripple")],
      plateComponents: [lookup(401, "V2 plate")],
      spinnerButtonComponents: [lookup(501, "Soft click button")],
    };
    const facets = buildCatalogFacets([candidate], null);
    expect(facets.patterns).toMatchObject([{ id: 201, count: 1 }]);
    expect(facets.plates).toMatchObject([{ id: 401, count: 1 }]);
    expect(facets.spinnerButtons).toMatchObject([{ id: 501, count: 1 }]);

    const search = parseCatalogFilterSearch({
      button: "501",
      family: "301",
      pattern: "201",
      plate: "401",
    });
    expect(filtersToSearch(filtersFromSearch(search))).toMatchObject({
      button: [501],
      pattern: [201],
      plate: [401],
    });
    expect(search).not.toHaveProperty("family");
  });
});

it("keeps material facets general-only and counts repeated general assignments once", () => {
  const genericAndSpecific = {
    ...item([]),
    materials: [
      lookup(10, "Stainless Steel"),
      lookup(10, "Stainless Steel"),
      lookup(10, "Stainless Steel"),
    ],
  };
  expect(buildCatalogFacets([genericAndSpecific], null).materials).toEqual([
    { ...lookup(10, "Stainless Steel"), count: 1 },
  ]);
  expect(
    matchesCatalogFilters(genericAndSpecific, {
      ...emptyCatalogFilters(),
      materialIds: [10],
    }),
  ).toBe(true);
});
