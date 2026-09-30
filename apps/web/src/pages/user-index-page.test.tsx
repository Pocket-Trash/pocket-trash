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
  it("links to feedback without showing My Requests when none exist", () => {
    const html = renderToStaticMarkup(<UserIndexPage hasFeedback={false} />);

    for (const href of [
      "/user/account",
      "/user/resources",
      "/user/collections",
      "/user/settings",
      "/user/settings/beta-features",
      "/feedback",
      "/feedback/new",
    ]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).not.toContain('href="/feedback/my-requests"');
    expect(html).not.toContain("Log out");
  });

  it("shows My Requests when eligible feedback exists", () => {
    const html = renderToStaticMarkup(<UserIndexPage hasFeedback />);

    expect(html).toContain('href="/feedback/my-requests"');
  });
});
