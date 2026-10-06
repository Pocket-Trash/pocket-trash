import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MakerLink } from "./maker-link";

vi.mock("@tanstack/react-router", () => ({
  /**
   * Renders typed links as anchors in static tests.
   *
   * @param root0 - Test link properties.
   * @param root0.children - Linked content.
   * @param root0.params - Maker route parameters.
   * @returns A static maker anchor.
   */
  Link: ({
    children,
    params,
  }: {
    /** Linked content. */
    children: React.ReactNode;
    /** Maker route parameters. */
    params: {
      /** Stable maker slug. */
      slug: string;
    };
  }) => <a href={`/makers/${params.slug}`}>{children}</a>,
}));

describe("MakerLink", () => {
  it("links stable maker slugs to internal profiles", () => {
    const html = renderToStaticMarkup(
      <MakerLink name="KAP EDC" slug="kap-edc" />,
    );

    expect(html).toContain('href="/makers/kap-edc"');
    expect(html).not.toContain('target="_blank"');
  });

  it("opens saved maker URLs in a new tab", () => {
    const html = renderToStaticMarkup(
      <MakerLink name="KAP EDC" url="https://www.kapedc.com" />,
    );

    expect(html).toContain('href="https://www.kapedc.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("renders plain text without a saved URL", () => {
    const html = renderToStaticMarkup(<MakerLink name="Unknown" url={null} />);

    expect(html).toBe("<span>Unknown</span>");
  });
});
