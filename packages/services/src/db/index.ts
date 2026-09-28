import type { Database } from "@package/database";
import type { Logger } from "@package/logger";
import {
  type CatalogService,
  type CollectionsService,
  createCatalogService,
  createCollectionsService,
} from "./catalog/index.js";
import {
  createFeedbackService,
  type FeedbackService,
} from "./feedback/index.js";
import {
  createUserSettingsService,
  defaultUserSettings,
  type UserSettingsService,
} from "./user-settings/index.js";
import { createUsersService, type UsersService } from "./users/index.js";

export type DbServices = {
  catalog: CatalogService;
  collections: CollectionsService;
  feedback: FeedbackService;
  userSettings: UserSettingsService;
  users: UsersService;
};

export function createDbServices(db: Database, logger: Logger): DbServices {
  const users = createUsersService(db, logger);

  return {
    catalog: createCatalogService(db, logger),
    collections: createCollectionsService(db, users, logger),
    feedback: createFeedbackService(db, logger),
    userSettings: createUserSettingsService(db, users, logger),
    users,
  };
}

export type {
  CatalogColor,
  CatalogFinishOption,
  CatalogImage,
  CatalogImageTargetType,
  CatalogImageTrashItem,
  CatalogLookup,
  CatalogProduct,
  CatalogProductType,
  CatalogService,
  CatalogViewer,
  CollectionsService,
  ProductWriteInput,
  PublicCollectionOwner,
  UserCollectionItem,
  UserCollectionSummary,
} from "./catalog/index.js";
export type {
  FeedbackService,
  SubmitFeedbackInput,
  UpdatePendingFeedbackInput,
} from "./feedback/index.js";
export {
  FeedbackStateError,
  FeedbackSubmissionLimitError,
} from "./feedback/index.js";
export type {
  UpsertUserSettingsInput,
  UserSettingsService,
} from "./user-settings/index.js";
export type { UserSyncResult, UsersService } from "./users/index.js";
export { defaultUserSettings };
