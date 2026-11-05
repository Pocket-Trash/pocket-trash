import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useForm, useStore } from "@tanstack/react-form";
import { expect } from "storybook/test";
import { Switch } from "./switch";

/**
 * Gives the controlled switch one form-owned draft value.
 * @param props - Story control state.
 * @returns The shared switch wired to a form field.
 */
function SwitchExample(props: {
  /** Whether this fixture is locked. */
  disabled?: boolean;
}) {
  const form = useForm({ defaultValues: { enabled: false } });
  const checked = useStore(form.store, (state) => state.values.enabled);
  return (
    <Switch
      checked={checked}
      disabled={props.disabled}
      label="Example setting"
      onCheckedChange={(enabled) => form.setFieldValue("enabled", enabled)}
    />
  );
}
/** Shared controlled-switch stories. */
const meta = {
  component: SwitchExample,
  title: "Components/UI/Switch",
} satisfies Meta<typeof SwitchExample>;
export default meta;
/** Shared switch story contract. */
type Story = StoryObj<typeof meta>;
/** Pointer and keyboard changes update the same controlled value. */
export const Interactive: Story = {
  /**
   * Exercises the shared switch's pointer and keyboard behavior.
   * @param context - Rendered setting and browser interactions.
   */
  play: async ({ canvas, userEvent }) => {
    const control = canvas.getByRole("switch", { name: "Example setting" });
    await expect(control).not.toBeChecked();
    await userEvent.click(control);
    await expect(control).toBeChecked();
    control.focus();
    await userEvent.keyboard(" ");
    await expect(control).not.toBeChecked();
  },
};
/** Locked settings expose their disabled state and resist changes. */
export const Disabled: Story = {
  args: { disabled: true },
  /**
   * Verifies the disabled state is both exposed and enforced.
   * @param context - Rendered locked control and browser interactions.
   */
  play: async ({ canvas, userEvent }) => {
    const control = canvas.getByRole("switch", { name: "Example setting" });
    await expect(control).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(control);
    await expect(control).not.toBeChecked();
  },
};
