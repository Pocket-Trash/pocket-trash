import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

/** Converts HTML fragments to GitHub Flavored Markdown. */
const htmlToMarkdownProcessor = unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeRemark)
  .use(remarkGfm)
  .use(remarkStringify, {
    bullet: "-",
    fences: true,
  });

/** Converts GitHub Flavored Markdown to sanitized HTML fragments. */
const markdownToHtmlProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify);

/**
 * Converts an HTML fragment to trimmed GitHub Flavored Markdown.
 *
 * @param html - HTML fragment to convert.
 * @returns Converted Markdown, or `null` when the input or output is empty.
 */
export function htmlToMarkdown(html: string | null | undefined): string | null {
  if (!html) {
    return null;
  }

  const markdown = String(htmlToMarkdownProcessor.processSync(html)).trim();

  return markdown.length > 0 ? markdown : null;
}

/**
 * Converts GitHub Flavored Markdown to a sanitized HTML fragment.
 *
 * @param markdown - Markdown source to convert.
 * @returns Sanitized HTML, or `null` when the input or output is empty.
 */
export function markdownToHtml(
  markdown: string | null | undefined,
): string | null {
  if (!markdown) {
    return null;
  }

  const html = String(markdownToHtmlProcessor.processSync(markdown)).trim();

  return html.length > 0 ? html : null;
}
