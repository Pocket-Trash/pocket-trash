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
    accountSettingsLoadFailed: false,
    accountSettingsLoaded: true,
    currency: "USD",
    isProfilePublic: false,
    measurementSystem: "metric",
    publishTrends: false,
    saving: false,
    setCurrency: vi.fn(),
    setIsProfilePublic: vi.fn(),
    setMeasurementSystem: vi.fn(),
    setPublishTrends: vi.fn(),
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

    expect(html).toContain('aria-label="Measurement system options"');
    expect(html.indexOf("Profile visibility")).toBeLessThan(
      html.indexOf("Measurement system"),
    );
    expect(html.match(/\bmy-12\b/g)).toHaveLength(3);
    expect(html).toContain('role="switch"');
    expect(html).toContain("Metric");
    expect(html).toContain("Imperial");
    expect(html).toContain('aria-label="Display currency"');
    expect(html).toContain('href="/user/settings/beta-features"');
    expect(html).toContain("Publish Trends");
    expect(html).toContain("Private");
  });
});
