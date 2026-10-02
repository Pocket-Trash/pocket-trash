import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ArchivePage } from "./archive-page";

vi.mock("@tanstack/react-router", () => ({
  /**
   * Returns a navigation spy.
   *
   * @returns A navigation spy.
   */
  useNavigate: () => vi.fn(),
  /**
   * Returns empty route parameters.
   *
   * @returns Empty route parameters.
   */
  useParams: () => ({}),
  /**
   * Returns empty route search state.
   *
   * @returns Empty route search state.
   */
  useSearch: () => ({}),
}));

vi.mock("@/components/app-shell", () => ({
  /**
   * Renders a minimal application shell for tests.
   *
   * @param props - Shell properties.
   * @param props.children - Nested page content.
   * @param props.headerActions - Header controls.
   * @returns The test shell.
   */
  AppShell: ({
    children,
    headerActions,
  }: {
    /** Nested page content. */
    children: React.ReactNode;
    /** Header controls. */
    headerActions: React.ReactNode;
  }) => (
    <div>
      <header>{headerActions}</header>
      {children}
    </div>
  ),
}));

vi.mock("@/components/filter-sidebar", () => ({
  /**
   * Renders a desktop filter marker.
   *
   * @returns A desktop filter marker.
   */
  FilterSidebar: () => <div data-autmog-filters="desktop" />,
}));

vi.mock("@/components/mobile-toolbar", () => ({
  /**
   * Renders a mobile toolbar marker.
   *
   * @returns A mobile toolbar marker.
   */
  MobileToolbar: () => <div data-autmog-toolbar="mobile" />,
}));

vi.mock("@/components/product-lightbox", () => ({
  /**
   * Omits the product lightbox from static markup tests.
   *
   * @returns No rendered lightbox content.
   */
  ProductLightbox: () => null,
}));

vi.mock("@/components/pull-to-refresh", () => ({
  /**
   * Renders pull-to-refresh content without interaction behavior.
   *
   * @param props - Wrapper properties.
   * @param props.children - Nested page content.
   * @returns The nested content.
   */
  PullToRefresh: ({
    children,
  }: {
    /** Nested page content. */
    children: React.ReactNode;
  }) => children,
}));

vi.mock("@/hooks/use-pen-settings", () => ({
  /**
   * Returns fixed currency rates for tests.
   *
   * @returns Fixed currency rate state.
   */
  useCurrencyRates: () => ({ rates: { CAD: 1 }, refreshRates: vi.fn() }),
  /**
   * Returns fixed pen display settings for tests.
   *
   * @returns Fixed pen display settings.
   */
  usePenSettings: () => ({ currency: "CAD", units: "mm", weight: "g" }),
}));

vi.mock("@/lib/pen-data", () => ({ products: [] }));

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns fixed English locale state.
   *
   * @returns Fixed English locale state.
   */
  useLocale: () => ({ locale: "en-US" }),
}));

describe("ArchivePage", () => {
  it("owns the desktop filter layout and mobile toolbar", () => {
    const html = renderToStaticMarkup(<ArchivePage />);

    expect(html).toContain("min-[881px]:grid-cols-[290px_minmax(0,1fr)]");
    expect(html).toContain('data-autmog-filters="desktop"');
    expect(html).toContain('data-autmog-toolbar="mobile"');
    expect(html).not.toContain("Settings");
  });
});
