import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { expect, fn } from "storybook/test";
import { ResourceFileInput } from "./resource-file-input";

const meta = {
  args: {
    browseLabel: "Browse files",
    description: "Drag files here or choose them from your device.",
    fileTypes: "STL, 3MF, STEP, PDF, TXT, or ZIP",
    files: [],
    id: "resource-files",
    label: "Upload resource files",
    onFilesChange: fn(),
    removeFileLabel: "Remove",
  },
  component: ResourceFileInput,
  decorators: [
    (Story) => (
      <div className="w-[32rem] max-w-full">
        <Story />
      </div>
    ),
  ],
  title: "Components/ResourceFileInput",
} satisfies Meta<typeof ResourceFileInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Disabled: Story = { args: { disabled: true } };

export const WithFiles: Story = {
  render: (args) => <FileInputExample {...args} initialFiles />,
};

export const AddAndRemove: Story = {
  render: (args) => <FileInputExample {...args} />,
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByLabelText(
      /Upload resource files/,
    ) as HTMLInputElement;
    await userEvent.upload(
      input,
      new File(["solid"], "spinner.stl", {
        type: "model/stl",
      }),
    );
    await expect(canvas.getByText("spinner.stl")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove spinner.stl" }),
    );
    await expect(canvas.queryByText("spinner.stl")).toBeNull();
  },
};

function FileInputExample({
  initialFiles = false,
  ...args
}: React.ComponentProps<typeof ResourceFileInput> & {
  initialFiles?: boolean;
}) {
  const [files, setFiles] = useState<File[]>(() =>
    initialFiles
      ? [new File(["solid"], "spinner.stl", { type: "model/stl" })]
      : [],
  );
  return <ResourceFileInput {...args} files={files} onFilesChange={setFiles} />;
}
