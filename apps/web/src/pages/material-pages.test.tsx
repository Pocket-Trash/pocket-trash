import type { PublicMaterial } from "@package/services";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MaterialLink } from "@/components/material-link";
import { materialHead, materialSearchSchema } from "@/lib/materials";
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
  specific: null,
  specifics: [],
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

describe("material specifics", () => {
  it("links canonical general and specific assignments using the appropriate name and route", () => {
    const html = renderToStaticMarkup(
      <>
        <MaterialLink material={material} />
        <MaterialLink
          material={{
            ...material,
            specific: { id: 2000, name: "Aluminum 6061", slug: "6061" },
          }}
        />
      </>,
    );
    expect(html).toContain('href="/materials/aluminum"');
    expect(html).toContain('href="/materials/aluminum/6061"');
    expect(html).toContain(">Aluminum 6061</a>");
  });

  it("renders scoped title, parent breadcrumb, and normal empty states on the shared detail page", () => {
    const exact: PublicMaterial = {
      ...material,
      specific: {
        id: 2000,
        materialId: material.id,
        name: "Aluminum 6061",
        slug: "6061",
        description: null,
      },
    };
    const html = renderToStaticMarkup(
      <MaterialDetailPage
        collectionItemsPage={1}
        material={exact}
        onCollectionItemsPageChange={vi.fn()}
        onProductsPageChange={vi.fn()}
        productsPage={1}
      />,
    );
    expect(html).toContain('data-breadcrumbs="Materials &gt; Aluminum"');
    expect(html).toContain("<h1>Aluminum 6061</h1>");
    expect(html).toContain("A <strong>lightweight</strong> metal.");
    expect(html).toContain("No products use this alloy or grade yet.");
    expect(html).toContain("No collection items use this alloy or grade yet.");
    expect(html).toContain(
      "No images have been added for this alloy or grade.",
    );
    expect(materialHead(exact).meta).toContainEqual({
      name: "robots",
      content: "noindex,follow",
    });
    expect(materialHead(exact).links?.[0]?.href).toMatch(
      /\/materials\/aluminum\/6061$/,
    );
    expect(materialHead({ ...exact, productCount: 1 }).meta).toContainEqual({
      name: "robots",
      content: "index,follow",
    });
    expect(
      materialHead({ ...exact, collectionItemCount: 1 }).meta,
    ).toContainEqual({ name: "robots", content: "index,follow" });
    expect(
      materialHead({
        ...exact,
        images: [
          {
            contentType: "image/webp",
            createdAt: new Date(),
            deletedAt: null,
            deletedByClerkId: null,
            deletedByRole: null,
            fileName: "one.webp",
            id: 1,
            objectPath: "one.webp",
            position: 0,
            size: 1,
            url: "https://cdn.test/one.webp",
          },
        ],
      }).meta,
    ).toContainEqual({ name: "robots", content: "index,follow" });
  });

  it("renders non-empty child links and one gallery without scope headings", () => {
    const html = renderToStaticMarkup(
      <MaterialDetailPage
        collectionItemsPage={1}
        material={{
          ...material,
          specifics: [
            {
              id: 2000,
              materialId: material.id,
              name: "Aluminum 6061",
              slug: "6061",
              description: null,
              productCount: 1,
              collectionItemCount: 0,
              leadImage: null,
            },
          ],
          images: ["general", "alpha", "beta"].map((fileName, id) => ({
            contentType: "image/webp",
            createdAt: new Date(),
            deletedAt: null,
            deletedByClerkId: null,
            deletedByRole: null,
            fileName,
            id,
            objectPath: fileName,
            position: 0,
            size: 1,
            url: `https://cdn.test/${fileName}`,
          })),
        }}
        onCollectionItemsPageChange={vi.fn()}
        onProductsPageChange={vi.fn()}
        productsPage={1}
      />,
    );
    expect(html).toContain('href="/materials/aluminum/6061"');
    expect(html.match(/<section aria-label="Images"/g)).toHaveLength(1);
    expect(html.indexOf("general")).toBeLessThan(html.indexOf("alpha"));
    expect(html.indexOf("alpha")).toBeLessThan(html.indexOf("beta"));
    expect(html).not.toContain('<h2 class="m-0 text-lg font-semibold">');
  });

  it("normalizes both pagination parameters independently", () => {
    expect(
      materialSearchSchema.parse({
        productsPage: "2",
        collectionItemsPage: "3",
      }),
    ).toEqual({ productsPage: 2, collectionItemsPage: 3 });
    expect(
      materialSearchSchema.parse({
        productsPage: "bad",
        collectionItemsPage: "3",
      }),
    ).toEqual({ productsPage: 1, collectionItemsPage: 3 });
  });
});
