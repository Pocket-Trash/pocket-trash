import type {
  DimensionMeasurement,
  DimensionUnit,
  WeightMeasurement,
  WeightUnit,
} from "@package/services";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** Exact editable measurement value. */
export type MeasurementInputValue = DimensionMeasurement | WeightMeasurement;

/** Controlled measurement editor properties. */
type MeasurementInputProps = {
  /** Accessible label for the numeric input. */
  label: string;
  /** Selects the compatible unit choices. */
  kind: "dimension" | "weight";
  /** Called when the numeric input loses focus. */
  onBlur?(): void;
  /**
   * Receives the updated value or unit.
   *
   * @param value - Updated exact measurement.
   */
  onChange(value: MeasurementInputValue): void;
  /** Accessible label for the unit selector. */
  unitLabel: string;
  /** Controlled exact measurement value. */
  value: MeasurementInputValue;
};

/** Units offered for stored dimensions. */
const dimensionUnits = ["mm", "in"] as const satisfies readonly DimensionUnit[];
/** Units offered for stored weights. */
const weightUnits = ["g", "oz"] as const satisfies readonly WeightUnit[];

/**
 * Edits an exact measurement value and its independently selected stored unit.
 *
 * Changing the unit deliberately does not convert or otherwise modify the
 * numeric text. This lets catalog editors enter the maker's published value
 * exactly as written.
 *
 * @param props - Controlled measurement field properties.
 * @returns The numeric input and unit selector.
 */
export function MeasurementInput(props: MeasurementInputProps) {
  const units = props.kind === "weight" ? weightUnits : dimensionUnits;

  /**
   * Updates only the selected unit while preserving the exact numeric text.
   *
   * @param unit - Newly selected unit.
   */
  const setUnit = (unit: string) => {
    if (!unit) return;
    if (props.kind === "weight") {
      props.onChange({ ...props.value, unit: unit as WeightUnit });
      return;
    }
    props.onChange({ ...props.value, unit: unit as DimensionUnit });
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Input
          aria-label={props.label}
          className="pr-10"
          min="0"
          onBlur={props.onBlur}
          onChange={(event) =>
            props.onChange({ ...props.value, value: event.target.value })
          }
          step="any"
          type="number"
          value={props.value.value}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
          {props.value.unit}
        </span>
      </div>
      <ToggleGroup
        aria-label={props.unitLabel}
        className="w-auto shrink-0"
        onValueChange={setUnit}
        type="single"
        value={props.value.unit}
      >
        {units.map((unit) => (
          <ToggleGroupItem key={unit} value={unit}>
            {unit}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
