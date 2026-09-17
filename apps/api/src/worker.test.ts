import { afterEach, describe, expect, it, vi } from "vitest";
import worker, {
  ApiEnvValidationError,
  validateApiBindings,
} from "./worker.js";

describe("api worker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serves health without database or Clerk bindings", async () => {
    const response = await worker.fetch(
      new Request("https://api.example.test/api/v0/health"),
      { APP_ENV: "test" },
      { waitUntil: vi.fn() } as unknown as Parameters<typeof worker.fetch>[2],
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "api",
    });
  });

  it("rejects invalid logger environment values without exposing secrets", () => {
    expect(() =>
      validateApiBindings({
        AXIOM_TOKEN: "secret",
        LOGGER: "pretty",
        LOG_LEVEL: "loud",
      }),
    ).toThrow(
      new ApiEnvValidationError(["LOG_LEVEL", "LOGGER", "AXIOM_DATASET"]),
    );
  });

  it("returns 500 and logs Worker errors", async () => {
    const axiomFetch = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", axiomFetch);

    const response = await worker.fetch(
      new Request("https://api.example.test/api/v0/logs", {
        body: "{}",
        method: "POST",
      }),
      {
        APP_ENV: "test",
        AXIOM_DATASET: "test",
        AXIOM_TOKEN: "secret",
        LOG_LEVEL: "loud",
      },
      { waitUntil: vi.fn() } as unknown as Parameters<typeof worker.fetch>[2],
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Internal server error.",
    });
    expect(axiomFetch).toHaveBeenCalledOnce();
  });
});
