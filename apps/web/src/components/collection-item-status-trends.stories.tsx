import type { CollectionItemStatusTrendItem } from "@package/services";
import type { CollectionItemStatusSearch } from "@package/services/catalog-terminology";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useReducer } from "react";
import { expect, fireEvent, fn, within } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { CollectionItemStatusTrends } from "./collection-item-status-trends";

/** Owner-authorized current and departed status fixtures. */
const items: CollectionItemStatusTrendItem[] = [
  {
    collectionItemId: 1,
    collectionId: 2,
    current: true,
    name: "Titanium spinner",
    ownerUserId: 3,
    productId: 4,
    statuses: ["grail", "favorite"],
  },
  {
    collectionItemId: 5,
    collectionId: 2,
    current: false,
    name: "Sold slider",
    ownerUserId: 3,
    productId: 6,
    statuses: ["sold"],
  },
  {
    collectionItemId: 7,
    collectionId: 2,
    current: true,
    name: "Unstatused pen",
    ownerUserId: 3,
    productId: 8,
    statuses: ["unstatused"],
  },
];

/** Status chart, equivalent table, and inline drilldown configurations. */
const meta = {
  title: "Components/Collection Item Status Trends",
  component: CollectionItemStatusTrends,
  beforeEach: mockStoryAuth,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  args: { items, onSelect: fn() },
} satisfies Meta<typeof CollectionItemStatusTrends>;
export default meta;
/** Status Trends story contract. */
type Story = StoryObj<typeof meta>;

/**
 * Keeps chart/table selection in controlled URL-shaped state.
 * @returns Interactive status explorer.
 */
function Controlled() {
  const [selected, select] = useReducer(
    (
      _previous: CollectionItemStatusSearch | undefined,
      next: CollectionItemStatusSearch | undefined,
    ) => next,
    undefined,
  );
  return (
    <CollectionItemStatusTrends
      items={items}
      onSelect={select}
      selected={selected}
    />
  );
}

/** Chart and table select the same inline results and destinations. */
export const Interactions: Story = {
  /**
   * Renders controlled status URL state.
   * @returns Interactive status explorer.
   */
  render: () => <Controlled />,
  /**
   * Selects through the table and pie, then clears the URL-shaped selection.
   * @param context - Real browser interactions and rendered chart.
   * @rejects When selection or destination assertions fail.
   */
  play: async (context) => {
    const table = within(
      context.canvas.getByRole("table", {
        name: "Collection item status assignments and counts",
      }),
    );
    await context.userEvent.click(
      table.getByRole("button", { name: "Show Favorite collection items" }),
    );
    await context.userEvent.keyboard("{Enter}");
    await expect(
      table.getByRole("button", { name: "Show Favorite collection items" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      context.canvas.getByRole("link", { name: "Titanium spinner" }),
    ).toHaveAttribute("href", "/collections/3/2/1");
    await context.userEvent.click(
      table.getByRole("button", { name: "Show Sold collection items" }),
    );
    await expect(
      context.canvas.getByRole("link", { name: "Sold slider" }),
    ).toHaveAttribute("href", "/collections/edit/5");
    const slice = context.canvas.getByRole("img", {
      name: /^Favorite, 1 Status assignments/,
    });
    const bounds = slice.getBoundingClientRect();
    const pointer = {
      clientX: bounds.x + bounds.width / 2,
      clientY: bounds.y + bounds.height / 2,
    };
    // Highcharts hit-testing requires plot coordinates; synthetic events default to (0, 0).
    fireEvent.mouseOver(slice, pointer);
    fireEvent.mouseMove(slice, pointer);
    fireEvent.click(slice, pointer);
    await expect(
      context.canvas.getByRole("link", { name: "Titanium spinner" }),
    ).toBeVisible();
    await context.userEvent.click(
      context.canvas.getByRole("button", { name: "Clear status selection" }),
    );
    await expect(
      context.canvas.queryByRole("link", { name: "Titanium spinner" }),
    ).not.toBeInTheDocument();
  },
};
/** Direct selection with no matching items. */
export const EmptySelection: Story = { args: { selected: "want-to-sell" } };
/** Empty owner collection. */
export const Empty: Story = { args: { items: [] } };
/** Narrow layout retains chart, table, and inline results. */
export const Mobile: Story = {
  args: { selected: "favorite" },
  globals: { viewport: { value: "mobile1", isRotated: false } },
};

/** Published-profile Sold entries remain text because departed items have no public route. */
export const PublicSold: Story = {
  args: { publicView: true, selected: "sold" },
  /**
   * Verifies the public departure label and absence of a detail or edit destination.
   * @param context - Public status results.
   * @rejects When a departed public item exposes a link.
   */
  play: async (context) => {
    await expect(context.canvas.getByText("Sold slider")).toBeVisible();
    await expect(
      context.canvas.getByText("Sold item; no public item page is available."),
    ).toBeVisible();
    await expect(
      context.canvas.queryByRole("link", { name: "Sold slider" }),
    ).not.toBeInTheDocument();
  },
};

/** Current items retain their public detail destinations. */
export const PublicCurrent: Story = {
  args: { publicView: true, selected: "favorite" },
};

/** Exact current public items can grow beyond an older anonymous generation. */
const liveFavorites: CollectionItemStatusTrendItem[] = Array.from(
  { length: 7 },
  (_, index) => ({
    collectionItemId: 100 + index,
    collectionId: 2,
    current: true,
    name: `Public favorite ${index + 1}`,
    ownerUserId: 3,
    productId: 4,
    statuses: ["favorite"],
  }),
);

/** An older rounded total must never be lower than its live public context. */
export const LiveLowerBound: Story = {
  args: {
    publicView: true,
    items: liveFavorites,
    selected: "favorite",
    totals: [
      { status: "favorite", approximateItemCount: 5, contributorCountBand: 5 },
    ],
  },
  /**
   * Checks the safe lower bound and exact public drilldown size.
   * @param context - App-wide status explorer.
   * @rejects When a stale approximate value is below the exact public count.
   */
  play: async (context) => {
    const table = within(
      context.canvas.getByRole("table", {
        name: "Collection item status assignments and counts",
      }),
    );
    await expect(
      table.getByRole("cell", { name: "Approximately 7 collection items" }),
    ).toBeVisible();
    await expect(
      context.canvas.getByText("7 currently public collection items"),
    ).toBeVisible();
    await expect(
      context.canvas.getByRole("link", { name: "Public favorite 7" }),
    ).toBeVisible();
  },
};

/** Missing or suppressed aggregate groups fall back to the live public count. */
export const SuppressedTotals: Story = {
  args: {
    publicView: true,
    items: liveFavorites,
    selected: "favorite",
    totals: [],
  },
  /**
   * Verifies suppression does not leave a gap or imply a private count.
   * @param context - Exact fallback presentation.
   * @rejects When a suppressed group exposes an approximate value.
   */
  play: async (context) => {
    const table = within(
      context.canvas.getByRole("table", {
        name: "Collection item status assignments and counts",
      }),
    );
    await expect(
      table.queryByRole("cell", { name: /^Approximately/ }),
    ).not.toBeInTheDocument();
    await expect(
      context.canvas.getByText("7 currently public collection items"),
    ).toBeVisible();
  },
};

/** An anonymous group can exist with no public source items to reveal. */
export const AnonymousOnly: Story = {
  args: {
    publicView: true,
    items: [],
    selected: "grail",
    totals: [
      { status: "grail", approximateItemCount: 20, contributorCountBand: 5 },
    ],
  },
};

/** Anonymous totals and empty live results remain readable in the dark theme. */
export const Dark: Story = { ...AnonymousOnly, globals: { theme: "dark" } };
