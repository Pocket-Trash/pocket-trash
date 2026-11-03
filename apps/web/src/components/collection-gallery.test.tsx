/** @vitest-environment jsdom */

import type { CatalogImage, UserCollectionSummary } from "@package/services";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import {
  CollectionGallery,
  type CollectionGalleryCopy,
} from "./collection-gallery";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/**
 * Creates a complete image record with deterministic gallery ordering.
 * @param id - Stable image ID and ordering position.
 * @returns Collection image fixture.
 */
function image(id: number): CatalogImage {
  return {
    id,
    fileName: `${id}.webp`,
    position: id,
    url: `/${id}.webp`,
    contentType: "image/webp",
    createdAt: new Date(0),
    deletedAt: null,
    deletedByClerkId: null,
    deletedByRole: null,
    objectPath: `${id}.webp`,
    size: 1,
  };
}

/** Collection fixture containing one cover and ten ordered gallery images. */
const collection: UserCollectionSummary = {
  coverImage: image(0),
  coverImages: Array.from({ length: 11 }, (_, id) => image(id)),
  createdAt: new Date(0),
  description: null,
  id: 1,
  isAdminPrivate: false,
  isPrivate: false,
  itemCount: 0,
  name: "Gallery",
  ownerUserId: 1,
  updatedAt: new Date(0),
};
/** Labels used by the public gallery controls. */
const copy: CollectionGalleryCopy = {
  closeImage: "Close",
  gallery: "Gallery",
  imageAlt: "Image",
  itemCount: "0 items",
  nextImage: "Next image",
  previousImage: "Previous image",
  nextPage: "Next page",
  previousPage: "Previous page",
  visibility: "Public",
  /**
   * Formats current pagination state.
   * @param page - Current one-based page.
   * @param count - Total pages.
   * @returns Pagination fixture text.
   */
  pageStatus: (page, count) => `${page}/${count}`,
};

it("retains gallery order and the first visible image across responsive page-size changes", async () => {
  const media = Object.assign(new EventTarget(), { matches: true });
  vi.stubGlobal("matchMedia", () => media);
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(<CollectionGallery collection={collection} copy={copy} />),
    );
    expect(
      container.querySelectorAll('button[aria-label^="Gallery:"]'),
    ).toHaveLength(10);
    expect(
      container.querySelector('button[aria-label="Gallery: 10.webp"]'),
    ).not.toBeNull();
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Next page"]')
        ?.click(),
    );
    expect(
      container.querySelectorAll('button[aria-label^="Gallery:"]'),
    ).toHaveLength(2);
    expect(
      container.querySelector('button[aria-label="Gallery: 1.webp"]'),
    ).not.toBeNull();
    media.matches = false;
    await act(async () => media.dispatchEvent(new Event("change")));
    expect(
      container.querySelectorAll('button[aria-label^="Gallery:"]'),
    ).toHaveLength(5);
    expect(container.querySelector("output")?.textContent).toBe("2/2");
    await act(async () =>
      root.render(
        <CollectionGallery
          collection={{
            ...collection,
            coverImages: [...collection.coverImages],
          }}
          copy={copy}
        />,
      ),
    );
    expect(container.querySelector("output")?.textContent).toBe("1/2");
    expect(
      container.querySelectorAll('button[aria-label^="Gallery:"]'),
    ).toHaveLength(7);
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
