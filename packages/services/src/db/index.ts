import type { Database } from "@package/database";
import type { Logger } from "@package/logger";
import { collectionAuditEvents } from "./audit/collections.js";
import { accountErasureAuditEvents } from "./audit/erasure.js";
import { featureFlagAuditEvents } from "./audit/feature-flags.js";
import { feedbackAuditEvents } from "./audit/feedback.js";
import { type AuditService, createAuditService } from "./audit/index.js";
import { productAuditEvents } from "./audit/products.js";
import { resourceAuditEvents } from "./audit/resources.js";
import { userBanAuditEvents } from "./audit/users.js";
import {
  type CatalogService,
  type CollectionsService,
  createCatalogService,
  createCollectionsService,
} from "./catalog/index.js";
import { createErasureService, type ErasureService } from "./erasure/index.js";
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

/** Database-backed domain services sharing one database client and logger. */
export type DbServices = {
  /** Audit event and export service. */
  audit: AuditService;
  /** Catalog product service. */
  catalog: CatalogService;
  /** User collection service. */
  collections: CollectionsService;
  /** Account-erasure workflow service. */
  erasure: ErasureService;
  /** Product-feedback service. */
  feedback: FeedbackService;
  /** User settings service. */
  userSettings: UserSettingsService;
  /** Application user service. */
  users: UsersService;
};

/**
 * Creates database-backed services.
 *
 * @param db - Application database.
 * @param logger - Application logger.
 * @returns Configured database services.
 */
export function createDbServices(db: Database, logger: Logger): DbServices {
  const audit = createAuditService(
    logger,
    [
      ...accountErasureAuditEvents,
      ...collectionAuditEvents,
      ...featureFlagAuditEvents,
      ...feedbackAuditEvents,
      ...productAuditEvents,
      ...resourceAuditEvents,
      ...userBanAuditEvents,
    ],
    db,
  );
  const users = createUsersService(db, logger, audit);

  return {
    audit,
    catalog: createCatalogService(db, logger, users, audit),
    collections: createCollectionsService(db, users, audit, logger),
    erasure: createErasureService(db, logger, undefined, audit),
    feedback: createFeedbackService(db, logger, audit),
    userSettings: createUserSettingsService(db, users, logger),
    users,
  };
}

export type {
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
  CreateAuditExportInput,
  DeleteAuditExportInput,
  DownloadAuditExportInput,
  ListAuditEventsInput,
} from "./audit/index.js";
export {
  AuditEventValidationError,
  AuditExportDeletionError,
  AuditExportEmptyError,
  AuditExportInProgressError,
  AuditPayloadTooLargeError,
  createAuditService,
} from "./audit/index.js";

export type {
  CatalogApprovalAction,
  CatalogApprovalStatus,
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
  ProductApprovalAction,
  ProductApprovalStatus,
  ProductWriteInput,
  PublicCollectionOwner,
  UserCollectionItem,
  UserCollectionSummary,
} from "./catalog/index.js";
export { CollectionButtonAlreadyInstalledError } from "./catalog/index.js";
export type {
  ApprovedErasureExceptionCode,
  CreateErasureRequestInput,
  ErasureOperationRequest,
  ErasureOperationResult,
  ErasureOperations,
  ErasureReceipt,
  ErasureService,
  RetryErasureRequestInput,
} from "./erasure/index.js";
export {
  AccountErasureInProgressError,
  createErasureService,
  createErasureSubjectHmac,
  ErasureOperationError,
} from "./erasure/index.js";
export type {
  AdminFeedbackItem,
  AdminFeedbackPage,
  AdminFeedbackSort,
  AdminFeedbackSortField,
  FeedbackAdminActionInput,
  FeedbackListItem,
  FeedbackMergeTarget,
  FeedbackNotificationItem,
  FeedbackPage,
  FeedbackService,
  LinearFeedbackSyncInput,
  LinearFeedbackSyncResult,
  ListAdminFeedbackOptions,
  ListMyFeedbackOptions,
  MergePendingFeedbackInput,
  SubmitFeedbackInput,
  UpdateAdminFeedbackInput,
  UpdatePendingFeedbackInput,
} from "./feedback/index.js";
export {
  FeedbackPlanRecoveryRequiredError,
  FeedbackStateError,
  FeedbackSubmissionLimitError,
} from "./feedback/index.js";
export type {
  UpsertUserSettingsInput,
  UserSettingsService,
} from "./user-settings/index.js";
export type {
  ApplyUserBanProviderState,
  SetUserBanStateInput,
  UserBanState,
  UserSyncResult,
  UsersService,
} from "./users/index.js";
export { UserBanStateError } from "./users/index.js";
export { defaultUserSettings };
