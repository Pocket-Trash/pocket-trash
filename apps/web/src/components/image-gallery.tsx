import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Image metadata required by gallery thumbnails and lightboxes.
 */
export type GalleryImage = {
  /** File name announced by thumbnail controls. */
  fileName: string;
  /** Stable image identifier. */
  id: number;
  /** Image source URL. */
  url: string;
};

/**
 * Renders non-empty image groups as thumbnails backed by one shared lightbox.
 *
 * @param props - Image gallery properties.
 * @param props.alt - Alternative text shared by the images.
 * @param props.closeLabel - Accessible label for closing the lightbox.
 * @param props.groups - Ordered image groups; empty groups are omitted.
 * @param props.label - Fallback group label and thumbnail label prefix.
 * @param props.nextLabel - Accessible label for the next-image control.
 * @param props.previousLabel - Accessible label for the previous-image control.
 * @returns The grouped gallery UI, or `null` when every group is empty.
 */
export function ImageGallery({
  alt,
  closeLabel,
  groups,
  label,
  nextLabel,
  previousLabel,
}: {
  /**
   * Alternative text shared by the images.
   */
  alt: string;
  /**
   * Accessible label for closing the lightbox.
   */
  closeLabel: string;
  /**
   * Ordered image groups; empty groups are omitted.
   */
  groups: Array<{
    /** Images displayed in this group. */
    images: GalleryImage[];
    /** Optional group heading and accessible label. */
    label?: string;
  }>;
  /**
   * Fallback group label and thumbnail label prefix.
   */
  label: string;
  /**
   * Accessible label for the next-image control.
   */
  nextLabel: string;
  /**
   * Accessible label for the previous-image control.
   */
  previousLabel: string;
}) {
  const images = groups.flatMap((group) => group.images);
  if (!images.length) return null;
  return (
    <ImageLightbox
      alt={alt}
      closeLabel={closeLabel}
      images={images}
      label={label}
      nextLabel={nextLabel}
      previousLabel={previousLabel}
    >
      {(select) => {
        let offset = 0;
        return groups.map((group, groupIndex) => {
          const groupOffset = offset;
          offset += group.images.length;
          return group.images.length ? (
            <section
              aria-label={group.label ?? label}
              className="grid gap-3"
              key={`${group.label ?? label}-${groupIndex}`}
            >
              {group.label ? (
                <h2 className="m-0 text-lg font-semibold">{group.label}</h2>
              ) : null}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {group.images.map((image, index) => (
                  <ImageButton
                    alt={alt}
                    image={image}
                    key={image.id}
                    label={label}
                    onClick={() => select(groupOffset + index)}
                  />
                ))}
              </div>
            </section>
          ) : null;
        });
      }}
    </ImageLightbox>
  );
}

/**
 * Renders a gallery thumbnail button for opening an image.
 *
 * @param props - Image button properties.
 * @param props.alt - Alternative text for the thumbnail image.
 * @param props.className - Additional CSS classes.
 * @param props.image - Image displayed by the thumbnail.
 * @param props.label - Accessible label prefix paired with the file name.
 * @param props.onClick - Opens the selected image.
 * @returns The image thumbnail button.
 */
export function ImageButton({
  alt,
  className = "",
  image,
  label,
  onClick,
}: {
  /**
   * Alternative text for the thumbnail image.
   */
  alt: string;
  /**
   * Additional CSS classes.
   *
   * @default ""
   */
  className?: string;
  /**
   * Image displayed by the thumbnail.
   */
  image: GalleryImage;
  /**
   * Accessible label prefix paired with the file name.
   */
  label: string;
  /** Opens the selected image. */
  onClick(): void;
}) {
  return (
    <button
      aria-label={`${label}: ${image.fileName}`}
      className={`overflow-hidden rounded-lg border border-border bg-card p-0 transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${className}`}
      onClick={onClick}
      type="button"
    >
      <img
        alt={alt}
        className="aspect-4/3 w-full object-cover"
        loading="lazy"
        src={image.url}
      />
    </button>
  );
}

/**
 * Renders caller-provided launchers and, when images exist, a modal lightbox with adjacent wraparound navigation.
 *
 * @param props - Image lightbox properties.
 * @param props.alt - Alternative text shared by lightbox images.
 * @param props.children - Renders image launchers with a guarded selection callback.
 * @param props.closeLabel - Accessible label for closing the lightbox.
 * @param props.images - Ordered images available in the lightbox; an empty array omits the dialog and makes selection inert.
 * @param props.label - Accessible label for the modal dialog.
 * @param props.nextLabel - Accessible label for the next-image control.
 * @param props.previousLabel - Accessible label for the previous-image control.
 * @returns The launcher content and, when images exist, the lightbox dialog.
 */
export function ImageLightbox({
  alt,
  children,
  closeLabel,
  images,
  label,
  nextLabel,
  previousLabel,
}: {
  /**
   * Alternative text shared by lightbox images.
   */
  alt: string;
  /**
   * Renders image launchers with the lightbox selection callback.
   *
   * @param select - Opens an existing image index and ignores invalid indexes.
   * @returns Launcher content rendered before the dialog.
   */
  children(select: (index: number) => void): ReactNode;
  /**
   * Accessible label for closing the lightbox.
   */
  closeLabel: string;
  /**
   * Ordered images available in the lightbox; an empty array omits the dialog and makes selection inert.
   */
  images: GalleryImage[];
  /**
   * Accessible label for the modal dialog.
   */
  label: string;
  /**
   * Accessible label for the next-image control.
   */
  nextLabel: string;
  /**
   * Accessible label for the previous-image control.
   */
  previousLabel: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  /**
   * Opens the lightbox at an existing image index.
   *
   * @param index - Zero-based image index; invalid indexes are ignored.
   */
  const select = (index: number) => {
    if (!images[index]) return;
    setSelectedIndex(index);
    dialogRef.current?.showModal();
  };
  /**
   * Moves to the adjacent image and wraps at either end.
   *
   * @param offset - Adjacent movement: `-1` for previous or `1` for next.
   */
  const cycle = (offset: number) => {
    setSelectedIndex(
      (index) => (index + offset + images.length) % images.length,
    );
  };

  return (
    <>
      {children(select)}
      {images.length ? (
        <dialog
          aria-label={label}
          className="m-auto h-screen w-screen max-w-none bg-transparent p-4 text-white backdrop:bg-black/90"
          onKeyDown={(event) => {
            if (images.length < 2) return;
            if (event.key === "ArrowRight") cycle(1);
            if (event.key === "ArrowLeft") cycle(-1);
          }}
          ref={dialogRef}
        >
          <div className="relative flex h-full items-center justify-center">
            <Button
              aria-label={closeLabel}
              className="absolute top-0 right-0 z-10"
              onClick={() => dialogRef.current?.close()}
              size="icon"
              type="button"
              variant="secondary"
            >
              <X />
            </Button>
            {images.length > 1 ? (
              <Button
                aria-label={previousLabel}
                className="absolute left-0 z-10"
                onClick={() => cycle(-1)}
                size="icon"
                type="button"
                variant="secondary"
              >
                <ChevronLeft />
              </Button>
            ) : null}
            {images[selectedIndex] ? (
              <img
                alt={alt}
                className="max-h-full max-w-full object-contain"
                src={images[selectedIndex].url}
              />
            ) : null}
            {images.length > 1 ? (
              <Button
                aria-label={nextLabel}
                className="absolute right-0 z-10"
                onClick={() => cycle(1)}
                size="icon"
                type="button"
                variant="secondary"
              >
                <ChevronRight />
              </Button>
            ) : null}
          </div>
        </dialog>
      ) : null}
    </>
  );
}
