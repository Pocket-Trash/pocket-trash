import type { SearchResponse } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, mocked, waitFor } from "storybook/test";
import { searchPublic } from "@/lib/search";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { SearchPage } from "./search-page";

/** Search result fixture for page stories. */
const response: SearchResponse = {
  counts: {
    all: 2,
    collections: 0,
    makers: 1,
    materials: 0,
    people: 0,
    products: 1,
    resources: 0,
  },
  items: [
    {
      context: "Machined pens",
      highlights: [
        { matched: true, text: "Bolt" },
        { matched: false, text: " action pen" },
      ],
      href: "/products/pens/bolt",
      id: 1,
      kind: "product",
      title: "Bolt Action Pen",
    },
    {
      highlights: [{ matched: true, text: "Bolt Works" }],
      href: "/makers/bolt-works",
      id: 2,
      kind: "maker",
      title: "Bolt Works",
    },
  ],
  page: 1,
  pageSize: 10,
  total: 2,
};

/** Configures public search page stories. */
const meta = {
  args: {
    onNavigate: fn(),
    search: { q: "bolt" },
  },
  /** Configures the public search response. */
  beforeEach: () => {
    mockStoryAuth();
    mocked(searchPublic).mockResolvedValue(response);
  },
  component: SearchPage,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Pages/Search",
} satisfies Meta<typeof SearchPage>;

export default meta;
/** Search page story contract. */
type Story = StoryObj<typeof meta>;

/** Search results in the default light theme. */
export const Default: Story = {
  /**
   * Verifies the loaded result presentation.
   *
   * @param context - Storybook play context.
   * @param context.canvas - Queries scoped to the rendered story.
   * @returns A promise that resolves after results load.
   */
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(
        canvas.getByRole("heading", { name: "Bolt Action Pen" }),
      ).toBeVisible(),
    );
    await expect(
      canvas.getByRole("tab", { name: /Products 1/u }),
    ).toBeVisible();
  },
};

/** Search results in the dark theme. */
export const Dark: Story = {
  ...Default,
  globals: { theme: "dark" },
};

/** Search results at a compact mobile viewport. */
export const Mobile: Story = {
  ...Default,
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
