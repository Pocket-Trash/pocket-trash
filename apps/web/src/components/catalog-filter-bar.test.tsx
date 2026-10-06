/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogFilterCopy } from "./catalog-filter-bar";
import { CatalogFilterBar } from "./catalog-filter-bar";

(
  globalThis as {
    /**
     * Signals that the test environment supports React `act`.
     */
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/components/ui/combobox", () => ({
  /**
   * Removes the single-select combobox from focused filter-bar tests.
   *
   * @returns No rendered output.
   */
  CatalogCombobox: () => null,
  /**
   * Removes the multi-select combobox from focused filter-bar tests.
   *
   * @returns No rendered output.
   */
  CatalogMultiCombobox: () => null,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  /**
   * Passes dropdown-menu children through without wrapper markup.
   *
   * @param input - Test-double properties.
   * @param input.children - Nested content.
   * @returns The nested test content.
   */
  DropdownMenu: ({
    children,
  }: {
    /**
     * Nested content.
     */
    children: React.ReactNode;
  }) => children,
  /**
   * Removes dropdown checkbox items from focused filter-bar tests.
   *
   * @returns No rendered output.
   */
  DropdownMenuCheckboxItem: () => null,
  /**
   * Removes dropdown content from focused filter-bar tests.
   *
   * @returns No rendered output.
   */
  DropdownMenuContent: () => null,
  /**
   * Removes dropdown triggers from focused filter-bar tests.
   *
   * @returns No rendered output.
   */
  DropdownMenuTrigger: () => null,
}));

vi.mock("@/components/ui/sheet", () => ({
  /**
   * Exposes sheet open state while rendering its children inline.
   *
   * @param input - Test-double properties.
   * @param input.children - Nested content.
   * @param input.open - Controlled sheet open state.
   * @returns The state-marked sheet test wrapper.
   */
  Sheet: ({
    children,
    open,
  }: {
    /**
     * Nested sheet content.
     */
    children: React.ReactNode;
    /** Controlled sheet open state. */
    open: boolean;
  }) => (
    <div data-open={String(open)} data-testid="mobile-filter-sheet">
      {children}
    </div>
  ),
  /**
   * Provides the sheet content test double.
   *
   * @param input - Test-double properties.
   * @param input.children - Nested content.
   * @returns The nested sheet content.
   */
  SheetContent: ({
    children,
  }: {
    /**
     * Nested content.
     */
    children: React.ReactNode;
  }) => children,
  /**
   * Provides the sheet description test double.
   *
   * @param input - Test-double properties.
   * @param input.children - Nested content.
   * @returns The nested sheet description.
   */
  SheetDescription: ({
    children,
  }: {
    /**
     * Nested content.
     */
    children: React.ReactNode;
  }) => children,
  /**
   * Provides the sheet header test double.
   *
   * @param input - Test-double properties.
   * @param input.children - Nested content.
   * @returns The nested sheet header.
   */
  SheetHeader: ({
    children,
  }: {
    /**
     * Nested content.
     */
    children: React.ReactNode;
  }) => children,
  /**
   * Provides the sheet title test double.
   *
   * @param input - Test-double properties.
   * @param input.children - Nested content.
   * @returns The nested sheet title.
   */
  SheetTitle: ({
    children,
  }: {
    /**
     * Nested content.
     */
    children: React.ReactNode;
  }) => children,
  /**
   * Removes the sheet trigger from focused filter-bar tests.
   *
   * @returns No rendered output.
   */
  SheetTrigger: () => null,
}));

vi.mock("@/components/ui/toggle-group", () => ({
  /**
   * Provides the toggle group test double.
   *
   * @param input - Test-double properties.
   * @param input.children - Nested content.
   * @returns The nested toggle-group content.
   */
  ToggleGroup: ({
    children,
  }: {
    /**
     * Nested content.
     */
    children: React.ReactNode;
  }) => children,
  /**
   * Provides the toggle group item test double.
   *
   * @param input - Test-double properties.
   * @param input.children - Nested content.
   * @returns The nested toggle item content.
   */
  ToggleGroupItem: ({
    children,
  }: {
    /**
     * Nested content.
     */
    children: React.ReactNode;
  }) => children,
}));

vi.mock("@/components/ui/tooltip", () => ({
  /**
   * Provides the tooltip test double.
   *
   * @param input - Test-double properties.
   * @param input.children - Nested content.
   * @returns The nested tooltip content.
   */
  Tooltip: ({
    children,
  }: {
    /**
     * Nested content.
     */
    children: React.ReactNode;
  }) => children,
  /**
   * Provides the tooltip content test double.
   *
   * @param input - Test-double properties.
   * @param input.children - Nested content.
   * @returns The nested tooltip panel content.
   */
  TooltipContent: ({
    children,
  }: {
    /**
     * Nested content.
     */
    children: React.ReactNode;
  }) => children,
  /**
   * Provides the tooltip trigger test double.
   *
   * @param input - Test-double properties.
   * @param input.children - Nested content.
   * @returns The nested tooltip trigger content.
   */
  TooltipTrigger: ({
    children,
  }: {
    /**
     * Nested content.
     */
    children: React.ReactNode;
  }) => children,
}));

/**
 * English labels used by filter-bar unit tests.
 */
const copy = {
  all: "All",
  any: "Any",
  apply: "Apply",
  clear: "Clear",
  close: "Close",
  colors: "Colour",
  description: "Filter the catalog",
  /**
   * Provides the fade name test double.
   *
   * @param colors - Arrow-separated color names.
   * @returns The test fade label.
   */
  fadeName: (colors) => `${colors} fade`,
  filters: "Filters",
  finishes: "Finish",
  maker: "Maker",
  matchMode: "Match mode",
  materials: "Material",
  more: "More",
  moreFilters: "More filters",
  /**
   * Provides the more options test double.
   *
   * @param label - Facet label.
   * @returns The test overflow-options label.
   */
  moreOptions: (label) => `More ${label}`,
  productType: "Product type",
  productTypeAll: "All product types",
  selectMaker: "Select a maker",
  selectProductType: "Select a product type",
  searchLabel: "Search catalog and collections",
  searchPlaceholder: "Search products, makers, types, aliases, or owners",
} satisfies CatalogFilterCopy;

/**
 * Empty facet set used to isolate panel behavior.
 */
const facets = {
  colors: [],
  fades: [],
  finishes: [],
  makers: [],
  materials: [],
  productTypes: [],
};

/**
 * Empty controlled filter state used by panel tests.
 */
const filters = {
  colorIds: [],
  fadeColorSets: [],
  finishIds: [],
  makerIds: [],
  materialIds: [],
  productType: null,
  query: "",
  strict: false,
};

describe("CatalogFilterBar", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
  });

  it("exposes a controlled accessible search field", () => {
    const onChange = vi.fn();
    act(() =>
      root.render(
        <CatalogFilterBar
          copy={copy}
          facets={facets}
          filters={filters}
          onChange={onChange}
        />,
      ),
    );

    const input = container.querySelector<HTMLInputElement>(
      'input[type="search"]',
    );
    expect(input?.getAttribute("placeholder")).toBe(copy.searchPlaceholder);
    act(() => {
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, "cassette");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith({ ...filters, query: "cassette" });
  });

  it("opens the anchored panel without opening the mobile sheet", () => {
    act(() =>
      root.render(
        <CatalogFilterBar
          copy={copy}
          facets={facets}
          filters={filters}
          onChange={vi.fn()}
        />,
      ),
    );

    const button = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent?.trim() === "More filters",
    );
    expect(button).toBeDefined();
    act(() => button?.click());

    expect(
      container
        .querySelector('[data-testid="mobile-filter-sheet"]')
        ?.getAttribute("data-open"),
    ).toBe("false");
    expect(container.querySelector("section")).not.toBeNull();
  });

  it("renders a route action after More filters", () => {
    act(() =>
      root.render(
        <CatalogFilterBar
          action={<a href="/products/add">Add product</a>}
          copy={copy}
          facets={facets}
          filters={filters}
          onChange={vi.fn()}
        />,
      ),
    );

    const labels = [...container.querySelectorAll("button, a")].map(
      (candidate) => candidate.textContent?.trim(),
    );
    expect(labels.indexOf("Add product")).toBeGreaterThan(
      labels.indexOf("More filters"),
    );
  });

  it("closes the anchored panel from Apply or an outside click", () => {
    act(() =>
      root.render(
        <CatalogFilterBar
          copy={copy}
          facets={facets}
          filters={filters}
          onChange={vi.fn()}
        />,
      ),
    );

    const more = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent?.trim() === "More filters",
    );
    act(() => more?.click());
    const apply = [
      ...container.querySelectorAll<HTMLButtonElement>("section button"),
    ].find((candidate) => candidate.textContent?.trim() === "Apply");
    act(() => apply?.click());
    expect(container.querySelector("section")).toBeNull();

    act(() => more?.click());
    act(() =>
      document.body.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true }),
      ),
    );
    expect(container.querySelector("section")).toBeNull();
  });
});
