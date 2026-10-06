import type { PublicMaterial } from "@package/services";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MaterialDetailPage, MaterialsPage } from "./material-pages";

vi.mock("@tanstack/react-router", () => ({
  /**
   * Renders typed router links as anchors for static tests.
   *
   * @param props - Mock link properties.
   * @param props.children - Link contents.
   * @param props.params - Route parameters substituted into the path.
   * @param props.to - Parameterized destination path.
   * @returns An anchor suitable for static rendering.
   */
  Link: ({
    children,
    params = {},
    to,
  }: {
    /** Link contents. */
    children: React.ReactNode;
    /** Route parameters substituted into the path. */
    params?: Record<string, number | string>;
    /** Parameterized destination path. */
    to: string;
  }) => (
    <a
      href={Object.entries(params).reduce(
        (path, [key, value]) => path.replace(`$${key}`, String(value)),
        to,
      )}
    >
      {children}
    </a>
  ),
}));

vi.mock("@/components/app-shell", () => ({
  /**
   * Renders the page title and breadcrumb copy for static tests.
   *
   * @param props - Mock application-shell properties.
   * @param props.breadcrumbItems - Breadcrumb items to expose for assertions.
   * @param props.children - Page contents.
   * @param props.title - Page title.
   * @returns A simplified application shell.
   */
  AppShell: ({
    breadcrumbItems = [],
    children,
    title,
  }: {
    /** Breadcrumb items to expose for assertions. */
    breadcrumbItems?: Array<{
      /** Breadcrumb label. */
      label: string;
    }>;
    /** Page contents. */
    children: React.ReactNode;
    /** Page title. */
    title: string;
  }) => (
    <div
      data-breadcrumbs={breadcrumbItems.map(({ label }) => label).join(" > ")}
    >
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns the fixed test locale.
   *
   * @returns The English test locale.
   */
  useLocale: () => ({ locale: "en-US" }),
}));

/** Public material fixture used by static page tests. */
const material: PublicMaterial = {
  collectionItemCount: 0,
  collectionItems: [],
  description: "A **lightweight** metal.",
  id: 1000,
  images: [],
  leadImage: null,
  name: "Aluminum",
  productCount: 0,
  products: [],
  slug: "aluminum",
};

describe("material pages", () => {
  it("renders populated initials, muted empty initials, and an Other section", () => {
    const html = renderToStaticMarkup(
      <MaterialsPage
        materials={[
          material,
          { ...material, id: 1001, name: "Steel", slug: "steel" },
          { ...material, id: 1002, name: "# Resin", slug: "resin" },
        ]}
      />,
    );

    expect(html).toContain('href="#materials-A"');
    expect(html).toContain('href="#materials-Other"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('href="/materials/aluminum"');
    expect(html).not.toContain('id="materials-B"');
  });

  it("renders typed materials breadcrumb and independent empty relations", () => {
    const html = renderToStaticMarkup(
      <MaterialDetailPage
        collectionItemsPage={1}
        material={material}
        onCollectionItemsPageChange={vi.fn()}
        onProductsPageChange={vi.fn()}
        productsPage={1}
      />,
    );

    expect(html).toContain('data-breadcrumbs="Materials"');
    expect(html).toContain("A <strong>lightweight</strong> metal.");
    expect(html).toContain("No products use this material yet.");
    expect(html).toContain("No collection items use this material yet.");
  });
});
