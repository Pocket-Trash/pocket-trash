import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { RouteErrorView } from "./route-error-page";

/** Controlled browser clipboard operation. */
const copy = fn();
/** Localized route recovery states with guarded browser operations. */
const meta = {
  component: RouteErrorView,
  args: {
    development: true,
    error: new Error("Fixture route failure"),
    locale: "en-US",
    pathname: "/products?token=private#fragment",
    onRetry: fn().mockResolvedValue(undefined),
  },
  /** Supplies a controlled clipboard and restores the original browser property.
   * @returns Clipboard fixture cleanup. */
  beforeEach: () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    copy.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: copy },
    });
    return () => {
      if (original) Object.defineProperty(navigator, "clipboard", original);
      else Reflect.deleteProperty(navigator, "clipboard");
    };
  },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Components/RouteError",
} satisfies Meta<typeof RouteErrorView>;
export default meta;
/** Route recovery story. */
type Story = StoryObj<typeof meta>;
/** Safe development diagnostics expose successful and denied clipboard feedback. */
export const Development: Story = {
  /** Exercises diagnostics disclosure, safe copy, failure feedback, and retry.
   * @param context - Story interaction context. */
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText("Technical details"));
    await userEvent.click(
      canvas.getByRole("button", { name: "Copy error details" }),
    );
    await expect(await canvas.findByText("Copied")).toBeVisible();
    await expect(copy.mock.calls[0]?.[0]).not.toContain("token=private");
    copy.mockRejectedValueOnce(new Error("Clipboard denied"));
    await userEvent.click(
      canvas.getByRole("button", { name: "Copy error details" }),
    );
    await expect(await canvas.findByText("Copy failed")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await expect(canvas.getByRole("button", { name: "Retry" })).toBeEnabled();
  },
};
/** Production recovery excludes diagnostic details. */
export const Production: Story = {
  args: { development: false },
  /** Checks production diagnostics remain absent.
   * @param context - Story interaction context. */
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByText("Technical details"),
    ).not.toBeInTheDocument();
  },
};
