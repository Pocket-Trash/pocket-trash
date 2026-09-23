import { describe, expect, it } from "vitest";
import { validateCatalogImages } from "./catalog-image-uploads";

describe("catalog image uploads", () => {
  it("enforces the per-operation catalog image limits", () => {
    const image = (size: number, name = "image.webp") =>
      ({ name, size, type: "image/webp" }) as File;

    expect(
      validateCatalogImages(
        Array.from({ length: 20 }, (_, index) => image(1, `${index}.webp`)),
      ),
    ).toBeUndefined();
    expect(
      validateCatalogImages(
        Array.from({ length: 21 }, (_, index) => image(1, `${index}.webp`)),
      )?.key,
    ).toBe("web.resources.validation.tooManyImages");
    expect(validateCatalogImages([image(25 * 1024 * 1024 + 1)])?.key).toBe(
      "web.resources.validation.imageTooLarge",
    );
    expect(
      validateCatalogImages(
        Array.from({ length: 9 }, (_, index) =>
          image(25 * 1024 * 1024, `${index}.webp`),
        ),
      )?.key,
    ).toBe("web.resources.validation.sessionTooLarge");
  });
});
