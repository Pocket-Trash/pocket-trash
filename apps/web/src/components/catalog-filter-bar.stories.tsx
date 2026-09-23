import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { expect, within } from "storybook/test";
import {
  type CatalogFacets,
  type CatalogFilters,
  emptyCatalogFilters,
} from "@/lib/catalog-filters";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { CatalogFilterBar, type CatalogFilterCopy } from "./catalog-filter-bar";

const blue = { count: 8, hex: "#2563eb", id: 1, name: "Blue", slug: "blue" };
const purple = {
  count: 5,
  hex: "#9333ea",
  id: 2,
  name: "Purple",
  slug: "purple",
};
const colors = [
  blue,
  purple,
  { count: 4, hex: "#16a34a", id: 3, name: "Green", slug: "green" },
  { count: 3, hex: "#dc2626", id: 4, name: "Red", slug: "red" },
  { count: 2, hex: "#111827", id: 5, name: "Black", slug: "black" },
  { count: 1, hex: "#e5e7eb", id: 6, name: "Silver", slug: "silver" },
];
const facets = {
  colors,
  fades: [{ colors: [blue, purple], count: 6, key: "1.2" }],
  finishes: [
    { count: 12, id: 1, name: "Anodized", slug: "anodized" },
    { count: 8, id: 2, name: "Polished", slug: "polished" },
    { count: 5, id: 3, name: "Blackened", slug: "blackened" },
  ],
  makers: [
    { count: 12, id: 1, name: "KAP EDC" },
    { count: 5, id: 2, name: "Clean EDC" },
  ],
  materials: [
    { count: 15, id: 1, name: "Titanium", slug: "titanium" },
    { count: 10, id: 2, name: "Zirconium", slug: "zirconium" },
    { count: 8, id: 3, name: "Bronze", slug: "bronze" },
    { count: 6, id: 4, name: "Copper", slug: "copper" },
    { count: 4, id: 5, name: "Stainless steel", slug: "stainless-steel" },
    { count: 2, id: 6, name: "Aluminum", slug: "aluminum" },
  ],
  productTypes: [
    { count: 20, name: "Spinner", slug: "spinner" },
    { count: 8, name: "Spinner button", slug: "spinner-button" },
  ],
} satisfies CatalogFacets;
const copy = {
  all: "All",
  any: "Any",
  apply: "Apply",
  clear: "Clear",
  close: "Remove",
  colors: "Colour",
  description: "Filter the catalog",
  fadeName: (value) => `${value} fade`,
  filters: "Filters",
  finishes: "Finish",
  maker: "Maker",
  matchMode: "Match",
  materials: "Material",
  more: "More",
  moreFilters: "More filters",
  moreOptions: (label) => `More ${label}`,
  productType: "Product type",
  productTypeAll: "All product types",
  selectMaker: "Select makers",
  selectProductType: "Select product type",
} satisfies CatalogFilterCopy;

const meta = {
  args: {
    copy,
    facets,
    filters: emptyCatalogFilters(),
    onChange: () => undefined,
  },
  component: CatalogFilterBar,
  decorators: [
    (Story) => (
      <StoryProviders>
        <div className="relative min-h-72 w-[75rem] max-w-[calc(100vw-2rem)] p-4">
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Components/CatalogFilterBar",
} satisfies Meta<typeof CatalogFilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <FilterExample {...args} />,
};

export const ActiveFilters: Story = {
  render: (args) => (
    <FilterExample
      {...args}
      initialFilters={{
        ...emptyCatalogFilters(),
        colorIds: [1],
        materialIds: [1],
        productType: "spinner",
      }}
    />
  ),
};

export const FilterInteraction: Story = {
  render: (args) => <FilterExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByLabelText("Titanium"));
    await userEvent.click(canvas.getByRole("button", { name: "Blue" }));
    await expect(canvas.getByRole("button", { name: "Clear" })).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "More filters" }));
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole("combobox", { name: "Maker" }));
    await userEvent.click(await page.findByRole("option", { name: "KAP EDC" }));
    await expect(
      page.getByRole("button", { name: "Remove: KAP EDC" }),
    ).toBeVisible();
  },
};

function FilterExample({
  initialFilters,
  ...args
}: React.ComponentProps<typeof CatalogFilterBar> & {
  initialFilters?: CatalogFilters;
}) {
  const [filters, setFilters] = useState(
    initialFilters ?? emptyCatalogFilters(),
  );
  return <CatalogFilterBar {...args} filters={filters} onChange={setFilters} />;
}
