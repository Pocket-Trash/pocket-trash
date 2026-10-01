import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combines conditional class values and resolves Tailwind conflicts.
 *
 * @param inputs - Class values to combine.
 * @returns The merged class-name string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
