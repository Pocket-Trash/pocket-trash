import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { MakerLink } from "./maker-link";

/**
 * Configures Storybook coverage for the maker link examples.
 */
const meta = {
  args: { name: "KAP EDC", url: "https://www.kapedc.com" },
  component: MakerLink,
  title: "Components/MakerLink",
} satisfies Meta<typeof MakerLink>;

export default meta;
/**
 * Storybook story contract for the maker link examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Defines the with url maker link story.
 */
export const WithUrl: Story = {};

/** Defines an internal maker profile link story. */
export const WithSlug: Story = { args: { slug: "kap-edc" } };

/**
 * Defines the without url maker link story.
 */
export const WithoutUrl: Story = { args: { url: null } };
