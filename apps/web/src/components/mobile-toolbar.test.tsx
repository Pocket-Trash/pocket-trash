import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createDefaultMatchModes, createEmptyFilters } from "@/lib/pen-filters";
import { MobileToolbar } from "./mobile-toolbar";

vi.mock("@/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en-US" }),
}));

describe("MobileToolbar", () => {
  it("keeps search, filters, and sort as native mobile controls", () => {
    const html = renderToStaticMarkup(
      <MobileToolbar
        active={createEmptyFilters()}
        filterCount={0}
        matchModes={createDefaultMatchModes()}
        onClearFilters={vi.fn()}
        onMatchModeChange={vi.fn()}
        onQueryChange={vi.fn()}
        onSortChange={vi.fn()}
        onToggleFilter={vi.fn()}
        products={[]}
        query=""
        sort="date_desc"
        sortOptions={[{ label: "Newest drop", value: "date_desc" }]}
      />,
    );

    expect(html).toContain('aria-label="Archive controls"');
    expect(html.match(/type="button"/g)).toHaveLength(3);
    expect(html).toContain("Search");
    expect(html).toContain("Filters");
    expect(html).toContain("Sort");
    expect(html).not.toContain("Settings");
  });
});
