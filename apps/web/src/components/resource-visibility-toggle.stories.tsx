import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, mocked, within } from "storybook/test";
import { markResourcePrivate, setResourceVisibility } from "@/lib/resources";
import { StoryProviders } from "../../.storybook/story-fixtures";
import {
  PublicResourceSwitch,
  ResourceVisibilityToggle,
} from "./resource-visibility-toggle";

/**
 * Configures Storybook coverage for the resource visibility toggle examples.
 */
const meta = {
  args: {
    canAdminister: false,
    isAdminPrivate: false,
    isOwner: true,
    isPrivate: false,
    name: "Pocket clip",
    resourceId: 1000,
  },
  /**
   * Resets successful visibility mutations before each story.
   */
  beforeEach: () => {
    mocked(markResourcePrivate).mockResolvedValue(undefined);
    mocked(setResourceVisibility).mockResolvedValue(undefined);
  },
  component: ResourceVisibilityToggle,
  decorators: [
    (Story) => (
      <StoryProviders>
        <div className="w-80">
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
  title: "Components/ResourceVisibilityToggle",
} satisfies Meta<typeof ResourceVisibilityToggle>;

export default meta;
/**
 * Storybook story contract for the resource visibility toggle examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Defines the owner public resource visibility toggle story.
 */
export const OwnerPublic: Story = {
  /**
   * Exercises the resource visibility toggle story interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("switch", { name: "Public" }));
    await expect(setResourceVisibility).toHaveBeenCalledWith({
      data: { isPublic: false, resourceId: 1000 },
    });
  },
};

/**
 * Defines the owner private resource visibility toggle story.
 */
export const OwnerPrivate: Story = { args: { isPrivate: true } };

/**
 * Defines the admin locked resource visibility toggle story.
 */
export const AdminLocked: Story = {
  args: { isAdminPrivate: true, isPrivate: true },
  /**
   * Exercises the resource visibility toggle story interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   */
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("switch", { name: "Public" }),
    ).toHaveAttribute("aria-disabled", "true");
  },
};

/**
 * Defines the admin moderation resource visibility toggle story.
 */
export const AdminModeration: Story = {
  args: { canAdminister: true, isOwner: false },
  /**
   * Exercises the resource visibility toggle story interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.canvasElement - Rendered Storybook canvas element.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("switch", { name: "Public" }));
    const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("textbox"),
      "Unsafe download",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Mark private" }),
    );
    await expect(markResourcePrivate).toHaveBeenCalledWith({
      data: { reason: "Unsafe download", resourceId: 1000 },
    });
  },
};

/** Staff restoration interaction story. */
export const AdminRestore: Story = {
  args: { canAdminister: true, isOwner: false, isPrivate: true },
  /**
   * Exercises restoration with a required staff reason.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after the interaction completes.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const originalPrompt = canvasElement.ownerDocument.defaultView?.prompt;
    if (!canvasElement.ownerDocument.defaultView || !originalPrompt) return;
    canvasElement.ownerDocument.defaultView.prompt = () => "Review completed";
    try {
      await userEvent.click(canvas.getByRole("switch", { name: "Public" }));
      await expect(setResourceVisibility).toHaveBeenCalledWith({
        data: {
          isPublic: true,
          reason: "Review completed",
          resourceId: 1000,
        },
      });
    } finally {
      canvasElement.ownerDocument.defaultView.prompt = originalPrompt;
    }
  },
};

/**
 * Defines the bare switch resource visibility toggle story.
 */
export const BareSwitch: Story = {
  /**
   * Renders the resource visibility toggle story example.
   *
   * @returns The rendered story example.
   */
  render: () => (
    <PublicResourceSwitch checked onCheckedChange={() => undefined} />
  ),
};
