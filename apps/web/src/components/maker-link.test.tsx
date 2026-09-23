import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MakerLink } from "./maker-link";

describe("MakerLink", () => {
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
