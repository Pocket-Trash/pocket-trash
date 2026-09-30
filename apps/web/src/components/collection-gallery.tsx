import type { UserCollectionSummary } from "@package/services";
import {
  createColumnHelper,
  createPaginatedRowModel,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import {
  type GalleryImage,
  ImageButton,
  ImageLightbox,
} from "@/components/image-gallery";
import { MarkdownContent } from "@/components/markdown-content";
import { Button } from "@/components/ui/button";

const paginationFeatures = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});
const columnHelper = createColumnHelper<
  typeof paginationFeatures,
  GalleryImage
>();
const columns = columnHelper.columns([
  columnHelper.accessor("id", { header: "id" }),
]);

export type CollectionGalleryCopy = {
  closeImage: string;
  gallery: string;
  imageAlt: string;
  itemCount: string;
  nextImage: string;
  nextPage: string;
  owner?: string;
  pageStatus(page: number, pageCount: number): string;
  previousImage: string;
  previousPage: string;
  visibility: string;
};

export function CollectionGallery({
  collection,
  copy,
}: {
  collection: UserCollectionSummary;
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
