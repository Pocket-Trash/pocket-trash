import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const toggleGroupItemVariants = cva(
  "inline-flex h-8 flex-1 items-center justify-center rounded-md px-3 text-xs font-medium text-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[pressed]:bg-primary data-[pressed]:text-primary-foreground",
);

type ToggleGroupBaseProps = Omit<
  React.ComponentProps<typeof ToggleGroupPrimitive>,
  "defaultValue" | "multiple" | "onValueChange" | "value"
>;

type ToggleGroupSingleProps = ToggleGroupBaseProps & {
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  type?: "single";
  value?: string;
};

type ToggleGroupMultipleProps = ToggleGroupBaseProps & {
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  type: "multiple";
  value?: string[];
};

type ToggleGroupProps = ToggleGroupSingleProps | ToggleGroupMultipleProps;

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
