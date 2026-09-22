import type { Database } from "@package/database";
import type { Logger } from "@package/logger";
import {
  createUserSettingsService,
  defaultUserSettings,
  type UpsertUserSettingsInput,
  type UserSettingsService,
} from "./user-settings/index.js";
import {
  createUsersService,
  type UserSyncResult,
  type UsersService,
} from "./users/index.js";

export type DbServices = {
  userSettings: UserSettingsService;
  users: UsersService;
};

export function createDbServices(db: Database, logger: Logger): DbServices {
  const users = createUsersService(db, logger);

  return {
    userSettings: createUserSettingsService(db, users, logger),
    users,
  };
}

export type {
  UpsertUserSettingsInput,
  UserSettingsService,
  UserSyncResult,
  UsersService,
};
export { defaultUserSettings };
