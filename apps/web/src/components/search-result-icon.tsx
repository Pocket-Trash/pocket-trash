import {
  faAtomSimple,
  faBox,
  faBoxesStacked,
  faCube,
  faFileLines,
  faGem,
  faIndustry,
  faUser,
} from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { SearchKind, SearchResult } from "@package/services";
import { Fragment } from "react";

/** Search result icons keyed by public result kind. */
const resultIcons = {
  collection: faBoxesStacked,
  collection_item: faBox,
  maker: faIndustry,
  material: faGem,
  material_detail: faAtomSimple,
  person: faUser,
  product: faCube,
  resource: faFileLines,
} satisfies Record<SearchKind, typeof faCube>;

/** Localization suffixes keyed by public result kind. */
export const searchResultTypeKeys = {
  collection: "collection",
  collection_item: "collectionItem",
  maker: "maker",
  material: "material",
  material_detail: "materialDetail",
  person: "person",
  product: "product",
  resource: "resource",
} as const satisfies Record<SearchKind, string>;

/** Properties for a public search result icon. */
type SearchResultIconProps = {
  /** Additional icon classes. */
  className?: string;
  /** Public search result kind. */
  kind: SearchKind;
};

/**
 * Renders the icon associated with a public search result kind.
 *
 * @param props - Search result icon properties.
 * @returns A decorative Font Awesome icon.
 */
export function SearchResultIcon({ className, kind }: SearchResultIconProps) {
  return (
    <FontAwesomeIcon
      aria-hidden="true"
      className={className}
      icon={resultIcons[kind]}
    />
  );
}

/** Properties for safe structured search-result highlights. */
type SearchHighlightsProps = {
  /** Structured highlight segments returned by public search. */
  highlights: SearchResult["highlights"];
};

/**
 * Renders escaped search-result highlights.
 *
 * @param props - Search highlight properties.
 * @returns Search text with matched segments emphasized.
 */
export function SearchHighlights({ highlights }: SearchHighlightsProps) {
  let offset = 0;
  return highlights.map((highlight) => {
    const key = `${offset}-${highlight.matched}`;
    offset += highlight.text.length;
    return highlight.matched ? (
      <strong className="font-semibold text-foreground" key={key}>
        {highlight.text}
      </strong>
    ) : (
      <Fragment key={key}>{highlight.text}</Fragment>
    );
  });
}
