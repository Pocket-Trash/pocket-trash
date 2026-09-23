import { createNoopLogger } from "@package/logger";
import { describe, expect, it } from "vitest";
import { createServices } from "./index.js";

describe("services", () => {
  it("throws a clear error when database services are used before configuration", () => {
    const services = createServices();

    expect(() => services.db).toThrow(
      "Database services have not been configured",
    );
  });

  it("throws a clear error when logger is used before configuration", () => {
    const services = createServices();

    expect(() => services.logger).toThrow(
      "Logger service has not been configured",
    );
  });

  it("throws a clear error when image services are used before configuration", () => {
    const services = createServices();

    expect(() => services.images).toThrow(
      "Image services have not been configured",
    );
  });

  it("throws a clear error when resource services are used before configuration", () => {
    expect(() => createServices().resources).toThrow(
      "Resource services have not been configured",
    );
  });

  it("rejects resource configuration without database configuration", () => {
    expect(() =>
      createServices().configure({
        logger: {
          app: "web",
          environment: "test",
          transports: [],
        },
        resources: {},
      }),
    ).toThrow("Resource services require database configuration");
  });

  it("configures logger independently", () => {
    const services = createServices();

    services.configure({
      logger: {
        app: "api",
        environment: "test",
        transports: [],
      },
    });

    expect(services.logger).toBeDefined();
    expect(() => services.db).toThrow(
      "Database services have not been configured",
    );
  });

  it("rejects database configuration without logger configuration", () => {
    const services = createServices();

    expect(() =>
      services.configure({
        db: {
          databaseUrl: "postgres://user:pass@example.test:5432/db",
        },
      } as Parameters<typeof services.configure>[0]),
    ).toThrow("Database services require logger configuration");
  });

  it("rejects image configuration without logger configuration", () => {
    const services = createServices();

    expect(() =>
      services.configure({
        images: {
          dryRun: true,
        },
      }),
    ).toThrow("Image services require logger configuration");
  });

  it("configures database when logger configuration is provided", () => {
    const services = createServices();

    services.configure({
      db: {
        databaseUrl: "postgres://user:pass@example.test:5432/db",
      },
      logger: {
        app: "api",
        environment: "test",
        transports: [],
      },
    });

    expect(services.db).toBeDefined();
    expect(services.logger).toBeDefined();
  });

  it("configures images when logger configuration is provided", () => {
    const services = createServices();

    services.configure({
      images: {
        dryRun: true,
      },
      logger: {
        app: "api",
        environment: "test",
        transports: [],
      },
    });

    expect(services.images).toBeDefined();
    expect(services.logger).toBeDefined();
  });

  it("accepts an existing logger instance for image services", () => {
    const services = createServices();
    const logger = createNoopLogger({ app: "scraper", environment: "test" });

    services.configure({
      images: {
        dryRun: true,
      },
      logger,
    });

    expect(services.logger).toBe(logger);
    expect(services.images).toBeDefined();
  });
});
