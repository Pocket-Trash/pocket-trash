import type { Database, FeatureFlag } from "@package/database";
import { createLogger } from "@package/logger";
import { describe, expect, it, vi } from "vitest";
import type { UsersService } from "../db/users/index.js";
import { createFeatureFlagsService } from "./index.js";

function createTestLogger() {
  return createLogger({
    app: "api",
    environment: "test",
    transports: [],
  });
}

function createUsersServiceMock(): UsersService {
  return {
    ensure: vi.fn(),
    getByClerkId: vi.fn(),
    syncFromClerk: vi.fn(),
  };
}

function createFlag(overrides: Partial<FeatureFlag> = {}): FeatureFlag {
  const now = new Date("2026-01-01T00:00:00.000Z");

  return {
    archivedAt: null,
    archivedByClerkId: null,
    audience: "admin",
    createdAt: now,
    createdByClerkId: "clerk-admin-1",
    defaultEnabled: false,
    description: null,
    id: "flag-1",
    name: "Admin beta",
    slug: "admin-beta",
    updatedAt: now,
    updatedByClerkId: "clerk-admin-1",
    ...overrides,
  };
}

function createFlagUpdateDbMock(flag: FeatureFlag) {
  let updateValues: Record<string, unknown> | null = null;
  const update = vi.fn(() => ({
    set: vi.fn((values: Record<string, unknown>) => {
      updateValues = values;

      return {
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            {
              ...flag,
              ...values,
            },
          ]),
        })),
      };
    }),
  }));

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([flag]),
        })),
      })),
    })),
    update,
  } as unknown as Database;

  return {
    db,
    getUpdateValues: () => updateValues,
    update,
  };
}

describe("feature flags service", () => {
  it("does not write audience during feature flag updates", async () => {
    const { db, getUpdateValues } = createFlagUpdateDbMock(createFlag());
    const service = createFeatureFlagsService(
      db,
      createUsersServiceMock(),
      createTestLogger(),
    );

    await expect(
      service.update({
        actorClerkId: "clerk-admin-2",
        description: "Updated description",
        name: "Updated admin beta",
        slug: "admin-beta",
      }),
    ).resolves.toMatchObject({
      audience: "admin",
      description: "Updated description",
      name: "Updated admin beta",
      slug: "admin-beta",
    });

    expect(getUpdateValues()).not.toHaveProperty("audience");
  });

  it("rejects stale callers that try to change a feature flag audience", async () => {
    const { db, update } = createFlagUpdateDbMock(createFlag());
    const service = createFeatureFlagsService(
      db,
      createUsersServiceMock(),
      createTestLogger(),
    );

    await expect(
      service.update({
        actorClerkId: "clerk-admin-2",
        audience: "user",
        slug: "admin-beta",
      } as Parameters<typeof service.update>[0]),
    ).rejects.toThrow("Feature flag audience cannot be changed.");

    expect(update).not.toHaveBeenCalled();
  });
});
