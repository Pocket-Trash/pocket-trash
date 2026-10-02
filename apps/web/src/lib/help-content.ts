import {
  formatTranslation,
  type SupportedLocale,
} from "@pocket-trash/localizations";
import englishMarkdownGuide from "@pocket-trash/localizations/help/en-US/how-to-use-markdown.mdx?raw";
import englishGuide from "@pocket-trash/localizations/help/en-US/image-size-and-resolution-guide.mdx?raw";
import spanishGuide from "@pocket-trash/localizations/help/es-MX/image-size-and-resolution-guide.mdx?raw";

/** Frontmatter fields attached to a help document. */
type HelpMetadata = Record<string, string> & {
  /** Localized document title. */
  title: string;
};

/** Parsed localized help content and its route slug. */
export type HelpDocument = {
  /** Markdown body without frontmatter. */
  body: string;
  /** Parsed frontmatter fields. */
  metadata: HelpMetadata;
  /** Route-safe document identifier. */
  slug: string;
};

/** Raw localized help documents compiled into the web bundle as text. */
const rawDocuments = {
  "/help/en-US/how-to-use-markdown.mdx": englishMarkdownGuide,
  "/help/en-US/image-size-and-resolution-guide.mdx": englishGuide,
  "/help/es-MX/image-size-and-resolution-guide.mdx": spanishGuide,
};

/** Parsed help documents keyed by locale and slug. */
const documents = new Map<string, HelpDocument>();

for (const [path, source] of Object.entries(rawDocuments)) {
  const match = path.match(/\/help\/([^/]+)\/([^/]+)\.mdx$/);
  if (!match) continue;
  const [, locale, slug] = match;
  if (!(locale && slug)) continue;
  const document = parseHelpDocument(source, slug);
  if (slug !== "index") {
    requiredMetadata(document.metadata, "datePublished");
    requiredMetadata(document.metadata, "category");
  }
  documents.set(`${locale}/${slug}`, document);
}

/** Returns a localized help document with an English fallback.
 *
 * @param locale - Preferred document locale.
 * @param slug - Help topic identifier.
 * @returns The localized or English document, or `undefined` when absent.
 */
export function getHelpDocument(
  locale: SupportedLocale,
  slug: string,
): HelpDocument | undefined {
  return documents.get(`${locale}/${slug}`) ?? documents.get(`en-US/${slug}`);
}

/**
 * Lists help topics in their English source order with locale fallbacks.
 *
 * @param locale - Preferred locale for each topic.
 * @returns Every published help document.
 */
export function getHelpDocuments(locale: SupportedLocale): HelpDocument[] {
  return [...documents.entries()]
    .filter(([key]) => key.startsWith("en-US/"))
    .map(([, document]) => getHelpDocument(locale, document.slug) ?? document);
}

/** Formats the image-upload guide link and aspect-ratio warning.
 *
 * @param locale - Locale used for both messages.
 * @returns Localized image-upload guidance.
 */
export function getImageUploadGuidance(locale: SupportedLocale) {
  return {
    helpLabel: formatTranslation(
      "web.catalog.images.aspectRatioGuideLink",
      {},
      locale,
    ),
    warning: formatTranslation(
      "web.catalog.images.aspectRatioWarning",
      {},
      locale,
    ),
  };
}

/** Parses help Markdown frontmatter and body content.
 *
 * @param source - Raw Markdown document including frontmatter.
 * @param slug - Route identifier assigned to the document.
 * @returns The parsed help document.
 * @throws When frontmatter is absent, malformed, or lacks a title.
 */
export function parseHelpDocument(source: string, slug: string): HelpDocument {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`Help document ${slug} has no frontmatter.`);

  const metadata = Object.fromEntries(
    (match[1] ?? "")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(":");
        if (separator < 1) {
          throw new Error(`Help document ${slug} has invalid frontmatter.`);
        }
        return [
          line.slice(0, separator).trim(),
          line.slice(separator + 1).trim(),
        ];
      }),
  ) as HelpMetadata;

  requiredMetadata(metadata, "title");
  return { body: (match[2] ?? "").trim(), metadata, slug };
}

/** Reads a required help frontmatter field.
 *
 * @param metadata - Parsed document frontmatter.
 * @param key - Required field name.
 * @returns The non-empty field value.
 * @throws When the field is missing or empty.
 */
function requiredMetadata(metadata: HelpMetadata, key: string): string {
  const value = metadata[key];
  if (!value) throw new Error(`Help document metadata is missing ${key}.`);
  return value;
}
