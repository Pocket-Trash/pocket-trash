import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { MakerLink } from "./maker-link";

const meta = {
  args: { name: "KAP EDC", url: "https://www.kapedc.com" },
  component: MakerLink,
  title: "Components/MakerLink",
} satisfies Meta<typeof MakerLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithUrl: Story = {};

export const WithoutUrl: Story = { args: { url: null } };
