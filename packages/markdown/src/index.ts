import { createHighlighter } from "@tanstack/highlight/core";
import { markdown as markdownLanguage } from "@tanstack/highlight/languages/markdown";
import { rehypeHighlightCodeBlocks } from "@tanstack/highlight/rehype";
import type { Element, Root as HtmlRoot } from "hast";
import type { Code, Root as MarkdownRoot, RootContent } from "mdast";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import type { Options as SanitizeSchema } from "rehype-sanitize";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { SKIP, visit } from "unist-util-visit";

/** Converts HTML fragments to GitHub Flavored Markdown. */
const htmlToMarkdownProcessor = unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeRemark)
  .use(remarkGfm)
  .use(remarkStringify, {
    bullet: "-",
    fences: true,
  });

/** Parses raw HTML fragments so unsupported markup can retain its text. */
const htmlFragmentParser = unified().use(rehypeParse, { fragment: true });

/** Highlights trusted fences with only the Markdown language registered. */
const markdownHighlighter = createHighlighter({
  languages: [markdownLanguage],
});

/** Element names admitted by every Markdown read path. */
const baseTagNames = [
  "a",
  "blockquote",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "hr",
  "li",
  "ol",
  "p",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
];

/** Sanitizer contract shared by user, scraped, and trusted Markdown. */
const baseSanitizeSchema: SanitizeSchema = {
  tagNames: baseTagNames,
  attributes: {
    a: ["href", ["rel", "noopener", "noreferrer"], ["target", "_blank"]],
    ol: ["start"],
    td: [["align", "left", "center", "right"]],
    th: [["align", "left", "center", "right"]],
  },
  protocols: {
    href: ["http", "https"],
  },
};

/** Fixed TanStack Highlight classes admitted for trusted code output. */
const highlightTokenClasses = [
  "th-token",
  "th-attr",
  "th-code-inline",
  "th-command",
  "th-comment",
  "th-deleted",
  "th-function",
  "th-heading",
  "th-inserted",
  "th-keyword",
  "th-link",
  "th-literal",
  "th-meta",
  "th-number",
  "th-operator",
  "th-property",
  "th-selector",
  "th-string",
  "th-tag",
  "th-type",
  "th-variable",
];

/** Sanitizer extension for trusted fenced code blocks. */
const trustedSanitizeSchema: SanitizeSchema = {
  ...baseSanitizeSchema,
  tagNames: [...baseTagNames, "code", "pre", "span"],
  attributes: {
    ...baseSanitizeSchema.attributes,
    pre: [
      ["className", "th-code", "th-code--markdown", "th-code--plaintext"],
      ["dataLanguage", "markdown", "plaintext"],
    ],
    span: [["className", ...highlightTokenClasses]],
  },
};

/** Options that grant trusted repository content its fenced-code capability. */
export type MarkdownRenderOptions = Readonly<{
  /** Enables fenced code while leaving indented code disabled. */
  trustedCodeBlocks?: boolean;
}>;

/** Shared processors for the base and trusted Markdown capabilities. */
const markdownToHtmlProcessors = {
  base: createMarkdownToHtmlProcessor(false),
  trusted: createMarkdownToHtmlProcessor(true),
};

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
 * @param options - Capabilities granted to the Markdown source.
 * @returns Sanitized HTML, or `null` when the input or output is empty.
 */
export function markdownToHtml(
  markdown: string | null | undefined,
  options: MarkdownRenderOptions = {},
): string | null {
  if (!markdown) {
    return null;
  }

  const processor = options.trustedCodeBlocks
    ? markdownToHtmlProcessors.trusted
    : markdownToHtmlProcessors.base;
  const html = String(processor.processSync(markdown)).trim();

  return html.length > 0 ? html : null;
}

/**
 * Creates one synchronous Markdown processor for a capability level.
 *
 * @param trustedCodeBlocks - Whether fenced code reaches the highlighter.
 * @returns A processor whose final step is the capability-specific sanitizer.
 */
function createMarkdownToHtmlProcessor(trustedCodeBlocks: boolean) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkSafeMarkdown, { trustedCodeBlocks })
    .use(remarkRehype);

  if (trustedCodeBlocks) {
    processor.use(rehypeTrustedCodeBlocks);
  }

  return processor
    .use(rehypeSafeLinks)
    .use(
      rehypeSanitize,
      trustedCodeBlocks ? trustedSanitizeSchema : baseSanitizeSchema,
    )
    .use(rehypeStringify);
}

/**
 * Adapts TanStack Highlight's first-party rehype transformer to unified.
 *
 * @returns A transformer that highlights fenced code synchronously.
 */
function rehypeTrustedCodeBlocks() {
  const highlight = rehypeHighlightCodeBlocks({
    highlighter: markdownHighlighter,
  });
  return (tree: HtmlRoot) => highlight(tree as never);
}

/**
 * Downgrades unsupported Markdown nodes before they become HTML.
 *
 * @param options - Capability level for fenced code.
 * @returns A unified transformer for Markdown syntax trees.
 */
function remarkSafeMarkdown(options: MarkdownRenderOptions) {
  /**
   * Rewrites unsupported nodes before HTML conversion.
   *
   * @param tree - Parsed Markdown syntax tree.
   * @param file - Source file used to distinguish fences from indentation.
   */
  const transform = (
    tree: MarkdownRoot,
    file: { /** Original Markdown source. */ value: unknown },
  ) => {
    const source = String(file.value);

    visit(tree, (node, index, parent) => {
      if (index === undefined || !parent) return;

      if (node.type === "heading" && node.depth > 3) {
        parent.children[index] = {
          type: "paragraph",
          children: node.children,
        } as RootContent;
        return [SKIP, index];
      }

      if (node.type === "code") {
        if (options.trustedCodeBlocks && isFencedCode(node, source)) return;
        parent.children[index] = textParagraph(node.value);
        return [SKIP, index];
      }

      if (node.type === "inlineCode") {
        parent.children[index] = { type: "text", value: node.value };
        return [SKIP, index];
      }

      if (node.type === "image" || node.type === "imageReference") {
        parent.children[index] = { type: "text", value: node.alt ?? "" };
        return [SKIP, index];
      }

      if (node.type === "html") {
        parent.children[index] = {
          type: "text",
          value: htmlFragmentText(node.value),
        };
        return [SKIP, index];
      }

      if (node.type === "listItem" && node.checked !== null) {
        node.checked = null;
      }

      if (node.type === "footnoteReference") {
        parent.children[index] = {
          type: "text",
          value: `[${node.label ?? node.identifier}]`,
        };
        return [SKIP, index];
      }

      if (node.type === "footnoteDefinition") {
        parent.children[index] = textParagraph(markdownNodeText(node));
        return [SKIP, index];
      }
    });
  };

  return transform;
}

/**
 * Applies link behavior before the final sanitizer.
 *
 * @returns A unified transformer for HTML syntax trees.
 */
function rehypeSafeLinks() {
  return (tree: HtmlRoot) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "a" || index === undefined || !parent) return;

      const href = node.properties.href;
      const link = typeof href === "string" ? safeLink(href) : null;
      if (!link) {
        parent.children.splice(index, 1, ...node.children);
        return [SKIP, index];
      }

      node.properties.href = link.href;
      if (link.external) {
        node.properties.target = "_blank";
        node.properties.rel = ["noopener", "noreferrer"];
      } else {
        delete node.properties.target;
        delete node.properties.rel;
      }
    });
  };
}

/**
 * Creates a paragraph containing downgraded plain text.
 *
 * @param value - Readable content from unsupported syntax.
 * @returns A Markdown paragraph node.
 */
function textParagraph(value: string): RootContent {
  return { type: "paragraph", children: [{ type: "text", value }] };
}

/**
 * Checks whether a parsed code node came from a Markdown fence.
 *
 * @param node - Parsed Markdown code node.
 * @param source - Original Markdown source.
 * @returns Whether the code starts with a backtick or tilde fence.
 */
function isFencedCode(node: Code, source: string): boolean {
  const offset = node.position?.start.offset;
  return (
    typeof offset === "number" && /^(?:`{3,}|~{3,})/.test(source.slice(offset))
  );
}

/**
 * Extracts readable text from a raw HTML fragment.
 *
 * @param html - Unsupported raw HTML from Markdown.
 * @returns Concatenated text without executable markup.
 */
function htmlFragmentText(html: string): string {
  return htmlNodeText(htmlFragmentParser.parse(html));
}

/**
 * Recursively collects text from an unknown HTML syntax-tree node.
 *
 * @param node - Candidate HTML syntax-tree node.
 * @returns Text contained by the node and its descendants.
 */
function htmlNodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  if ("value" in node && typeof node.value === "string") return node.value;
  if (
    "tagName" in node &&
    node.tagName === "img" &&
    "properties" in node &&
    node.properties &&
    typeof node.properties === "object" &&
    "alt" in node.properties &&
    typeof node.properties.alt === "string"
  ) {
    return node.properties.alt;
  }
  if (!("children" in node) || !Array.isArray(node.children)) return "";
  return node.children.map(htmlNodeText).join("");
}

/**
 * Recursively collects readable text from a Markdown syntax-tree node.
 *
 * @param node - Candidate Markdown syntax-tree node.
 * @returns Text contained by the node and its descendants.
 */
function markdownNodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("alt" in node && typeof node.alt === "string") return node.alt;
  if (!("children" in node) || !Array.isArray(node.children)) return "";
  return node.children.map(markdownNodeText).join(" ");
}

/**
 * Classifies a destination and normalizes safe external schemes.
 *
 * @param href - Destination emitted by the Markdown parser.
 * @returns Safe destination metadata, or `null` for an unsafe destination.
 */
function safeLink(href: string): {
  /** Whether the destination leaves the application. */
  external: boolean;
  /** Sanitized destination retained in the rendered anchor. */
  href: string;
} | null {
  let decoded = href;
  while (true) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return null;
    }
  }

  const compact = decoded.replace(/[\u0000-\u0020\u007f]+/g, "");
  if (!compact || compact.startsWith("//")) return null;

  const scheme = compact.match(/^([a-z][a-z0-9+.-]*):/i)?.[1];
  if (!scheme) return { external: false, href };
  if (!/^https?$/i.test(scheme)) return null;

  return {
    external: true,
    href: href.replace(/^[a-z][a-z0-9+.-]*:/i, `${scheme.toLowerCase()}:`),
  };
}
