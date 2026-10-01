import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("@clerk/tanstack-react-start", () => ({
  /**
   * Returns a loaded, signed-out authentication state.
   *
   * @returns The authentication state consumed by the shell.
   */
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
}));

vi.mock("@tanstack/react-router", () => ({
  /**
   * Renders router links as plain anchors for server rendering.
   *
   * @param input - Link rendering input.
   * @param input.children - Link contents.
   * @returns A plain anchor targeting the test root.
   */
  Link: ({
    children,
  }: {
    /** Link contents. */
    children: React.ReactNode;
  }) => <a href="/">{children}</a>,
}));

vi.mock("@/components/language-select", () => ({
  /**
   * Renders a stable language-selector marker.
   *
   * @returns The language-selector marker.
   */
  LanguageSelect: () => <span>language-control</span>,
}));

vi.mock("@/components/theme-toggle", () => ({
  /**
   * Renders a stable theme-toggle marker.
   *
   * @returns The theme-toggle marker.
   */
  ThemeToggle: () => <span>theme-control</span>,
}));

vi.mock("@/components/user-menu", () => ({
  /**
   * Renders a stable account-control marker.
   *
   * @returns The account-control marker.
   */
  UserMenu: () => <span>account-control</span>,
}));

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns fixed English locale state with a spy setter.
   *
   * @returns Locale state consumed by the shell.
   */
  useLocale: () => ({ locale: "en-US", setLocale: vi.fn() }),
  /**
   * Provides the optional locale consumed by the provider-independent header.
   *
   * @returns The test locale.
   */
  useOptionalLocale: () => "en-US",
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
    expect(html).toContain("container mx-auto");
    expect(html).not.toContain("flex-1 flex justify-center");
    expect(html).not.toContain("<footer>footer</footer>");

    const language = html.indexOf("language-control");
    const theme = html.indexOf("theme-control");
    const account = html.indexOf("account-control");

    expect(language).toBeGreaterThan(-1);
    expect(language).toBeLessThan(theme);
    expect(theme).toBeLessThan(account);
  });
});
