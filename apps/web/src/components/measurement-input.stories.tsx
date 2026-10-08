import type {
  DimensionMeasurement,
  WeightMeasurement,
} from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import * as React from "react";
import { expect, fn } from "storybook/test";
import { withThemePanels } from "../../.storybook/theme-panels";
import { MeasurementInput } from "./measurement-input";

/**
 * Renders a controlled dimension input example.
 *
 * @returns The stateful story content.
 */
function DimensionExample() {
  const [value, setValue] = React.useState<DimensionMeasurement>({
    unit: "mm",
    value: "25.4",
  });
  return (
    <div className="w-80 max-w-full">
      <MeasurementInput
        kind="dimension"
        label="Length"
        onChange={(nextValue) => setValue(nextValue as DimensionMeasurement)}
        unitLabel="Length unit"
        value={value}
      />
    </div>
  );
}

/**
 * Renders a controlled weight input example.
 *
 * @returns The stateful story content.
 */
function WeightExample() {
  const [value, setValue] = React.useState<WeightMeasurement>({
    unit: "oz",
    value: "3.175",
  });
  return (
    <div className="w-80 max-w-full">
      <MeasurementInput
        kind="weight"
        label="Weight"
        onChange={(nextValue) => setValue(nextValue as WeightMeasurement)}
        unitLabel="Weight unit"
        value={value}
      />
    </div>
  );
}

/**
 * Configures Storybook coverage for exact stored measurement entry.
 */
const meta = {
  args: {
    kind: "dimension",
    label: "Length",
    onChange: fn(),
    unitLabel: "Length unit",
    value: { unit: "mm", value: "25.4" },
  },
  component: MeasurementInput,
  decorators: [withThemePanels],
  title: "Components/MeasurementInput",
} satisfies Meta<typeof MeasurementInput>;

export default meta;
/** Storybook story contract for measurement input examples. */
type Story = StoryObj<typeof meta>;

/** Shows a controlled dimension input and verifies unit changes preserve text. */
export const Dimension: Story = {
  render: DimensionExample,
  /**
   * Exercises the stored-unit toggle without converting the entered value.
   *
   * @param context - Storybook interaction context.
   * @returns A promise that resolves after the assertions pass.
   * @rejects {Error} When the rendered controls are missing.
   */
  play: async (context) => {
    const { canvas, userEvent } = context;
    const [input] = canvas.getAllByRole("spinbutton", { name: "Length" });
    const [inches] = canvas.getAllByRole("button", { name: "in" });
    if (!input || !inches) throw new Error("Measurement controls are missing.");
    await expect(input).toHaveValue(25.4);
    await userEvent.click(inches);
    await expect(input).toHaveValue(25.4);
    await expect(inches).toHaveAttribute("aria-pressed", "true");
  },
};

/** Shows the weight-specific gram and ounce choices. */
export const Weight: Story = {
  render: WeightExample,
};
