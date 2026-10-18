import {
  faArrowLeftToLine,
  faArrowRightToLine,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatTranslation } from "@pocket-trash/localizations";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocale } from "@/providers/locale-provider";
import { Button } from "./ui/button";

/** Properties for shared one-based pagination controls. */
type PaginationProps = {
  /** Accessible name for the pagination landmark. */
  ariaLabel: string;
  /**
   * Handles a user-selected one-based page.
   *
   * @param page - Selected page.
   */
  onPageChange(page: number): void;
  /** Current one-based page. */
  page: number;
  /** Total number of pages. */
  pageCount: number;
};

/**
 * Returns the numbered pages shown around the current page.
 *
 * @param page - Current one-based page.
 * @param pageCount - Total number of pages.
 * @param mobile - Whether compact pagination is active.
 * @returns Visible one-based page numbers.
 */
export function getVisiblePages(
  page: number,
  pageCount: number,
  mobile: boolean,
) {
  const radius = mobile ? 1 : 2;
  const pages: number[] = [];
  for (
    let candidate = Math.max(1, page - radius);
    candidate <= Math.min(pageCount, page + radius);
    candidate += 1
  ) {
    pages.push(candidate);
  }
  return pages;
}

/**
 * Renders responsive first, previous, numbered, next, and last controls.
 *
 * @param props - Pagination properties.
 * @returns Accessible pagination controls when more than one page exists.
 */
export function Pagination({
  ariaLabel,
  onPageChange,
  page,
  pageCount,
}: PaginationProps) {
  const { locale } = useLocale();
  const mobile = useIsMobile();
  if (pageCount <= 1) return null;

  /**
   * Formats localized pagination copy.
   *
   * @param key - Pagination translation key.
   * @param values - Translation interpolation values.
   * @returns Localized pagination copy.
   */
  const t = (
    key:
      | "web.search.pagination.firstPage"
      | "web.search.pagination.goToPage"
      | "web.search.pagination.lastPage"
      | "web.search.pagination.nextPage"
      | "web.search.pagination.pageStatus"
      | "web.search.pagination.previousPage",
    values: Record<string, string | number> = {},
  ) => formatTranslation(key, values, locale);

  return (
    <nav
      aria-label={ariaLabel}
      className="flex items-center justify-center gap-1 px-3 py-6"
    >
      <Button
        aria-label={t("web.search.pagination.firstPage")}
        disabled={page === 1}
        onClick={() => onPageChange(1)}
        size="icon"
        type="button"
        variant="outline"
      >
        <FontAwesomeIcon aria-hidden="true" icon={faArrowLeftToLine} />
      </Button>
      <Button
        aria-label={t("web.search.pagination.previousPage")}
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
        size="icon"
        type="button"
        variant="outline"
      >
        <FontAwesomeIcon aria-hidden="true" icon={faChevronLeft} />
      </Button>
      {getVisiblePages(page, pageCount, mobile).map((pageNumber) => (
        <Button
          aria-current={pageNumber === page ? "page" : undefined}
          aria-label={t("web.search.pagination.goToPage", {
            page: pageNumber,
          })}
          key={pageNumber}
          onClick={() => onPageChange(pageNumber)}
          size="icon"
          type="button"
          variant={pageNumber === page ? "default" : "ghost"}
        >
          {pageNumber}
        </Button>
      ))}
      <Button
        aria-label={t("web.search.pagination.nextPage")}
        disabled={page === pageCount}
        onClick={() => onPageChange(page + 1)}
        size="icon"
        type="button"
        variant="outline"
      >
        <FontAwesomeIcon aria-hidden="true" icon={faChevronRight} />
      </Button>
      <Button
        aria-label={t("web.search.pagination.lastPage")}
        disabled={page === pageCount}
        onClick={() => onPageChange(pageCount)}
        size="icon"
        type="button"
        variant="outline"
      >
        <FontAwesomeIcon aria-hidden="true" icon={faArrowRightToLine} />
      </Button>
      <output className="sr-only">
        {t("web.search.pagination.pageStatus", { page, pageCount })}
      </output>
    </nav>
  );
}
