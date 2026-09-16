import { describe, expect, it } from "vitest";
import { resolveAuthenticatedLocale, resolveWebLocale } from "./locale";

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

describe("resolveAuthenticatedLocale", () => {
  it("uses the saved server locale before an anonymous locale", () => {
    expect(
      resolveAuthenticatedLocale({ settings: { locale: "en-US" } }, "es-MX"),
    ).toEqual({ locale: "en-US", shouldPersist: false });
  });

  it("promotes an explicit anonymous locale when the server has none", () => {
    expect(
      resolveAuthenticatedLocale({ settings: { locale: null } }, "es-MX"),
    ).toEqual({ locale: "es-MX", shouldPersist: true });
  });

  it("does not persist a browser-derived locale", () => {
    expect(
      resolveAuthenticatedLocale({ settings: { locale: null } }, null),
    ).toEqual({ locale: null, shouldPersist: false });
  });
});
