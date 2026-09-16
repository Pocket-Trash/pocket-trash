import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("@clerk/tanstack-react-start", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));

vi.mock("@/components/language-select", () => ({
  LanguageSelect: () => <span>language-control</span>,
}));

vi.mock("@/components/page-footer", () => ({
  PageFooter: () => <footer>footer</footer>,
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <span>theme-control</span>,
}));

vi.mock("@/components/user-menu", () => ({
  UserMenu: () => <span>account-control</span>,
}));

vi.mock("@/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en-US", setLocale: vi.fn() }),
}));

describe("AppShell", () => {
  it("renders shared page chrome without global sidebar controls", () => {
    const html = renderToStaticMarkup(
      <AppShell
        breadcrumbItems={[{ label: "Products", to: "/products" }]}
        title="Add product"
      >
        <main>content</main>
      </AppShell>,
    );

    expect(html).toContain("Pocket Trash");
    expect(html).toContain("Products");
    expect(html).toContain("Add product");
    expect(html).not.toContain('data-slot="sidebar"');

    const language = html.indexOf("language-control");
    const theme = html.indexOf("theme-control");
    const account = html.indexOf("account-control");

    expect(language).toBeGreaterThan(-1);
    expect(language).toBeLessThan(theme);
    expect(theme).toBeLessThan(account);
  });
});
