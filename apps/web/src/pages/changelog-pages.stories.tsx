import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";
import { getChangelogEntries } from "@/lib/changelog-content";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { ChangelogEntryPage, ChangelogListPage } from "./changelog-pages";

/** Published English entry used by the changelog stories. */
const entry = getChangelogEntries("en-US")[0];
if (!entry) throw new Error("The changelog story fixture is missing.");

/** Ten-entry fixture that exercises a full paginated page. */
const entries = Array.from({ length: 10 }, (_, index) => ({
  ...entry,
  slug: index === 0 ? entry.slug : `${entry.slug}-${index + 1}`,
  title: index === 0 ? entry.title : `${entry.title} ${index + 1}`,
}));

/** Storybook configuration shared by the changelog page stories. */
const meta = {
  args: {
    changelogPage: { entries, page: 1, pageCount: 2 },
  },
  beforeEach: mockStoryAuth,
  component: ChangelogListPage,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Components/ChangelogPages",
} satisfies Meta<typeof ChangelogListPage>;

export default meta;
/** Changelog story shape derived from the shared metadata. */
type Story = StoryObj<typeof meta>;

/** Full first page with working pagination controls. */
export const PaginatedList: Story = {
  /**
   * Verifies entry count, status, and next-page destination.
   *
   * @param root0 - Storybook play context.
   */
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("heading", { level: 2 })).toHaveLength(10);
    await expect(canvas.getByText("Page 1 of 2")).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Next page" }),
    ).toHaveAttribute("href", "/changelog?page=2");
  },
};

/** Permanent entry page with copy and category actions. */
export const IndividualEntry: Story = {
  /**
   * Verifies the entry's primary interactive affordances.
   *
   * @param root0 - Storybook play context.
   */
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", {
        level: 2,
        name: "Introducing the Pocket Trash changelog",
      }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Copy link" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "New Feature" }),
    ).toHaveAttribute("href", "/changelog/feature");
  },
  /**
   * Renders the selected fixture as a permanent entry page.
   *
   * @returns The permanent entry story UI.
   */
  render: () => <ChangelogEntryPage entry={entry} />,
};
