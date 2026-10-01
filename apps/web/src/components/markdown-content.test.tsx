import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "./markdown-content";

describe("MarkdownContent", () => {
  it("enables fenced code only for trusted repository content", () => {
    const markdown = "```markdown\n# Heading\n```";
    const userHtml = renderToStaticMarkup(
      <MarkdownContent markdown={markdown} />,
    );
    const trustedHtml = renderToStaticMarkup(
      <MarkdownContent markdown={markdown} trustedCodeBlocks />,
    );

    expect(userHtml).toContain("# Heading");
    expect(userHtml).not.toContain("<code");
    expect(trustedHtml).toContain('class="th-code th-code--markdown"');
  });
});
