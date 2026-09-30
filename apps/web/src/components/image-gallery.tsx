import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type GalleryImage = { fileName: string; id: number; url: string };

export function ImageGallery({
  alt,
  closeLabel,
  groups,
  label,
  nextLabel,
  pageSize,
  previousLabel,
}: {
  alt: string;
  closeLabel: string;
  groups: Array<{ images: GalleryImage[]; label?: string }>;
  label: string;
  nextLabel: string;
  pageSize?: number;
  previousLabel: string;
}) {
  const images = groups.flatMap((group) => group.images);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const pageCount = pageSize ? Math.ceil(images.length / pageSize) : 1;
  const pageStart = pageSize ? page * pageSize : 0;
  const pageEnd = pageSize ? pageStart + pageSize : images.length;
  let groupOffset = 0;
  const select = (index: number) => {
    setSelectedIndex(index);
    dialogRef.current?.showModal();
  };
  const cycle = (offset: number) =>
    setSelectedIndex(
      (index) => (index + offset + images.length) % images.length,
    );

  if (!images.length) return null;
  return (
    <>
      {groups.map((group, groupIndex) => {
        const offset = groupOffset;
        groupOffset += group.images.length;
        const visibleImages = group.images.slice(
          Math.max(0, pageStart - offset),
          Math.max(0, pageEnd - offset),
        );
        const visibleOffset = Math.max(offset, pageStart);
        return visibleImages.length ? (
          <section
            aria-label={group.label ?? label}
            className="grid gap-3"
            key={`${group.label ?? label}-${groupIndex}`}
          >
            {group.label ? (
              <h2 className="m-0 text-lg font-semibold">{group.label}</h2>
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {visibleImages.map((image, index) => (
                <button
                  aria-label={`${label}: ${image.fileName}`}
                  className="overflow-hidden rounded-lg border border-border bg-card p-0 transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  key={image.id}
                  onClick={() => select(visibleOffset + index)}
                  type="button"
                >
                  <img
                    alt={alt}
                    className="aspect-4/3 w-full object-cover"
                    loading="lazy"
                    src={image.url}
                  />
                </button>
              ))}
            </div>
          </section>
        ) : null;
      })}
      {pageCount > 1 ? (
        <nav
          aria-label={label}
          className="flex items-center justify-center gap-3"
        >
          <Button
            aria-label={previousLabel}
            disabled={page === 0}
            onClick={() => setPage((current) => current - 1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronLeft />
          </Button>
          <Button
            aria-label={nextLabel}
            disabled={page === pageCount - 1}
            onClick={() => setPage((current) => current + 1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronRight />
          </Button>
        </nav>
      ) : null}
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
    </>
  );
}
