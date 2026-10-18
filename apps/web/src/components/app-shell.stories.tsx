import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, within } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { AppShell } from "./app-shell";
import { Button } from "./ui/button";

/**
 * Configures Storybook coverage for the app shell examples.
 */
const meta = {
  beforeEach: mockStoryAuth,
  component: AppShell,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Components/AppShell",
} satisfies Meta<typeof AppShell>;

export default meta;
/**
 * Storybook story contract for the app shell examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Defines the default app shell story.
 */
export const Default: Story = {
  args: {
    children: (
      <div className="grid gap-4 p-6 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          Archive content
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          More content
        </div>
      </div>
    ),
    meta: "8 items",
    title: "Pocket Trash",
  },
  /**
   * Exercises the app shell story interaction and assertions.
   *
   * @param context - Storybook play context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @returns A promise that resolves after the interaction assertions pass.
   * @rejects {Error} If a user interaction or assertion fails.
   */
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Pocket Trash" }),
    ).toBeVisible();
    await canvas.getByRole("button", { name: "Open search" }).click();
    await expect(
      canvas.getByRole("dialog", { name: "Search Pocket Trash" }),
    ).toBeVisible();
  },
};

/** App shell search surface in the compact drawer presentation. */
export const Mobile: Story = {
  ...Default,
  parameters: { viewport: { defaultViewport: "mobile1" } },
  /**
   * Verifies search uses the shared drawer at a compact viewport.
   *
   * @param context - Storybook play context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.canvasElement - Element containing the rendered story.
   * @returns A promise that resolves after the interaction assertions pass.
   */
  play: async ({ canvas, canvasElement }) => {
    await canvas.getByRole("button", { name: "Open search" }).click();
    const page = within(canvasElement.ownerDocument.body);
    await expect(
      page.getByRole("dialog", { name: "Search Pocket Trash" }),
    ).toHaveAttribute("data-presentation", "drawer");
  },
};

/** App shell and search surface in the dark theme. */
export const Dark: Story = {
  ...Default,
  globals: { theme: "dark" },
};

/**
 * Defines the route header app shell story.
 */
export const RouteHeader: Story = {
  args: {
    breadcrumbItems: [{ label: "Products", to: "/products" }],
    children: <div className="p-6">Product form</div>,
    headerActions: <Button>Add product</Button>,
    meta: "Draft",
    title: "Add product",
  },
};
