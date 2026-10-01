import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PublicPlaceholderPage } from "./public-placeholder-page";

vi.mock("@/components/app-shell", () => ({
  AppShell: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: string;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "es-MX" }),
}));

it("renders a localized public placeholder", () => {
  const html = renderToStaticMarkup(
    <PublicPlaceholderPage titleKey="web.navigation.privacy" />,
  );

  expect(html).toContain("Privacidad");
  expect(html).toContain("Próximamente.");
});
