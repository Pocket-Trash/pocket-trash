import type { DatabaseConfig } from "@package/database";
import { createDb } from "@package/database";
import { createLogger, type Logger, type LoggerConfig } from "@package/logger";
import type {
  RemoteImageStorageConfig,
  UploadStorageConfig,
} from "@package/storage";
import { createUploadStorage, signResourceUrl } from "@package/storage";
import { createDbServices, type DbServices } from "./db/index.js";
import { createStorageService, type StorageService } from "./storage/index.js";

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
  UpsertUserSettingsInput,
  UserCollectionItem,
  UserCollectionSummary,
  UserSettingsService,
  UserSyncResult,
  UsersService,
} from "./db/index.js";
export { defaultUserSettings } from "./db/index.js";

import {
  createFeatureFlagsService,
  type FeatureFlagsService,
} from "./flags/index.js";
import { createImagesService, type ImagesService } from "./images/index.js";
import {
  createResourcesService,
  type ResourcesService,
} from "./resources/index.js";

export type {
  AdminTargetingFeatureFlag,
  FeatureFlagListItem,
  FeatureFlagsService,
  UserBetaFeatureFlag,
} from "./flags/index.js";

export type ServicesLoggerConfig = LoggerConfig | Logger;

export type ServicesConfig = {
  db?: DatabaseConfig;
  images?: RemoteImageStorageConfig;
  logger?: ServicesLoggerConfig;
  storage?: UploadStorageConfig;
};

export class Services {
  #db?: DbServices;
  #flags?: FeatureFlagsService;
  #images?: ImagesService;
  #logger?: Logger;
  #resources?: ResourcesService;
  #storage?: StorageService;

  configure(config: ServicesConfig): void {
    if (config.db && !config.logger && !this.#logger) {
      throw new Error("Database services require logger configuration.");
    }

    if (config.images && !config.logger && !this.#logger) {
      throw new Error("Image services require logger configuration.");
    }

    if (config.storage && !config.db) {
      throw new Error("Storage services require database configuration.");
    }

    if (config.logger) {
      this.#logger = isLogger(config.logger)
        ? config.logger
        : createLogger(config.logger);
    }

    if (config.db) {
      if (!this.#logger) {
        throw new Error("Database services require logger configuration.");
      }

      const db = createDb(config.db);
      this.#db = createDbServices(db, this.#logger);
      this.#flags = createFeatureFlagsService(db, this.#db.users, this.#logger);
      if (config.storage) {
        const configStorage = config.storage;
        const storage = createUploadStorage(configStorage);
        this.#storage = createStorageService({
          db,
          storage,
          logger: this.#logger,
        });
        this.#resources = createResourcesService(
          db,
          storage,
          this.#logger,
          (objectPath) => signResourceUrl({ ...configStorage, objectPath }),
        );
      }
    }

    if (config.images) {
      if (!this.#logger) {
        throw new Error("Image services require logger configuration.");
      }

      this.#images = createImagesService(config.images, this.#logger);
    }
  }

  get db(): DbServices {
    if (!this.#db) {
      throw new Error(
        "Database services have not been configured. Import the app-local services module and provide database configuration before using s.db.",
      );
    }

    return this.#db;
  }

  get logger(): Logger {
    if (!this.#logger) {
      throw new Error(
        "Logger service has not been configured. Import the app-local services module and provide logger configuration before using s.logger.",
      );
    }

    return this.#logger;
  }

  get flags(): FeatureFlagsService {
    if (!this.#flags) {
      throw new Error(
        "Feature flag services have not been configured. Import the app-local services module and provide database configuration before using s.flags.",
      );
    }

    return this.#flags;
  }

  get images(): ImagesService {
    if (!this.#images) {
      throw new Error(
        "Image services have not been configured. Import the app-local services module and provide image configuration before using s.images.",
      );
    }

    return this.#images;
  }

  get storage(): StorageService {
    if (!this.#storage)
      throw new Error("Storage services have not been configured.");
    return this.#storage;
  }

  get resources(): ResourcesService {
    if (!this.#resources) {
      throw new Error(
        "Resource services have not been configured. Import the app-local services module and provide database and resource storage configuration before using s.resources.",
      );
    }

    return this.#resources;
  }
}

export function createServices(): Services {
  return new Services();
}

const services = createServices();

export default services;

function isLogger(value: ServicesLoggerConfig): value is Logger {
  return (
    typeof value === "object" &&
    value !== null &&
    "operation" in value &&
    typeof value.operation === "function"
  );
}

export type {
  ImageUpdateInput,
  ImageUpdateResult,
  ImageUploadInput,
  ImageUploadResult,
  RemoteImageStorageConfig,
  RemoteImageUploadInput,
  UploadInput,
  UploadResult,
  UploadStorageConfig,
} from "@package/storage";
export { signResourceUrl } from "@package/storage";
export { signImages } from "./images/sign-images.js";
export type {
  CreateResourceInput,
  ResourceDetail,
  ResourceDirectory,
  ResourceDirectoryItem,
  ResourceImageDetail,
  ResourceNotificationItem,
  ResourcesService,
  ResourceTrashItem,
  ResourceVersionDetail,
  UpdateResourceInput,
  UploadResourceVersionInput,
} from "./resources/index.js";
export {
  createConfiguredResourcesService,
  createResourcesService,
} from "./resources/index.js";

export * from "./storage/index.js";
export type { ImagesService };
export { createImagesService };
