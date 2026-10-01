import { describe, expect, it } from "vitest";
import {
  downgradeMarkdownCodeBlocks,
  htmlToMarkdown,
  markdownToHtml,
} from "./index.js";

describe("htmlToMarkdown", () => {
  it("converts Shopify-style HTML to markdown", () => {
    expect(
      htmlToMarkdown(
        '<p>Machined <strong>titanium</strong> pen with <a href="https://example.com">details</a>.</p>',
      ),
    ).toBe("Machined **titanium** pen with [details](https://example.com).");
  });

  it("preserves images and list structure", () => {
    expect(
      htmlToMarkdown(
        '<ul><li>One</li><li>Two</li></ul><p><img src="https://example.com/pen.jpg" alt="Pen"></p>',
      ),
    ).toBe("- One\n- Two\n\n![Pen](https://example.com/pen.jpg)");
  });

  it("returns null for empty input", () => {
    expect(htmlToMarkdown(null)).toBeNull();
    expect(htmlToMarkdown("")).toBeNull();
  });
});

describe("downgradeMarkdownCodeBlocks", () => {
  it("removes true fenced and indented code syntax", () => {
    expect(
      downgradeMarkdownCodeBlocks(
        "before\n\n````markdown\n``` stays text\n````\n\n    indented\n\nafter",
      ),
    ).toBe("before\n\n``` stays text\n\nindented\n\nafter");
  });

  it("preserves supported nested-list indentation", () => {
    const markdown = "- parent\n    - child";
    expect(downgradeMarkdownCodeBlocks(markdown)).toBe(markdown);
  });
});

describe("markdownToHtml", () => {
  it.each([
    ["paragraphs", "Plain text", "<p>Plain text</p>"],
    ["heading 1", "# One", "<h1>One</h1>"],
    ["heading 2", "## Two", "<h2>Two</h2>"],
    ["heading 3", "### Three", "<h3>Three</h3>"],
    ["bold", "**Bold**", "<strong>Bold</strong>"],
    ["italic", "*Italic*", "<em>Italic</em>"],
    [
      "combined bold and italic",
      "***Combined***",
      "<em><strong>Combined</strong></em>",
    ],
    ["strikethrough", "~~Removed~~", "<del>Removed</del>"],
    ["relative links", "[Help](/help)", '<a href="/help">Help</a>'],
    ["unordered lists", "- One\n- Two", "<ul>"],
    ["ordered lists", "1. One\n2. Two", "<ol>"],
    ["tables", "| A | B |\n| - | - |\n| 1 | 2 |", "<table>"],
    ["horizontal rules", "---", "<hr>"],
    ["blockquotes", "> Quoted", "<blockquote>"],
  ])("renders supported %s", (_name, markdown, expected) => {
    expect(markdownToHtml(markdown)).toContain(expected);
  });

  it.each([
    ["heading 4", "#### Heading", "Heading", "<h4"],
    ["fenced code", "```\nconst x = 1;\n```", "const x = 1;", "<code"],
    ["indented code", "    const x = 1;", "const x = 1;", "<code"],
    ["task lists", "- [x] Done", "Done", "<input"],
    ["footnotes", "Text[^1]\n\n[^1]: Footnote", "Footnote", "<sup"],
    [
      "images",
      "![Pen photo](https://example.com/pen.jpg)",
      "Pen photo",
      "<img",
    ],
    [
      "raw HTML images",
      '<img src="https://example.com/pen.jpg" alt="Raw pen photo">',
      "Raw pen photo",
      "<img",
    ],
    ["inline code", "Use `code` here", "code", "<code"],
    [
      "raw HTML",
      '<b>Readable</b><script>alert("x")</script>',
      "Readable",
      "<script",
    ],
  ])("downgrades unsupported %s to readable text", (_name, markdown, text, tag) => {
    const html = markdownToHtml(markdown);

    expect(html).toContain(text);
    expect(html).not.toContain(tag);
  });

  it("opens only external HTTP links in a new tab", () => {
    const relative = markdownToHtml("[Help](../help)");
    const external = markdownToHtml("[Site](HtTpS://example.com/path)");

    expect(relative).toContain('<a href="../help">Help</a>');
    expect(relative).not.toContain("target=");
    expect(external).toContain('target="_blank"');
    expect(external).toContain('rel="noopener noreferrer"');
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java%73cript:alert(1)",
    "javascript%3Aalert(1)",
    "%2525256A%25252561%25252576%25252561%25252573%25252563%25252572%25252569%25252570%25252574%2525253Aalert(1)",
    "java%0Ascript:alert(1)",
    "java\u0000script:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "//example.com/path",
  ])("keeps unsafe destination %s inert", (url) => {
    const html = markdownToHtml(`[unsafe](${url})`);

    expect(html).toContain("unsafe");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("target=");
  });

  it("removes executable attributes and styles", () => {
    const html = markdownToHtml(
      '<a href="https://example.com" onclick="alert(1)" style="color:red">Safe label</a>',
    );

    expect(html).toContain("Safe label");
    expect(html).not.toMatch(/onclick|style=|<a/);
  });

  it("highlights trusted Markdown fences before final sanitization", () => {
    const html = markdownToHtml("```markdown\n# Heading\n```", {
      trustedCodeBlocks: true,
    });

    expect(html).toContain('<pre class="th-code th-code--markdown"');
    expect(html).toContain('data-language="markdown"');
    expect(html).toContain("th-heading");
    expect(html).not.toContain("style=");
  });

  it("escapes unknown trusted fence languages as plain code", () => {
    const html = markdownToHtml(
      "```javascript\n<script>alert('x')</script>\n```",
      { trustedCodeBlocks: true },
    );

    expect(html).toContain('<pre class="th-code th-code--plaintext"');
    expect(html).toContain('data-language="plaintext"');
    expect(html).toContain("&#x3C;script>alert('x')&#x3C;/script>");
    expect(html).not.toContain("<script");
  });

  it("still downgrades indented code for trusted content", () => {
    const html = markdownToHtml("    const x = 1;", {
      trustedCodeBlocks: true,
    });

    expect(html).toContain("const x = 1;");
    expect(html).not.toContain("<code");
  });
});
