import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PageFooter } from "./page-footer";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en-US" }),
}));

it("renders the site links, accessible social links, and supplied year", () => {
  const html = renderToStaticMarkup(<PageFooter year={2026} />);

  expect(html).toContain("Made by EDC fans for EDC fans");
  expect(html).toContain("© 2026 Pocket Trash");

  for (const href of [
    "/",
    "/changelog",
    "/help",
    "/contact",
    "/feedback",
    "/privacy",
    "/terms-of-service",
  ]) {
    expect(html).toContain(`href="${href}"`);
  }

  expect(html).toContain('href="https://x.com/pockettrashapp"');
  expect(html).toContain('aria-label="X (opens in a new tab)"');
  expect(html).toContain('href="https://discord.gg/jQWqfnCX73"');
  expect(html).toContain('aria-label="Discord (opens in a new tab)"');
  expect(html.match(/target="_blank"/g)).toHaveLength(2);
  expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(2);
  expect(html).not.toContain("machinedpens");
  expect(html).not.toContain("BVG_Digital");
});
