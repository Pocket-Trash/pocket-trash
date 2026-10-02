import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UserSettingsPage } from "./user-settings-page";

vi.mock("@tanstack/react-router", () => ({
  /**
   * Renders router links as native anchors.
   *
   * @param root0 - Link properties.
   * @returns The anchor fixture.
   */
  Link: ({
    children,
    to,
  }: {
    /** Link content. */
    children: React.ReactNode;
    /** Link destination. */
    to: string;
  }) => <a href={to}>{children}</a>,
}));

vi.mock("@/components/user-page-shell", () => ({
  /**
   * Renders a minimal user-page shell.
   *
   * @param root0 - Shell properties.
   * @returns The shell fixture.
   */
  UserPageShell: ({
    children,
  }: {
    /** Nested settings content. */
    children: React.ReactNode;
  }) => <main>{children}</main>,
}));

vi.mock("@/hooks/use-pen-settings", () => ({
  /**
   * Returns stable display-preference fixtures.
   *
   * @returns The display-preference fixtures.
   */
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
  /**
   * Returns the English locale fixture.
   *
   * @returns The English locale fixture.
   */
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
