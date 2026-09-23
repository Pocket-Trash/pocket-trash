/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogFilterCopy } from "./catalog-filter-bar";
import { CatalogFilterBar } from "./catalog-filter-bar";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/components/ui/combobox", () => ({
  CatalogCombobox: () => null,
  CatalogMultiCombobox: () => null,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => children,
  DropdownMenuCheckboxItem: () => null,
  DropdownMenuContent: () => null,
  DropdownMenuTrigger: () => null,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) => (
    <div data-open={String(open)} data-testid="mobile-filter-sheet">
      {children}
    </div>
  ),
  SheetContent: ({ children }: { children: React.ReactNode }) => children,
  SheetDescription: ({ children }: { children: React.ReactNode }) => children,
  SheetHeader: ({ children }: { children: React.ReactNode }) => children,
  SheetTitle: ({ children }: { children: React.ReactNode }) => children,
  SheetTrigger: () => null,
}));

vi.mock("@/components/ui/toggle-group", () => ({
  ToggleGroup: ({ children }: { children: React.ReactNode }) => children,
  ToggleGroupItem: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
  TooltipContent: ({ children }: { children: React.ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => children,
}));

const copy = {
  all: "All",
  any: "Any",
  apply: "Apply",
  clear: "Clear",
  close: "Close",
  colors: "Colour",
  description: "Filter the catalog",
  fadeName: (colors) => `${colors} fade`,
  filters: "Filters",
  finishes: "Finish",
  maker: "Maker",
  matchMode: "Match mode",
  materials: "Material",
  more: "More",
  moreFilters: "More filters",
  moreOptions: (label) => `More ${label}`,
  productType: "Product type",
  productTypeAll: "All product types",
  selectMaker: "Select a maker",
  selectProductType: "Select a product type",
} satisfies CatalogFilterCopy;

const facets = {
  colors: [],
  fades: [],
  finishes: [],
  makers: [],
  materials: [],
  productTypes: [],
};

const filters = {
  colorIds: [],
  fadeColorSets: [],
  finishIds: [],
  makerIds: [],
  materialIds: [],
  productType: null,
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
