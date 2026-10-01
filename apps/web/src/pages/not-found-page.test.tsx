import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { NotFoundPage } from "./not-found-page";

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns the English locale fixture.
   *
   * @returns The English locale fixture.
   */
  useLocale: () => ({ locale: "en-US" }),
}));

it("returns home with a native document request", () => {
  const html = renderToStaticMarkup(<NotFoundPage />);

  expect(html).toContain('href="/"');
  expect(html).toContain("Return home");
  expect(html).not.toContain("Return to archive");
});
