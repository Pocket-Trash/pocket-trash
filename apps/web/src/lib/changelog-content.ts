import {
  type ChangelogCategorySlug,
  changelogCategories,
  type SupportedLocale,
} from "@pocket-trash/localizations";
import englishChangelogIntroduction from "@pocket-trash/localizations/changelog/en-US/2027-10-02-introducing-the-pocket-trash-changelog.mdx?raw";
import spanishChangelogIntroduction from "@pocket-trash/localizations/changelog/es-MX/2027-10-02-introducing-the-pocket-trash-changelog.mdx?raw";

/** A complete customer-facing changelog entry. */
export type ChangelogEntry = {
  /** Localized Markdown body. */
  body: string;
  /** Categories attached to the entry. */
  categories: readonly ChangelogCategorySlug[];
  /** Most recent modification date when the entry was revised. */
  dateModified?: string;
  /** Publication date used for ordering. */
  datePublished: string;
  /** Permanent URL slug. */
  slug: string;
  /** Localized entry title. */
  title: string;
};

/** One page of publication-date-sorted changelog entries. */
export type ChangelogPage = {
  /** Entries on this page. */
  entries: readonly ChangelogEntry[];
  /** One-based current page number. */
  page: number;
  /** Total number of available pages. */
  pageCount: number;
};

/** Parsed changelog source before English metadata validation. */
type ParsedChangelogDocument = {
  /** Markdown body from the source file. */
  body: string;
  /** Frontmatter values used to build a complete entry. */
  metadata: {
    /** Optional categories, required by the English source. */
    categories?: readonly ChangelogCategorySlug[];
    /** Optional revision date. */
    dateModified?: string;
    /** Optional publication date, required by the English source. */
    datePublished?: string;
    /** Entry title. */
    title: string;
  };
  /** Permanent slug derived from the source filename. */
  slug: string;
};

/** Maximum number of full entries rendered on one list page. */
const pageSize = 10;
/** Bundled localized changelog sources keyed by virtual path. */
const rawDocuments = {
  "/changelog/en-US/2027-10-02-introducing-the-pocket-trash-changelog.mdx":
    englishChangelogIntroduction,
  "/changelog/es-MX/2027-10-02-introducing-the-pocket-trash-changelog.mdx":
    spanishChangelogIntroduction,
} as const;

/** Parsed documents keyed by locale and permanent slug. */
const documents = new Map<string, ParsedChangelogDocument>();

for (const [path, source] of Object.entries(rawDocuments)) {
  const match = path.match(
    /\/changelog\/([^/]+)\/\d{4}-\d{2}-\d{2}-(.+)\.mdx$/,
  );
  if (!(match?.[1] && match[2])) continue;
  documents.set(`${match[1]}/${match[2]}`, parseDocument(source, match[2]));
}

/** Validated English entries used for metadata and translation fallback. */
const englishEntries = [...documents.entries()]
  .filter(([key]) => key.startsWith("en-US/"))
  .map(([, document]) => completeEnglishEntry(document))
  .sort((left, right) => right.datePublished.localeCompare(left.datePublished));

/**
 * Returns localized changelog entries, falling back to English per entry.
 *
 * @param locale - Requested supported locale.
 * @param category - Optional category filter.
 * @returns Publication-date-sorted changelog entries.
 */
export function getChangelogEntries(
  locale: SupportedLocale,
  category?: ChangelogCategorySlug,
): readonly ChangelogEntry[] {
  return englishEntries
    .map((english) => localizeEntry(english, locale))
    .filter((entry) => !category || entry.categories.includes(category));
}

/**
 * Returns one localized changelog entry by its permanent slug.
 *
 * @param locale - Requested supported locale.
 * @param slug - Permanent entry slug without the publication date.
 * @returns The localized entry, or undefined when it does not exist.
 */
export function getChangelogEntry(
  locale: SupportedLocale,
  slug: string,
): ChangelogEntry | undefined {
  return getChangelogEntries(locale).find((entry) => entry.slug === slug);
}

/**
 * Normalizes an untrusted page search value.
 *
 * @param value - Raw search parameter value.
 * @returns A positive integer page, defaulting to page one.
 */
export function parseChangelogPage(value: unknown): number {
  const page =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

/**
 * Selects one ten-entry changelog page.
 *
 * @param entries - Publication-date-sorted entries.
 * @param page - Positive page number.
 * @returns The page, or undefined when the page is beyond the final page.
 */
export function paginateChangelog(
  entries: readonly ChangelogEntry[],
  page: number,
): ChangelogPage | undefined {
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  if (page > pageCount) return undefined;

  const start = (page - 1) * pageSize;
  return {
    entries: entries.slice(start, start + pageSize),
    page,
    pageCount,
  };
}

/**
 * Parses a bundled changelog source and validates its present frontmatter.
 *
 * @param source - Raw MDX source with YAML-like frontmatter.
 * @param slug - Permanent slug derived from the source filename.
 * @returns The parsed source document.
 * @throws When frontmatter, the title, or a category is invalid.
 */
function parseDocument(source: string, slug: string): ParsedChangelogDocument {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`Changelog entry ${slug} has no frontmatter.`);

  const values = new Map<string, string>();
  const categories: ChangelogCategorySlug[] = [];
  let listKey: string | null = null;

  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem?.[1] && listKey === "categories") {
      if (!(listItem[1] in changelogCategories)) {
        throw new Error(`Changelog entry ${slug} has an invalid category.`);
      }
      categories.push(listItem[1] as ChangelogCategorySlug);
      continue;
    }

    const separator = line.indexOf(":");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    listKey = value ? null : key;
    if (value) values.set(key, value);
  }

  const title = values.get("title");
  if (!title) throw new Error(`Changelog entry ${slug} has no title.`);

  return {
    body: (match[2] ?? "").trim(),
    metadata: {
      ...(categories.length ? { categories } : {}),
      ...(values.get("dateModified")
        ? { dateModified: values.get("dateModified") }
        : {}),
      ...(values.get("datePublished")
        ? { datePublished: values.get("datePublished") }
        : {}),
      title,
    },
    slug,
  };
}

/**
 * Validates required English metadata and creates a complete entry.
 *
 * @param document - Parsed English source document.
 * @returns A complete English changelog entry.
 * @throws When metadata is incomplete or the slug is reserved.
 */
function completeEnglishEntry(
  document: ParsedChangelogDocument,
): ChangelogEntry {
  if (document.slug in changelogCategories) {
    throw new Error(
      `Changelog entry ${document.slug} uses a reserved category slug.`,
    );
  }

  const { categories, datePublished } = document.metadata;
  if (!(categories?.length && datePublished)) {
    throw new Error(
      `Changelog entry ${document.slug} has incomplete metadata.`,
    );
  }

  return {
    body: document.body,
    categories,
    ...(document.metadata.dateModified
      ? { dateModified: document.metadata.dateModified }
      : {}),
    datePublished,
    slug: document.slug,
    title: document.metadata.title,
  };
}

/**
 * Applies a localized title and body while retaining English metadata.
 *
 * @param english - Complete English fallback entry.
 * @param locale - Requested supported locale.
 * @returns The localized entry, or the English entry when absent.
 */
function localizeEntry(
  english: ChangelogEntry,
  locale: SupportedLocale,
): ChangelogEntry {
  const localized = documents.get(`${locale}/${english.slug}`);
  return localized
    ? {
        ...english,
        body: localized.body,
        title: localized.metadata.title,
      }
    : english;
}
