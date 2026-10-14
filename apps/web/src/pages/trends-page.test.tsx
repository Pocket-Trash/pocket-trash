import type { PublicProductTypeTrend } from "@package/services";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TrendsPage } from "./trends-page";

vi.mock("@/components/app-shell", () => ({
  /**
   * Renders a minimal application shell for Trends page tests.
   *
   * @param props - Shell title and nested content.
   * @returns A simplified shell exposing its title.
   */
  AppShell: ({
    children,
    title,
  }: {
    /** Nested page content. */
    children: React.ReactNode;
    /** Page title. */
    title: string;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns the fixed English locale.
   *
   * @returns Locale state consumed by the Trends page.
   */
  useLocale: () => ({ locale: "en-US" }),
}));

/** Ten descending product-type Trends used to exercise chart truncation. */
const trends: PublicProductTypeTrend[] = Array.from(
  { length: 10 },
  (_, index) => ({
    count: 10 - index,
    productTypeId: 1000 + index,
    productTypeName: `Type ${index + 1}`,
    productTypeSlug: `type-${index + 1}`,
  }),
);

describe("TrendsPage", () => {
  it("charts the eight largest types plus Other while preserving the exact table", () => {
    const html = renderToStaticMarkup(
      <TrendsPage onProductTypeChange={vi.fn()} trends={trends} />,
    );
    const chart = html.match(
      /<ol aria-label="Catalog products by product type"[\s\S]*?<\/ol>/,
    )?.[0];
    const table = html.match(/<table[\s\S]*?<\/table>/)?.[0];

    expect(chart?.match(/<li/g)).toHaveLength(9);
    expect(chart).toContain("Other");
    expect(chart).not.toContain("Type 10");
    expect(table).toContain(
      '<caption class="bg-card p-3 text-left font-semibold">Catalog products by product type</caption>',
    );
    expect(table?.match(/<th(?: |>)/g)).toHaveLength(12);
    expect(table?.match(/<tr/g)).toHaveLength(11);
    expect(table).toContain("Type 10");
    expect(table).toContain(">1</td>");
  });
});
