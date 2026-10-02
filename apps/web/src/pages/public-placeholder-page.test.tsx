import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PublicPlaceholderPage } from "./public-placeholder-page";

vi.mock("@/components/app-shell", () => ({
  /**
   * Renders a minimal titled shell for placeholder assertions.
   *
   * @param root0 - Shell properties.
   * @returns The titled shell fixture.
   */
  AppShell: ({
    children,
    title,
  }: {
    /** Nested placeholder content. */
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
   * Returns the Spanish locale fixture.
   *
   * @returns The Spanish locale fixture.
   */
  useLocale: () => ({ locale: "es-MX" }),
}));

it("renders a localized public placeholder", () => {
  const html = renderToStaticMarkup(
    <PublicPlaceholderPage titleKey="web.navigation.privacy" />,
  );

  expect(html).toContain("Privacidad");
  expect(html).toContain("Próximamente.");
  expect(html).toContain("lg:max-w-[75%]");
});
