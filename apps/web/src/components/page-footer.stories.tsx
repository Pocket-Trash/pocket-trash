import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { PageFooter } from "./page-footer";

const meta = {
  beforeEach: mockStoryAuth,
  component: PageFooter,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  title: "Components/PageFooter",
} satisfies Meta<typeof PageFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
