import type { DatabaseConfig } from "@package/database";
import { createDb } from "@package/database";
import type { ImageStorageConfig } from "@package/images";
import { createLogger, type Logger, type LoggerConfig } from "@package/logger";
import { createDbServices, type DbServices } from "./db/index.js";

export type {
  CatalogLookup,
  CatalogProduct,
  CatalogProductType,
  CatalogService,
  CollectionsService,
  ProductWriteInput,
  UpsertUserSettingsInput,
  UserCollectionItem,
  UserSettingsService,
} from "./db/index.js";
export { defaultUserSettings } from "./db/index.js";

import {
  createFeatureFlagsService,
  type FeatureFlagsService,
} from "./flags/index.js";
import { createImagesService, type ImagesService } from "./images/index.js";

export type {
  AdminTargetingFeatureFlag,
  FeatureFlagListItem,
  FeatureFlagsService,
  UserBetaFeatureFlag,
} from "./flags/index.js";

export type ServicesLoggerConfig = LoggerConfig | Logger;

export type ServicesConfig = {
  db?: DatabaseConfig;
  images?: ImageStorageConfig;
  logger?: ServicesLoggerConfig;
};

export class Services {
  #db?: DbServices;
  #flags?: FeatureFlagsService;
  #images?: ImagesService;
  #logger?: Logger;

  configure(config: ServicesConfig): void {
    if (config.db && !config.logger && !this.#logger) {
      throw new Error("Database services require logger configuration.");
    }

    if (config.images && !config.logger && !this.#logger) {
      throw new Error("Image services require logger configuration.");
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
  ImageStorageConfig,
  ImageUpdateInput,
  ImageUpdateResult,
  ImageUploadInput,
  ImageUploadResult,
  RemoteImageUploadInput,
} from "@package/images";
export type { ImagesService };
export { createImagesService };
