/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const states = vi.hoisted(() => ({ open: [] as boolean[] }));

vi.mock("@base-ui/react/combobox", () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    children;
  return {
    Combobox: {
      Empty: passthrough,
      Input: () => null,
      Item: passthrough,
      ItemIndicator: passthrough,
      List: () => null,
      Popup: passthrough,
      Portal: passthrough,
      Positioner: passthrough,
      Root: ({
        items,
        onOpenChange,
        onValueChange,
        open,
      }: {
        items: Array<{ id: number; name: string }>;
        onOpenChange: (open: boolean) => void;
        onValueChange: (value: unknown) => void;
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
