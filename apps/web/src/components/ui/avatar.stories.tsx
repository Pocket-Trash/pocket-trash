import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Check } from "lucide-react";
import { withThemePanels } from "../../../.storybook/theme-panels";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "./avatar";

/**
 * Configures Storybook coverage for the avatar examples.
 */
const meta = {
  component: Avatar,
  decorators: [withThemePanels],
  title: "UI/Avatar",
} satisfies Meta<typeof Avatar>;

export default meta;
/**
 * Storybook story contract for the avatar examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Shows the avatar fallback example.
 */
export const Fallback: Story = {
  /**
   * Renders the avatar fallback example.
   *
   * @returns The rendered story example.
   */
  render: () => (
    <Avatar>
      <AvatarFallback>PT</AvatarFallback>
    </Avatar>
  ),
};

/**
 * Shows the avatar sizes example.
 */
export const Sizes: Story = {
  /**
   * Renders the avatar sizes example.
   *
   * @returns The rendered story example.
   */
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar size="sm">
        <AvatarFallback>SM</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>MD</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>LG</AvatarFallback>
      </Avatar>
    </div>
  ),
};

/**
 * Shows the avatar with badge example.
 */
export const WithBadge: Story = {
  /**
   * Renders the avatar with badge example.
   *
   * @returns The rendered story example.
   */
  render: () => (
    <Avatar size="lg">
      <AvatarImage alt="Ada Lovelace" src="" />
      <AvatarFallback>AL</AvatarFallback>
      <AvatarBadge>
        <Check />
      </AvatarBadge>
    </Avatar>
  ),
};

/**
 * Shows the avatar group example.
 */
export const Group: Story = {
  /**
   * Renders the avatar group example.
   *
   * @returns The rendered story example.
   */
  render: () => (
    <AvatarGroup>
      <Avatar>
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>GH</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>KN</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+3</AvatarGroupCount>
    </AvatarGroup>
  ),
};
