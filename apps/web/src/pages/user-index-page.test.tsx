import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UserIndexPage } from "./user-index-page";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en-US" }),
}));

describe("UserIndexPage", () => {
  it("links to the five account destinations without logout", () => {
    const html = renderToStaticMarkup(<UserIndexPage />);

    for (const href of [
      "/user/account",
      "/user/resources",
      "/user/collections",
      "/user/settings",
      "/user/settings/beta-features",
    ]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).not.toContain("Log out");
  });
});
