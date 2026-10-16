import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  AdminConfigPage,
  AdminProductConfigPage,
  AdminTrendsConfigPage,
} from "./admin-config-pages";

vi.mock("@pocket-trash/localizations", () => ({
  /**
   * Returns the localization key as stable test copy.
   *
   * @param key - Requested localization key.
   * @returns The key unchanged.
   */
  formatTranslation: (key: string) => key,
}));

vi.mock("@tanstack/react-router", () => ({
  /**
   * Renders a plain anchor for route links.
   *
   * @param props - Link properties.
   * @returns A plain anchor element.
   */
  Link: (props: React.ComponentProps<"a">) => {
    const { children, to, ...anchorProps } =
      props as React.ComponentProps<"a"> & {
        /** Link destination. */
        to: string;
      };
    return (
      <a href={to} {...anchorProps}>
        {children}
      </a>
    );
  },
}));

/** Product-type image metadata used by configuration tests. */
const productTypeImage = {
  imageAlt: "No image set",
  imageUrl: "https://cdn.pocket-trash.app/assets/static/no-image.png",
} as const;

vi.mock("@/components/admin-page-shell", () => ({
  /**
   * Renders only the administration page content.
   *
   * @param props - Shell properties.
   * @returns The shell children.
   */
  AdminPageShell: (props: {
    /** Shell content. */
    children: React.ReactNode;
  }) => <>{props.children}</>,
}));

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns a fixed English locale.
   *
   * @returns The English locale fixture.
   */
  useLocale: () => ({ locale: "en-US" }),
}));

describe("administrator configuration pages", () => {
  it("links the configuration hub to product and Trends settings", () => {
    const html = renderToStaticMarkup(<AdminConfigPage />);

    expect(html).toContain('href="/admin/config/products"');
    expect(html).toContain("web.navigation.products");
    expect(html).toContain('href="/admin/config/trends"');
    expect(html).toContain("web.admin.config.trends.title");
  });

  it("keeps primary Trends types included and read-only", () => {
    const html = renderToStaticMarkup(
      <AdminTrendsConfigPage
        productTypes={[
          {
            id: 1,
            includeInTrends: true,
            isPartOrAccessory: false,
            name: "Slider",
            slug: "slider",
          },
          {
            id: 2,
            includeInTrends: false,
            isPartOrAccessory: true,
            name: "Slider Plate",
            slug: "slider-plate",
          },
        ]}
      />,
    );

    expect(html).toContain("web.admin.config.trends.description");
    expect(html.match(/type="checkbox"/gu)).toHaveLength(2);
    expect(html).toMatch(/<input[^>]*disabled=""[^>]*checked=""/u);
    expect(html).toContain("web.admin.config.trends.alwaysIncluded");
  });

  it("paginates the product-type table at 30 rows", () => {
    const html = renderToStaticMarkup(
      <AdminProductConfigPage
        productTypes={Array.from({ length: 31 }, (_, index) => ({
          id: index + 1,
          ...productTypeImage,
          isPartOrAccessory: index % 2 === 0,
          name: `Product Type ${String(index + 1).padStart(2, "0")}`,
          slug: `product-type-${index + 1}`,
        }))}
      />,
    );

    expect(html).toContain("Product Type 30");
    expect(html).not.toContain("Product Type 31");
    expect(html).toContain("web.admin.config.products.description");
    expect(html).toContain("web.collections.gallery.pageStatus");
    expect(html.match(/type="checkbox"/gu)).toHaveLength(30);
  });
});
