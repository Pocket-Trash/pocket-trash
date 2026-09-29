import { afterEach, describe, expect, it, vi } from "vitest";
import * as serviceFactories from "./lib/services.js";
import worker, {
  ApiEnvValidationError,
  handleWorkerScheduled,
  isAllowedWebOrigin,
  validateApiBindings,
  validateUploadBindings,
} from "./worker.js";

describe("api worker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it("validates upload bindings and environment-specific web origins", () => {
    expect(() => validateUploadBindings({ APP_ENV: "production" })).toThrow(
      new ApiEnvValidationError([
        "CLERK_SECRET_KEY",
        "DATABASE_URL",
        "BUNNY_CDN_BASE_URL",
        "BUNNY_RESOURCE_FOLDER_PREFIX",
        "BUNNY_IMAGE_FOLDER_PREFIX",
        "BUNNY_STORAGE_ACCESS_KEY",
        "BUNNY_STORAGE_ENDPOINT",
        "BUNNY_STORAGE_ZONE_NAME",
      ]),
    );
    expect(isAllowedWebOrigin("http://localhost:4005", "development")).toBe(
      true,
    );
    expect(
      isAllowedWebOrigin(
        "https://pocket-trash-git-pr-12.vercel.app",
        "preview",
      ),
    ).toBe(true);
    expect(isAllowedWebOrigin("https://pocket-trash.app", "production")).toBe(
      true,
    );
    expect(isAllowedWebOrigin("https://attacker.example", "production")).toBe(
      false,
    );
  });

  it.each([
    false,
    true,
  ])("flushes the scheduled cleanup logger even on failure (%s)", async (fails) => {
    const bindings = {
      APP_ENV: "production",
      CLERK_SECRET_KEY: "test-secret",
      DATABASE_URL: "postgresql://user:password@localhost/test",
      BUNNY_STORAGE_ACCESS_KEY: "test",
      BUNNY_CDN_BASE_URL: "https://cdn.test",
      BUNNY_STORAGE_ENDPOINT: "https://storage.test",
      BUNNY_STORAGE_ZONE_NAME: "test",
      BUNNY_RESOURCE_FOLDER_PREFIX: "resources/files",
      BUNNY_IMAGE_FOLDER_PREFIX: "images",
    };
    const runtime = serviceFactories.createApiServices(bindings, {
      storage: true,
    });
    const cleanup = vi.spyOn(runtime.services.storage, "cleanupExpired");
    if (fails) cleanup.mockRejectedValueOnce(new Error("private SQL payload"));
    else cleanup.mockResolvedValueOnce(0);
    const flush = vi.spyOn(runtime.logger, "flush");
    vi.spyOn(serviceFactories, "createApiServices").mockReturnValueOnce(
      runtime,
    );
    const tasks: Promise<unknown>[] = [];
    await handleWorkerScheduled(
      { cron: "15 * * * *", scheduledTime: 0 } as ScheduledController,
      bindings,
      {
        waitUntil(task: Promise<unknown>) {
          tasks.push(task);
        },
      } as ExecutionContext,
    );
    await Promise.all(tasks);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(flush).toHaveBeenCalledOnce();
  });

  it("does not schedule expired-session cleanup outside production", async () => {
    const waitUntil = vi.fn();

    await handleWorkerScheduled(
      { cron: "15 * * * *", scheduledTime: 0 } as ScheduledController,
      { APP_ENV: "preview" },
      { waitUntil } as unknown as ExecutionContext,
    );

    expect(waitUntil).not.toHaveBeenCalled();
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
