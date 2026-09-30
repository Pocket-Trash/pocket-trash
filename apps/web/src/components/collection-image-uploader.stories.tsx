import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { CollectionImageUploader } from "./collection-form";

const copy = {
  browse: "Browse",
  imageHelp: "Choose up to ten collection images.",
  imageTypes: "Allowed image types: JPEG, PNG, WebP, and AVIF.",
  label: "Gallery",
  removeFile: "Remove file",
  submit: "Upload images",
};

const meta = {
  args: { copy, onUpload: fn(async () => true) },
  component: CollectionImageUploader,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  title: "Components/CollectionImageUploader",
} satisfies Meta<typeof CollectionImageUploader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UploadBatch: Story = {
  play: async ({ args, canvas, userEvent }) => {
    const files = [
      new File(["one"], "one.png", { type: "image/png" }),
      new File(["two"], "two.png", { type: "image/png" }),
    ];
    await userEvent.upload(canvas.getByLabelText("Gallery"), files);
    await userEvent.click(
      canvas.getByRole("button", { name: "Upload images" }),
    );
    await expect(args.onUpload).toHaveBeenCalledWith(files);
    await expect(canvas.queryByText("one.png")).not.toBeInTheDocument();
  },
};

export const RetryFailedBatch: Story = {
  args: { onUpload: fn(async () => false) },
  play: async ({ args, canvas, userEvent }) => {
    const file = new File(["retry"], "retry.png", { type: "image/png" });
    await userEvent.upload(canvas.getByLabelText("Gallery"), file);
    await userEvent.click(
      canvas.getByRole("button", { name: "Upload images" }),
    );
    await expect(args.onUpload).toHaveBeenCalledWith([file]);
    await expect(canvas.getByText("retry.png")).toBeVisible();
  },
};
