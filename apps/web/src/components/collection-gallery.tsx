import {
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { UserCollectionSummary } from "@package/services";
import { type ReactNode, useMemo, useReducer } from "react";
import {
  type GalleryImage,
  ImageButton,
  ImageLightbox,
} from "@/components/image-gallery";
import { MarkdownContent } from "@/components/markdown-content";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-browser-layout";

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
 * @param props.ownerAvatar - Decorative owner picture beside the collection title.
 * @returns The collection gallery UI.
 */
export function CollectionGallery({
  collection,
  copy,
  ownerAvatar,
}: {
  /**
   * Collection summary and cover images to present.
   */
  collection: UserCollectionSummary;
  /**
   * Localized labels and formatted collection metadata.
   */
  copy: CollectionGalleryCopy;
  /** Decorative owner picture beside the collection title. */
  ownerAvatar?: ReactNode;
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
  const pageSize = useMediaQuery("(min-width: 64rem)") ? 9 : 6;
  const [pagination, dispatch] = useReducer(
    (
      state: {
        /** Ordered images used by the current pagination. */
        images: GalleryImage[];
        /** Current zero-based page. */
        page: number;
        /** Previous responsive page size. */
        pageSize: number;
      },
      event:
        | {
            /** Collection images changed. */
            type: "imagesChanged";
            /** Replacement ordered images. */
            images: GalleryImage[];
          }
        | {
            /** Viewport tier changed. */
            type: "viewportChanged";
            /** New responsive page size. */
            pageSize: number;
          }
        | {
            /** Move to an adjacent page. */
            type: "pageMoved";
            /** Previous or next page. */
            offset: number;
          },
    ) => {
      if (event.type === "imagesChanged")
        return { ...state, images: event.images, page: 0 };
      if (event.type === "viewportChanged")
        return {
          ...state,
          pageSize: event.pageSize,
          page: Math.floor((state.page * state.pageSize) / event.pageSize),
        };
      return { ...state, page: state.page + event.offset };
    },
    { images: nonCoverImages, page: 0, pageSize },
  );
  if (pagination.images !== nonCoverImages)
    dispatch({ type: "imagesChanged", images: nonCoverImages });
  if (pagination.pageSize !== pageSize)
    dispatch({ type: "viewportChanged", pageSize });
  const pageCount = Math.max(1, Math.ceil(nonCoverImages.length / pageSize));
  const page = Math.max(0, Math.min(pagination.page, pageCount - 1));

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
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold">{collection.name}</h2>
              {ownerAvatar}
            </div>
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
                  {nonCoverImages
                    .slice(page * pageSize, (page + 1) * pageSize)
                    .map((image) => (
                      <ImageButton
                        alt={copy.imageAlt}
                        image={image}
                        key={image.id}
                        label={copy.gallery}
                        onClick={() =>
                          select(images.findIndex(({ id }) => id === image.id))
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
                      disabled={page === 0}
                      onClick={() =>
                        dispatch({ type: "pageMoved", offset: -1 })
                      }
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <FontAwesomeIcon
                        aria-hidden="true"
                        icon={faChevronLeft}
                      />
                    </Button>
                    <output aria-live="polite" className="text-sm">
                      {copy.pageStatus(page + 1, pageCount)}
                    </output>
                    <Button
                      aria-label={copy.nextPage}
                      disabled={page === pageCount - 1}
                      onClick={() => dispatch({ type: "pageMoved", offset: 1 })}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <FontAwesomeIcon
                        aria-hidden="true"
                        icon={faChevronRight}
                      />
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
