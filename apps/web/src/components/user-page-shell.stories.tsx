import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, within } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { UserPageShell } from "./user-page-shell";

/**
 * Configures Storybook coverage for the user page shell examples.
 */
const meta = {
  args: {
    children: (
      <div className="rounded-lg border border-border bg-card p-6">
        Account content
      </div>
    ),
    section: "account",
    title: "Account",
  },
  beforeEach: mockStoryAuth,
  component: UserPageShell,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Components/UserPageShell",
} satisfies Meta<typeof UserPageShell>;

export default meta;
/**
 * Storybook story contract for the user page shell examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Defines the default user page shell story.
 */
export const Default: Story = {
  /**
   * Exercises the user page shell story interaction and assertions.
   *
   * @param context - Storybook play context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @returns A promise that resolves after the interaction assertions pass.
   * @rejects {Error} If a user interaction or assertion fails.
   */
  play: async ({ canvas, userEvent }) => {
    await expect(
      canvas.getByText("Account", { selector: "[aria-current='page']" }),
    ).toBeVisible();
    const navigation = canvas.getByRole("navigation", { name: "User" });
    const links = within(navigation);
    await expect(
      links.getByRole("link", { name: "Collections" }),
    ).toHaveAttribute("href", "/user/collections");
    await expect(
      links.getByRole("link", { name: "Resources" }),
    ).toHaveAttribute("href", "/user/resources");
    await expect(links.getByRole("link", { name: "Account" })).toHaveAttribute(
      "href",
      "/user/account",
    );
    await expect(links.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/user/settings",
    );
    await expect(
      links.getByRole("link", { name: "Beta features" }),
    ).toHaveAttribute("href", "/user/settings/beta-features");

    const toggle = canvas.getByRole("button", { name: "Toggle sidebar" });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(navigation).not.toBeVisible();
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(navigation).toBeVisible();
  },
};

/** User page shell containing an editable surface. */
export const EditableContent: Story = {
  args: {
    children: (
      <div
        aria-label="Editor"
        className="rounded-lg border border-border bg-card p-6"
        contentEditable
        role="textbox"
        suppressContentEditableWarning
      >
        Editable content
      </div>
    ),
  },
  /**
   * Verifies editor shortcuts do not also toggle the sidebar.
   *
   * @param context - Storybook play context.
   * @returns A promise that resolves after the interaction assertions pass.
   */
  play: async ({ canvas, userEvent }) => {
    const toggle = canvas.getByRole("button", { name: "Toggle sidebar" });
    await userEvent.click(canvas.getByRole("textbox", { name: "Editor" }));
    await userEvent.keyboard("{Control>}b{/Control}");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  },
};

/** User page shell at the mobile viewport. */
export const Mobile: Story = {
  globals: { viewport: "mobile1" },
  /**
   * Verifies the mobile sidebar starts expanded and remains collapsible.
   *
   * @param context - Storybook play context.
   * @returns A promise that resolves after the interaction assertions pass.
   */
  play: async ({ canvas, userEvent }) => {
    const navigation = canvas.getByRole("navigation", { name: "User" });
    const toggle = canvas.getByRole("button", { name: "Toggle sidebar" });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(navigation).not.toBeVisible();
  },
};
