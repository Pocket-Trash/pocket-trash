import type { UserBetaFeatureFlag } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { mockStoryRole, StoryProviders } from "../../.storybook/story-fixtures";
import { UserBetaFeaturesPage } from "./user-beta-features-page";

/** Current-account beta opt-in fixture. */
const flag: UserBetaFeatureFlag = {
  description: "An available beta tool.",
  name: "Beta tool",
  slug: "beta-tool",
  enabled: false,
};
/** User beta settings supplied by canonical route data. */
const meta = {
  component: UserBetaFeaturesPage,
  /** Supplies the current authenticated user.
   * @returns Nothing. */
  beforeEach: () => mockStoryRole("user"),
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  title: "Components/UserBetaFeaturesPage",
} satisfies Meta<typeof UserBetaFeaturesPage>;
export default meta;
/** User beta settings story contract. */
type Story = StoryObj<typeof meta>;
/** No currently available beta tools. */
export const Empty: Story = { args: { initialFlags: [] } };
/** Available tool before opt-in. */
export const Disabled: Story = { args: { initialFlags: [flag] } };
/** Enabled opt-in supplied by the refreshed route loader. */
export const Enabled: Story = {
  args: { initialFlags: [{ ...flag, enabled: true }] },
};
/** Previous-account snapshots are hidden after identity replacement. */
export const StaleAccount: Story = {
  args: { actorId: "prior_account", initialFlags: [flag] },
};
