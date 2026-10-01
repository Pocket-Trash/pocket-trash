import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Supplies the shared CSS classes for toggle-group items.
 */
const toggleGroupItemVariants = cva(
  "inline-flex h-8 flex-1 items-center justify-center rounded-md px-3 text-xs font-medium text-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[pressed]:bg-primary data-[pressed]:text-primary-foreground",
);

/**
 * Shared styling and content accepted by every toggle group mode.
 */
type ToggleGroupBaseProps = Omit<
  React.ComponentProps<typeof ToggleGroupPrimitive>,
  "defaultValue" | "multiple" | "onValueChange" | "value"
>;

/**
 * Controlled or uncontrolled props for a single-select toggle group.
 */
type ToggleGroupSingleProps = ToggleGroupBaseProps & {
  /**
   * Initial uncontrolled toggle selection. An empty or omitted string means no
   * initial selection.
   */
  defaultValue?: string;
  /**
   * Reports selection changes.
   *
   * @param value - Next selection, or an empty string when cleared.
   */
  onValueChange?: (value: string) => void;
  /**
   * Toggle selection mode. Omission selects single-selection mode.
   *
   * @default "single"
   */
  type?: "single";
  /**
   * Current controlled selection. An empty string means no selection; omission
   * leaves the group uncontrolled.
   */
  value?: string;
};

/**
 * Controlled or uncontrolled props for a multi-select toggle group.
 */
type ToggleGroupMultipleProps = ToggleGroupBaseProps & {
  /**
   * Initial uncontrolled toggle selection. An empty or omitted array means no
   * initial selection.
   */
  defaultValue?: string[];
  /**
   * Reports selection changes.
   *
   * @param value - Next selections, or an empty array when cleared.
   */
  onValueChange?: (value: string[]) => void;
  /**
   * Toggle selection mode.
   */
  type: "multiple";
  /**
   * Current controlled selection. An empty array means no selection; omission
   * leaves the group uncontrolled.
   */
  value?: string[];
};

/**
 * Props accepted by single- and multi-select toggle groups.
 */
type ToggleGroupProps = ToggleGroupSingleProps | ToggleGroupMultipleProps;

/**
 * Renders a toggle group, using single-selection mode unless `type` is `"multiple"`.
 *
 * @param props - Toggle group properties.
 * @returns The rendered toggle group UI.
 */
function ToggleGroup(props: ToggleGroupProps) {
  const { className } = props;
  const classes = cn(
    "inline-flex w-full items-center gap-1 rounded-lg border border-input bg-background p-1",
    className,
  );

  if (props.type === "multiple") {
    const { className: _className, type: _type, ...toggleGroupProps } = props;
    void _className;
    void _type;

    return (
      <ToggleGroupPrimitive
        className={classes}
        data-slot="toggle-group"
        multiple
        {...toggleGroupProps}
      />
    );
  }

  const {
    className: _className,
    defaultValue,
    onValueChange,
    type: _type,
    value,
    ...toggleGroupProps
  } = props;
  void _className;
  void _type;
  const controlledValue = "value" in props ? (value ? [value] : []) : undefined;

  return (
    <ToggleGroupPrimitive
      className={classes}
      data-slot="toggle-group"
      defaultValue={defaultValue ? [defaultValue] : undefined}
      multiple={false}
      onValueChange={(nextValue) => onValueChange?.(nextValue[0] ?? "")}
      value={controlledValue}
      {...toggleGroupProps}
    />
  );
}

/**
 * Renders one selectable item within a toggle group.
 *
 * @param props - Toggle group item properties.
 * @param props.className - Additional CSS classes.
 * @returns The rendered toggle group item UI.
 */
function ToggleGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof Toggle> &
  VariantProps<typeof toggleGroupItemVariants>) {
  return (
    <Toggle
      className={cn(toggleGroupItemVariants(), className)}
      data-slot="toggle-group-item"
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
