import type { PublicMakerDetail } from "@package/services";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MakerDetailPage } from "./maker-detail-page";

/** Properties for the test application shell. */
interface TestAppShellProps {
  /** Nested page content. */
  children: React.ReactNode;
}

/** One image group supplied to the test gallery. */
interface TestImageGroup {
  /** Images in the group. */
  images: unknown[];
}

/** Properties for the test image gallery. */
interface TestImageGalleryProps {
  /** Image groups to summarize. */
  groups: TestImageGroup[];
}

/** Properties for the test Markdown renderer. */
interface TestMarkdownProps {
  /** Markdown source. */
  markdown: string;
}

vi.mock("@tanstack/react-router", () => ({
  /**
   * Renders route links as anchors for static tests.
   *
   * @param root0 - Test link properties.
   * @param root0.children - Linked content.
   * @param root0.to - Route destination.
   * @returns A static route anchor.
   */
  Link: ({
    children,
    to,
  }: {
    /** Linked content. */
    children: React.ReactNode;
    /** Route destination. */
    to: string;
  }) => <a href={to}>{children}</a>,
  /**
   * Supplies a navigation stub to unrelated imported catalog pages.
   *
   * @returns A navigation spy.
   */
  useNavigate: () => vi.fn(),
}));

vi.mock("@/components/app-shell", () => ({
  /**
   * Renders only page content in maker detail tests.
   *
   * @param root0 - Test shell properties.
   * @param root0.children - Nested page content.
   * @returns The nested page content.
   */
  AppShell: ({ children }: TestAppShellProps) => <>{children}</>,
}));

vi.mock("@/components/image-gallery", () => ({
  /**
   * Renders deterministic gallery metadata.
   *
   * @param root0 - Test gallery properties.
   * @param root0.groups - Image groups to summarize.
   * @returns Deterministic image-count metadata.
   */
  ImageGallery: ({ groups }: TestImageGalleryProps) => (
    <div data-image-count={groups.flatMap(({ images }) => images).length} />
  ),
}));

vi.mock("@/components/markdown-content", () => ({
  /**
   * Renders deterministic Markdown source.
   *
   * @param root0 - Test Markdown properties.
   * @param root0.markdown - Markdown source.
   * @returns Deterministic Markdown metadata.
   */
  MarkdownContent: ({ markdown }: TestMarkdownProps) => (
    <div data-markdown={markdown} />
  ),
}));

vi.mock("@/lib/catalog-copy", () => ({
  /**
   * Returns localization keys for deterministic assertions.
   *
   * @returns Deterministic translation formatter.
   */
  useCatalogCopy: () => testCatalogCopy,
}));

/**
 * Returns a localization key unchanged.
 *
 * @param key - Translation key.
 * @returns The supplied key.
 */
function testCatalogCopy(key: string) {
  return key;
}

describe("MakerDetailPage", () => {
  it("omits absent optional profile regions and renders related empty states", () => {
    const html = renderToStaticMarkup(
      <MakerDetailPage
        collectionItemsPage={0}
        maker={maker()}
        onCollectionItemsPageChange={vi.fn()}
        onProductsPageChange={vi.fn()}
        productsPage={0}
      />,
    );

    expect(html).not.toContain("data-image-count");
    expect(html).not.toContain("data-markdown");
    expect(html).not.toContain('target="_blank"');
    expect(html).toContain("web.makers.noProducts");
    expect(html).toContain("web.makers.noCollectionItems");
  });

  it("renders active images, Markdown, and a safe external website link", () => {
    const html = renderToStaticMarkup(
      <MakerDetailPage
        collectionItemsPage={0}
        maker={{
          ...maker(),
          description: "Maker **story**",
          images: [
            {
              contentType: "image/png",
              createdAt: new Date(0),
              deletedAt: null,
              deletedByClerkId: null,
              deletedByRole: null,
              fileName: "maker.png",
              id: 1,
              objectPath: "makers/maker.png",
              position: 0,
              size: 12,
              url: "https://cdn.test/maker.png",
            },
          ],
          rootUrl: "https://maker.test",
        }}
        onCollectionItemsPageChange={vi.fn()}
        onProductsPageChange={vi.fn()}
        productsPage={0}
      />,
    );

    expect(html).toContain('data-image-count="1"');
    expect(html).toContain('data-markdown="Maker **story**"');
    expect(html).toContain('href="https://maker.test"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});

/**
 * Creates an empty public maker detail fixture.
 *
 * @returns Public maker detail without optional profile data.
 */
function maker(): PublicMakerDetail {
  return {
    collectionItems: [],
    description: null,
    id: 1,
    images: [],
    name: "Maker",
    products: [],
    rootUrl: null,
    slug: "maker",
  };
}
