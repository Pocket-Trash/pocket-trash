import type { Database } from "@package/database";
import { sql } from "drizzle-orm";

/** Stable search result kinds emitted by the public search index. */
export type SearchKind =
  | "product"
  | "collection"
  | "collection_item"
  | "maker"
  | "person"
  | "material"
  | "material_detail"
  | "resource";

/** Stable scopes offered by public search. */
export type SearchGroup =
  | "all"
  | "products"
  | "collections"
  | "makers"
  | "people"
  | "materials"
  | "resources";

/** One safe display segment, separated from database-generated markup. */
export type SearchHighlight = {
  /** Whether this segment matched the query. */
  matched: boolean;
  /** Plain text safe for framework escaping. */
  text: string;
};

/** One public search result. */
export type SearchResult = {
  /** Optional contextual label. */
  context?: string;
  /** Public destination. */
  href: string;
  /** Structured plain-text match excerpt. */
  highlights: SearchHighlight[];
  /** Stable source identifier. */
  id: number;
  /** Optional public image URL. */
  imageUrl?: string;
  /** Stable result kind. */
  kind: SearchKind;
  /** Parent identifier for nested results. */
  parentId?: number;
  /** Public result title. */
  title: string;
};

/** Search match totals for every public scope. */
export type SearchCounts = Record<SearchGroup, number>;

/** One page of public search results and its unfiltered scope counts. */
export type SearchResponse = {
  /** Match counts by scope. */
  counts: SearchCounts;
  /** Current result page. */
  items: SearchResult[];
  /** One-based page number. */
  page: number;
  /** Fixed surface-specific page size. */
  pageSize: number;
  /** Match count in the selected scope. */
  total: number;
};

/** Public search request. */
export type SearchInput = {
  /** Selected search scope. */
  group?: SearchGroup;
  /** One-based page number. */
  page?: number;
  /** User-entered web-search query. */
  query: string;
  /** Calling UI, which determines page size. */
  surface: "modal" | "page";
};

/** Database-backed public search operations. */
export type SearchService = {
  /**
   * Finds visible public records matching a web-search query.
   *
   * @param input - Search query, scope, and surface.
   * @returns Matching records and counts by scope.
   */
  search(input: SearchInput): Promise<SearchResponse>;
};

/** Raw search result returned by PostgreSQL. */
type SearchRow = {
  /** Optional contextual label. */
  context: string | null;
  /** Marked match excerpt. */
  headline: string;
  /** Public destination. */
  href: string;
  /** Stable source identifier. */
  id: number | string;
  /** Optional public image URL. */
  imageUrl: string | null;
  /** Stable result kind. */
  kind: SearchKind;
  /** Parent identifier for nested results. */
  parentId: number | string | null;
  /** Public result title. */
  title: string;
};

/** Raw grouped count returned by PostgreSQL. */
type CountRow = {
  /** Number of matches in the group. */
  count: number | string;
  /** Public search group. */
  group: Exclude<SearchGroup, "all">;
};

/** Private-use marker placed before matched text by PostgreSQL. */
const START_MATCH = "\uE000";
/** Private-use marker placed after matched text by PostgreSQL. */
const END_MATCH = "\uE001";
/** Search groups that contribute to the aggregate count. */
const groups = [
  "products",
  "collections",
  "makers",
  "people",
  "materials",
  "resources",
] as const;

/**
 * Splits a marked database excerpt into safe plain-text match segments.
 *
 * @param headline - Database excerpt containing private-use match markers.
 * @returns Plain-text segments with match state.
 */
export function parseSearchHighlight(headline: string): SearchHighlight[] {
  const segments: SearchHighlight[] = [];
  let matched = false;
  for (const part of headline.split(
    new RegExp(`(${START_MATCH}|${END_MATCH})`, "u"),
  )) {
    if (part === START_MATCH) matched = true;
    else if (part === END_MATCH) matched = false;
    else if (part) segments.push({ matched, text: part });
  }
  return segments;
}

/** Parsed query parts used to add final-token prefix matching. */
type PrefixQuery = {
  /** Query portion handled with web-search syntax. */
  base: string;
  /** Optional final token handled as a prefix. */
  prefix?: string;
};

/**
 * Splits the final word from a web-search query for prefix matching.
 *
 * @param query - Trimmed or untrimmed user query.
 * @returns Base web-search query and optional final prefix.
 */
function splitPrefixQuery(query: string): PrefixQuery {
  const match = /(?:^|\s)([\p{L}\p{N}][\p{L}\p{N}-]*)$/u.exec(query.trim());
  if (!match?.[1]) return { base: query.trim() };
  return {
    base: query.trim().slice(0, -match[1].length).trim(),
    prefix: match[1],
  };
}

/**
 * Creates an empty scope-count response.
 *
 * @returns Zero counts for every public search scope.
 */
function emptyCounts(): SearchCounts {
  return {
    all: 0,
    collections: 0,
    makers: 0,
    materials: 0,
    people: 0,
    products: 0,
    resources: 0,
  };
}

/**
 * Creates the public full-text search service.
 *
 * @param db - Database connection used for search queries.
 * @returns Public search operations.
 */
export function createSearchService(db: Database): SearchService {
  return {
    /**
     * Finds visible public records matching a web-search query.
     *
     * @param input - Search query, scope, and surface.
     * @returns Matching records and counts by scope.
     */
    async search(input) {
      const query = input.query.trim();
      const group = input.group ?? "all";
      const page = Math.max(1, Math.trunc(input.page ?? 1));
      const pageSize = input.surface === "modal" ? 7 : 10;
      if (query.length < 2) {
        return { counts: emptyCounts(), items: [], page, pageSize, total: 0 };
      }

      const { base, prefix } = splitPrefixQuery(query);
      const queryExpression = prefix
        ? base
          ? sql`websearch_to_tsquery('simple', normalize_search_text(${base})) && to_tsquery('simple', normalize_search_text(${prefix}) || ':*')`
          : sql`to_tsquery('simple', normalize_search_text(${prefix}) || ':*')`
        : sql`websearch_to_tsquery('simple', normalize_search_text(${base}))`;
      const groupFilter =
        group === "all" ? sql`true` : sql`search_group = ${group}`;
      const offset = (page - 1) * pageSize;

      const [resultRows, countRows] = await Promise.all([
        db.execute(sql<SearchRow>`
          with query as (select ${queryExpression} as value)
          select kind, source_id as id, parent_id as "parentId", title, href,
            image_url as "imageUrl", context,
            ts_headline(
              'simple', concat_ws(' ', title, context, description), query.value,
              ${`StartSel=${START_MATCH}, StopSel=${END_MATCH}, MaxWords=24, MinWords=8, ShortWord=2`}
            ) as headline
          from search_documents cross join query
          where search_vector @@ query.value and ${groupFilter}
          order by
            (normalize_search_text(title) = normalize_search_text(${query})) desc,
            (normalize_search_text(title) like normalize_search_text(${query}) || '%') desc,
            ts_rank_cd(search_vector, query.value) desc,
            normalize_search_text(title), kind, source_id
          limit ${pageSize} offset ${offset}
        `),
        db.execute(sql<CountRow>`
          with query as (select ${queryExpression} as value)
          select search_group as "group", count(*)::integer as count
          from search_documents cross join query
          where search_vector @@ query.value
          group by search_group
        `),
      ]);

      const counts = emptyCounts();
      for (const row of countRows.rows as unknown as CountRow[]) {
        counts[row.group] = Number(row.count);
      }
      counts.all = groups.reduce((total, key) => total + counts[key], 0);

      return {
        counts,
        items: (resultRows.rows as unknown as SearchRow[]).map((row) => ({
          ...(row.context ? { context: row.context } : {}),
          href: row.href,
          highlights: parseSearchHighlight(row.headline),
          id: Number(row.id),
          ...(row.imageUrl ? { imageUrl: row.imageUrl } : {}),
          kind: row.kind,
          ...(row.parentId === null ? {} : { parentId: Number(row.parentId) }),
          title: row.title,
        })),
        page,
        pageSize,
        total: counts[group],
      };
    },
  };
}
