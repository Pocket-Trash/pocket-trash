import { describe, expect, it } from "vitest";
import {
  getHelpDocument,
  getImageUploadGuidance,
  parseHelpDocument,
} from "./help-content";

describe("help content", () => {
  it("loads Spanish help content instead of falling back to English", () => {
    const english = getHelpDocument("en-US", "image-size-and-resolution-guide");
    const guide = getHelpDocument("es-MX", "image-size-and-resolution-guide");

    expect(guide?.body).not.toBe(english?.body);
    expect(guide?.metadata.title).toBe(
      "Guía de tamaño y resolución de imágenes",
    );
    expect(guide?.body).toContain("1200 × 900 píxeles");
    expect(getImageUploadGuidance("es-MX")).toEqual({
      helpLabel: "Leer la guía de tamaño y resolución de imágenes",
      warning:
        "Esta imagen no tiene una relación de aspecto de 4:3 y se recortará al mostrarse.",
    });
  });

  it("loads the image guide with its publishing metadata", () => {
    const guide = getHelpDocument("en-US", "image-size-and-resolution-guide");

    expect(guide?.metadata).toMatchObject({
      category: "Images",
      datePublished: "2026-09-23",
      title: "Image size and resolution guide",
    });
    expect(guide?.body).toContain("1200 × 900");
  });

  it("returns no document for unknown topics", () => {
    expect(getHelpDocument("en-US", "missing-guide")).toBeUndefined();
    expect(getHelpDocument("es-MX", "missing-guide")).toBeUndefined();
  });

  it("parses optional modified dates", () => {
    const document = parseHelpDocument(
      "---\ntitle: Test\ndatePublished: 2026-09-01\ndateModified: 2026-09-23\ncategory: Test\n---\nBody",
      "test",
    );

    expect(document.metadata.dateModified).toBe("2026-09-23");
  });
});
