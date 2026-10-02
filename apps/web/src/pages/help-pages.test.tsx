import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { parseHelpDocument } from "@/lib/help-content";
import { HelpIndexPage, HelpTopicPage } from "./help-pages";

vi.mock("@/components/app-shell", () => ({
  /**
   * Renders only the shell content under test.
   *
   * @param root0 - Shell properties.
   * @returns The nested page content.
   */
  AppShell: ({
    children,
  }: {
    /** Nested page content. */
    children: React.ReactNode;
  }) => <>{children}</>,
}));

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns the Spanish locale fixture.
   *
   * @returns The Spanish locale fixture.
   */
  useLocale: () => ({ locale: "es-MX" }),
}));

describe("HelpTopicPage", () => {
  it("shows only the modified date when one exists", () => {
    const document = parseHelpDocument(
      "---\ntitle: Test\ndatePublished: 2026-09-01\ndateModified: 2026-09-23\ncategory: Test\n---\nBody",
      "test",
    );
    const html = renderToStaticMarkup(
      <HelpTopicPage
        dateLabel="Date"
        dateModifiedLabel="Date Modified"
        document={document}
        helpTitle="Help"
      />,
    );

    expect(html).toContain("Date Modified:");
    expect(html).not.toContain("Date: 2026-09-01");
    expect(html).toContain('dateTime="2026-09-23"');
  });

  it("highlights trusted Markdown examples without executing their source", () => {
    const document = parseHelpDocument(
      "---\ntitle: Test\ndatePublished: 2026-09-01\ncategory: Test\n---\n```markdown\n<script>alert('unsafe')</script>\n```\n\n# Rendered result",
      "test",
    );
    const html = renderToStaticMarkup(
      <HelpTopicPage
        dateLabel="Date"
        dateModifiedLabel="Date Modified"
        document={document}
        helpTitle="Help"
      />,
    );

    expect(html).toContain('class="th-code th-code--markdown"');
    expect(html).toContain("&#x3C;script>");
    expect(html).not.toContain("<script>");
    expect(html.indexOf("th-code")).toBeLessThan(
      html.indexOf("<h1>Rendered result</h1>"),
    );
  });

  it("uses responsive GitHub palettes for both site themes", () => {
    const markdownTheme = readFileSync(
      new URL("../../../../packages/markdown/theme.css", import.meta.url),
      "utf8",
    );

    expect(markdownTheme).toContain(
      ":root .markdown-content {\n  --th-background: #ffffff;",
    );
    expect(markdownTheme).toContain(
      ".dark .markdown-content {\n  --th-background: #0d1117;",
    );
    expect(markdownTheme).toContain(
      ".markdown-content pre.th-code {\n  overflow-x: auto;",
    );
  });
});

describe("HelpIndexPage", () => {
  it("renders the Spanish help index", () => {
    const documents = [
      parseHelpDocument(
        "---\ntitle: How to Use Markdown\ndatePublished: 2026-10-01\ncategory: Writing\n---\nBody",
        "how-to-use-markdown",
      ),
      parseHelpDocument(
        "---\ntitle: Guía de tamaño y resolución de imágenes\ndatePublished: 2026-09-23\ncategory: Images\n---\nBody",
        "image-size-and-resolution-guide",
      ),
    ];
    const html = renderToStaticMarkup(<HelpIndexPage documents={documents} />);

    expect(html).toContain("Esta página todavía está en desarrollo.");
    expect(html).toContain("Temas de ayuda");
    expect(html).toContain("How to Use Markdown");
    expect(html).toContain('href="/help/how-to-use-markdown"');
    expect(html).toContain("Guía de tamaño y resolución de imágenes");
    expect(html).toContain('href="/help/image-size-and-resolution-guide"');
    expect(html).toContain("Contacto");
    expect(html).toContain("Próximamente.");
    expect(html).toContain("lg:max-w-[75%]");
  });
});
