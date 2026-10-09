import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";
import { describe, expect, it } from "vitest";
import { createApp, openApiJsonPath } from "./app.js";
import { findOpenApiCoverageErrors } from "./openapi-coverage.js";
import { app as workerApp } from "./worker.js";

/** Live OpenAPI path items accepted by the coverage checker. */
const documentSchema = z.object({
  paths: z.record(z.string(), z.record(z.string(), z.unknown())),
});

describe("OpenAPI coverage", () => {
  it("reports an endpoint missing from the document", () => {
    expect(
      findOpenApiCoverageErrors([{ method: "GET", path: "/health" }], {}),
    ).toEqual(["Missing OpenAPI operation: GET /health"]);
  });

  it("covers every registration in the real API's live document", async () => {
    const response = await workerApp.request(openApiJsonPath);
    expect(response.status).toBe(200);
    const document = documentSchema.parse(await response.json());
    expect(findOpenApiCoverageErrors(workerApp.routes, document.paths)).toEqual(
      [],
    );
  });

  it("passes once a missing operation is documented", () => {
    expect(
      findOpenApiCoverageErrors([{ method: "GET", path: "/health" }], {
        "/health": { get: {} },
      }),
    ).toEqual([]);
  });

  it("checks methods independently and detects stale operations", () => {
    expect(
      findOpenApiCoverageErrors([{ method: "POST", path: "/health" }], {
        "/health": { get: {} },
      }),
    ).toEqual([
      "Missing OpenAPI operation: POST /health",
      "Stale OpenAPI operation: GET /health",
    ]);
  });

  it("normalizes parameters and deduplicates method-scoped middleware", () => {
    expect(
      findOpenApiCoverageErrors(
        [
          { method: "PUT", path: "/api/v0/sessions/:sessionId/files/:fileId" },
          { method: "PUT", path: "/api/v0/sessions/:sessionId/files/:fileId" },
        ],
        {
          "/api/v0/sessions/{sessionId}/files/{fileId}": {
            put: {},
            parameters: [],
          },
        },
      ),
    ).toEqual([]);
  });

  it("finds undocumented endpoints in nested routers and multi-method registrations", async () => {
    const nested = new OpenAPIHono();
    nested.on(["GET", "POST"], "/items/:id", (context) =>
      context.body(null, 204),
    );
    const app = createApp().route("/api/v0/nested", nested);
    const document = documentSchema.parse(
      await (await app.request(openApiJsonPath)).json(),
    );
    expect(findOpenApiCoverageErrors(app.routes, document.paths)).toEqual([
      "Missing OpenAPI operation: GET /api/v0/nested/items/{id}",
      "Missing OpenAPI operation: POST /api/v0/nested/items/{id}",
    ]);
  });

  it("does not skip handlers that also accept next", () => {
    const app = new OpenAPIHono();
    app.get("/hidden", async (context, next) => {
      if (context.req.header("x-return")) return context.body(null, 204);
      await next();
    });
    expect(findOpenApiCoverageErrors(app.routes, {})).toEqual([
      "Missing OpenAPI operation: GET /hidden",
    ]);
  });

  it.each([
    "all",
    "use",
  ] as const)("rejects opaque ALL registrations through %s", (registration) => {
    const app = new OpenAPIHono();
    /**
     * Serves a response from an opaque middleware registration.
     *
     * @param context - Test request context.
     * @param next - Remaining handlers.
     * @returns Empty response when requested, or completion of the next handler.
     */
    const handler: MiddlewareHandler = async (context, next) => {
      if (context.req.header("x-return")) return context.body(null, 204);
      await next();
    };
    if (registration === "all") app.all("/hidden/*", handler);
    else app.use("/hidden/*", handler);
    expect(findOpenApiCoverageErrors(app.routes, {}).join("\n")).toContain(
      "Unsupported route registration: ALL /hidden/*",
    );
  });

  it.each([
    "/items/:id?",
    "/items/:id{[0-9]+}",
    "/items/*/edit",
  ])("rejects unrepresentable patterns: %s", (path) => {
    expect(
      findOpenApiCoverageErrors([{ method: "GET", path }], {}).join("\n"),
    ).toContain(`Unsupported route registration: GET ${path}`);
  });

  it("requires the exact catch-all extension for wildcard endpoints", () => {
    const routes = [{ method: "OPTIONS", path: "/storage/*" }];
    expect(
      findOpenApiCoverageErrors(routes, { "/storage/{path}": { options: {} } }),
    ).toEqual(["Wildcard operation requires x-hono-path: OPTIONS /storage/*"]);
    expect(
      findOpenApiCoverageErrors(routes, {
        "/storage/{path}": { options: { "x-hono-path": "/storage/*" } },
      }),
    ).toEqual([]);
  });

  it("requires explicit HEAD and OPTIONS registrations", () => {
    expect(
      findOpenApiCoverageErrors(
        [
          { method: "HEAD", path: "/health" },
          { method: "OPTIONS", path: "/health" },
        ],
        {},
      ),
    ).toEqual([
      "Missing OpenAPI operation: HEAD /health",
      "Missing OpenAPI operation: OPTIONS /health",
    ]);
  });

  it("preserves implicit HEAD and unauthenticated wildcard storage preflight", async () => {
    const app = createApp();
    const head = await app.request("/api/v0/health", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    for (const path of [
      "/api/v0/storage/upload-sessions",
      "/api/v0/storage/unknown/nested",
    ]) {
      const response = await app.request(path, {
        method: "OPTIONS",
        headers: { origin: "https://untrusted.example" },
      });
      expect(response.status).toBe(204);
      expect(await response.text()).toBe("");
      expect(response.headers.get("access-control-allow-headers")).toBe(
        "authorization, content-type",
      );
      expect(response.headers.get("access-control-allow-methods")).toBe(
        "DELETE, POST, PUT, OPTIONS",
      );
      expect(response.headers.has("access-control-allow-origin")).toBe(false);
    }
  });
});
