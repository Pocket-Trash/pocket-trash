import { type ReactNode, useReducer } from "react";
import { Pagination } from "@/components/pagination";
import { useViewportWidth } from "@/hooks/use-browser-layout";
import { usePageCorrection } from "@/hooks/use-page-correction";

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
  const width = useViewportWidth();
  const pageSize =
    width === null ? 12 : getCatalogPageSize(width, widePageSize);
  const [state, dispatch] = useReducer(
    (
      state: {
        /** Ordered input records, used to reset local pagination. */
        items: T[];
        /** User-requested zero-based page. */
        requestedPage: number;
      },
      event:
        | {
            /** Input records changed. */
            type: "itemsChanged";
            /** Replacement records. */
            items: T[];
          }
        | {
            /** User selected a page. */
            type: "pageRequested";
            /** Requested zero-based page. */
            page: number;
          },
    ) =>
      event.type === "itemsChanged"
        ? { items: event.items, requestedPage: 0 }
        : { ...state, requestedPage: event.page },
    { items, requestedPage: 0 },
  );
  if (state.items !== items) dispatch({ type: "itemsChanged", items });
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.max(
    0,
    Math.min(
      controlledPage ?? (state.items === items ? state.requestedPage : 0),
      pageCount - 1,
    ),
  );
  usePageCorrection(
    { requested: controlledPage ?? page, page, measured: width !== null },
    (corrected) => onPageChange?.(corrected, { replace: true }),
  );
  /**
   * Applies a user-requested page to controlled or local state.
   *
   * @param nextPage - Zero-based destination page.
   */
  const changePage = (nextPage: number) => {
    if (onPageChange) {
      onPageChange(nextPage, { replace: false });
    } else {
      dispatch({ type: "pageRequested", page: nextPage });
    }
  };

  return (
    <>
      {children(items.slice(page * pageSize, (page + 1) * pageSize))}
      {pageCount > 1 ? (
        <Pagination
          ariaLabel={ariaLabel}
          onPageChange={(nextPage) => changePage(nextPage - 1)}
          page={page + 1}
          pageCount={pageCount}
        />
      ) : null}
    </>
  );
}
