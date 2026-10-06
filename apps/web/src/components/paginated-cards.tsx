import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCatalogCopy } from "@/lib/catalog-copy";

/**
 * Properties shared by paginated catalog card lists.
 *
 * @template T - Card data preserved while slicing pages.
 */
interface PaginatedCardsProps<T> {
  /** Accessible name for the pagination controls. */
  ariaLabel: string;
  /**
   * Renders the cards for the current page.
   *
   * @param items - Card data on the current page.
   * @returns The current page's card grid.
   */
  children(items: T[]): ReactNode;
  /** Ordered card data to paginate. */
  items: T[];
  /** Zero-based externally controlled page. */
  page?: number;
  /**
   * Handles controlled page changes and out-of-range replacement.
   *
   * @param page - Zero-based destination page.
   * @param options - Navigation history behavior.
   */
  onPageChange?: (page: number, options: PageChangeOptions) => void;
  /** Maximum cards rendered above 1280 CSS pixels. */
  widePageSize: number;
}

/** Navigation options for a controlled catalog page change. */
interface PageChangeOptions {
  /** Replace the current history entry instead of pushing one. */
  replace: boolean;
}

/**
 * Resolves catalog page size from the browser viewport width.
 *
 * @param viewportWidth - Browser viewport width in CSS pixels.
 * @param widePageSize - Page size used above 1280 CSS pixels.
 * @returns The responsive catalog page size.
 * @internal
 */
export function getCatalogPageSize(
  viewportWidth: number,
  widePageSize: number,
) {
  if (viewportWidth <= 480) return 8;
  if (viewportWidth <= 1280) return 12;
  return widePageSize;
}

/**
 * Renders one page of catalog cards and shared navigation controls.
 *
 * @param props - Catalog pagination properties.
 * @returns The current card page and controls when multiple pages exist.
 * @template T - Card data preserved while slicing pages.
 */
export function PaginatedCards<T>({
  ariaLabel,
  children,
  items,
  onPageChange,
  page: controlledPage,
  widePageSize,
}: PaginatedCardsProps<T>) {
  const t = useCatalogCopy();
  const [pageSize, setPageSize] = useState(12);
  const [viewportMeasured, setViewportMeasured] = useState(false);
  const [renderedItems, setRenderedItems] = useState(items);
  const [requestedPage, setRequestedPage] = useState(0);
  useEffect(() => {
    /** Synchronizes the page size with the current catalog grid width. */
    const updatePageSize = () => {
      setPageSize(getCatalogPageSize(window.innerWidth, widePageSize));
      setViewportMeasured(true);
    };
    updatePageSize();
    window.addEventListener("resize", updatePageSize);
    return () => window.removeEventListener("resize", updatePageSize);
  }, [widePageSize]);
  if (renderedItems !== items) {
    setRenderedItems(items);
    if (controlledPage === undefined) setRequestedPage(0);
  }
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.max(
    0,
    Math.min(controlledPage ?? requestedPage, pageCount - 1),
  );
  useEffect(() => {
    if (
      viewportMeasured &&
      controlledPage !== undefined &&
      controlledPage !== page
    ) {
      onPageChange?.(page, { replace: true });
    }
  }, [controlledPage, onPageChange, page, viewportMeasured]);
  /**
   * Applies a user-requested page to controlled or local state.
   *
   * @param nextPage - Zero-based destination page.
   */
  const changePage = (nextPage: number) => {
    if (onPageChange) {
      onPageChange(nextPage, { replace: false });
    } else {
      setRequestedPage(nextPage);
    }
  };

  return (
    <>
      {children(items.slice(page * pageSize, (page + 1) * pageSize))}
      {pageCount > 1 ? (
        <nav
          aria-label={ariaLabel}
          className="flex items-center justify-center gap-3 px-3 pb-6"
        >
          <Button
            aria-label={t("web.collections.gallery.previousPage")}
            disabled={page === 0}
            onClick={() => changePage(page - 1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronLeft />
          </Button>
          <output aria-live="polite" className="text-sm">
            {t("web.collections.gallery.pageStatus", {
              page: page + 1,
              pageCount,
            })}
          </output>
          <Button
            aria-label={t("web.collections.gallery.nextPage")}
            disabled={page === pageCount - 1}
            onClick={() => changePage(page + 1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronRight />
          </Button>
        </nav>
      ) : null}
    </>
  );
}
