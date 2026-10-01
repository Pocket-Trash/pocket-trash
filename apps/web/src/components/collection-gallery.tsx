import type { UserCollectionSummary } from "@package/services";
import {
  createColumnHelper,
  createPaginatedRowModel,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo } from "react";
import {
  type GalleryImage,
  ImageButton,
  ImageLightbox,
} from "@/components/image-gallery";
import { MarkdownContent } from "@/components/markdown-content";
import { Button } from "@/components/ui/button";

/**
 * Responsive pagination behavior for non-cover collection images.
 */
const paginationFeatures = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});
/**
 * Column builder for gallery images.
 */
const columnHelper = createColumnHelper<
  typeof paginationFeatures,
  GalleryImage
>();
/**
 * Minimal columns required to paginate gallery images.
 */
const columns = columnHelper.columns([
  columnHelper.accessor("id", { header: "id" }),
]);

/**
 * Localized labels displayed by a collection gallery.
 */
export type CollectionGalleryCopy = {
  /**
   * Accessible label for closing the lightbox.
   */
  closeImage: string;
  /**
   * Gallery heading and accessible label.
   */
  gallery: string;
  /**
   * Alternative text shared by collection images.
   */
  imageAlt: string;
  /**
   * Formatted collection item count.
   */
  itemCount: string;
  /**
   * Accessible label for the next lightbox image.
   */
  nextImage: string;
  /**
   * Accessible label for the next gallery page.
   */
  nextPage: string;
  /**
   * Optional formatted owner attribution.
   */
  owner?: string;
  /**
   * Formats the visible gallery page position.
   *
   * @param page - Current one-based page number.
   * @param pageCount - Total number of pages.
   * @returns Localized pagination status text.
   */
  pageStatus(page: number, pageCount: number): string;
  /**
   * Accessible label for the previous lightbox image.
   */
  previousImage: string;
  /**
   * Accessible label for the previous gallery page.
   */
  previousPage: string;
  /**
   * Formatted collection visibility text.
   */
  visibility: string;
};

/**
 * Renders collection details, a responsive image grid, and a shared lightbox.
 * The cover leads the lightbox; remaining images sort by descending position, then ID, in pages of six below 64rem and nine otherwise.
 *
 * @param props - Collection gallery properties.
 * @param props.collection - Collection summary and cover images to present.
 * @param props.copy - Localized labels and formatted collection metadata.
 * @returns The collection gallery UI.
 */
export function CollectionGallery({
  collection,
  copy,
}: {
  /**
   * Collection summary and cover images to present.
   */
  collection: UserCollectionSummary;
  /**
   * Localized labels and formatted collection metadata.
   */
  copy: CollectionGalleryCopy;
}) {
  const nonCoverImages = useMemo(
    () =>
      [...collection.coverImages]
        .filter(({ id }) => id !== collection.coverImage?.id)
        .sort((left, right) =>
          right.position === left.position
            ? right.id - left.id
            : right.position - left.position,
        ),
    [collection.coverImage?.id, collection.coverImages],
  );
  const images = useMemo(
    () =>
      collection.coverImage
        ? [collection.coverImage, ...nonCoverImages]
        : nonCoverImages,
    [collection.coverImage, nonCoverImages],
  );
  const initialState = useMemo(
    () => ({ pagination: { pageIndex: 0, pageSize: 6 } }),
    [],
  );
  const table = useTable(
    {
      columns,
      data: nonCoverImages,
      features: paginationFeatures,
      initialState,
    },
    (state) => ({ pagination: state.pagination }),
  );
  const setPageSize = table.setPageSize;
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 64rem)");
    /**
     * Uses nine gallery images on desktop and six on smaller viewports.
     */
    const updatePageSize = () => {
      setPageSize(desktop.matches ? 9 : 6);
    };
    updatePageSize();
    desktop.addEventListener("change", updatePageSize);
    return () => desktop.removeEventListener("change", updatePageSize);
  }, [setPageSize]);
  const pageCount = table.getPageCount();

  return (
    <ImageLightbox
      alt={copy.imageAlt}
      closeLabel={copy.closeImage}
      images={images}
      label={copy.gallery}
      nextLabel={copy.nextImage}
      previousLabel={copy.previousImage}
    >
      {(select) => (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="grid content-start gap-4 rounded-xl border border-border bg-card p-6 text-card-foreground">
            {collection.coverImage ? (
              <ImageButton
                alt={copy.imageAlt}
                image={collection.coverImage}
                label={copy.gallery}
                onClick={() => select(0)}
              />
            ) : null}
            <h2 className="text-lg font-semibold">{collection.name}</h2>
            {collection.description ? (
              <MarkdownContent markdown={collection.description} />
            ) : null}
            <div className="grid gap-1 text-sm text-muted-foreground">
              <p>{copy.itemCount}</p>
              <p>{copy.visibility}</p>
              {copy.owner ? <p>{copy.owner}</p> : null}
            </div>
          </div>
          <div className="grid content-start gap-3">
            {nonCoverImages.length ? (
              <>
                <h2 className="text-lg font-semibold">{copy.gallery}</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {table.getRowModel().rows.map((row) => (
                    <ImageButton
                      alt={copy.imageAlt}
                      image={row.original}
                      key={row.original.id}
                      label={copy.gallery}
                      onClick={() =>
                        select(
                          images.findIndex(({ id }) => id === row.original.id),
                        )
                      }
                    />
                  ))}
                </div>
                {pageCount > 1 ? (
                  <nav
                    aria-label={copy.gallery}
                    className="flex items-center justify-center gap-3"
                  >
                    <Button
                      aria-label={copy.previousPage}
                      disabled={!table.getCanPreviousPage()}
                      onClick={() => table.previousPage()}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <ChevronLeft />
                    </Button>
                    <output aria-live="polite" className="text-sm">
                      {copy.pageStatus(
                        table.state.pagination.pageIndex + 1,
                        pageCount,
                      )}
                    </output>
                    <Button
                      aria-label={copy.nextPage}
                      disabled={!table.getCanNextPage()}
                      onClick={() => table.nextPage()}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <ChevronRight />
                    </Button>
                  </nav>
                ) : null}
              </>
            ) : null}
          </div>
        </section>
      )}
    </ImageLightbox>
  );
}
