import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ArchivePage } from "./archive-page";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
  useSearch: () => ({}),
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({
    children,
    headerActions,
  }: {
    children: React.ReactNode;
    headerActions: React.ReactNode;
  }) => (
    <div>
      <header>{headerActions}</header>
      {children}
    </div>
  ),
}));

vi.mock("@/components/filter-sidebar", () => ({
  FilterSidebar: () => <div data-autmog-filters="desktop" />,
}));

vi.mock("@/components/mobile-toolbar", () => ({
  MobileToolbar: () => <div data-autmog-toolbar="mobile" />,
}));

vi.mock("@/components/product-lightbox", () => ({
  ProductLightbox: () => null,
}));

vi.mock("@/components/pull-to-refresh", () => ({
  PullToRefresh: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/hooks/use-pen-settings", () => ({
  useCurrencyRates: () => ({ rates: { CAD: 1 }, refreshRates: vi.fn() }),
  usePenSettings: () => ({ currency: "CAD", units: "mm", weight: "g" }),
}));

vi.mock("@/lib/pen-data", () => ({ products: [] }));

vi.mock("@/providers/locale-provider", () => ({
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
