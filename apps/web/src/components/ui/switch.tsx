import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { useId } from "react";

/**
 * Presents a controlled binary setting using the app's visibility-switch pattern.
 * @param props - Accessible label, current value, and form-owned update callback.
 * @returns A labeled keyboard-accessible switch.
 */
export function Switch({
  checked,
  disabled = false,
  label,
  onCheckedChange,
}: {
  /** Whether the setting is on. */
  checked: boolean;
  /** Whether interaction is locked. */
  disabled?: boolean;
  /** Accessible visible setting name. */
  label: string;
  /**
   * Reports a requested setting change.
   * @param checked - Whether the setting should be on.
   */
  onCheckedChange(checked: boolean): void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <SwitchPrimitive.Root
        aria-label={label}
        checked={checked}
        className="flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-muted-foreground/35 p-0.5 outline-none transition-colors data-[checked]:bg-green-600 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:data-[checked]:bg-green-500"
        disabled={disabled}
        id={id}
        onCheckedChange={onCheckedChange}
      >
        <SwitchPrimitive.Thumb className="size-5 rounded-full bg-white shadow-sm transition-transform data-[checked]:translate-x-5" />
      </SwitchPrimitive.Root>
    </div>
  );
}
