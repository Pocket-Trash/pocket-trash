import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UserSettingsPage } from "./user-settings-page";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/components/user-page-shell", () => ({
  UserPageShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));

vi.mock("@/hooks/use-pen-settings", () => ({
  usePenSettings: () => ({
    currency: "USD",
    saving: false,
    setCurrency: vi.fn(),
    setUnits: vi.fn(),
    setWeight: vi.fn(),
    units: "in",
    weight: "g",
  }),
}));

vi.mock("@/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en-US" }),
}));

describe("UserSettingsPage", () => {
  it("renders display preferences and links to beta features", () => {
    const html = renderToStaticMarkup(<UserSettingsPage />);

    expect(html).toContain('aria-label="Dimension units"');
    expect(html).toContain('aria-label="Weight units"');
    expect(html).toContain('aria-label="Display currency"');
    expect(html).toContain('href="/user/settings/beta-features"');
  });
});
