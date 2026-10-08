import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { PublicProfileAvatar } from "./public-profile-avatar";

/** Browser-local image fixture; production URLs always come from Clerk. */
const picture = new URL(
  "/images/tmp/7887468134587-1.jpg",
  window.location.origin,
).href;
/** Public avatar stories exercise the shared primitive and Clerk URL parameters. */
const meta = {
  component: PublicProfileAvatar,
  args: { imageUrl: null, username: "collector" },
  title: "Components/PublicProfileAvatar",
} satisfies Meta<typeof PublicProfileAvatar>;
export default meta;
/** Public avatar story contract. */
type Story = StoryObj<typeof meta>;
/** Missing and removed pictures retain the decorative initials fallback. */
export const Absent: Story = {};
/** A profile uses a 37.5px avatar with a 75px square image request. */
export const ProfilePicture: Story = {
  args: { imageUrl: picture, size: "lg" },
  /**
   * Verifies the profile crop matches twice its rendered dimensions.
   *
   * @param context - Story canvas.
   * @param context.canvasElement - Rendered story container.
   * @returns Completion after crop assertions.
   * @rejects When the profile avatar is missing.
   */
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector("img")).not.toBeNull(),
    );
    const avatar = canvasElement.querySelector('[data-slot="avatar"]');
    if (!avatar) throw new Error("Profile avatar missing");
    const pixels = 2 * parseFloat(getComputedStyle(avatar).width);
    expect(canvasElement.querySelector("img")?.getAttribute("src")).toContain(
      `width=${pixels}&height=${pixels}&fit=crop`,
    );
  },
};

/**
 * Exercises a picture replacement and removal without changing the visible identity.
 *
 * @returns Stateful avatar scenario for browser interaction coverage.
 */
function PictureChanges() {
  const [imageUrl, setImageUrl] = useState<string | null>(picture);
  return (
    <div>
      <PublicProfileAvatar imageUrl={imageUrl} username="collector" />
      <span>collector</span>
      <button
        type="button"
        onClick={() => setImageUrl(`${picture}?replacement=true`)}
      >
        Replace
      </button>
      <button type="button" onClick={() => setImageUrl(null)}>
        Remove
      </button>
    </div>
  );
}

/** Browser coverage for loaded, replaced, and removed pictures. */
export const ChangedAndRemoved: Story = {
  render: PictureChanges,
  /**
   * Verifies proxy parameters and decorative semantics through picture transitions.
   *
   * @param context - Story canvas.
   * @param context.canvasElement - Rendered story container.
   * @returns Completion after replacement and fallback assertions.
   * @rejects When the attribution avatar is missing.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvasElement.querySelector("img")).not.toBeNull(),
    );
    const avatar = canvasElement.querySelector('[data-slot="avatar"]');
    expect(avatar).toHaveAttribute("aria-hidden", "true");
    if (!avatar) throw new Error("Attribution avatar missing");
    const pixels = 2 * parseFloat(getComputedStyle(avatar).width);
    expect(canvasElement.querySelector("img")).toHaveAttribute("alt", "");
    expect(canvasElement.querySelector("img")?.getAttribute("src")).toContain(
      `width=${pixels}&height=${pixels}&fit=crop`,
    );
    await userEvent.click(canvas.getByRole("button", { name: "Replace" }));
    await waitFor(() =>
      expect(canvasElement.querySelector("img")?.getAttribute("src")).toContain(
        "replacement=true",
      ),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(canvasElement.querySelector("img")).toBeNull());
    expect(
      canvasElement.querySelector('[data-slot="avatar-fallback"]'),
    ).toHaveTextContent("C");
    expect(canvas.getByText("collector")).toBeVisible();
  },
};
