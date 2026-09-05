import type { Database, User, UserSettings } from "@package/database";
import {
  createLogger,
  type LogEvent,
  type LogTransport,
  loggerMessages,
} from "@package/logger";
import { describe, expect, it, vi } from "vitest";
import { hashLogIdentifier } from "../logging.js";
import { createUserSettingsService } from "./user-settings/index.js";
import { createUsersService } from "./users/index.js";

function captureLogger(events: LogEvent[]) {
  const transport: LogTransport = {
    log(event) {
      events.push(event);
    },
  };

  return createLogger({
    app: "api",
    environment: "test",
    transports: [transport],
  });
}

function createDbMock(input: {
  insertRows?: unknown[][];
  selectRows?: unknown[][];
}): Database & {
  conflictSets: unknown[];
  insertValues: unknown[];
} {
  const insertRows = [...(input.insertRows ?? [])];
  const selectRows = [...(input.selectRows ?? [])];
  const conflictSets: unknown[] = [];
  const insertValues: unknown[] = [];

  const db = {
    insert: vi.fn(() => ({
      values: vi.fn((value: unknown) => {
        insertValues.push(value);

        return {
          onConflictDoUpdate: vi.fn((config: { set: unknown }) => {
            conflictSets.push(config.set);

            return {
              returning: vi.fn().mockResolvedValue(insertRows.shift() ?? []),
            };
          }),
        };
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue(selectRows.shift() ?? []),
          })),
        })),
      })),
    })),
  } as unknown as Database;

  return Object.assign(db, { conflictSets, insertValues });
}

describe("database service logging", () => {
  it("logs users.ensure with a hashed clerk id", async () => {
    const events: LogEvent[] = [];
    const clerkId = "clerk-secret-123";
    const logger = captureLogger(events);
    const user: User = {
      clerkId,
      id: 1000,
    };
    const db = createDbMock({
      insertRows: [[user]],
    });
    const users = createUsersService(db, logger);

    await expect(users.ensure({ clerkId })).resolves.toEqual(user);
    await logger.flush();

    expect(events).toHaveLength(1);
    expect(events[0]?.message).toBe(
      `${loggerMessages.database.users.ensure}.succeeded`,
    );
    expect(events[0]?.attributes).toMatchObject({
      clerkIdHash: hashLogIdentifier(clerkId),
      operation: loggerMessages.database.users.ensure,
      outcome: "success",
    });
    expect(JSON.stringify(events)).not.toContain(clerkId);
  });

  it("logs users.ensure failures with a failure outcome", async () => {
    const events: LogEvent[] = [];
    const logger = captureLogger(events);
    const users = createUsersService(
      createDbMock({
        insertRows: [[]],
      }),
      logger,
    );

    await expect(users.ensure({ clerkId: "clerk-failed-1" })).rejects.toThrow(
      "Failed to ensure user",
    );
    await logger.flush();

    expect(events[0]?.message).toBe(
      `${loggerMessages.database.users.ensure}.failed`,
    );
    expect(events[0]?.attributes).toMatchObject({
      operation: loggerMessages.database.users.ensure,
      outcome: "failure",
    });
  });

  it("logs userSettings.getByClerkId with a hashed clerk id", async () => {
    const events: LogEvent[] = [];
    const clerkId = "clerk-settings-1";
    const logger = captureLogger(events);
    const settings: UserSettings = {
      currencyCode: "CAD",
      dimensionUnit: "in",
      locale: null,
      theme: "dark",
      userId: 1000,
      weightUnit: "g",
    };
    const service = createUserSettingsService(
      createDbMock({
        selectRows: [[settings]],
      }),
      createUsersService(createDbMock({}), logger),
      logger,
    );

    await expect(service.getByClerkId(clerkId)).resolves.toEqual(settings);
    await logger.flush();

    expect(events).toHaveLength(1);
    expect(events[0]?.message).toBe(
      `${loggerMessages.database.userSettings.getByClerkId}.succeeded`,
    );
    expect(events[0]?.attributes).toMatchObject({
      clerkIdHash: hashLogIdentifier(clerkId),
      operation: loggerMessages.database.userSettings.getByClerkId,
      outcome: "success",
    });
    expect(JSON.stringify(events)).not.toContain(clerkId);
  });

  it("logs nested upsert operations with settings metadata", async () => {
    const events: LogEvent[] = [];
    const clerkId = "clerk-upsert-1";
    const logger = captureLogger(events);
    const user: User = {
      clerkId,
      id: 1000,
    };
    const settings = {
      currencyCode: "USD",
      dimensionUnit: "mm",
      theme: "system",
      weightUnit: "oz",
    } as const;
    const userSettings: UserSettings = {
      ...settings,
      locale: null,
      userId: user.id,
    };
    const db = createDbMock({
      insertRows: [[user], [userSettings]],
    });
    const users = createUsersService(db, logger);
    const service = createUserSettingsService(db, users, logger);

    await expect(service.upsertForClerkId(clerkId, settings)).resolves.toEqual(
      userSettings,
    );
    await logger.flush();

    expect(events.map((event) => event.message)).toEqual([
      `${loggerMessages.database.users.ensure}.succeeded`,
      `${loggerMessages.database.userSettings.upsertForClerkId}.succeeded`,
    ]);
    expect(events[1]?.attributes).toMatchObject({
      clerkIdHash: hashLogIdentifier(clerkId),
      operation: loggerMessages.database.userSettings.upsertForClerkId,
      outcome: "success",
      settingKeys: ["currencyCode", "dimensionUnit", "theme", "weightUnit"],
      settings,
    });
    expect(JSON.stringify(events)).not.toContain(clerkId);
  });

  it("patches partial user settings over existing values", async () => {
    const events: LogEvent[] = [];
    const clerkId = "clerk-patch-existing-1";
    const logger = captureLogger(events);
    const existingSettings: UserSettings = {
      currencyCode: "CAD",
      dimensionUnit: "in",
      locale: null,
      theme: "dark",
      userId: 1000,
      weightUnit: "g",
    };
    const user: User = {
      clerkId,
      id: 1000,
    };
    const patchedSettings: UserSettings = {
      ...existingSettings,
      theme: "system",
    };
    const db = createDbMock({
      insertRows: [[user], [patchedSettings]],
      selectRows: [[existingSettings]],
    });
    const users = createUsersService(db, logger);
    const service = createUserSettingsService(db, users, logger);

    await expect(
      service.patchForClerkId(clerkId, { theme: "system" }),
    ).resolves.toEqual(patchedSettings);
    await logger.flush();

    expect(events.map((event) => event.message)).toEqual([
      `${loggerMessages.database.userSettings.getByClerkId}.succeeded`,
      `${loggerMessages.database.users.ensure}.succeeded`,
      `${loggerMessages.database.userSettings.patchForClerkId}.succeeded`,
    ]);
    expect(events[2]?.attributes).toMatchObject({
      clerkIdHash: hashLogIdentifier(clerkId),
      operation: loggerMessages.database.userSettings.patchForClerkId,
      outcome: "success",
      settingKeys: ["theme"],
      settings: { theme: "system" },
    });
    expect(db.insertValues[1]).toEqual({
      currencyCode: "CAD",
      dimensionUnit: "in",
      locale: null,
      theme: "system",
      userId: user.id,
      weightUnit: "g",
    });
    expect(db.conflictSets[1]).toEqual({
      currencyCode: "CAD",
      dimensionUnit: "in",
      locale: null,
      theme: "system",
      weightUnit: "g",
    });
    expect(JSON.stringify(events)).not.toContain(clerkId);
  });

  it("patches partial user settings over defaults when none exist", async () => {
    const events: LogEvent[] = [];
    const clerkId = "clerk-patch-defaults-1";
    const logger = captureLogger(events);
    const user: User = {
      clerkId,
      id: 1000,
    };
    const patchedSettings: UserSettings = {
      currencyCode: "USD",
      dimensionUnit: "in",
      locale: null,
      theme: "light",
      userId: user.id,
      weightUnit: "g",
    };
    const db = createDbMock({
      insertRows: [[user], [patchedSettings]],
      selectRows: [[]],
    });
    const users = createUsersService(db, logger);
    const service = createUserSettingsService(db, users, logger);

    await expect(
      service.patchForClerkId(clerkId, { theme: "light" }),
    ).resolves.toEqual(patchedSettings);
    await logger.flush();

    expect(events.map((event) => event.message)).toEqual([
      `${loggerMessages.database.userSettings.getByClerkId}.succeeded`,
      `${loggerMessages.database.users.ensure}.succeeded`,
      `${loggerMessages.database.userSettings.patchForClerkId}.succeeded`,
    ]);
    expect(events[2]?.attributes).toMatchObject({
      clerkIdHash: hashLogIdentifier(clerkId),
      operation: loggerMessages.database.userSettings.patchForClerkId,
      outcome: "success",
      settingKeys: ["theme"],
      settings: { theme: "light" },
    });
    expect(db.insertValues[1]).toEqual({
      currencyCode: "USD",
      dimensionUnit: "in",
      locale: null,
      theme: "light",
      userId: user.id,
      weightUnit: "g",
    });
    expect(db.conflictSets[1]).toEqual({
      currencyCode: "USD",
      dimensionUnit: "in",
      locale: null,
      theme: "light",
      weightUnit: "g",
    });
    expect(JSON.stringify(events)).not.toContain(clerkId);
  });

  it("persists a resolved locale when settings have no saved locale", async () => {
    const events: LogEvent[] = [];
    const clerkId = "clerk-locale-1";
    const logger = captureLogger(events);
    const existingSettings: UserSettings = {
      currencyCode: "CAD",
      dimensionUnit: "mm",
      locale: null,
      theme: "light",
      userId: 1000,
      weightUnit: "oz",
    };
    const savedSettings: UserSettings = {
      ...existingSettings,
      locale: "es-MX",
    };
    const user: User = {
      clerkId,
      id: existingSettings.userId,
    };
    const db = createDbMock({
      insertRows: [[user], [savedSettings]],
      selectRows: [[existingSettings]],
    });
    const users = createUsersService(db, logger);
    const service = createUserSettingsService(db, users, logger);

    await expect(
      service.resolveLocaleForClerkId(clerkId, ["fr-CA", "es-MX"]),
    ).resolves.toBe("es-MX");
    await logger.flush();

    expect(events.map((event) => event.message)).toEqual([
      `${loggerMessages.database.userSettings.getByClerkId}.succeeded`,
      `${loggerMessages.database.users.ensure}.succeeded`,
      `${loggerMessages.database.userSettings.upsertForClerkId}.succeeded`,
    ]);
    expect(db.insertValues[1]).toEqual({
      currencyCode: "CAD",
      dimensionUnit: "mm",
      locale: "es-MX",
      theme: "light",
      userId: user.id,
      weightUnit: "oz",
    });
    expect(JSON.stringify(events)).not.toContain(clerkId);
  });

  it("treats a legacy saved English locale as English", async () => {
    const events: LogEvent[] = [];
    const clerkId = "clerk-locale-legacy-1";
    const logger = captureLogger(events);
    const existingSettings = {
      currencyCode: "USD",
      dimensionUnit: "in",
      locale: "en",
      theme: "system",
      userId: 1000,
      weightUnit: "g",
    };
    const db = createDbMock({
      selectRows: [[existingSettings]],
    });
    const users = createUsersService(db, logger);
    const service = createUserSettingsService(db, users, logger);

    await expect(
      service.resolveLocaleForClerkId(clerkId, ["es-MX"]),
    ).resolves.toBe("en-US");
    await logger.flush();

    expect(events.map((event) => event.message)).toEqual([
      `${loggerMessages.database.userSettings.getByClerkId}.succeeded`,
    ]);
    expect(db.insertValues).toEqual([]);
  });
});
