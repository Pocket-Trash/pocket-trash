import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { expect, fn } from "storybook/test";
import { FileDropInput, ResourceFileInput } from "./resource-file-input";

/**
 * Configures Storybook coverage for the resource file input examples.
 */
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
/**
 * Storybook story contract for the resource file input examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Defines the empty resource file input story.
 */
export const Empty: Story = {};

/**
 * Defines the disabled resource file input story.
 */
export const Disabled: Story = { args: { disabled: true } };

/**
 * Defines the with files resource file input story.
 */
export const WithFiles: Story = {
  /**
   * Renders the resource file input story example.
   *
   * @param args - Current Storybook story arguments.
   * @returns The rendered story example.
   */
  render: (args) => <FileInputExample {...args} initialFiles />,
};

/**
 * Defines the add and remove resource file input story.
 */
export const AddAndRemove: Story = {
  /**
   * Renders the resource file input story example.
   *
   * @param args - Current Storybook story arguments.
   * @returns The rendered story example.
   */
  render: (args) => <FileInputExample {...args} />,
  /**
   * Exercises the resource file input story interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.userEvent - Storybook interaction driver.
   * @returns A promise that resolves after the story assertions complete.
   * @rejects When a Storybook interaction or assertion fails.
   */
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

/**
 * Renders the file input example UI.
 *
 * @param props - File input example properties.
 * @param props.initialFiles - Whether to seed the example with one STL file.
 * @returns The rendered file input example UI.
 */
function FileInputExample({
  initialFiles = false,
  ...args
}: React.ComponentProps<typeof ResourceFileInput> & {
  /**
   * Whether to seed the example with one STL file.
   *
   * @default false
   */
  initialFiles?: boolean;
}) {
  const [files, setFiles] = useState<File[]>(() =>
    initialFiles
      ? [new File(["solid"], "spinner.stl", { type: "model/stl" })]
      : [],
  );
  return <ResourceFileInput {...args} files={files} onFilesChange={setFiles} />;
}

/** Verifies hidden image-picker sizing and keyboard access in constrained layouts. */
export const ImagePicker: Story = {
  /**
   * Renders the shared picker with the product image restrictions.
   * @param args - Existing picker labels and state.
   * @returns The image picker example.
   */
  render: (args) => (
    <FileDropInput
      {...args}
      accept=".avif,.jpeg,.jpg,.png,.webp"
      multiple
      onRemove={fn()}
    />
  ),
  /**
   * Checks visually hidden geometry and keyboard focus without suppressing overflow.
   * @param context - Browser story context.
   * @param context.canvas - Queries scoped to the picker.
   * @param context.canvasElement - Layout container in the browser.
   * @param context.userEvent - Keyboard interaction driver.
   * @returns Completion of the browser assertions.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const input = canvas.getByLabelText(/Upload resource files/);
    for (const width of [256, 512]) {
      canvasElement.style.width = `${width}px`;
      canvasElement.style.maxWidth = "100%";
      const style = getComputedStyle(input);
      await expect(style.width).toBe("1px");
      await expect(style.height).toBe("1px");
      await expect(style.padding).toBe("0px");
      await expect(style.borderWidth).toBe("0px");
      await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
        canvasElement.clientWidth,
      );
      const root = canvasElement.ownerDocument.documentElement;
      await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    }
    await expect(input).toHaveAttribute(
      "accept",
      ".avif,.jpeg,.jpg,.png,.webp",
    );
    await expect(input).toHaveAttribute("multiple");
    await expect(input).toHaveAccessibleDescription(
      "Drag files here or choose them from your device.",
    );
    await userEvent.tab();
    await expect(input).toHaveFocus();
    const label = canvas.getByText("Browse files").closest("label");
    await expect(label).toHaveAttribute("for", input.id);
    await expect(getComputedStyle(label!).boxShadow).not.toBe("none");
  },
};
