import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, within } from "storybook/test";
import {
  mockStoryAuth,
  StoryProviders,
  storyProduct,
  storyRates,
} from "../../.storybook/story-fixtures";
import { ProductLightbox } from "./product-lightbox";

const meta = {
  args: {
    currency: "USD",
    imageIndex: 0,
    onClose: fn(),
    onImageChange: fn(),
    product: storyProduct,
    rates: storyRates,
    units: "in",
    weight: "g",
  },
  beforeEach: mockStoryAuth,
  component: ProductLightbox,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Components/ProductLightbox",
} satisfies Meta<typeof ProductLightbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.click(
      within(canvasElement.ownerDocument.body).getByRole("button", {
        name: "Close",
      }),
    );
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const Empty: Story = {
  args: { product: null },
};
