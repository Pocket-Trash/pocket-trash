/** @vitest-environment jsdom */

import { Activity, act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  imageHasDifferentAspectRatio,
  useImageFileValidation,
} from "./use-image-file-validation";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/**
 * Exposes the adapter's current selection result through a public hook consumer.
 * @param props - Supplied selection and expected ratio.
 * @returns Current validation guidance.
 */
function ValidationFixture({
  files,
  ratio,
}: {
  /** Externally supplied files. */
  files: readonly File[];
  /** Externally supplied expected ratio. */
  ratio?: number;
}) {
  return (
    <output>
      {useImageFileValidation(files, ratio) ? "mismatch" : "matching"}
    </output>
  );
}

/**
 * Completes one browser metadata response using native load dispatch.
 * @param image - Pending browser image.
 * @param width - Natural width.
 * @param height - Natural height.
 */
function load(image: HTMLImageElement, width: number, height: number) {
  Object.defineProperties(image, {
    naturalWidth: { configurable: true, value: width },
    naturalHeight: { configurable: true, value: height },
  });
  image.dispatchEvent(new Event("load"));
}

describe("image metadata adapter", () => {
  let container: HTMLDivElement;
  let root: Root;
  let images: HTMLImageElement[];
  beforeEach(() => {
    images = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation(
      () => `blob:metadata-${images.length}`,
    );
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.stubGlobal("Image", function () {
      const image = document.createElement("img");
      images.push(image);
      return image;
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps SSR pure and validates initially supplied files only after commit", async () => {
    const file = new File(["image"], "initial.png");
    expect(
      renderToString(<ValidationFixture files={[file]} ratio={4 / 3} />),
    ).toContain("matching");
    expect(images).toHaveLength(0);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    await act(async () =>
      root.render(<ValidationFixture files={[file]} ratio={4 / 3} />),
    );
    expect(images).toHaveLength(1);
    const image = images[0];
    if (!image) throw new Error("Missing pending image");
    await act(async () => load(image, 100, 100));
    expect(container.textContent).toBe("mismatch");
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      "blob:metadata-1",
    );
    expect(image.onload).toBeNull();
    expect(image.onerror).toBeNull();
    expect(image.getAttribute("src")).toBeNull();
  });

  it("cancels replaced selections, ignores captured late callbacks, and clears removed-file guidance", async () => {
    const first = new File(["first"], "first.png");
    const second = new File(["second"], "second.png");
    await act(async () =>
      root.render(<ValidationFixture files={[first]} ratio={4 / 3} />),
    );
    const oldImage = images[0];
    if (!oldImage) throw new Error("Missing first image");
    const late = oldImage.onload;
    await act(async () =>
      root.render(<ValidationFixture files={[second]} ratio={4 / 3} />),
    );
    expect(oldImage.onload).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    const current = images[1];
    if (!current) throw new Error("Missing replacement image");
    await act(async () => load(current, 400, 300));
    await act(async () => late?.call(oldImage, new Event("load")));
    expect(container.textContent).toBe("matching");
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    await act(async () =>
      root.render(<ValidationFixture files={[second]} ratio={1} />),
    );
    const changedRatio = images[2];
    if (!changedRatio) throw new Error("Missing changed-ratio image");
    await act(async () => load(changedRatio, 400, 300));
    expect(container.textContent).toBe("mismatch");
    await act(async () =>
      root.render(<ValidationFixture files={[]} ratio={1} />),
    );
    expect(container.textContent).toBe("matching");
  });

  it("does not repeat completed checks on identical file arrays or StrictMode/Activity resumption", async () => {
    const file = new File(["image"], "kept.png");
    /**
     * Keeps the same selected file through browser lifecycle resumption.
     * @param mode - Activity visibility.
     * @returns StrictMode-wrapped validation consumer.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <ValidationFixture files={[file]} ratio={4 / 3} />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    const current = images.at(-1);
    if (!current) throw new Error("Missing current image");
    await act(async () => load(current, 100, 100));
    expect(container.textContent).toBe("mismatch");
    const count = images.length;
    await act(async () => root.render(tree("visible")));
    await act(async () => root.render(tree("hidden")));
    await act(async () => root.render(tree("visible")));
    expect(images).toHaveLength(count);
    expect(container.textContent).toBe("mismatch");
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(count);
  });

  it("releases pending object URLs and handlers on unmount", async () => {
    await act(async () =>
      root.render(
        <ValidationFixture
          files={[new File(["image"], "pending.png")]}
          ratio={1}
        />,
      ),
    );
    const image = images[0];
    if (!image) throw new Error("Missing pending image");
    await act(async () => root.render(null));
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      "blob:metadata-1",
    );
    expect(image.onload).toBeNull();
    expect(image.onerror).toBeNull();
  });

  it("treats unreadable files, unavailable object URLs, and pre-aborted reads as matching", async () => {
    const file = new File(["broken"], "broken.png");
    const pending = imageHasDifferentAspectRatio(file, 1);
    images[0]?.dispatchEvent(new Event("error"));
    await expect(pending).resolves.toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    vi.mocked(URL.createObjectURL).mockImplementationOnce(() => {
      throw new Error("unreadable");
    });
    await expect(imageHasDifferentAspectRatio(file, 1)).resolves.toBe(false);
    expect(images[1]?.onload).toBeNull();
    const abort = new AbortController();
    abort.abort();
    const count = images.length;
    await expect(
      imageHasDifferentAspectRatio(file, 1, abort.signal),
    ).resolves.toBe(false);
    expect(images).toHaveLength(count);
  });
});
