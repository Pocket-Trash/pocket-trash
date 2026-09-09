import { describe, expect, it } from "vitest";
import { resolveWebLocale } from "./locale";

describe("resolveWebLocale", () => {
  it("uses a saved signed-out locale before browser preferences", () => {
    expect(resolveWebLocale("es-MX", ["en-US"])).toBe("es-MX");
  });

  it("falls back to English for unsupported browser languages", () => {
    expect(resolveWebLocale(null, ["fr-CA"])).toBe("en-US");
  });

  it("normalizes legacy saved English before browser preferences", () => {
    expect(resolveWebLocale("en", ["es-MX"])).toBe("en-US");
  });
});
