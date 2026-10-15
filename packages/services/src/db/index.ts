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
import { createTrendsService, type TrendsService } from "./trends/index.js";
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
  /** Privacy-safe public Trends service. */
  trends: TrendsService;
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
    trends: createTrendsService(db),
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
  AdminMaterial,
  AdminMaterialSummary,
  CatalogApprovalAction,
  CatalogApprovalStatus,
  CatalogColor,
  CatalogCompatiblePen,
  CatalogCompatiblePenPart,
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
  CatalogRefillCompatibilityTarget,
  CatalogRefillOffering,
  CatalogService,
  CatalogTerminologyAlias,
  CatalogTerminologyNamespace,
  CatalogViewer,
  CollectionItemOwnershipPeriod,
  CollectionItemOwnershipStart,
  CollectionItemOwnershipWrite,
  CollectionsService,
  EffectiveSliderSetup,
  MaterialCombination,
  MaterialSelection,
  MaterialSpecific,
  OwnershipEntryReason,
  OwnershipExitReason,
  PensAdminWriteInput,
  ProductApprovalAction,
  ProductApprovalStatus,
  ProductMaterialAssignment,
  ProductMaterialComponent,
  ProductWriteInput,
  PublicCollectionOwner,
  PublicMakerDetail,
  PublicMakerSummary,
  PublicMaterial,
  PublicMaterialSpecificSummary,
  PublicMaterialSummary,
  PublicProductTypeTrend,
  SliderMagnetConfiguration,
  SliderMagnetLayout,
  SliderMagnetPreset,
  TrendsProductTypeConfiguration,
  UserCollectionItem,
  UserCollectionSummary,
} from "./catalog/index.js";
export {
  CollectionAssemblyPrivacyBlockedError,
  CollectionButtonAlreadyInstalledError,
  CollectionItemPrivacyInheritedError,
  CollectionSliderComponentAlreadyInstalledError,
  collectionOwnershipEntryReasons,
  collectionOwnershipExitReasons,
  sliderClickCount,
  sliderMagnetConfigurationIsValid,
  sliderMagnetLayoutDetails,
  sliderMagnetLayouts,
} from "./catalog/index.js";
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
  ActivityTrendPoint,
  ActivityTrendRange,
  PublicActivityTrends,
  PublicCollectionItemProductTypeTrend,
  PublicCollectionItemTrends,
  PublicCollectionLifecycleFilters,
  PublicCollectionLifecycleTrendPoint,
  PublicCollectionLifecycleTrends,
  PublicCollectionMakerProductTrends,
  PublicCollectionMaterialTrends,
  PublicMakerProductTrend,
  PublicMaterialTrend,
  PublicPartAccessoryProductTypeTrend,
  PublicPartAccessoryTrends,
  PublicPenRefillTrends,
  PublicPenRefillTrendValue,
  PublicSliderTrend,
  PublicSliderTrends,
  PublicSliderTrendValue,
  PublicSpinnerTrend,
  PublicSpinnerTrends,
  PublicSpinnerTrendValue,
  SliderTrendMetricId,
  SpinnerTrendMetricId,
  TrendsService,
  UserActivityTrendPoint,
  UserActivityTrends,
  UserCollectionHistoryTrendPoint,
  UserCollectionHistoryTrends,
} from "./trends/index.js";
export {
  activityTrendRanges,
  createTrendsService,
  getActivityTrendRange,
  PUBLIC_TRENDS_CONTRIBUTOR_THRESHOLD,
  PUBLIC_TRENDS_ROUNDING_INCREMENT,
  PUBLIC_TRENDS_STALE_MS,
  SLIDER_TRENDS_COVERAGE_THRESHOLD,
  SPINNER_TRENDS_COVERAGE_THRESHOLD,
  sliderTrendMetricIds,
  spinnerTrendMetricIds,
} from "./trends/index.js";
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
