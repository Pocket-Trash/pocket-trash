import { describe, expect, it } from "vitest";
import { createApiServices } from "./services.js";

describe("API services factory", () => {
  it("isolates requests and lets webhooks run without storage bindings", () => {
    const bindings = {
      DATABASE_URL: "postgresql://user:password@localhost/test",
      APP_ENV: "test",
    };
    const first = createApiServices(bindings),
      second = createApiServices(bindings);
    expect(first.services).not.toBe(second.services);
    expect(first.logger).not.toBe(second.logger);
    expect(first.services.db).toBeDefined();
    expect(() => first.services.storage).toThrow("not been configured");
    const uploads = createApiServices(
      {
        ...bindings,
        BUNNY_STORAGE_ACCESS_KEY: "test",
        BUNNY_CDN_BASE_URL: "https://cdn.test",
        BUNNY_STORAGE_ENDPOINT: "https://storage.test",
        BUNNY_STORAGE_ZONE_NAME: "test",
        BUNNY_RESOURCE_FOLDER_PREFIX: "resources/dev",
        BUNNY_IMAGE_FOLDER_PREFIX: "images/dev",
      },
      { storage: true },
    );
    expect(uploads.services.storage).toBeDefined();
    expect(uploads.services.resources).toBeDefined();
  });
});
