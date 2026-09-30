import {
  formatTranslation,
  type SupportedLocale,
} from "@pocket-trash/localizations";
import englishGuide from "@pocket-trash/localizations/help/en-US/image-size-and-resolution-guide.mdx?raw";
import spanishGuide from "@pocket-trash/localizations/help/es-MX/image-size-and-resolution-guide.mdx?raw";

type HelpMetadata = Record<string, string> & {
  title: string;
};

export type HelpDocument = {
  body: string;
  metadata: HelpMetadata;
  slug: string;
};

const rawDocuments = {
  "/help/en-US/image-size-and-resolution-guide.mdx": englishGuide,
  "/help/es-MX/image-size-and-resolution-guide.mdx": spanishGuide,
};

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

export function getHelpDocument(
  locale: SupportedLocale,
  slug: string,
): HelpDocument | undefined {
  return documents.get(`${locale}/${slug}`) ?? documents.get(`en-US/${slug}`);
}

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

function requiredMetadata(metadata: HelpMetadata, key: string): string {
  const value = metadata[key];
  if (!value) throw new Error(`Help document metadata is missing ${key}.`);
  return value;
}
