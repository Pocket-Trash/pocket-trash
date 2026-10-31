import { useReverification } from "@clerk/tanstack-react-start";
import { formatTranslation } from "@pocket-trash/localizations";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, mocked, waitFor, within } from "storybook/test";
import { requestSelfErasure } from "@/lib/account-erasure";
import { mockStoryRole, StoryProviders } from "../../.storybook/story-fixtures";
import { DeleteAccountSection } from "./delete-account-section";

/** Self-erasure controls with isolated strict-reverification/service fixtures. */
const meta = {
  component: DeleteAccountSection,
  /** Configures the current account and an isolated recoverable erasure failure. */
  beforeEach: () => {
    mockStoryRole("user");
    mocked(useReverification).mockImplementation(
      (request) =>
        async (...args) =>
          await request(...args),
    );
    mocked(requestSelfErasure).mockRejectedValue(
      new Error("Fixture service unavailable"),
    );
  },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  title: "Components/DeleteAccountSection",
} satisfies Meta<typeof DeleteAccountSection>;
export default meta;
/** Self-erasure confirmation story contract. */
type Story = StoryObj<typeof meta>;
/** Initial closed confirmation state. */
export const Closed: Story = {};
/** Failed confirmed requests retain explicit consent and allow retry. */
export const Failed: Story = {
  /**
   * Exercises explicit confirmation and existing sanitized failure feedback.
   * @param context - Current story interaction context.
   * @returns Completion after consent and retry eligibility are verified.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", {
        name: formatTranslation("web.erasure.self.open", {}, "en-US"),
      }),
    );
    const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog");
    const scope = within(dialog);
    const submit = scope.getByRole("button", {
      name: formatTranslation("web.erasure.self.submit", {}, "en-US"),
    });
    await expect(submit).toBeDisabled();
    await userEvent.click(scope.getByRole("checkbox"));
    await userEvent.click(submit);
    await waitFor(() =>
      expect(requestSelfErasure).toHaveBeenCalledWith({
        data: { confirmed: true },
      }),
    );
    await expect(
      scope.getByText(
        formatTranslation("web.erasure.self.failure", {}, "en-US"),
      ),
    ).toBeVisible();
    await expect(scope.getByRole("checkbox")).toBeChecked();
    await expect(submit).toBeEnabled();
  },
};
