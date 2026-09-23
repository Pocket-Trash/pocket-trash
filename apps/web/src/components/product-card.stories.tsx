import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";
import {
  mockStoryAuth,
  StoryProviders,
  storyProduct,
  storyRates,
} from "../../.storybook/story-fixtures";
import { withThemePanels } from "../../.storybook/theme-panels";
import { ProductCard } from "./product-card";

const meta = {
  beforeEach: mockStoryAuth,
  component: ProductCard,
  decorators: [
    (Story) => (
      <StoryProviders>
        <div className="w-72">
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
  title: "Components/ProductCard",
} satisfies Meta<typeof ProductCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    currency: "USD",
    onOpen: fn(),
    product: storyProduct,
    rates: storyRates,
    units: "in",
    weight: "g",
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button"));
    await expect(args.onOpen).toHaveBeenCalled();
  },
};

export const Metric: Story = {
  args: { ...Default.args, units: "mm", weight: "oz" },
  decorators: [withThemePanels],
};
