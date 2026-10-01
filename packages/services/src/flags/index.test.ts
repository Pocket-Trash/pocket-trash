import type { Database, FeatureFlag } from "@package/database";
import { createLogger } from "@package/logger";
import { describe, expect, it, vi } from "vitest";
import type { AuditService } from "../db/audit/index.js";
import type { UsersService } from "../db/users/index.js";
import { createFeatureFlagsService } from "./index.js";

/**
 * Creates the no-op logger used by focused feature-flag tests.
 *
 * @returns Test logger.
 */
function createTestLogger() {
  return createLogger({
    app: "api",
    environment: "test",
    transports: [],
  });
}

/**
 * Creates user-service dependencies for focused feature-flag tests.
 *
 * @returns Mocked user service.
 */
function createUsersServiceMock(): UsersService {
  return {
    ensure: vi.fn().mockResolvedValue({
      clerkId: "clerk-admin-2",
      clerkUpdatedAt: null,
      id: 1000,
      username: "Admin",
    }),
    getByClerkId: vi.fn(),
    listClerkIds: vi.fn(),
    syncFromClerk: vi.fn(),
  };
}

/**
 * Creates a complete persisted feature-flag fixture.
 *
 * @param overrides - Fixture fields to replace.
 * @returns Persisted feature-flag fixture.
 */
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

/**
 * Creates a database mock for feature-flag update behavior.
 *
 * @param flag - Current persisted feature flag.
 * @returns Database mock and update observations.
 */
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
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi
            .fn()
            .mockResolvedValue([{ id: 1000, username: "Admin" }]),
        })),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            for: vi.fn().mockResolvedValue([flag]),
          })),
        })),
      })),
    })),
    transaction: vi.fn(async (callback) => await callback(db)),
    update,
  } as unknown as Database;

  return {
    db,
    /**
     * Returns fields passed to the feature-flag update.
     *
     * @returns Captured update fields, or `null` before an update.
     */
    getUpdateValues: () => updateValues,
    update,
  };
}

/**
 * Creates the audit dependency used by focused feature-flag tests.
 *
 * @returns Mocked audit service.
 */
function createAuditServiceMock(): AuditService {
  return { write: vi.fn() } as unknown as AuditService;
}

describe("feature flags service", () => {
  it("does not write audience during feature flag updates", async () => {
    const { db, getUpdateValues } = createFlagUpdateDbMock(createFlag());
    const service = createFeatureFlagsService(
      db,
      createUsersServiceMock(),
      createTestLogger(),
      createAuditServiceMock(),
    );

    await expect(
      service.update({
        actor: { clerkId: "clerk-admin-2", role: "admin" },
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
      createAuditServiceMock(),
    );

    await expect(
      service.update({
        actor: { clerkId: "clerk-admin-2", role: "admin" },
        audience: "user",
        slug: "admin-beta",
      } as Parameters<typeof service.update>[0]),
    ).rejects.toThrow("Feature flag audience cannot be changed.");

    expect(update).not.toHaveBeenCalled();
  });
});
