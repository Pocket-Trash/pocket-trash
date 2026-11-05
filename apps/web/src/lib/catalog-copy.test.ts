import { loggerMessages } from "@package/logger";
import { describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";
import {
  catalogProductCreateLabel,
  catalogProductTypeLabel,
  formatCatalogCopy,
} from "./catalog-copy";

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

describe("catalog copy", () => {
  it("shows and logs a missing translation key", () => {
    expect(formatCatalogCopy("web.missing.testKey", {}, "en-US")).toBe(
      "web.missing.testKey",
    );
    expect(logger.error).toHaveBeenCalledWith(
      loggerMessages.web.localizationKeyMissing,
      {
        attributes: {
          locale: "en-US",
          translationKey: "web.missing.testKey",
        },
      },
    );
  });
});

describe("product type copy", () => {
  it("keeps actuator examples separate from complete creation actions in both locales", () => {
    for (const locale of ["en-US", "es-MX"] as const) {
      /**
       * Formats the current test locale.
       * @param key - Shared translation key.
       * @param values - Interpolation values.
       * @returns Localized copy for this assertion.
       */
      const t = (key: string, values: Readonly<Record<string, unknown>> = {}) =>
        formatCatalogCopy(key, values, locale);
      const label = catalogProductTypeLabel(t, "pen-actuator", "Pen Actuator");
      expect(label).toContain(
        locale === "en-US"
          ? "(e.g. bolt pin, button)"
          : "(p. ej., perno de accionamiento, botón)",
      );
      expect(catalogProductTypeLabel(t, undefined, "Pen Actuators")).toBe(
        label,
      );
      expect(catalogProductTypeLabel(t, "pen-clip", "Clip")).toBe("Clip");
      expect(catalogProductTypeLabel(t, undefined, "Custom actuator")).toBe(
        "Custom actuator",
      );
      expect(catalogProductCreateLabel(t, "pen-actuator")).toBe(
        locale === "en-US" ? "Add pen actuator" : "Agregar actuador de pluma",
      );
      expect(catalogProductCreateLabel(t)).toBe(t("web.action.addProduct"));
      expect(catalogProductCreateLabel(t, "unsupported")).toBe(
        t("web.action.addProduct"),
      );
    }
  });
});
