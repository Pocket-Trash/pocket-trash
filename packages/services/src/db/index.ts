import type { Database } from "@package/database";
import type { Logger } from "@package/logger";
import {
  type CatalogService,
  type CollectionsService,
  createCatalogService,
  createCollectionsService,
} from "./catalog/index.js";
import {
  createUserSettingsService,
  defaultUserSettings,
  type UserSettingsService,
} from "./user-settings/index.js";
import { createUsersService, type UsersService } from "./users/index.js";

export type DbServices = {
  catalog: CatalogService;
  collections: CollectionsService;
  userSettings: UserSettingsService;
  users: UsersService;
};

export function createDbServices(db: Database, logger: Logger): DbServices {
  const users = createUsersService(db, logger);

  return {
    catalog: createCatalogService(db, logger),
    collections: createCollectionsService(db, users, logger),
    userSettings: createUserSettingsService(db, users, logger),
    users,
  };
}

export type {
  CatalogProduct,
  CatalogProductType,
  CatalogService,
  CollectionsService,
  ProductWriteInput,
  UserCollectionItem,
} from "./catalog/index.js";
export type {
  UpsertUserSettingsInput,
  UserSettingsService,
} from "./user-settings/index.js";
export { defaultUserSettings };
