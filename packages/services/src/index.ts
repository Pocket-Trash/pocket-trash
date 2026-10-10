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

export type { Actor, Permission, Role } from "./authorization.js";
export {
  hasPermission,
  hasStaffPermission,
  normalizeActor,
  permissions,
} from "./authorization.js";
export { nextAvailableSlug, slugify, slugPattern } from "./catalog-slug.js";
export { adminFeedbackArchiveStatuses } from "./db/feedback/index.js";
export type {
  AdminFeedbackItem,
  AdminFeedbackPage,
  AdminFeedbackSort,
  AdminFeedbackSortField,
  AdminMaterial,
  AdminMaterialSummary,
  ApprovedErasureExceptionCode,
  AuditDeliveryFailure,
  AuditEventCursor,
  AuditEventDefinition,
  AuditEventPage,
  AuditExportDownload,
  AuditExportView,
  AuditPayload,
  AuditRedactionContext,
  AuditService,
  AuditWriteInput,
  CatalogApprovalAction,
  CatalogApprovalStatus,
  CatalogColor,
  CatalogCompatiblePen,
  CatalogConfigurationChoice,
  CatalogConfigurationSlot,
  CatalogFinishOption,
  CatalogImage,
  CatalogImageTargetType,
  CatalogImageTrashItem,
  CatalogIncludedComponent,
  CatalogLookup,
  CatalogMaker,
  CatalogPensAdminOptions,
  CatalogProduct,
  CatalogProductType,
  CatalogProductTypeSummary,
  CatalogRefillOffering,
  CatalogService,
  CatalogTerminologyAlias,
  CatalogTerminologyNamespace,
  CatalogViewer,
  CollectionsService,
  CreateAuditExportInput,
  DeleteAuditExportInput,
  DownloadAuditExportInput,
  EffectiveSliderSetup,
  ErasureOperationRequest,
  ErasureOperationResult,
  ErasureOperations,
  ErasureReceipt,
  ErasureService,
  FeedbackAdminActionInput,
  FeedbackListItem,
  FeedbackMergeTarget,
  FeedbackNotificationItem,
  FeedbackPage,
  FeedbackService,
  LinearFeedbackSyncInput,
  LinearFeedbackSyncResult,
  ListAdminFeedbackOptions,
  ListAuditEventsInput,
  ListMyFeedbackOptions,
  MaterialSelection,
  MaterialSpecific,
  MergePendingFeedbackInput,
  PensAdminWriteInput,
  ProductApprovalAction,
  ProductApprovalStatus,
  ProductMaterialAssignment,
  ProductWriteInput,
  PublicCollectionOwner,
  PublicMakerDetail,
  PublicMakerSummary,
  PublicMaterial,
  PublicMaterialSpecificSummary,
  PublicMaterialSummary,
  SliderMagnetConfiguration,
  SliderMagnetLayout,
  SliderMagnetPreset,
  SubmitFeedbackInput,
  UpdateAdminFeedbackInput,
  UpdatePendingFeedbackInput,
  UpsertUserSettingsInput,
  UserBanState,
  UserCollectionItem,
  UserCollectionSummary,
  UserSettingsService,
  UserSyncResult,
  UsersService,
} from "./db/index.js";
export {
  AccountErasureInProgressError,
  AuditEventValidationError,
  AuditExportDeletionError,
  AuditExportEmptyError,
  AuditExportInProgressError,
  AuditPayloadTooLargeError,
  CollectionAssemblyPrivacyBlockedError,
  CollectionButtonAlreadyInstalledError,
  CollectionItemPrivacyInheritedError,
  CollectionSliderComponentAlreadyInstalledError,
  createAuditService,
  createErasureService,
  createErasureSubjectHmac,
  defaultUserSettings,
  ErasureOperationError,
  FeedbackPlanRecoveryRequiredError,
  FeedbackStateError,
  FeedbackSubmissionLimitError,
  sliderClickCount,
  sliderMagnetConfigurationIsValid,
  sliderMagnetLayoutDetails,
  sliderMagnetLayouts,
  UserBanStateError,
} from "./db/index.js";
export type {
  DimensionMeasurement,
  DimensionUnit,
  Measurement,
  MeasurementSystem,
  WeightMeasurement,
  WeightUnit,
} from "./measurements.js";
export {
  convertDimension,
  convertWeight,
  formatMeasurement,
  gramsPerOunce,
  measurementsEqual,
  millimetersPerInch,
} from "./measurements.js";

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

/** Logger configuration or an existing logger accepted by the service registry. */
export type ServicesLoggerConfig = LoggerConfig | Logger;

/**
 * Environment-neutral dependencies for an application service registry.
 *
 * Logger configuration may stand alone. Database and image services require a
 * logger. Storage must be configured with a database in the same call and also
 * requires a configured or supplied logger.
 */
export type ServicesConfig = {
  /** Database client configuration for database-backed services. */
  db?: DatabaseConfig;
  /** Remote image storage configuration. */
  images?: RemoteImageStorageConfig;
  /** Logger configuration or an existing logger instance. */
  logger?: ServicesLoggerConfig;
  /** Upload storage configuration for resources and erasure workflows. */
  storage?: UploadStorageConfig;
};

/**
 * App-facing database, feature-flag, image, logger, resource, and storage
 * namespaces. Each getter fails until its namespace has been configured by the
 * importing server application.
 */
export class Services {
  /** Configured database-backed services. */
  #db?: DbServices;
  /** Configured feature-flag service. */
  #flags?: FeatureFlagsService;
  /** Configured remote-image service. */
  #images?: ImagesService;
  /** Configured application logger. */
  #logger?: Logger;
  /** Configured resource service. */
  #resources?: ResourcesService;
  /** Configured upload-storage service. */
  #storage?: StorageService;

  /**
   * Configures namespaces from app-supplied runtime settings without reading
   * environment variables.
   *
   * @param config - Runtime service configuration.
   * @throws When dependencies are missing or database, storage, or image configuration is invalid.
   */
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
      this.#flags = createFeatureFlagsService(
        db,
        this.#db.users,
        this.#logger,
        this.#db.audit,
      );
      if (config.storage) {
        const configStorage = config.storage;
        const storage = createUploadStorage(configStorage);
        this.#storage = createStorageService({
          audit: this.#db.audit,
          db,
          storage,
          logger: this.#logger,
        });
        this.#resources = createResourcesService(
          db,
          storage,
          this.#logger,
          (objectPath) => signResourceUrl({ ...configStorage, objectPath }),
          this.#db.audit,
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

  /**
   * Returns configured database-backed services.
   *
   * @returns Database-backed service collection.
   * @throws When database services have not been configured.
   */
  get db(): DbServices {
    if (!this.#db) {
      throw new Error(
        "Database services have not been configured. Import the app-local services module and provide database configuration before using s.db.",
      );
    }

    return this.#db;
  }

  /**
   * Returns the configured application logger.
   *
   * @returns Application logger.
   * @throws When a logger has not been configured.
   */
  get logger(): Logger {
    if (!this.#logger) {
      throw new Error(
        "Logger service has not been configured. Import the app-local services module and provide logger configuration before using s.logger.",
      );
    }

    return this.#logger;
  }

  /**
   * Returns the configured feature-flag service.
   *
   * @returns Feature-flag service.
   * @throws When database services have not been configured.
   */
  get flags(): FeatureFlagsService {
    if (!this.#flags) {
      throw new Error(
        "Feature flag services have not been configured. Import the app-local services module and provide database configuration before using s.flags.",
      );
    }

    return this.#flags;
  }

  /**
   * Returns the configured remote-image service.
   *
   * @returns Remote-image service.
   * @throws When image services have not been configured.
   */
  get images(): ImagesService {
    if (!this.#images) {
      throw new Error(
        "Image services have not been configured. Import the app-local services module and provide image configuration before using s.images.",
      );
    }

    return this.#images;
  }

  /**
   * Returns the configured upload-storage service.
   *
   * @returns Upload-storage service.
   * @throws When storage services have not been configured.
   */
  get storage(): StorageService {
    if (!this.#storage)
      throw new Error("Storage services have not been configured.");
    return this.#storage;
  }

  /**
   * Returns the configured resource service.
   *
   * @returns Resource service.
   * @throws When database-backed resource storage has not been configured.
   */
  get resources(): ResourcesService {
    if (!this.#resources) {
      throw new Error(
        "Resource services have not been configured. Import the app-local services module and provide database and resource storage configuration before using s.resources.",
      );
    }

    return this.#resources;
  }
}

/**
 * Creates an isolated, unconfigured application service registry.
 *
 * @returns New service registry.
 */
export function createServices(): Services {
  return new Services();
}

/** Shared service registry for application-local configuration. */
const services = createServices();

export default services;

/**
 * Checks whether a logger configuration value is an existing logger.
 *
 * @param value - Logger configuration or candidate logger.
 * @returns Whether the value exposes the logger operation contract.
 */
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
