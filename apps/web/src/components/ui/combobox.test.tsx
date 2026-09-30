import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CatalogCombobox, CatalogMultiCombobox } from "./combobox";

const bronze = { id: 1, name: "Bronze" };

describe("catalog combobox selections", () => {
  it("renders removable pills for selected materials and buttons", () => {
    const materials = renderToStaticMarkup(
      <CatalogMultiCombobox
        ariaLabel="Materials"
        items={[bronze]}
        onValueChange={() => undefined}
        placeholder="Select materials"
        removeLabel="Close"
        value={[bronze]}
      />,
    );
    const button = renderToStaticMarkup(
      <CatalogCombobox
        ariaLabel="Button"
        items={[bronze]}
        onValueChange={() => undefined}
        placeholder="Select button"
        removeLabel="Close"
        showSelectedPill
        value={bronze}
      />,
    );

    expect(materials).toContain("Bronze");
    expect(materials).toContain('aria-label="Close: Bronze"');
    expect(button).toContain('aria-label="Close: Bronze"');
  });
});
