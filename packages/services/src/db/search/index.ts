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
  /** Whether collection attribution may identify its owner. */
  ownerIsProfilePublic?: boolean;
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
  /** Calling UI, which determines result limits. */
  surface: "directory" | "modal" | "page";
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
  /** Whether collection attribution may identify its owner. */
  ownerIsProfilePublic: boolean | null;
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
      const page =
        input.surface === "directory"
          ? 1
          : Math.max(1, Math.trunc(input.page ?? 1));
      const pageSize =
        input.surface === "directory" ? 0 : input.surface === "modal" ? 7 : 10;
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
        group === "all"
          ? sql`true`
          : sql`search_documents.search_group = ${group}`;
      const offset = (page - 1) * pageSize;
      const pagination =
        input.surface === "directory"
          ? sql``
          : sql`limit ${pageSize} offset ${offset}`;

      const [resultRows, countRows] = await Promise.all([
        db.execute(sql<SearchRow>`
          with query as (select ${queryExpression} as value)
          select search_documents.kind, search_documents.source_id as id,
            search_documents.parent_id as "parentId", search_documents.title,
            search_documents.href, search_documents.image_url as "imageUrl",
            search_documents.context,
            case when search_documents.kind in ('collection', 'collection_item')
              then coalesce(owner_settings.is_profile_public, false)
              else null
            end as "ownerIsProfilePublic",
            ts_headline(
              'simple', concat_ws(' ', search_documents.title, search_documents.context, search_documents.description), query.value,
              ${`StartSel=${START_MATCH}, StopSel=${END_MATCH}, MaxWords=24, MinWords=8, ShortWord=2`}
            ) as headline
          from search_documents cross join query
          left join user_collection search_collection
            on search_documents.kind = 'collection'
              and search_collection.id = search_documents.source_id
          left join collection_item search_item
            on search_documents.kind = 'collection_item'
              and search_item.id = search_documents.source_id
          left join user_settings owner_settings
            on owner_settings.user_id = coalesce(
              search_collection.owner_id,
              search_item.owner_id
            )
          where search_documents.search_vector @@ query.value and ${groupFilter}
          order by
            (normalize_search_text(search_documents.title) = normalize_search_text(${query})) desc,
            (normalize_search_text(search_documents.title) like normalize_search_text(${query}) || '%') desc,
            ts_rank_cd(search_documents.search_vector, query.value) desc,
            normalize_search_text(search_documents.title),
            search_documents.kind, search_documents.source_id
          ${pagination}
        `),
        db.execute(sql<CountRow>`
          with query as (select ${queryExpression} as value)
          select search_group as "group", count(*)::integer as count
          from search_documents cross join query
          where search_documents.search_vector @@ query.value
          group by search_documents.search_group
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
          ...(row.ownerIsProfilePublic === null
            ? {}
            : { ownerIsProfilePublic: row.ownerIsProfilePublic }),
          ...(row.parentId === null ? {} : { parentId: Number(row.parentId) }),
          title: row.title,
        })),
        page,
        pageSize:
          input.surface === "directory" ? resultRows.rows.length : pageSize,
        total: counts[group],
      };
    },
  };
}
