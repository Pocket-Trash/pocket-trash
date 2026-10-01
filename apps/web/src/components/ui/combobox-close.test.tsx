/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mutable combobox state exposed to close-behavior tests.
 */
const states = vi.hoisted(() => ({ open: [] as boolean[] }));

vi.mock("@base-ui/react/combobox", () => {
  /**
   * Returns nested test content without adding markup.
   *
   * @param input - Passthrough test-double properties.
   * @param input.children - Nested content.
   * @returns The nested test content.
   */
  const passthrough = ({
    children,
  }: {
    /**
     * Nested content.
     */
    children?: React.ReactNode;
  }) => children;
  return {
    Combobox: {
      Empty: passthrough,
      /**
       * Provides the input test double.
       *
       * @returns No rendered output.
       */
      Input: () => null,
      Item: passthrough,
      ItemIndicator: passthrough,
      /**
       * Provides the list test double.
       *
       * @returns No rendered output.
       */
      List: () => null,
      Popup: passthrough,
      Portal: passthrough,
      Positioner: passthrough,
      /**
       * Provides the root test double.
       *
       * @param input - Combobox root test-double properties.
       * @param input.items - Options available for selection.
       * @param input.onOpenChange - Callback invoked when the open state changes.
       * @param input.onValueChange - Callback invoked when the selection changes.
       * @param input.open - Current controlled open state.
       * @returns The rendered test controls.
       */
      Root: ({
        items,
        onOpenChange,
        onValueChange,
        open,
      }: {
        /**
         * Options available for selection.
         */
        items: Array<{
          /**
           * Stable option identifier.
           */
          id: number;
          /**
           * Display label for the option.
           */
          name: string;
        }>;
        /**
         * Reports combobox open-state changes.
         *
         * @param open - Next open state.
         */
        onOpenChange: (open: boolean) => void;
        /**
         * Reports selection changes.
         *
         * @param value - Next selection value.
         */
        onValueChange: (value: unknown) => void;
        /**
         * Whether the combobox root is open.
         */
        open: boolean;
      }) => {
        states.open.push(open);
        return (
          <>
            <button
              data-testid="open"
              onClick={() => onOpenChange(true)}
              type="button"
            />
            <button
              data-testid="select"
              onClick={() => onValueChange(items[0])}
              type="button"
            />
          </>
        );
      },
      /**
       * Provides the trigger test double.
       *
       * @returns No rendered output.
       */
      Trigger: () => null,
    },
  };
});

import { CatalogCombobox, CatalogMultiCombobox } from "./combobox";

describe.each([
  CatalogCombobox,
  CatalogMultiCombobox,
])("combobox close behavior", (Component) => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    states.open.length = 0;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
  });

  it("closes after selecting a value", () => {
    const item = { id: 1, name: "Bronze" };
    act(() =>
      root.render(
        <Component
          ariaLabel="Material"
          items={[item]}
          onValueChange={vi.fn() as never}
          placeholder="Material"
          removeLabel="Remove"
          value={(Component === CatalogMultiCombobox ? [] : null) as never}
        />,
      ),
    );
    act(() =>
      (container.querySelector('[data-testid="open"]') as HTMLElement).click(),
    );
    expect(states.open.at(-1)).toBe(true);
    act(() =>
      (
        container.querySelector('[data-testid="select"]') as HTMLElement
      ).click(),
    );
    expect(states.open.at(-1)).toBe(false);
  });
});
