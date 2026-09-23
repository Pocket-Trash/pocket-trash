import { loggerMessages } from "@package/logger";
import { describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";
import { formatCatalogCopy } from "./catalog-copy";

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
