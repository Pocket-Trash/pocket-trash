import type { AuditJsonObject, Database } from "@package/database";
import { schema } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { type Actor, hasPermission } from "../../authorization.js";
import { nextAvailableSlug } from "../../catalog-slug.js";
import { normalizeCatalogSearch } from "../../catalog-terminology.js";
import { hashLogIdentifier, loggedMutation } from "../../logging.js";
import {
  attachImages as attachStoredImages,
  lockTarget,
  selectCollectionCover as selectStoredCover,
} from "../../storage/image-records.js";
import { queueObjectDeletions } from "../../storage/object-lifecycle.js";
import type {
  UploadActor,
  UploadedFile,
  UploadTarget,
} from "../../storage/types.js";
import { collectionAudit, writeCollectionAudit } from "../audit/collections.js";
import type { AuditService } from "../audit/index.js";
import {
  productAudit,
  writeProductAdminAudit,
  writeProductAudit,
} from "../audit/products.js";
import type { UsersService } from "../users/index.js";
import {
  collectionDeletionState,
  collectionItemDeletionState,
} from "./deletion-state.js";

/**
 * Error raised for collection button already installed.
 */
export class CollectionButtonAlreadyInstalledError extends Error {
  /**
   * Creates the error reported when a button is already assigned elsewhere.
   */
  constructor() {
    super("Collection button is already installed on another spinner.");
    this.name = "CollectionButtonAlreadyInstalledError";
  }
}

/**
 * Returns the violated PostgreSQL unique-constraint name.
 *
 * @param error - Candidate error.
 * @returns Constraint name, or `undefined` for other errors.
 */
function uniqueConstraint(error: unknown): string | undefined {
  const databaseError =
    error instanceof Error && error.cause !== undefined ? error.cause : error;
  if (
    typeof databaseError === "object" &&
    databaseError !== null &&
    "code" in databaseError &&
    databaseError.code === "23505" &&
    "constraint" in databaseError &&
    typeof databaseError.constraint === "string"
  ) {
    return databaseError.constraint;
  }
  return undefined;
}

/**
 * Catalog name conflict messages.
 */
const catalogNameConflictMessages: Record<string, string> = {
  color_name_case_insensitive_unique: "Color name already exists.",
  finish_name_case_insensitive_unique: "Finish name already exists.",
  makers_name_case_insensitive_unique: "Maker name already exists.",
  makers_root_url_unique: "Maker root URL already exists.",
  makers_slug_unique: "Maker slug already exists.",
  materials_name_case_insensitive_unique: "Material name already exists.",
  pattern_name_case_insensitive_unique: "Pattern name already exists.",
  compatibility_family_maker_name_unique:
    "Compatibility family name already exists for this maker.",
  catalog_terminology_alias_maker_concept_value_unique:
    "Alias already exists for this maker and concept.",
  catalog_terminology_alias_preferred_unique:
    "A preferred alias already exists for this maker and concept.",
};

/**
 * Maps catalog name conflict.
 *
 * @param error - Candidate error.
 * @returns Never returns.
 * @throws The mapped name-conflict error, or the original error when unmatched.
 */
function mapCatalogNameConflict(error: unknown): never {
  const message = catalogNameConflictMessages[uniqueConstraint(error) ?? ""];
  if (message) throw new Error(message);
  throw error;
}

/**
 * Product category supported by the spinner catalog.
 */
export type CatalogProductType =
  | "slider"
  | "slider-insert"
  | "slider-plate"
  | "spinner"
  | "spinner-button";

/** Registered canonical namespace supported by catalog terminology. */
export type CatalogTerminologyNamespace = "product-type";

/** Maker-scoped catalog terminology alias exposed to clients. */
export type CatalogTerminologyAlias = {
  /** Registered canonical key named by the alias. */
  canonicalKey: CatalogProductType;
  /** Registered namespace containing the canonical key. */
  canonicalNamespace: CatalogTerminologyNamespace;
  /** Creation timestamp. */
  createdAt: Date;
  /** Database identifier. */
  id: number;
  /** Whether this is the maker's display term for the concept. */
  isPreferred: boolean;
  /** User-visible, non-localized catalog name. */
  label: string;
  /** Maker identifier scoping the alias. */
  makerId: number;
  /** Maker display name. */
  makerName: string;
  /** Stable comparison value. */
  normalizedValue: string;
  /** Last-updated timestamp. */
  updatedAt: Date;
};

/**
 * Narrows a persisted product-type slug to the supported exhaustive union.
 *
 * @param value - Product-type slug loaded from the database.
 * @returns The supported product type.
 * @throws When the catalog contains an unsupported product type.
 */
function catalogProductType(value: string): CatalogProductType {
  switch (value) {
    case "slider":
    case "slider-insert":
    case "slider-plate":
    case "spinner":
    case "spinner-button":
      return value;
    default:
      throw new Error(`Unsupported catalog product type: ${value}`);
  }
}
/** Explicit physical host for a slider product's magnet system. */
export type SliderMagnetSystem = "body-hosted" | "insert-driven";
/** Meaning of a slider body's recorded weight. */
export type SliderWeightBasis = "body-only" | "complete-build";
/** Durable review state for a catalog product or collection item. */
export type CatalogApprovalStatus = "approved" | "pending" | "rejected";
/** Administrative transition accepted by a catalog approval workflow. */
export type CatalogApprovalAction = "approve" | "reject" | "reverse";
/** Product approval state retained for existing service consumers. */
export type ProductApprovalStatus = CatalogApprovalStatus;
/** Product approval action retained for existing service consumers. */
export type ProductApprovalAction = CatalogApprovalAction;

/**
 * Shared identity and routing fields for catalog reference data.
 */
export type CatalogLookup = {
  /**
   * Database identifier.
   */
  id: number;
  /**
   * Display name.
   */
  name: string;
  /**
   * URL-safe identifier.
   */
  slug: string;
};

/** Maker profile shared by catalog forms and administration routes. */
export type CatalogMaker = {
  /** Optional Markdown profile description. */
  description: string | null;
  /** Database identifier. */
  id: number;
  /** Ordered active images, plus archived images for authorized administration reads. */
  images: CatalogImage[];
  /** Display name. */
  name: string;
  /** Optional external website root URL. */
  rootUrl: string | null;
  /** Stable public URL identifier. */
  slug: string;
};

/** Public maker directory entry with visibility-filtered catalog totals. */
export type PublicMakerSummary = CatalogMaker & {
  /** Distinct public collection items associated with the maker. */
  collectionItemCount: number;
  /** Distinct approved public products associated with the maker. */
  productCount: number;
};

/** Public maker profile with its visibility-filtered related catalog data. */
export type PublicMakerDetail = CatalogMaker & {
  /** Distinct owned and unsold public collection items associated with the maker. */
  collectionItems: UserCollectionItem[];
  /** Distinct approved public products associated with the maker. */
  products: CatalogProduct[];
};

/** Maker-scoped reviewed compatibility family. */
export type CatalogCompatibilityFamily = CatalogLookup & {
  /** Maker that defines the family. */
  makerId: number;
  /** Maker display name. */
  makerName: string;
};

/** Reviewed warning that remains distinct from enforced family compatibility. */
export type CatalogCompatibilityAdvisory = {
  /** Advisory database identifier. */
  id: number;
  /** Exact related product identifier. */
  relatedProductId: number;
  /** Exact related product display name. */
  relatedProductName: string;
  /** Review timestamp. */
  reviewedAt: Date;
  /** Non-blocking reviewed warning text. */
  text: string;
};

/** Exact product relationship describing a component sold with a parent. */
export type CatalogIncludedComponent = CatalogLookup & {
  /** Canonical component product type. */
  productTypeSlug: "slider-insert" | "slider-plate";
};

/**
 * Catalog color lookup with its hexadecimal display value.
 */
export type CatalogColor = CatalogLookup & {
  /**
   * Hexadecimal color value.
   */
  hex: string;
};

/**
 * Appearance option with its optional pattern, effect, colors, and finish layers.
 */
export type CatalogFinishOption = {
  /**
   * Visual effect applied across the option, or `null` for none.
   */
  colorEffect: CatalogLookup | null;
  /**
   * Ordered colors in the option.
   */
  colors: CatalogColor[];
  /**
   * Ordered surface finishes in the option.
   */
  finishes: CatalogLookup[];
  /**
   * Finish-option database identifier.
   */
  id: number;
  /**
   * Reusable surface pattern, or `null` for none.
   */
  pattern: CatalogLookup | null;
};

/**
 * Authenticated actor whose permissions control catalog visibility.
 */
export type CatalogViewer = Actor;

/**
 * Stored catalog image metadata, ordering, and soft-deletion state.
 */
export type CatalogImage = {
  /**
   * Content type.
   */
  contentType: string;
  /**
   * Created timestamp.
   */
  createdAt: Date;
  /**
   * Deleted timestamp.
   */
  deletedAt: Date | null;
  /**
   * Deleted by Clerk user identifier.
   */
  deletedByClerkId: string | null;
  /**
   * Deleted by role.
   */
  deletedByRole: "admin" | "owner" | null;
  /**
   * File name.
   */
  fileName: string;
  /**
   * Image database identifier.
   */
  id: number;
  /**
   * Object path.
   */
  objectPath: string;
  /**
   * Display order position.
   */
  position: number;
  /**
   * File size in bytes.
   */
  size: number;
  /**
   * Public image URL.
   */
  url: string;
};

/** Material content and image state exposed to product administrators. */
export type AdminMaterial = CatalogLookup & {
  /** Optional Markdown description. */
  description: string | null;
  /** Active and soft-deleted material images in display order. */
  images: CatalogImage[];
};

/** Material content shown in the administrator directory. */
export type AdminMaterialSummary = CatalogLookup & {
  /** Optional Markdown description. */
  description: string | null;
};

/** Material summary exposed by the public directory. */
export type PublicMaterialSummary = CatalogLookup & {
  /** Number of visible, currently owned collection items assigned directly to the material. */
  collectionItemCount: number;
  /** First active image in display order, or `null` when no image is available. */
  leadImage: CatalogImage | null;
  /** Number of visible approved products assigned to the material. */
  productCount: number;
};

/** Material content and related public catalog records exposed by its detail page. */
export type PublicMaterial = PublicMaterialSummary & {
  /** Optional Markdown description. */
  description: string | null;
  /** Visible collection items assigned directly to this material. */
  collectionItems: UserCollectionItem[];
  /** Active images in stable display order. */
  images: CatalogImage[];
  /** Visible approved products assigned to this material. */
  products: CatalogProduct[];
};

/**
 * Entity kinds that can own catalog images.
 */
export type CatalogImageTargetType =
  | "collection"
  | "collection_item"
  | "material"
  | "maker"
  | "product";
/**
 * Soft-deleted image with ownership and target context for restoration.
 */
export type CatalogImageTrashItem = CatalogImage & {
  /**
   * Owner Clerk user identifier.
   */
  ownerClerkId: string | null;
  /**
   * Target identifier.
   */
  targetId: number;
  /**
   * Target name.
   */
  targetName: string;
  /**
   * Target type.
   */
  targetType: CatalogImageTargetType;
};

/**
 * Ordered finish option submitted during a product write.
 */
export type ProductWriteFinishOption = {
  /**
   * Color effect identifier.
   */
  colorEffectId: number | null;
  /**
   * Color identifiers.
   */
  colorIds: number[];
  /**
   * Finish identifiers.
   */
  finishIds: number[];
  /**
   * Pattern identifier.
   */
  patternId?: number | null;
};

/** Exact magnet group within one catalog configuration. */
export type CatalogMagnetGroup = {
  /** Positive diameter in millimetres, retained at database precision. */
  diameterMm: string;
  /** Normalized uppercase grade text. */
  grade: string;
  /** Stable key scoped to the configuration. */
  key: string;
  /** Global vocabulary label. */
  label: string;
  /** Positive thickness in millimetres, retained at database precision. */
  thicknessMm: string;
};

/** Exact source-relative position in one complete catalog configuration. */
export type CatalogMagnetSlot = {
  /** Source-documented column, when present. */
  documentedColumn: number | null;
  /** Source-documented row, when present. */
  documentedRow: number | null;
  /** Group key for an occupied slot; `null` for an empty slot. */
  groupKey: string | null;
  /** Physical slider half named by the source-relative contract. */
  half: "half-a" | "half-b";
  /** Stable source-relative slot key. */
  key: string;
  /** Complete catalog state; unknown is intentionally unsupported. */
  state: "occupied" | "empty";
};

/** Complete structured layout for one body-hosted catalog slider. */
export type CatalogMagnetConfiguration = {
  /** Ordered magnet groups. */
  groups: CatalogMagnetGroup[];
  /** Global configuration vocabulary label. */
  label: string;
  /** Optional source-relative layout label. */
  sourceLabel: string | null;
  /** Optional notes accompanying a complete source layout. */
  sourceNotes: string | null;
  /** Ordered exact slots across Half A and Half B. */
  slots: CatalogMagnetSlot[];
};

/** Inherent, immutable-at-collection-time setup of a body-hosted slider. */
export type CatalogBodyHostedMagnetSetup = {
  /** Positive inherent click count, or `null` when undocumented. */
  clickCount: number | null;
  /** Complete structured configuration, or `null` when undocumented. */
  configuration: CatalogMagnetConfiguration | null;
  /** Sourced note retained instead of inferring an incomplete layout. */
  sourceNote: string | null;
};

/** One positive insert click count in immutable insertion order. */
export type CatalogInsertClickOption = {
  /** Positive click count. */
  clickCount: number;
  /** Database identifier. */
  id: number;
  /** Immutable system-assigned insertion position. */
  insertionPosition: number;
};

/** One complete, exact magnet configuration offered by an insert product. */
export type CatalogInsertMagnetOffer = {
  /** Referenced insert click-option identifier, when linked. */
  clickOptionId: number | null;
  /** Linked positive click count, when present. */
  clickCount: number | null;
  /** Complete exact offer snapshot. */
  configuration: CatalogMagnetConfiguration;
  /** Authoring template provenance, when copied from a template. */
  copiedFromTemplateId: number | null;
  /** Database identifier. */
  id: number;
  /** Exact host insert product identifier. */
  insertProductId: number;
  /** Whether this is the insert product's advertised default. */
  isAdvertisedDefault: boolean;
};

/** An exact insert offer explicitly merchandised for an insert-driven slider. */
export type CatalogSliderInsertOffer = CatalogInsertMagnetOffer & {
  /** Exact host insert product name. */
  insertProductName: string;
  /** Whether this is the slider's advertised default association. */
  isSliderAdvertisedDefault: boolean;
};

/** Catalog-manager-only reusable authoring source. */
export type CatalogMagnetConfigurationTemplate = {
  /** Family scope target, when family-scoped. */
  compatibilityFamilyId: number | null;
  /** Complete exact authoring configuration. */
  configuration: CatalogMagnetConfiguration;
  /** Database identifier. */
  id: number;
  /** Maker scope target, when maker-scoped. */
  makerId: number | null;
  /** Manager-facing template name. */
  name: string;
  /** Authoring visibility scope. */
  scope: "global" | "maker" | "family";
};

/**
 * Fully hydrated catalog product returned to callers.
 */
export type CatalogProduct = {
  /**
   * Durable product review state.
   */
  approvalStatus: CatalogApprovalStatus;
  /** Reviewed non-blocking compatibility warnings. */
  compatibilityAdvisories: CatalogCompatibilityAdvisory[];
  /** Reviewed compatibility-family memberships. */
  compatibilityFamilies: CatalogCompatibilityFamily[];
  /**
   * Bearing model or designation, or `null` when unspecified.
   */
  bearing: string | null;
  /** Live inherent setup for a body-hosted slider. */
  bodyHostedMagnetSetup: CatalogBodyHostedMagnetSetup | null;
  /** Exact insert offers explicitly merchandised for this slider. */
  advertisedInsertOffers: CatalogSliderInsertOffer[];
  /**
   * Button diameter in millimetres.
   */
  buttonDiameterMm: string | null;
  /**
   * Compatible button identifier.
   */
  compatibleButtonId: number | null;
  /**
   * Compatible button name.
   */
  compatibleButtonName: string | null;
  /**
   * Whether the viewer may administer the record.
   */
  canAdminister: boolean;
  /**
   * Whether the viewer may edit the record.
   */
  canEdit: boolean;
  /**
   * Created timestamp.
   */
  createdAt: Date;
  /**
   * Product description, or `null` when absent.
   */
  description: string | null;
  /**
   * Diameter in millimetres.
   */
  diameterMm: string | null;
  /**
   * Configured finish choices with their colors and effects.
   */
  finishOptions: CatalogFinishOption[];
  /**
   * Number of attached images.
   */
  imageCount: number;
  /**
   * Images ordered for display.
   */
  images: CatalogImage[];
  /** Exact products sold as components with this product. */
  includedComponents: CatalogIncludedComponent[];
  /** Positive click counts owned by this exact insert product. */
  insertClickOptions: CatalogInsertClickOption[];
  /** Complete configuration offers owned by this exact insert product. */
  insertMagnetOffers: CatalogInsertMagnetOffer[];
  /**
   * Database identifier.
   */
  id: number;
  /**
   * Length in millimetres.
   */
  lengthMm: string | null;
  /**
   * Maker identifier.
   */
  makerId: number;
  /**
   * Maker name.
   */
  makerName: string;
  /** Stable public maker slug. */
  makerSlug: string;
  /**
   * Maker product URL.
   */
  makerProductUrl: string | null;
  /**
   * Whether the maker product URL has passed validation.
   */
  makerProductUrlValid: boolean;
  /**
   * Maker URL.
   */
  makerUrl: string | null;
  /** Explicit magnet host for sliders, or `null` for other product types. */
  magnetSystem: SliderMagnetSystem | null;
  /**
   * Materials assigned to the product.
   */
  materials: Array<{
    /**
     * Database identifier.
     */
    id: number;
    /**
     * Display name.
     */
    name: string;
    /**
     * URL-safe identifier.
     */
    slug: string;
  }>;
  /**
   * Display name.
   */
  name: string;
  /**
   * Owner Clerk user identifier.
   */
  ownerClerkId: string | null;
  /**
   * Whether the record is private.
   */
  isPrivate: boolean;
  /**
   * Whether staff forced the record private.
   */
  isAdminPrivate: boolean;
  /**
   * Whether the viewer owns the record.
   */
  isOwner?: boolean;
  /**
   * Product type identifier.
   */
  productTypeId: number;
  /**
   * Product type name.
   */
  productTypeName: string;
  /**
   * Product type slug.
   */
  productTypeSlug: CatalogProductType;
  /**
   * URL-safe identifier.
   */
  slug: string;
  /**
   * Spin diameter in millimetres.
   */
  spinDiameterMm: string | null;
  /**
   * Thickness in millimetres.
   */
  thicknessMm: string | null;
  /**
   * Thickness with button in millimetres.
   */
  thicknessWithButtonMm: string | null;
  /**
   * Updated timestamp.
   */
  updatedAt: Date;
  /**
   * Weight in grams.
   */
  weightG: string | null;
  /** Meaning of a slider's weight, or `null` when no slider weight is recorded. */
  weightBasis: SliderWeightBasis | null;
  /**
   * Width in millimetres.
   */
  widthMm: string | null;
};

/**
 * Validated fields accepted when creating or updating a catalog product.
 */
export type ProductWriteInput = {
  /**
   * Authenticated actor.
   */
  actor: Actor;
  /** Complete inherent setup or sourced incomplete-layout note. */
  bodyHostedMagnetSetup?: CatalogBodyHostedMagnetSetup | null;
  /** Reviewed non-blocking compatibility warnings. */
  compatibilityAdvisories?: Array<{
    /** Exact related product identifier. */
    relatedProductId: number;
    /** Reviewed warning text. */
    text: string;
  }>;
  /** Reviewed compatibility-family identifiers. */
  compatibilityFamilyIds?: number[];
  /**
   * Optional description.
   */
  description?: string | null;
  /**
   * Maker identifier.
   */
  makerId: number;
  /**
   * Maker product URL.
   */
  makerProductUrl?: string | null;
  /**
   * Finish options.
   */
  finishOptions: ProductWriteFinishOption[];
  /**
   * Material identifiers.
   */
  materialIds: number[];
  /** Exact component products sold with this product. */
  includedComponentIds?: number[];
  /** Exact offers merchandised by an insert-driven slider. */
  advertisedInsertOffers?: Array<{
    /** Whether this association is the slider's Default setup. */
    isAdvertisedDefault: boolean;
    /** Exact host-bound insert offer identifier. */
    offerId: number;
  }>;
  /** Insert-owned click counts and complete exact configuration offers. */
  insertHostedMagnetOptions?: {
    /** Positive click counts in system-managed insertion order. */
    clickCounts: number[];
    /** Complete exact offers hosted by this insert product. */
    offers: Array<{
      /** Linked click count belonging to the same insert. */
      clickCount: number | null;
      /** Complete exact configuration snapshot. */
      configuration: CatalogMagnetConfiguration;
      /** Optional manager template provenance. */
      copiedFromTemplateId?: number | null;
      /** Existing offer identifier retained across updates. */
      id?: number;
      /** Whether this is the insert product's advertised default. */
      isAdvertisedDefault: boolean;
    }>;
  } | null;
  /**
   * Display name.
   */
  name: string;
  /**
   * Product type slug.
   */
  productTypeSlug: CatalogProductType;
  /**
   * Administrative reason for the operation.
   */
  reason?: string;
  /**
   * URL-safe identifier.
   */
  slug: string;
  /**
   * Product measurements and compatibility fields.
   */
  specs: {
    /**
     * Bearing.
     */
    bearing?: string | null;
    /**
     * Button diameter in millimetres.
     */
    buttonDiameterMm?: string | null;
    /**
     * Compatible button identifier.
     */
    compatibleButtonId?: number | null;
    /**
     * Diameter in millimetres.
     */
    diameterMm?: string | null;
    /**
     * Length in millimetres.
     */
    lengthMm?: string | null;
    /** Explicit physical magnet host for a slider product. */
    magnetSystem?: SliderMagnetSystem | null;
    /**
     * Spin diameter in millimetres.
     */
    spinDiameterMm?: string | null;
    /**
     * Thickness in millimetres.
     */
    thicknessMm?: string | null;
    /**
     * Thickness with button in millimetres.
     */
    thicknessWithButtonMm?: string | null;
    /**
     * Weight in grams.
     */
    weightG?: string | null;
    /** Meaning of a slider body's recorded weight. */
    weightBasis?: SliderWeightBasis | null;
    /**
     * Width in millimetres.
     */
    widthMm?: string | null;
  };
};

/**
 * Catalog reads and audited mutations exposed to application callers.
 */
export type CatalogService = {
  /**
   * Creates an audited maker-scoped alias for a registered catalog concept.
   *
   * @param input - Alias label, maker, canonical concept, preference, and actor.
   * @returns The created alias.
   */
  createTerminologyAlias(input: {
    /** Authenticated catalog manager. */
    actor: Actor;
    /** Registered product-type key. */
    canonicalKey: CatalogProductType;
    /** Registered canonical namespace. */
    canonicalNamespace: CatalogTerminologyNamespace;
    /** Whether the alias is the maker's preferred display term. */
    isPreferred: boolean;
    /** Non-localized display label. */
    label: string;
    /** Maker identifier scoping the alias. */
    makerId: number;
  }): Promise<CatalogTerminologyAlias>;
  /**
   * Creates a reviewed maker-scoped compatibility family.
   *
   * @param input - Family maker, name, slug, and authenticated catalog manager.
   * @returns Created compatibility family.
   * @rejects When authorization, validation, persistence, auditing, or logging fails.
   */
  createCompatibilityFamily(input: {
    /** Authenticated catalog manager. */
    actor: Actor;
    /** Maker identifier that scopes the family. */
    makerId: number;
    /** Display name. */
    name: string;
    /** URL-safe identifier. */
    slug: string;
  }): Promise<CatalogCompatibilityFamily>;
  /**
   * Creates a catalog-manager-only exact configuration authoring template.
   *
   * @param input - Template scope, name, configuration, and authenticated actor.
   * @returns Created reusable authoring template.
   * @rejects When authorization, validation, persistence, auditing, or logging fails.
   */
  createMagnetConfigurationTemplate(input: {
    /** Authenticated catalog manager. */
    actor: Actor;
    /** Family scope target, required only for family scope. */
    compatibilityFamilyId: number | null;
    /** Complete exact configuration copied by future offers. */
    configuration: CatalogMagnetConfiguration;
    /** Maker scope target, required only for maker scope. */
    makerId: number | null;
    /** Manager-facing template name. */
    name: string;
    /** Visibility scope used by catalog authoring. */
    scope: "global" | "maker" | "family";
  }): Promise<CatalogMagnetConfigurationTemplate>;
  /**
   * Attaches images.
   *
   * @param input - Target, uploaded files, and authenticated actor.
   * @returns Completion after the images are attached.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  attachImages(input: {
    /**
     * Image-owning catalog entity.
     */
    target: UploadTarget;
    /**
     * Uploaded image files.
     */
    files: UploadedFile[];
    /**
     * Authenticated actor.
     */
    actor: UploadActor;
    /**
     * Administrative reason for the operation.
     */
    reason?: string;
  }): Promise<void>;
  /**
   * Selects collection cover.
   *
   * @param input - Collection, selected image, and authenticated actor.
   * @returns Completion after the cover selection is stored.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  selectCollectionCover(input: {
    /**
     * Collection identifier.
     */
    collectionId: number;
    /**
     * Image identifier.
     */
    imageId: number | null;
    /**
     * Authenticated actor.
     */
    actor: UploadActor;
    /**
     * Administrative reason for the operation.
     */
    reason?: string;
  }): Promise<void>;
  /**
   * Creates color.
   *
   * @param input - Color name, slug, hex value, and authenticated actor.
   * @returns Created color.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  createColor(input: {
    /**
     * Authenticated actor.
     */
    actor: Actor;
    /**
     * Hexadecimal color value.
     */
    hex: string;
    /**
     * Display name.
     */
    name: string;
    /**
     * URL-safe identifier.
     */
    slug: string;
  }): Promise<CatalogColor>;
  /**
   * Creates finish.
   *
   * @param input - Finish name, slug, and authenticated actor.
   * @returns Created finish.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  createFinish(input: {
    /**
     * Authenticated actor.
     */
    actor: Actor;
    /**
     * Display name.
     */
    name: string;
    /**
     * URL-safe identifier.
     */
    slug: string;
  }): Promise<CatalogLookup>;
  /**
   * Creates maker.
   *
   * @param input - Maker name, optional root URL, and authenticated actor.
   * @returns Created maker.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  createMaker(input: {
    /**
     * Authenticated actor.
     */
    actor: Actor;
    /** Optional Markdown profile description. */
    description?: string | null;
    /**
     * Display name.
     */
    name: string;
    /**
     * Root URL.
     */
    rootUrl: string | null;
  }): Promise<CatalogMaker>;
  /**
   * Creates material.
   *
   * @param input - Material name, optional description, and authenticated actor.
   * @returns Created material.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  createMaterial(input: {
    /**
     * Authenticated actor.
     */
    actor: Actor;
    /** Optional Markdown description. */
    description?: string | null;
    /**
     * Display name.
     */
    name: string;
  }): Promise<AdminMaterial>;
  /**
   * Creates pattern.
   *
   * @param input - Pattern name, slug, and authenticated actor.
   * @returns Created pattern.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  createPattern(input: {
    /** Authenticated actor. */
    actor: Actor;
    /** Display name. */
    name: string;
    /** URL-safe identifier. */
    slug: string;
  }): Promise<CatalogLookup>;
  /**
   * Creates product.
   *
   * @param input - Product fields, finish options, and authenticated actor.
   * @returns Created product.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  createProduct(input: ProductWriteInput): Promise<CatalogProduct>;
  /**
   * Permanently deletes an unreferenced product with transactional audit and storage cleanup.
   *
   * @param input - Confirmed owner or staff deletion with a reason for staff intervention.
   * @returns Whether deletion committed; `false` means the product is still referenced.
   * @rejects When confirmation, authorization, validation, persistence, or auditing fails.
   */
  deleteProduct(input: {
    /** Authenticated actor requesting deletion. */
    actor: Actor;
    /** Explicit acknowledgement of permanent deletion. */
    confirmed: boolean;
    /** Catalog product being deleted. */
    productId: number;
    /** Required nonblank reason for cross-owner deletion. */
    reason?: string;
  }): Promise<boolean>;
  /**
   * Applies one authorized product approval transition.
   *
   * @param input - Product decision, actor, and nonblank reason.
   * @returns The resulting durable approval state.
   * @rejects When authorization, validation, lookup, persistence, or auditing fails.
   */
  decideProductApproval(input: {
    /** Requested approval transition. */
    action: CatalogApprovalAction;
    /** Staff actor making the decision. */
    actor: Actor;
    /** Product receiving the decision. */
    productId: number;
    /** Nonblank reason for the decision. */
    reason: string;
  }): Promise<CatalogApprovalStatus>;
  /**
   * Returns product.
   *
   * @param productTypeSlug - Product type slug.
   * @param productSlug - Product slug.
   * @param viewer - Optional catalog viewer.
   * @returns Matching product, when available.
   * @rejects When product data cannot be queried.
   */
  getProduct(
    productTypeSlug: string,
    productSlug: string,
    viewer?: CatalogViewer,
  ): Promise<CatalogProduct | null>;
  /**
   * Returns one public maker profile and its public catalog content.
   *
   * @param slug - Stable maker slug.
   * @returns The matching public maker detail, or `null` when absent.
   * @rejects When maker or catalog data cannot be queried.
   */
  getPublicMakerDetail(slug: string): Promise<PublicMakerDetail | null>;
  /**
   * Returns one maker profile to an authorized product manager.
   *
   * @param input - Maker identifier and authenticated administrator.
   * @returns The matching maker, or `null` when it does not exist.
   * @rejects When authorization or persistence fails.
   */
  getMakerForAdmin(input: {
    /** Authenticated administrator. */
    actor: Actor;
    /** Maker identifier. */
    makerId: number;
  }): Promise<CatalogMaker | null>;
  /**
   * Lists color effects.
   *
   * @returns Matching color effects.
   * @rejects When the database query or operation logging fails.
   */
  listColorEffects(): Promise<CatalogLookup[]>;
  /**
   * Lists colors.
   *
   * @returns Matching colors.
   * @rejects When the database query or operation logging fails.
   */
  listColors(): Promise<CatalogColor[]>;
  /**
   * Lists finishes.
   *
   * @returns Matching finishes.
   * @rejects When the database query or operation logging fails.
   */
  listFinishes(): Promise<CatalogLookup[]>;
  /**
   * Lists makers.
   *
   * @returns Matching makers.
   * @rejects When the database query fails.
   */
  listMakers(): Promise<CatalogMaker[]>;
  /**
   * Lists public maker directory summaries with database-aggregated counts.
   *
   * @returns Name-sorted maker summaries.
   * @rejects When the database query fails.
   */
  listPublicMakers(): Promise<PublicMakerSummary[]>;
  /**
   * Lists maker profiles for an authorized product manager.
   *
   * @param actor - Authenticated administrator.
   * @returns Name-sorted maker profiles.
   * @rejects When authorization or persistence fails.
   */
  listMakersForAdmin(actor: Actor): Promise<CatalogMaker[]>;
  /**
   * Lists materials.
   *
   * @returns Matching materials.
   * @rejects When the database query fails.
   */
  listMaterials(): Promise<
    Array<{
      /**
       * Database identifier.
       */
      id: number;
      /**
       * Display name.
       */
      name: string;
      /**
       * URL-safe identifier.
       */
      slug: string;
    }>
  >;
  /**
   * Lists all materials with public product and directly assigned collection-item counts.
   *
   * @returns Name-sorted public material summaries.
   * @rejects When material, image, or count queries fail.
   */
  listPublicMaterials(): Promise<PublicMaterialSummary[]>;
  /**
   * Loads one material and its publicly visible related catalog records.
   *
   * @param materialSlug - Stable material route slug.
   * @returns Public material detail, or `null` when the slug is unknown.
   * @rejects When material or related catalog queries fail.
   */
  getPublicMaterial(materialSlug: string): Promise<PublicMaterial | null>;
  /**
   * Lists material content for product administrators.
   *
   * @param actor - Administrator requesting material content.
   * @returns Materials without image payloads.
   * @rejects When authorization or persistence fails.
   */
  listAdminMaterials(actor: Actor): Promise<AdminMaterialSummary[]>;
  /**
   * Loads one material for product administration.
   *
   * @param materialId - Material identifier.
   * @param actor - Administrator requesting material content.
   * @returns Matching material, or `null` when no row exists.
   * @rejects When authorization or persistence fails.
   */
  getAdminMaterial(
    materialId: number,
    actor: Actor,
  ): Promise<AdminMaterial | null>;
  /**
   * Updates editable material content while preserving its stable slug.
   *
   * @param input - Material identifier, replacement content, and administrator.
   * @returns Updated material with images.
   * @rejects When authorization, validation, persistence, auditing, or logging fails.
   */
  updateMaterial(input: {
    /** Authenticated administrator. */
    actor: Actor;
    /** Optional Markdown description. */
    description: string | null;
    /** Material identifier. */
    materialId: number;
    /** Replacement display name. */
    name: string;
  }): Promise<AdminMaterial>;
  /**
   * Lists patterns.
   *
   * @returns Matching patterns.
   * @rejects When the database query or operation logging fails.
   */
  listPatterns(): Promise<CatalogLookup[]>;
  /**
   * Lists reviewed compatibility families.
   *
   * @returns Compatibility families ordered by maker and name.
   * @rejects When the database query or operation logging fails.
   */
  listCompatibilityFamilies(): Promise<CatalogCompatibilityFamily[]>;
  /**
   * Lists authoring templates only for catalog managers.
   *
   * @param viewer - Viewer whose catalog permissions control access.
   * @returns Reusable exact configuration templates or an empty list.
   * @rejects When the database query or operation logging fails.
   */
  listMagnetConfigurationTemplates(
    viewer?: CatalogViewer,
  ): Promise<CatalogMagnetConfigurationTemplate[]>;
  /**
   * Lists maker-scoped terminology aliases ordered by label.
   *
   * @returns Registered terminology aliases.
   */
  listTerminologyAliases(): Promise<CatalogTerminologyAlias[]>;
  /**
   * Lists products.
   *
   * @param productTypeSlug - Product type slug.
   * @param viewer - Optional catalog viewer.
   * @returns Matching products.
   * @rejects When product data cannot be queried.
   */
  listProducts(
    productTypeSlug?: string,
    viewer?: CatalogViewer,
  ): Promise<CatalogProduct[]>;
  /**
   * Lists product types.
   *
   * @returns Matching product types.
   * @rejects When the database query fails.
   */
  listProductTypes(): Promise<
    Array<{
      /**
       * Database identifier.
       */
      id: number;
      /**
       * Display name.
       */
      name: string;
      /**
       * URL-safe identifier.
       */
      slug: string;
    }>
  >;
  /**
   * Lists slugs.
   *
   * @param productTypeSlug - Product type slug.
   * @param exceptProductId - Except product identifier.
   * @returns Matching slugs.
   * @rejects When the database query fails.
   */
  listSlugs(
    productTypeSlug: string,
    exceptProductId?: number,
  ): Promise<string[]>;
  /**
   * Lists image trash.
   *
   * @param input - Actor whose visible deleted images should be listed.
   * @returns Matching image trash.
   * @rejects When the database query fails.
   */
  listImageTrash(input: {
    /**
     * Authenticated actor.
     */
    actor: Actor;
  }): Promise<CatalogImageTrashItem[]>;
  /**
   * Restores image.
   *
   * @param input - Actor, deleted image, target type, and optional moderation reason.
   * @returns Completion after the image is restored.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  restoreImage(input: {
    /**
     * Authenticated actor.
     */
    actor: Actor;
    /**
     * Image identifier.
     */
    imageId: number;
    /**
     * Administrative reason for the operation.
     */
    reason?: string;
    /**
     * Target type.
     */
    targetType: CatalogImageTargetType;
  }): Promise<void>;
  /**
   * Soft-deletes image.
   *
   * @param input - Actor, image, target type, and optional moderation reason.
   * @returns Completion after the image is moved to trash.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  softDeleteImage(input: {
    /**
     * Authenticated actor.
     */
    actor: Actor;
    /**
     * Image identifier.
     */
    imageId: number;
    /**
     * Administrative reason for the operation.
     */
    reason?: string;
    /**
     * Target type.
     */
    targetType: CatalogImageTargetType;
  }): Promise<void>;
  /**
   * Sets product visibility.
   *
   * @param input - Product visibility update and actor context.
   * @returns Completion after product visibility is stored.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  setVisibility(input: {
    /**
     * Authenticated actor.
     */
    actor: Actor;
    /**
     * Whether the record is private.
     */
    isPrivate: boolean;
    /**
     * Product identifier.
     */
    productId: number;
    /**
     * Administrative reason for the operation.
     */
    reason?: string;
  }): Promise<void>;
  /**
   * Sets maker product URL validity.
   *
   * @param input - Product, validity decision, actor, and optional moderation reason.
   * @returns Completion after URL validity is stored.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  setMakerProductUrlValidity(input: {
    /**
     * Authenticated actor.
     */
    actor: Actor;
    /**
     * Whether the maker product URL is considered valid.
     */
    makerProductUrlValid: boolean;
    /**
     * Product identifier.
     */
    productId: number;
    /**
     * Administrative reason for the operation.
     */
    reason?: string;
  }): Promise<void>;
  /**
   * Updates mutable maker profile fields without changing its stable slug.
   *
   * @param input - Maker fields and authenticated administrator.
   * @returns The updated maker profile.
   * @rejects When authorization, lookup, conflicts, persistence, auditing, or operation logging fails.
   */
  updateMaker(input: {
    /** Authenticated administrator. */
    actor: Actor;
    /** Optional Markdown profile description. */
    description: string | null;
    /** Maker identifier. */
    makerId: number;
    /** Display name. */
    name: string;
    /** Optional external website root URL. */
    rootUrl: string | null;
  }): Promise<CatalogMaker>;
  /**
   * Updates product.
   *
   * @param input - Product identifier and replacement catalog fields.
   * @returns Updated product.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  updateProduct(
    input: ProductWriteInput & {
      /**
       * Product identifier.
       */
      productId: number;
    },
  ): Promise<CatalogProduct>;
};

/**
 * Owned collection item with its product snapshot and visibility state.
 */
export type UserCollectionItem = {
  /** Durable administrative review state, independent of privacy. */
  approvalStatus: CatalogApprovalStatus;
  /**
   * Effective bearing after applying the collection-item override.
   */
  bearing: string | null;
  /**
   * Bearing override.
   */
  bearingOverride: string | null;
  /**
   * Whether the viewer may administer the record.
   */
  canAdminister: boolean;
  /**
   * Whether the viewer may edit the record.
   */
  canEdit: boolean;
  /**
   * Collection is private.
   */
  collectionIsPrivate: boolean;
  /**
   * Collection identifier.
   */
  collectionId: number;
  /**
   * Collection name.
   */
  collectionName: string;
  /**
   * Collection item identifier.
   */
  collectionItemId: number;
  /**
   * Display name.
   */
  displayName: string;
  /**
   * Effective description after applying the collection-item override.
   */
  description: string | null;
  /**
   * Description override.
   */
  descriptionOverride: string | null;
  /**
   * Finish option.
   */
  finishOption: CatalogFinishOption | null;
  /**
   * Number of attached images.
   */
  imageCount: number;
  /**
   * Images ordered for display.
   */
  images: CatalogImage[];
  /**
   * Whether the record is private.
   */
  isPrivate: boolean;
  /**
   * Whether staff forced the record private.
   */
  isAdminPrivate: boolean;
  /**
   * Whether the viewer owns the record.
   */
  isOwner?: boolean;
  /**
   * Installed button identifier.
   */
  installedButtonId: number | null;
  /**
   * Maker identifier.
   */
  makerId: number;
  /**
   * Maker name.
   */
  makerName: string;
  /** Stable public maker slug. */
  makerSlug: string;
  /**
   * Maker URL.
   */
  makerUrl: string | null;
  /**
   * Selected material, or `null` when none is assigned.
   */
  material: CatalogLookup | null;
  /**
   * Display name.
   */
  name: string;
  /**
   * Owner Clerk user identifier.
   */
  ownerClerkId: string;
  /**
   * Owner username.
   */
  ownerUsername: string | null;
  /**
   * Owner database user identifier.
   */
  ownerUserId: number;
  /**
   * Product identifier.
   */
  productId: number;
  /**
   * Product slug.
   */
  productSlug: string;
  /**
   * Product type name.
   */
  productTypeName: string;
  /**
   * Product type slug.
   */
  productTypeSlug: CatalogProductType;
  /**
   * Source product finish option identifier.
   */
  sourceProductFinishOptionId: number | null;
  /**
   * Product images.
   */
  productImages: CatalogImage[];
};

/**
 * Public owner identity and aggregate collection counts.
 */
export type PublicCollectionOwner = {
  /**
   * Visible collections owned by the user.
   */
  collections: UserCollectionSummary[];
  /**
   * Number of visible collection items.
   */
  itemCount: number;
  /**
   * Visible collection items owned by the user.
   */
  items: UserCollectionItem[];
  /**
   * User identifier.
   */
  userId: number;
  /**
   * Username.
   */
  username: string;
};

/**
 * Collection metadata and counts visible to the current viewer.
 */
export type UserCollectionSummary = {
  /**
   * Whether the viewer may administer the record.
   */
  canAdminister?: boolean;
  /**
   * Whether the viewer may edit the record.
   */
  canEdit?: boolean;
  /**
   * Cover image.
   */
  coverImage: CatalogImage | null;
  /**
   * Cover images.
   */
  coverImages: CatalogImage[];
  /**
   * Created timestamp.
   */
  createdAt: Date;
  /**
   * Optional description.
   */
  description: string | null;
  /**
   * Database identifier.
   */
  id: number;
  /**
   * Whether staff forced the record private.
   */
  isAdminPrivate: boolean;
  /**
   * Whether the viewer owns the record.
   */
  isOwner?: boolean;
  /**
   * Whether the record is private.
   */
  isPrivate: boolean;
  /**
   * Number of visible collection items.
   */
  itemCount: number;
  /**
   * Display name.
   */
  name: string;
  /**
   * Owner database user identifier.
   */
  ownerUserId: number;
  /**
   * Optional plain-text summary shown on collection cards.
   */
  summary?: string | null;
  /**
   * Updated timestamp.
   */
  updatedAt: Date;
};

/**
 * Editable collection name, summary, description, and visibility.
 */
export type CollectionWriteInput = {
  /**
   * Optional description.
   */
  description: string | null;
  /**
   * Whether the record is private.
   */
  isPrivate: boolean;
  /**
   * Display name.
   */
  name: string;
  /**
   * Administrative reason for the operation.
   */
  reason?: string;
  /**
   * Optional plain-text summary.
   */
  summary?: string | null;
};

/** Database operations for user collections and their catalog items. */
export type CollectionsService = {
  /**
   * Applies a serialized collection-item approval decision with transactional auditing.
   *
   * @param input - Authenticated staff action, target, and nonblank reason.
   * @returns The resulting durable approval state.
   * @rejects When authorization, validation, lookup, persistence, or auditing fails.
   */
  decideItemApproval(input: {
    /** Requested approval transition. */
    action: CatalogApprovalAction;
    /** Authenticated administrator. */
    actor: Actor;
    /** Collection item being reviewed. */
    collectionItemId: number;
    /** Nonblank reason for the decision. */
    reason: string;
  }): Promise<CatalogApprovalStatus>;
  /**
   * Adds a spinner and optional button to a collection.
   *
   * @param input - Collection, spinner, optional button, overrides, and actor.
   * @returns Identifiers of the created spinner and optional button items.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  addSpinner(input: {
    /**
     * Authenticated actor.
     */
    actor: Actor;
    /**
     * Bearing.
     */
    bearing?: string | null;
    /**
     * Button custom finish.
     */
    buttonCustomFinish: ProductWriteFinishOption | null;
    /**
     * Button finish option identifier.
     */
    buttonFinishOptionId: number | null;
    /**
     * Button material identifier.
     */
    buttonMaterialId: number | null;
    /**
     * Button product identifier.
     */
    buttonProductId: number | null;
    /**
     * Spinner finish option identifier.
     */
    spinnerFinishOptionId: number | null;
    /**
     * Spinner custom finish.
     */
    spinnerCustomFinish: ProductWriteFinishOption | null;
    /**
     * Spinner material identifier.
     */
    spinnerMaterialId: number;
    /**
     * Spinner product identifier.
     */
    spinnerProductId: number;
    /**
     * Collection identifier.
     */
    collectionId?: number | null;
    /**
     * Display name.
     */
    displayName: string;
    /**
     * Optional description.
     */
    description?: string | null;
    /**
     * New collection.
     */
    newCollection?: CollectionWriteInput | null;
  }): Promise<{
    /**
     * Button item identifier.
     */
    buttonItemId: number | null;
    /**
     * Spinner item identifier.
     */
    spinnerItemId: number;
  }>;
  /**
   * Adds a spinner button to a collection.
   *
   * @param input - Collection item, button product, overrides, and actor.
   * @returns Identifier of the created button item.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  addSpinnerButton(input: {
    /**
     * Authenticated actor.
     */
    actor: Actor;
    /**
     * Custom finish.
     */
    customFinish: ProductWriteFinishOption | null;
    /**
     * Finish option identifier.
     */
    finishOptionId: number | null;
    /**
     * Material identifier.
     */
    materialId: number;
    /**
     * Product identifier.
     */
    productId: number;
    /**
     * Collection identifier.
     */
    collectionId?: number | null;
    /**
     * Display name.
     */
    displayName: string;
    /**
     * Optional description.
     */
    description?: string | null;
    /**
     * New collection.
     */
    newCollection?: CollectionWriteInput | null;
  }): Promise<number>;
  /**
   * Creates collection.
   *
   * @param input - Collection values and authenticated actor.
   * @returns Created collection.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  createCollection(
    input: CollectionWriteInput & {
      /**
       * Authenticated actor.
       */
      actor: Actor;
    },
  ): Promise<UserCollectionSummary>;
  /**
   * Counts owned products.
   *
   * @param input - Actor and candidate product identifiers.
   * @returns Owned-item counts keyed by requested product identifier.
   * @rejects When the required catalog data cannot be queried.
   */
  countOwnedProducts(input: {
    /**
     * Actor Clerk user identifier.
     */
    actorClerkId: string;
    /**
     * Product identifiers.
     */
    productIds: number[];
  }): Promise<Record<number, number>>;
  /**
   * Moves or permanently deletes a collection and its contents.
   *
   * @param input - Authorized deletion request.
   * @returns Completion after the transaction commits.
   * @rejects When authorization, persistence, audit writing, or operation logging fails.
   */
  deleteCollection(input: {
    /** Actor requesting deletion. */
    actor: Actor;
    /** Explicit acknowledgement of collection deletion. */
    confirmed: boolean;
    /** Collection to delete. */
    collectionId: number;
    /** Collection receiving moved items, or null for permanent deletion. */
    destinationCollectionId: number | null;
    /** Required moderation reason when acting for another user. */
    reason?: string;
  }): Promise<void>;

  /**
   * Deletes only a currently owned selected item and its images, retaining linked items and catalog products.
   *
   * @param input - Confirmed owner or staff request with a reason for cross-owner intervention.
   * @returns Completion after the deletion and audit event commit.
   * @rejects When confirmation, authorization, auditing, persistence, or logging fails.
   */
  deleteItem(input: {
    /** Authenticated actor. */
    actor: Actor;
    /** Item to permanently delete. */
    collectionItemId: number;
    /** Explicit acknowledgement of irreversible deletion. */
    confirmed: boolean;
    /** Required nonblank reason for cross-owner deletion. */
    reason?: string;
  }): Promise<void>;

  /**
   * Loads valid deletion destinations and the affected item count.
   *
   * @param actor - Actor requesting the deletion choices.
   * @param collectionId - Collection being considered for deletion.
   * @returns Deletion context, or null when the collection is inaccessible.
   * @rejects When the user lookup or database query fails.
   */
  getDeletionContext(
    actor: Actor,
    collectionId: number,
  ): Promise<{
    /** Collections eligible to receive moved items. */
    destinations: UserCollectionSummary[];
    /** Number of items affected by deletion. */
    itemCount: number;
  } | null>;
  /**
   * Returns owned item.
   *
   * @param actor - Authenticated actor.
   * @param collectionItemId - Collection item identifier.
   * @returns Matching owned item, when available.
   * @rejects When the database query fails.
   */
  getOwnedItem(
    actor: Actor,
    collectionItemId: number,
  ): Promise<UserCollectionItem | null>;
  /**
   * Returns default collection name.
   *
   * @param actorClerkId - Actor clerk identifier.
   * @returns Default collection name synthesized from the owner's username.
   * @rejects When the user profile is incomplete or the database query fails.
   */
  getDefaultCollectionName(actorClerkId: string): Promise<string>;
  /**
   * Returns owned collection.
   *
   * @param actor - Authenticated actor.
   * @param collectionId - Collection identifier.
   * @returns Matching owned collection, when available.
   * @rejects When the user lookup or database query fails.
   */
  getOwnedCollection(
    actor: Actor,
    collectionId: number,
  ): Promise<UserCollectionSummary | null>;
  /**
   * Returns public collection.
   *
   * @param input - Owner, collection, and optional viewer context.
   * @returns Matching public collection, when available.
   * @rejects When the database query fails.
   */
  getPublicCollection(input: {
    /**
     * Collection identifier.
     */
    collectionId: number;
    /**
     * Owner database user identifier.
     */
    ownerUserId: number;
    /**
     * Optional viewer used to apply visibility rules.
     */
    viewer?: CatalogViewer;
  }): Promise<UserCollectionSummary | null>;
  /**
   * Lists one collection's items using owner, staff, and public visibility rules.
   *
   * @param input - Collection, owner, and optional authenticated viewer.
   * @returns Collection items visible to the viewer.
   * @rejects When the required catalog data cannot be queried.
   */
  listCollectionItems(input: {
    /** Parent collection identifier. */
    collectionId: number;
    /** Collection owner's database identifier. */
    ownerUserId: number;
    /** Optional authenticated viewer. */
    viewer?: CatalogViewer;
  }): Promise<UserCollectionItem[]>;
  /**
   * Returns public item.
   *
   * @param input - Owner, collection item, collection, and optional viewer context.
   * @returns Matching public item, when available.
   * @rejects When the required catalog data cannot be queried.
   */
  getPublicItem(input: {
    /**
     * Collection item identifier.
     */
    collectionItemId: number;
    /**
     * Collection identifier.
     */
    collectionId: number;
    /**
     * Owner database user identifier.
     */
    ownerUserId: number;
    /**
     * Optional viewer used to apply visibility rules.
     */
    viewer?: CatalogViewer;
  }): Promise<UserCollectionItem | null>;
  /**
   * Lists collection items owned by the actor.
   *
   * @param actor - Authenticated actor.
   * @param collectionId - Collection identifier.
   * @returns Owned collection items visible to the actor.
   * @rejects When the required catalog data cannot be queried.
   */
  listOwned(actor: Actor, collectionId?: number): Promise<UserCollectionItem[]>;
  /**
   * Lists owned collections.
   *
   * @param actor - Authenticated actor.
   * @returns Matching owned collections.
   * @rejects When the required catalog data cannot be queried.
   */
  listOwnedCollections(actor: Actor): Promise<UserCollectionSummary[]>;
  /**
   * Lists product items.
   *
   * @param productId - Product identifier.
   * @param viewer - Optional catalog viewer.
   * @returns Matching product items.
   * @rejects When the required catalog data cannot be queried.
   */
  listProductItems(
    productId: number,
    viewer?: CatalogViewer,
  ): Promise<UserCollectionItem[]>;
  /**
   * Lists owners with public collections or items.
   *
   * @param viewer - Optional catalog viewer.
   * @returns Matching owners.
   * @rejects When the required catalog data cannot be queried.
   */
  listOwners(viewer?: CatalogViewer): Promise<PublicCollectionOwner[]>;
  /**
   * Sets collection visibility.
   *
   * @param input - Collection, visibility state, actor, and optional moderation reason.
   * @returns Completion after collection visibility is stored.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  setCollectionVisibility(input: {
    /**
     * Authenticated actor.
     */
    actor: Actor;
    /**
     * Collection identifier.
     */
    collectionId: number;
    /**
     * Whether the record is private.
     */
    isPrivate: boolean;
    /**
     * Administrative reason for the operation.
     */
    reason?: string;
  }): Promise<void>;
  /**
   * Sets item visibility.
   *
   * @param input - Collection item, visibility state, actor, and optional moderation reason.
   * @returns Completion after item visibility is stored.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  setItemVisibility(input: {
    /**
     * Authenticated actor.
     */
    actor: Actor;
    /**
     * Collection item identifier.
     */
    collectionItemId: number;
    /**
     * Whether the record is private.
     */
    isPrivate: boolean;
    /**
     * Administrative reason for the operation.
     */
    reason?: string;
  }): Promise<void>;
  /**
   * Updates item.
   *
   * @param input - Collection item, editable overrides, and authenticated actor.
   * @returns Completion after the collection item is updated.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  updateItem(input: {
    /**
     * Authenticated actor.
     */
    actor: Actor;
    /**
     * Bearing.
     */
    bearing?: string | null;
    /**
     * Collection identifier.
     */
    collectionId?: number;
    /**
     * Collection item identifier.
     */
    collectionItemId: number;
    /**
     * Custom finish.
     */
    customFinish: ProductWriteFinishOption | null;
    /**
     * Finish option identifier.
     */
    finishOptionId: number | null;
    /**
     * Display name.
     */
    displayName: string;
    /**
     * Optional description.
     */
    description?: string | null;
    /**
     * Installed button.
     */
    installedButton?: {
      /**
       * Collection item identifier.
       */
      collectionItemId: number;
      /**
       * Custom finish.
       */
      customFinish: ProductWriteFinishOption | null;
      /**
       * Finish option identifier.
       */
      finishOptionId: number | null;
      /**
       * Material identifier.
       */
      materialId: number;
    } | null;
    /**
     * Material identifier.
     */
    materialId: number;
    /**
     * Administrative reason for the operation.
     */
    reason?: string;
  }): Promise<void>;
  /**
   * Updates collection.
   *
   * @param input - Collection identifier, replacement values, and authenticated actor.
   * @returns Updated collection.
   * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
   */
  updateCollection(
    input: CollectionWriteInput & {
      /**
       * Authenticated actor.
       */
      actor: Actor;
      /**
       * Collection identifier.
       */
      collectionId: number;
    },
  ): Promise<UserCollectionSummary>;
};

/**
 * Creates catalog and collection operations backed by the database.
 *
 * @param db - Database used for catalog persistence.
 * @param logger - Structured operation logger.
 * @param users - Optional user service required by audited mutations.
 * @param audit - Optional audit service required by audited mutations.
 * @returns Catalog operations bound to the supplied dependencies.
 */
export function createCatalogService(
  db: Database,
  logger: Logger,
  users?: UsersService,
  audit?: AuditService,
): CatalogService {
  return {
    /**
     * Creates an audited maker-scoped catalog terminology alias.
     *
     * @param input - Alias concept, label, maker, preference, and actor.
     * @returns Created terminology alias.
     * @rejects When authorization, validation, persistence, auditing, or logging fails.
     */
    async createTerminologyAlias(input) {
      if (!hasPermission(input.actor, "products.manage"))
        throw new Error("Product does not exist.");
      if (input.canonicalNamespace !== "product-type")
        throw new Error("Catalog terminology namespace is not registered.");
      const canonicalKey = catalogProductType(input.canonicalKey);
      const label = input.label.trim();
      const normalizedValue = normalizeCatalogSearch(label);
      if (!label || label.length > 80 || !normalizedValue)
        throw new Error("Alias must be between 1 and 80 characters.");
      const dependencies = requireProductAudit(users, audit);
      const actorUser = dependencies
        ? await dependencies.users.ensure({ clerkId: input.actor.clerkId })
        : null;
      return await loggedMutation(
        logger,
        loggerMessages.database.catalog.createTerminologyAlias,
        () =>
          db.transaction(async (tx) => {
            const [makerRow] = await tx
              .select({ id: schema.maker.id, name: schema.maker.name })
              .from(schema.maker)
              .where(eq(schema.maker.id, input.makerId))
              .limit(1);
            if (!makerRow) throw new Error("Maker does not exist.");
            const [row] = await tx
              .insert(schema.catalogTerminologyAlias)
              .values({
                canonicalKey,
                canonicalNamespace: input.canonicalNamespace,
                isPreferred: input.isPreferred,
                label,
                makerId: input.makerId,
                normalizedValue,
              })
              .returning()
              .catch(mapCatalogNameConflict);
            if (!row) throw new Error("Failed to create terminology alias.");
            const result: CatalogTerminologyAlias = {
              ...row,
              canonicalKey,
              canonicalNamespace: "product-type",
              makerName: makerRow.name,
            };
            if (dependencies && actorUser) {
              await writeProductAdminAudit(dependencies.audit, tx, {
                actor: input.actor,
                actorUser,
                after: {
                  canonicalKey,
                  canonicalNamespace: "product-type",
                  isPreferred: row.isPreferred,
                  label: row.label,
                  makerId: row.makerId,
                  normalizedValue: row.normalizedValue,
                },
                definition: productAudit.terminologyAliasCreated,
                targetId: row.id,
              });
            }
            return result;
          }),
        actorAttributes(input.actor.clerkId, {
          canonicalKey,
          makerId: input.makerId,
        }),
      );
    },
    /**
     * Attaches images.
     *
     * @param input - Target, uploaded files, and authenticated actor.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async attachImages(input) {
      const collectionDependencies = requireCollectionAudit(
        users,
        audit,
        input.target.type,
      );
      const productDependencies =
        input.target.type === "product" || input.target.type === "material"
          ? requireProductAudit(users, audit)
          : null;
      const dependencies = collectionDependencies ?? productDependencies;
      const actorUser = dependencies
        ? await dependencies.users.getByClerkId(input.actor.clerkId)
        : null;
      if (dependencies && !actorUser)
        throw new Error("Image target does not exist.");
      await loggedMutation(
        logger,
        loggerMessages.database.catalog.attachImages,
        () =>
          db.transaction(async (tx) => {
            await lockTarget(tx, input.target);
            const collectionContext = await collectionImageTargetContext(
              tx,
              input.target,
            );
            const productContext = await productImageTargetContext(
              tx,
              input.target,
            );
            const materialContext = await materialImageTargetContext(
              tx,
              input.target,
            );
            const before = await collectionImageState(tx, input.target);
            await attachStoredImages(tx, input);
            if (input.target.type === "product" && input.files.length)
              await touchProductUpdatedAt(tx, input.target.id);
            if (collectionContext) {
              const after = await collectionImageState(tx, input.target);
              if (!collectionDependencies || !actorUser)
                throw new Error("Collection audit is not configured.");
              await writeCollectionAudit(collectionDependencies.audit, tx, {
                actor: input.actor,
                actorUser,
                after,
                before,
                definition:
                  input.target.type === "collection_item"
                    ? collectionAudit.imageAdded
                    : before.currentImageId === null
                      ? collectionAudit.coverAdded
                      : collectionAudit.coverReplaced,
                ownerUserId: collectionContext.ownerUserId,
                reason: input.reason,
                targetId: input.target.id,
              });
            } else if (productContext) {
              if (!productDependencies || !actorUser)
                throw new Error("Product audit is not configured.");
              await writeProductAudit(productDependencies.audit, tx, {
                actor: input.actor,
                actorUser,
                after: await collectionImageState(tx, input.target),
                before,
                definition: productAudit.imageAdded,
                ownerClerkId: productContext.ownerClerkId,
                ownerUserId: productContext.ownerUserId,
                reason: input.reason,
                targetId: input.target.id,
              });
            } else if (materialContext) {
              if (!productDependencies || !actorUser)
                throw new Error("Product audit is not configured.");
              await writeProductAdminAudit(productDependencies.audit, tx, {
                actor: input.actor,
                actorUser,
                after: await collectionImageState(tx, input.target),
                before,
                definition: productAudit.materialImageAdded,
                targetId: materialContext.materialId,
              });
            }
          }),
        actorAttributes(input.actor.clerkId),
      );
    },
    /**
     * Selects collection cover.
     *
     * @param input - Collection, selected image, and authenticated actor.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async selectCollectionCover(input) {
      const dependencies = requireCollectionAudit(users, audit, "collection");
      if (!dependencies) throw new Error("Collection audit is not configured.");
      const actorUser = await dependencies.users.getByClerkId(
        input.actor.clerkId,
      );
      if (!actorUser) throw new Error("Collection does not exist.");
      await loggedMutation(
        logger,
        loggerMessages.database.catalog.selectCollectionCover,
        () =>
          db.transaction(async (tx) => {
            const context = await collectionImageTargetContext(tx, {
              id: input.collectionId,
              type: "collection",
            });
            if (!context) throw new Error("Collection does not exist.");
            const before = await collectionImageState(tx, {
              id: input.collectionId,
              type: "collection",
            });
            await selectStoredCover(tx, input);
            await writeCollectionAudit(dependencies.audit, tx, {
              actor: input.actor,
              actorUser,
              after: await collectionImageState(tx, {
                id: input.collectionId,
                type: "collection",
              }),
              before,
              definition:
                input.imageId === null
                  ? collectionAudit.coverCleared
                  : collectionAudit.coverSelected,
              ownerUserId: context.ownerUserId,
              reason: input.reason,
              targetId: input.collectionId,
            });
          }),
        actorAttributes(input.actor.clerkId),
      );
    },
    /**
     * Creates a reviewed maker-scoped compatibility family.
     *
     * @param input - Family maker, name, slug, and authenticated catalog manager.
     * @returns Created compatibility family.
     * @rejects When authorization, validation, persistence, auditing, or logging fails.
     */
    async createCompatibilityFamily(input) {
      if (!hasPermission(input.actor, "products.manage"))
        throw new Error("Product does not exist.");
      const dependencies = requireProductAudit(users, audit);
      const actorUser = dependencies
        ? await dependencies.users.ensure({ clerkId: input.actor.clerkId })
        : null;
      return await logger.operation(
        loggerMessages.database.catalog.createCompatibilityFamily,
        async () =>
          await db.transaction(async (tx) => {
            const [makerRow] = await tx
              .select({ id: schema.maker.id, name: schema.maker.name })
              .from(schema.maker)
              .where(eq(schema.maker.id, input.makerId))
              .limit(1);
            if (!makerRow) throw new Error("Maker does not exist.");
            const [row] = await tx
              .insert(schema.compatibilityFamily)
              .values({
                makerId: input.makerId,
                name: input.name,
                slug: input.slug,
              })
              .returning({
                id: schema.compatibilityFamily.id,
                makerId: schema.compatibilityFamily.makerId,
                name: schema.compatibilityFamily.name,
                slug: schema.compatibilityFamily.slug,
              })
              .catch(mapCatalogNameConflict);
            if (!row) throw new Error("Failed to create compatibility family.");
            const result = { ...row, makerName: makerRow.name };
            if (dependencies && actorUser) {
              await writeProductAdminAudit(dependencies.audit, tx, {
                actor: input.actor,
                actorUser,
                after: result,
                definition: productAudit.compatibilityFamilyCreated,
                targetId: row.id,
              });
            }
            return result;
          }),
        actorAttributes(input.actor.clerkId, { slug: input.slug }),
      );
    },
    /**
     * Creates an audited catalog-manager configuration template.
     *
     * @param input - Template scope, exact configuration, and actor.
     * @returns Created reusable authoring template.
     * @rejects When authorization, validation, persistence, auditing, or logging fails.
     */
    async createMagnetConfigurationTemplate(input) {
      if (!hasPermission(input.actor, "products.manage"))
        throw new Error("Product does not exist.");
      const name = normalizeRequiredVocabulary(input.name);
      const normalizedName = normalizeCatalogSearch(name);
      const configuration = normalizeCatalogMagnetConfiguration(
        input.configuration,
      );
      if (
        (input.scope === "global" &&
          (input.makerId !== null || input.compatibilityFamilyId !== null)) ||
        (input.scope === "maker" &&
          (input.makerId === null || input.compatibilityFamilyId !== null)) ||
        (input.scope === "family" &&
          (input.makerId !== null || input.compatibilityFamilyId === null))
      ) {
        throw new Error("Magnet configuration template scope is invalid.");
      }
      const dependencies = requireProductAudit(users, audit);
      const actorUser = dependencies
        ? await dependencies.users.ensure({ clerkId: input.actor.clerkId })
        : null;
      return await logger.operation(
        loggerMessages.database.catalog.createMagnetConfigurationTemplate,
        async () =>
          await db.transaction(async (tx) => {
            const [row] = await tx
              .insert(schema.magnetConfigurationTemplate)
              .values({
                compatibilityFamilyId: input.compatibilityFamilyId,
                configuration,
                makerId: input.makerId,
                name,
                normalizedName,
                scope: input.scope,
              })
              .returning()
              .catch(mapCatalogNameConflict);
            if (!row)
              throw new Error(
                "Failed to create magnet configuration template.",
              );
            const result: CatalogMagnetConfigurationTemplate = {
              compatibilityFamilyId: row.compatibilityFamilyId,
              configuration: normalizeCatalogMagnetConfiguration(
                row.configuration,
              ),
              id: row.id,
              makerId: row.makerId,
              name: row.name,
              scope: row.scope,
            };
            if (dependencies && actorUser) {
              await writeProductAdminAudit(dependencies.audit, tx, {
                actor: input.actor,
                actorUser,
                after: {
                  compatibilityFamilyId: result.compatibilityFamilyId,
                  configuration: result.configuration,
                  makerId: result.makerId,
                  name: result.name,
                  scope: result.scope,
                },
                definition: productAudit.magnetConfigurationTemplateCreated,
                targetId: row.id,
              });
            }
            return result;
          }),
        actorAttributes(input.actor.clerkId),
      );
    },
    /**
     * Creates color.
     *
     * @param input - Color name, slug, hex value, and authenticated actor.
     * @returns Created color.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async createColor(input) {
      if (!hasPermission(input.actor, "products.manage"))
        throw new Error("Product does not exist.");
      const dependencies = requireProductAudit(users, audit);
      const actorUser = dependencies
        ? await dependencies.users.ensure({ clerkId: input.actor.clerkId })
        : null;
      return await logger.operation(
        loggerMessages.database.catalog.createColor,
        async () =>
          await db.transaction(async (tx) => {
            const [duplicate] = await tx
              .select({ id: schema.color.id })
              .from(schema.color)
              .where(
                eq(sql`lower(${schema.color.name})`, input.name.toLowerCase()),
              )
              .limit(1);
            if (duplicate) throw new Error("Color name already exists.");

            const [row] = await tx
              .insert(schema.color)
              .values({ hex: input.hex, name: input.name, slug: input.slug })
              .returning({
                hex: schema.color.hex,
                id: schema.color.id,
                name: schema.color.name,
                slug: schema.color.slug,
              })
              .catch(mapCatalogNameConflict);
            if (!row) throw new Error("Failed to create color.");
            if (dependencies && actorUser) {
              await writeProductAdminAudit(dependencies.audit, tx, {
                actor: input.actor,
                actorUser,
                after: row,
                definition: productAudit.colorCreated,
                targetId: row.id,
              });
            }
            return row;
          }),
        actorAttributes(input.actor.clerkId, { slug: input.slug }),
      );
    },
    /**
     * Creates finish.
     *
     * @param input - Finish name, slug, and authenticated actor.
     * @returns Created finish.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async createFinish(input) {
      if (!hasPermission(input.actor, "products.manage"))
        throw new Error("Product does not exist.");
      const dependencies = requireProductAudit(users, audit);
      const actorUser = dependencies
        ? await dependencies.users.ensure({ clerkId: input.actor.clerkId })
        : null;
      return await logger.operation(
        loggerMessages.database.catalog.createFinish,
        async () =>
          await db.transaction(async (tx) => {
            const [duplicate] = await tx
              .select({ id: schema.finish.id })
              .from(schema.finish)
              .where(
                eq(sql`lower(${schema.finish.name})`, input.name.toLowerCase()),
              )
              .limit(1);
            if (duplicate) throw new Error("Finish name already exists.");

            const [row] = await tx
              .insert(schema.finish)
              .values({ name: input.name, slug: input.slug })
              .returning({
                id: schema.finish.id,
                name: schema.finish.name,
                slug: schema.finish.slug,
              })
              .catch(mapCatalogNameConflict);
            if (!row) throw new Error("Failed to create finish.");
            if (dependencies && actorUser) {
              await writeProductAdminAudit(dependencies.audit, tx, {
                actor: input.actor,
                actorUser,
                after: row,
                definition: productAudit.finishCreated,
                targetId: row.id,
              });
            }
            return row;
          }),
        actorAttributes(input.actor.clerkId, { slug: input.slug }),
      );
    },
    /**
     * Creates maker.
     *
     * @param input - Maker name, optional root URL, and authenticated actor.
     * @returns Created maker.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async createMaker(input) {
      if (!hasPermission(input.actor, "products.manage"))
        throw new Error("Product does not exist.");
      const dependencies = requireProductAudit(users, audit);
      const actorUser = dependencies
        ? await dependencies.users.ensure({ clerkId: input.actor.clerkId })
        : null;
      return await logger.operation(
        loggerMessages.database.catalog.createMaker,
        async () =>
          await db.transaction(async (tx) => {
            await tx.execute(
              sql`select pg_advisory_xact_lock(hashtext('makers.slug'))`,
            );
            const [duplicate] = await tx
              .select({ id: schema.maker.id })
              .from(schema.maker)
              .where(
                eq(sql`lower(${schema.maker.name})`, input.name.toLowerCase()),
              )
              .limit(1);
            if (duplicate) throw new Error("Maker name already exists.");

            const existingSlugs = await tx
              .select({ slug: schema.maker.slug })
              .from(schema.maker);
            const slug = nextAvailableSlug(
              input.name,
              existingSlugs.map((maker) => maker.slug),
            );

            const [row] = await tx
              .insert(schema.maker)
              .values({
                description: input.description ?? null,
                name: input.name,
                rootUrl: input.rootUrl,
                slug,
              })
              .returning({
                description: schema.maker.description,
                id: schema.maker.id,
                name: schema.maker.name,
                rootUrl: schema.maker.rootUrl,
                slug: schema.maker.slug,
              })
              .catch(mapCatalogNameConflict);
            if (!row) throw new Error("Failed to create maker.");
            if (dependencies && actorUser) {
              await writeProductAdminAudit(dependencies.audit, tx, {
                actor: input.actor,
                actorUser,
                after: row,
                definition: productAudit.makerCreated,
                targetId: row.id,
              });
            }
            return { ...row, images: [] };
          }),
        actorAttributes(input.actor.clerkId),
      );
    },
    /**
     * Creates material.
     *
     * @param input - Material name, optional description, and authenticated actor.
     * @returns Created material.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async createMaterial(input) {
      if (!hasPermission(input.actor, "products.manage"))
        throw new Error("Material does not exist.");
      const values = normalizeMaterialWrite(input);
      const dependencies = requireProductAudit(users, audit);
      const actorUser = dependencies
        ? await dependencies.users.ensure({ clerkId: input.actor.clerkId })
        : null;
      return await logger.operation(
        loggerMessages.database.catalog.createMaterial,
        async () =>
          await db.transaction(async (tx) => {
            const [duplicate] = await tx
              .select({ id: schema.material.id })
              .from(schema.material)
              .where(
                eq(
                  sql`lower(${schema.material.name})`,
                  values.name.toLowerCase(),
                ),
              )
              .limit(1);
            if (duplicate) throw new Error("Material name already exists.");
            const slug = await nextMaterialSlug(tx, values.name);

            const [row] = await tx
              .insert(schema.material)
              .values({ ...values, slug })
              .returning({
                description: schema.material.description,
                id: schema.material.id,
                name: schema.material.name,
                slug: schema.material.slug,
              })
              .catch(mapCatalogNameConflict);
            if (!row) throw new Error("Failed to create material.");
            if (dependencies && actorUser) {
              await writeProductAdminAudit(dependencies.audit, tx, {
                actor: input.actor,
                actorUser,
                after: row,
                definition: productAudit.materialCreated,
                targetId: row.id,
              });
            }
            return { ...row, images: [] };
          }),
        actorAttributes(input.actor.clerkId),
      );
    },
    /**
     * Creates pattern.
     *
     * @param input - Pattern name, slug, and authenticated actor.
     * @returns Created pattern.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async createPattern(input) {
      if (!hasPermission(input.actor, "products.manage"))
        throw new Error("Product does not exist.");
      const dependencies = requireProductAudit(users, audit);
      const actorUser = dependencies
        ? await dependencies.users.ensure({ clerkId: input.actor.clerkId })
        : null;
      return await logger.operation(
        loggerMessages.database.catalog.createPattern,
        async () =>
          await db.transaction(async (tx) => {
            const [duplicate] = await tx
              .select({ id: schema.pattern.id })
              .from(schema.pattern)
              .where(
                eq(
                  sql`lower(${schema.pattern.name})`,
                  input.name.toLowerCase(),
                ),
              )
              .limit(1);
            if (duplicate) throw new Error("Pattern name already exists.");

            const [row] = await tx
              .insert(schema.pattern)
              .values({ name: input.name, slug: input.slug })
              .returning({
                id: schema.pattern.id,
                name: schema.pattern.name,
                slug: schema.pattern.slug,
              })
              .catch(mapCatalogNameConflict);
            if (!row) throw new Error("Failed to create pattern.");
            if (dependencies && actorUser) {
              await writeProductAdminAudit(dependencies.audit, tx, {
                actor: input.actor,
                actorUser,
                after: row,
                definition: productAudit.patternCreated,
                targetId: row.id,
              });
            }
            return row;
          }),
        actorAttributes(input.actor.clerkId, { slug: input.slug }),
      );
    },
    /**
     * Creates product.
     *
     * @param input - Product fields, finish options, and authenticated actor.
     * @returns Created product.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async createProduct(input) {
      const dependencies = requireProductAudit(users, audit);
      const actorUser = dependencies
        ? await dependencies.users.ensure({ clerkId: input.actor.clerkId })
        : null;
      return await logger.operation(
        loggerMessages.database.catalog.createProduct,
        async () => {
          const [type] = await db
            .select({ id: schema.productType.id })
            .from(schema.productType)
            .where(eq(schema.productType.slug, input.productTypeSlug))
            .limit(1);
          if (!type) throw new Error("Product type does not exist.");
          if (!input.materialIds.length)
            throw new Error("At least one material is required.");
          await validateFinishOptions(db, input.finishOptions);

          const productId = await db.transaction(async (tx) => {
            const [row] = await tx
              .insert(schema.product)
              .values({
                ...(input.description !== undefined
                  ? {
                      description: normalizeOptionalDescription(
                        input.description,
                      ),
                    }
                  : {}),
                makerId: input.makerId,
                ...(input.makerProductUrl !== undefined
                  ? {
                      makerProductUrl: normalizeOptionalUrl(
                        input.makerProductUrl,
                      ),
                      makerProductUrlValid: true,
                    }
                  : {}),
                name: input.name,
                ownerClerkId: input.actor.clerkId,
                productTypeId: type.id,
                slug: input.slug,
              })
              .returning({ id: schema.product.id });
            if (!row) throw new Error("Failed to create product.");

            if (input.materialIds.length) {
              await tx.insert(schema.productMaterial).values(
                input.materialIds.map((materialId) => ({
                  materialId,
                  productId: row.id,
                })),
              );
            }

            await replaceProductFinishOptions(tx, row.id, input.finishOptions);

            await insertProductSubtype(
              tx,
              row.id,
              input.productTypeSlug,
              input.specs,
            );
            await replaceBodyHostedMagnetSetup(tx, row.id, input, true);
            await replaceInsertHostedMagnetOptions(tx, row.id, input, true);
            await replaceSliderInsertOffers(tx, row.id, input, true);
            await replaceProductRelationships(tx, row.id, input);
            if (dependencies && actorUser) {
              const [created] = await queryProducts(
                tx as unknown as Database,
                input.productTypeSlug,
                input.slug,
                input.actor,
              );
              if (!created) throw new Error("Failed to load created product.");
              await writeProductAudit(dependencies.audit, tx, {
                actor: input.actor,
                actorUser,
                after: productAuditState(created),
                definition: productAudit.productCreated,
                ownerClerkId: input.actor.clerkId,
                ownerUserId: actorUser.id,
                targetId: row.id,
              });
            }
            return row.id;
          });

          const created = await this.getProduct(
            input.productTypeSlug,
            input.slug,
            input.actor,
          );
          if (!created || created.id !== productId) {
            throw new Error("Failed to load created product.");
          }
          return created;
        },
        productAttributes(input),
      );
    },
    /**
     * Returns product.
     *
     * @param productTypeSlug - Product type slug.
     * @param productSlug - Product slug.
     * @param viewer - Optional catalog viewer.
     * @returns Matching product, when available.
     * @rejects When product data cannot be queried.
     */
    async getProduct(productTypeSlug, productSlug, viewer) {
      const products = await queryProducts(
        db,
        productTypeSlug,
        productSlug,
        viewer,
      );
      return products[0] ?? null;
    },
    /**
     * Applies one serialized product approval transition.
     *
     * @param input - Authorized approval decision.
     * @returns The resulting durable approval state.
     * @rejects When authorization, validation, lookup, persistence, or auditing fails.
     */
    async decideProductApproval(input) {
      if (!hasPermission(input.actor, "products.manage")) {
        throw new Error("Product does not exist.");
      }
      const reason = input.reason.trim();
      if (!reason || reason.length > 1000) {
        throw new Error("A decision reason is required.");
      }
      if (!users || !audit) throw new Error("Product audit is not configured.");
      return await loggedMutation(
        logger,
        loggerMessages.database.catalog.updateProduct,
        async () =>
          await db.transaction(async (tx) => {
            const [product] = await tx
              .select({
                approvalStatus: schema.product.approvalStatus,
                approvalDecidedAt: schema.product.approvalDecidedAt,
                ownerClerkId: schema.product.ownerClerkId,
              })
              .from(schema.product)
              .where(eq(schema.product.id, input.productId))
              .limit(1)
              .for("update");
            if (!product) throw new Error("Product does not exist.");
            const approvalStatus = nextApprovalStatus(
              product.approvalStatus,
              input.action,
            );
            const [actorUser] = await tx
              .select({ id: schema.user.id, username: schema.user.username })
              .from(schema.user)
              .where(eq(schema.user.clerkId, input.actor.clerkId))
              .limit(1);
            if (!actorUser) throw new Error("Product does not exist.");
            const [ownerUser] = product.ownerClerkId
              ? await tx
                  .select({ id: schema.user.id })
                  .from(schema.user)
                  .where(eq(schema.user.clerkId, product.ownerClerkId))
                  .limit(1)
              : [];
            const occurredAt = new Date();
            await tx
              .update(schema.product)
              .set({
                approvalDecidedAt: occurredAt,
                approvalDecisionReason: reason,
                approvalStatus,
              })
              .where(eq(schema.product.id, input.productId));
            await writeProductAdminAudit(audit, tx, {
              actor: input.actor,
              actorUser,
              after: {
                approvalStatus,
                approvalDecidedAt: occurredAt.toISOString(),
              },
              before: {
                approvalStatus: product.approvalStatus,
                approvalDecidedAt:
                  product.approvalDecidedAt?.toISOString() ?? null,
              },
              definition:
                input.action === "approve"
                  ? productAudit.productApproved
                  : input.action === "reject"
                    ? productAudit.productRejected
                    : productAudit.productApprovalReversed,
              occurredAt,
              ownerUserId: ownerUser?.id ?? null,
              reason,
              targetId: input.productId,
            });
            return approvalStatus;
          }),
        actorAttributes(input.actor.clerkId, { productId: input.productId }),
      );
    },
    /**
     * Deletes one unreferenced product, queues all its images, and audits atomically.
     *
     * @param input - Confirmed owner or authorized staff deletion.
     * @returns Whether deletion committed; referenced products remain unchanged.
     * @rejects When confirmation, authorization, validation, persistence, or auditing fails.
     */
    async deleteProduct(input) {
      if (input.confirmed !== true)
        throw new Error("Product deletion confirmation is required.");
      if (!users || !audit) throw new Error("Product audit is not configured.");
      return await loggedMutation(
        logger,
        loggerMessages.database.catalog.deleteProduct,
        async () =>
          await db.transaction(async (tx) => {
            await lockTarget(tx, { type: "product", id: input.productId });
            const [row] = await tx
              .select()
              .from(schema.product)
              .where(eq(schema.product.id, input.productId))
              .limit(1)
              .for("update");
            if (
              !row ||
              (row.ownerClerkId !== input.actor.clerkId &&
                !hasPermission(input.actor, "products.manage"))
            ) {
              throw new Error("Product does not exist.");
            }
            const reason = input.reason?.trim();
            if (
              (row.ownerClerkId !== input.actor.clerkId && !reason) ||
              (reason && reason.length > 1000)
            ) {
              throw new Error("A moderation reason is required.");
            }
            const [actorUser] = await tx
              .select({ id: schema.user.id, username: schema.user.username })
              .from(schema.user)
              .where(eq(schema.user.clerkId, input.actor.clerkId))
              .limit(1);
            if (!actorUser) throw new Error("Product does not exist.");
            const [ownerUser] = row.ownerClerkId
              ? await tx
                  .select({ id: schema.user.id })
                  .from(schema.user)
                  .where(eq(schema.user.clerkId, row.ownerClerkId))
                  .limit(1)
              : [];
            // FK writers lock these child keys, not necessarily the parent product.
            await tx
              .select({ id: schema.productSpinner.id })
              .from(schema.productSpinner)
              .where(eq(schema.productSpinner.id, row.id))
              .for("update");
            await tx
              .select({ id: schema.productSpinnerButton.id })
              .from(schema.productSpinnerButton)
              .where(eq(schema.productSpinnerButton.id, row.id))
              .for("update");
            for (const subtype of [
              schema.productSlider,
              schema.productSliderPlate,
              schema.productSliderInsert,
            ]) {
              await tx
                .select({ id: subtype.id })
                .from(subtype)
                .where(eq(subtype.id, row.id))
                .for("update");
            }
            const finishes = await tx
              .select({ id: schema.finishOption.id })
              .from(schema.finishOption)
              .where(eq(schema.finishOption.productId, row.id))
              .orderBy(asc(schema.finishOption.id))
              .for("update");
            const references = await tx.execute(sql`
            select 1 from collection_spinner where product_spinner_id = ${row.id}
            union all select 1 from collection_spinner_button where product_spinner_button_id = ${row.id}
            union all select 1 from product_spinner where compatible_button_id = ${row.id}
            union all select 1 from product_included_component where component_product_id = ${row.id}
            union all select 1 from product_compatibility_advisory where related_product_id = ${row.id}
            union all select 1 from finish_option selected join finish_option source on source.id = selected.source_product_finish_option_id where source.product_id = ${row.id}
            limit 1`);
            if (references.rows.length) return false;
            const product = (
              await queryProducts(tx, undefined, row.slug, input.actor)
            ).find(({ id }) => id === row.id);
            if (!product) failProductLoad();
            const images = await tx
              .select({
                id: schema.productImage.id,
                position: schema.productImage.position,
                fileName: schema.productImage.fileName,
                contentType: schema.productImage.contentType,
                size: schema.productImage.size,
                sha256: schema.productImage.sha256,
                storageProvider: schema.productImage.storageProvider,
                objectPath: schema.productImage.objectPath,
                deletedAt: schema.productImage.deletedAt,
              })
              .from(schema.productImage)
              .where(eq(schema.productImage.productId, row.id))
              .orderBy(asc(schema.productImage.id));
            await queueObjectDeletions(
              tx,
              images.map(({ objectPath }) => objectPath),
            );
            await tx
              .delete(schema.product)
              .where(eq(schema.product.id, row.id));
            await writeProductAudit(audit, tx, {
              actor: input.actor,
              actorUser,
              before: {
                ...productAuditState(product),
                approvalStatus: row.approvalStatus,
                approvalDecidedAt: row.approvalDecidedAt?.toISOString() ?? null,
                createdAt: row.createdAt.toISOString(),
                updatedAt: row.updatedAt.toISOString(),
                images: images.map((image) => ({
                  ...image,
                  deletedAt: image.deletedAt?.toISOString() ?? null,
                })),
              },
              after: {
                deleted: true,
                queuedImageCount: new Set(
                  images.map(({ objectPath }) => objectPath),
                ).size,
                deletedFinishOptionCount: finishes.length,
              },
              definition: productAudit.productDeleted,
              ownerClerkId: row.ownerClerkId,
              ownerUserId: ownerUser?.id ?? null,
              reason,
              targetId: row.id,
            });
            return true;
          }),
        actorAttributes(input.actor.clerkId, { productId: input.productId }),
      );
    },
    /**
     * Lists makers.
     *
     * @returns Matching makers.
     * @rejects When the database query fails.
     */
    async listMakers() {
      return await queryMakerProfiles(db, false);
    },
    /**
     * Returns one public maker profile with public products and collection items.
     *
     * @param slug - Stable maker slug.
     * @returns Public detail for the matching maker, or `null` when absent.
     * @rejects When maker or catalog data cannot be queried.
     */
    async getPublicMakerDetail(slug) {
      const maker = (await queryMakerProfiles(db, false)).find(
        (candidate) => candidate.slug === slug,
      );
      if (!maker) return null;
      const [products, collectionItems] = await Promise.all([
        queryProducts(db),
        queryOwnedItems(db, undefined, undefined, {
          makerId: maker.id,
          publicOnly: true,
        }),
      ]);
      return {
        ...maker,
        collectionItems: [
          ...new Map(
            collectionItems.map((item) => [item.collectionItemId, item]),
          ).values(),
        ],
        products: products.filter((product) => product.makerId === maker.id),
      };
    },
    /**
     * Lists public maker directory summaries.
     *
     * @returns Name-sorted maker summaries with visibility-filtered counts.
     * @rejects When the database query fails.
     */
    async listPublicMakers() {
      const result = await db.execute<{
        /** Public collection-item count. */
        collectionItemCount: number | string;
        /** Optional Markdown description. */
        description: string | null;
        /** Lead image content type. */
        imageContentType: string | null;
        /** Lead image creation time. */
        imageCreatedAt: Date | null;
        /** Lead image filename. */
        imageFileName: string | null;
        /** Lead image identifier. */
        imageId: number | string | null;
        /** Lead image object path. */
        imageObjectPath: string | null;
        /** Lead image position. */
        imagePosition: number | null;
        /** Lead image size in bytes. */
        imageSize: number | null;
        /** Lead image URL. */
        imageUrl: string | null;
        /** Maker identifier. */
        id: number | string;
        /** Maker display name. */
        name: string;
        /** Public product count. */
        productCount: number | string;
        /** Optional maker website. */
        rootUrl: string | null;
        /** Stable maker slug. */
        slug: string;
      }>(sql`
        with public_products as (
          select product.id, product.maker_id
          from product
          where product.approval_status = 'approved'
            and not product.is_private
        ), product_counts as (
          select maker_id, count(distinct id)::int as product_count
          from public_products
          group by maker_id
        ), public_items as (
          select distinct collection_item.id, public_products.maker_id
          from collection_item
          join user_collection
            on user_collection.id = collection_item.collection_id
          left join collection_spinner
            on collection_spinner.id = collection_item.id
          left join collection_spinner_button
            on collection_spinner_button.id = collection_item.id
          join public_products
            on public_products.id = coalesce(
              collection_spinner.product_spinner_id,
              collection_spinner_button.product_spinner_button_id
            )
          where collection_item.owned
            and collection_item.sold_at is null
            and collection_item.approval_status = 'approved'
            and not collection_item.is_private
            and not user_collection.is_private
        ), item_counts as (
          select maker_id, count(distinct id)::int as item_count
          from public_items
          group by maker_id
        )
        select makers.id, makers.name, makers.slug,
          makers.root_url as "rootUrl",
          makers.description,
          coalesce(product_counts.product_count, 0)::int as "productCount",
          coalesce(item_counts.item_count, 0)::int as "collectionItemCount",
          lead_image.id as "imageId",
          lead_image.file_name as "imageFileName",
          lead_image.content_type as "imageContentType",
          lead_image.size as "imageSize",
          lead_image.object_path as "imageObjectPath",
          lead_image.url as "imageUrl",
          lead_image.position as "imagePosition",
          lead_image.created_at as "imageCreatedAt"
        from makers
        left join product_counts on product_counts.maker_id = makers.id
        left join item_counts on item_counts.maker_id = makers.id
        left join lateral (
          select maker_image.*
          from maker_image
          where maker_image.maker_id = makers.id
            and maker_image.deleted_at is null
          order by maker_image.position, maker_image.id
          limit 1
        ) lead_image on true
        order by lower(makers.name), makers.id
      `);
      return result.rows.map((row) => ({
        collectionItemCount: Number(row.collectionItemCount),
        description: row.description,
        id: Number(row.id),
        images:
          row.imageId === null
            ? []
            : [
                {
                  contentType: row.imageContentType ?? "image/jpeg",
                  createdAt: row.imageCreatedAt ?? new Date(0),
                  deletedAt: null,
                  deletedByClerkId: null,
                  deletedByRole: null,
                  fileName: row.imageFileName ?? "maker",
                  id: Number(row.imageId),
                  objectPath: row.imageObjectPath ?? "",
                  position: row.imagePosition ?? 0,
                  size: row.imageSize ?? 0,
                  url: row.imageUrl ?? "",
                },
              ],
        name: row.name,
        productCount: Number(row.productCount),
        rootUrl: row.rootUrl,
        slug: row.slug,
      }));
    },
    /**
     * Lists maker profiles for an authorized product manager.
     *
     * @param actor - Authenticated administrator.
     * @returns Name-sorted maker profiles.
     * @rejects When authorization or persistence fails.
     */
    async listMakersForAdmin(actor) {
      if (!hasPermission(actor, "products.manage"))
        throw new Error("Product does not exist.");
      return await queryMakerProfiles(db, true);
    },
    /**
     * Returns one maker profile to an authorized product manager.
     *
     * @param input - Maker identifier and authenticated administrator.
     * @returns The matching maker, or `null` when it does not exist.
     * @rejects When authorization or persistence fails.
     */
    async getMakerForAdmin(input) {
      if (!hasPermission(input.actor, "products.manage"))
        throw new Error("Product does not exist.");
      const [maker] = await queryMakerProfiles(db, true, input.makerId);
      return maker ?? null;
    },
    /**
     * Lists color effects.
     *
     * @returns Matching color effects.
     * @rejects When the database query or operation logging fails.
     */
    async listColorEffects() {
      return await logger.operation(
        loggerMessages.database.catalog.listColorEffects,
        async () =>
          await db
            .select({
              id: schema.colorEffect.id,
              name: schema.colorEffect.name,
              slug: schema.colorEffect.slug,
            })
            .from(schema.colorEffect)
            .orderBy(asc(schema.colorEffect.name)),
      );
    },
    /**
     * Lists reviewed compatibility families.
     *
     * @returns Compatibility families ordered by maker and name.
     * @rejects When the database query or operation logging fails.
     */
    async listCompatibilityFamilies() {
      return await logger.operation(
        loggerMessages.database.catalog.listCompatibilityFamilies,
        async () =>
          await db
            .select({
              id: schema.compatibilityFamily.id,
              makerId: schema.compatibilityFamily.makerId,
              makerName: schema.maker.name,
              name: schema.compatibilityFamily.name,
              slug: schema.compatibilityFamily.slug,
            })
            .from(schema.compatibilityFamily)
            .innerJoin(
              schema.maker,
              eq(schema.compatibilityFamily.makerId, schema.maker.id),
            )
            .orderBy(
              asc(schema.maker.name),
              asc(schema.compatibilityFamily.name),
            ),
      );
    },
    /**
     * Lists exact configuration templates only to catalog managers.
     *
     * @param viewer - Viewer whose manager permission controls access.
     * @returns Visible authoring templates.
     */
    async listMagnetConfigurationTemplates(viewer) {
      if (!hasPermission(viewer, "products.manage")) return [];
      return await logger.operation(
        loggerMessages.database.catalog.listMagnetConfigurationTemplates,
        async () => {
          const rows = await db
            .select()
            .from(schema.magnetConfigurationTemplate)
            .orderBy(asc(schema.magnetConfigurationTemplate.name));
          return rows.map(
            (row): CatalogMagnetConfigurationTemplate => ({
              compatibilityFamilyId: row.compatibilityFamilyId,
              configuration: normalizeCatalogMagnetConfiguration(
                row.configuration,
              ),
              id: row.id,
              makerId: row.makerId,
              name: row.name,
              scope: row.scope,
            }),
          );
        },
      );
    },
    /**
     * Lists maker-scoped terminology aliases ordered by label.
     *
     * @returns Registered terminology aliases.
     */
    async listTerminologyAliases() {
      return await logger.operation(
        loggerMessages.database.catalog.listTerminologyAliases,
        async () => {
          const rows = await db
            .select({
              canonicalKey: schema.catalogTerminologyAlias.canonicalKey,
              canonicalNamespace:
                schema.catalogTerminologyAlias.canonicalNamespace,
              createdAt: schema.catalogTerminologyAlias.createdAt,
              id: schema.catalogTerminologyAlias.id,
              isPreferred: schema.catalogTerminologyAlias.isPreferred,
              label: schema.catalogTerminologyAlias.label,
              makerId: schema.catalogTerminologyAlias.makerId,
              makerName: schema.maker.name,
              normalizedValue: schema.catalogTerminologyAlias.normalizedValue,
              updatedAt: schema.catalogTerminologyAlias.updatedAt,
            })
            .from(schema.catalogTerminologyAlias)
            .innerJoin(
              schema.maker,
              eq(schema.catalogTerminologyAlias.makerId, schema.maker.id),
            )
            .orderBy(
              asc(schema.catalogTerminologyAlias.label),
              asc(schema.maker.name),
            );
          return rows.map((row) => ({
            ...row,
            canonicalKey: catalogProductType(row.canonicalKey),
            canonicalNamespace: "product-type" as const,
          }));
        },
      );
    },
    /**
     * Lists colors.
     *
     * @returns Matching colors.
     * @rejects When the database query or operation logging fails.
     */
    async listColors() {
      return await logger.operation(
        loggerMessages.database.catalog.listColors,
        async () =>
          await db
            .select({
              hex: schema.color.hex,
              id: schema.color.id,
              name: schema.color.name,
              slug: schema.color.slug,
            })
            .from(schema.color)
            .orderBy(asc(schema.color.name)),
      );
    },
    /**
     * Lists finishes.
     *
     * @returns Matching finishes.
     * @rejects When the database query or operation logging fails.
     */
    async listFinishes() {
      return await logger.operation(
        loggerMessages.database.catalog.listFinishes,
        async () =>
          await db
            .select({
              id: schema.finish.id,
              name: schema.finish.name,
              slug: schema.finish.slug,
            })
            .from(schema.finish)
            .orderBy(asc(schema.finish.name)),
      );
    },
    /**
     * Lists materials.
     *
     * @returns Matching materials.
     * @rejects When the database query fails.
     */
    async listMaterials() {
      return await db
        .select({
          id: schema.material.id,
          name: schema.material.name,
          slug: schema.material.slug,
        })
        .from(schema.material)
        .orderBy(asc(schema.material.name));
    },
    /**
     * Lists all materials with public product and collection-item counts.
     *
     * @returns Name-sorted material summaries.
     * @rejects When material, image, or count queries fail.
     */
    async listPublicMaterials() {
      return await queryPublicMaterialSummaries(db);
    },
    /**
     * Loads one material with public related products and directly assigned items.
     *
     * @param materialSlug - Stable material route slug.
     * @returns Material detail, or `null` when no material matches.
     * @rejects When material or related catalog queries fail.
     */
    async getPublicMaterial(materialSlug) {
      const [material] = await db
        .select({
          description: schema.material.description,
          id: schema.material.id,
          name: schema.material.name,
          slug: schema.material.slug,
        })
        .from(schema.material)
        .where(eq(schema.material.slug, materialSlug))
        .limit(1);
      if (!material) return null;

      const [summaries, images, products, collectionItems] = await Promise.all([
        queryPublicMaterialSummaries(db, material.id),
        queryMaterialImages(db, material.id),
        queryPublicMaterialProducts(db, material.id),
        queryOwnedItems(db, undefined, undefined, {
          materialId: material.id,
          publicOnly: true,
        }),
      ]);
      const summary = summaries[0];
      if (!summary) return null;
      return {
        ...summary,
        collectionItems,
        description: material.description,
        images: images.filter(({ deletedAt }) => deletedAt === null),
        products,
      };
    },
    /**
     * Lists material content for product administrators.
     *
     * @param actor - Administrator requesting material content.
     * @returns Materials without image payloads.
     * @rejects When authorization or persistence fails.
     */
    async listAdminMaterials(actor) {
      if (!hasPermission(actor, "products.manage"))
        throw new Error("Material does not exist.");
      return await logger.operation(
        loggerMessages.database.catalog.listAdminMaterials,
        async () => await queryAdminMaterialRows(db),
        actorAttributes(actor.clerkId),
      );
    },
    /**
     * Loads one material for product administration.
     *
     * @param materialId - Material identifier.
     * @param actor - Administrator requesting material content.
     * @returns Matching material, or `null` when no row exists.
     * @rejects When authorization or persistence fails.
     */
    async getAdminMaterial(materialId, actor) {
      if (!hasPermission(actor, "products.manage"))
        throw new Error("Material does not exist.");
      return await logger.operation(
        loggerMessages.database.catalog.getAdminMaterial,
        async () => {
          const material = (await queryAdminMaterialRows(db, materialId))[0];
          return material
            ? {
                ...material,
                images: await queryMaterialImages(db, material.id),
              }
            : null;
        },
        actorAttributes(actor.clerkId, { materialId }),
      );
    },
    /**
     * Lists patterns.
     *
     * @returns Matching patterns.
     * @rejects When the database query or operation logging fails.
     */
    async listPatterns() {
      return await logger.operation(
        loggerMessages.database.catalog.listPatterns,
        async () =>
          await db
            .select({
              id: schema.pattern.id,
              name: schema.pattern.name,
              slug: schema.pattern.slug,
            })
            .from(schema.pattern)
            .orderBy(asc(schema.pattern.name)),
      );
    },
    /**
     * Lists products.
     *
     * @param productTypeSlug - Product type slug.
     * @param viewer - Optional catalog viewer.
     * @returns Matching products.
     * @rejects When product data cannot be queried.
     */
    async listProducts(productTypeSlug, viewer) {
      return await queryProducts(db, productTypeSlug, undefined, viewer);
    },
    /**
     * Lists product types.
     *
     * @returns Matching product types.
     * @rejects When the database query fails.
     */
    async listProductTypes() {
      return await db
        .select({
          id: schema.productType.id,
          name: schema.productType.name,
          slug: schema.productType.slug,
        })
        .from(schema.productType)
        .orderBy(asc(schema.productType.name));
    },
    /**
     * Lists slugs.
     *
     * @param productTypeSlug - Product type slug.
     * @param exceptProductId - Except product identifier.
     * @returns Matching slugs.
     * @rejects When the database query fails.
     */
    async listSlugs(productTypeSlug, exceptProductId) {
      const conditions = [eq(schema.productType.slug, productTypeSlug)];
      if (exceptProductId !== undefined) {
        conditions.push(sql`${schema.product.id} <> ${exceptProductId}`);
      }
      const rows = await db
        .select({ slug: schema.product.slug })
        .from(schema.product)
        .innerJoin(
          schema.productType,
          eq(schema.product.productTypeId, schema.productType.id),
        )
        .where(and(...conditions));
      return rows.map(({ slug }) => slug);
    },
    /**
     * Lists image trash.
     *
     * @param input - Actor whose visible deleted images should be listed.
     * @returns Matching image trash.
     * @rejects When the database query fails.
     */
    async listImageTrash(input) {
      return await listCatalogImageTrash(db, input);
    },
    /**
     * Restores image.
     *
     * @param input - Actor, deleted image, target type, and optional moderation reason.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async restoreImage(input) {
      if (input.targetType === "material") {
        if (!hasPermission(input.actor, "products.manage"))
          throw new Error("Image does not exist.");
        const dependencies = requireProductAudit(users, audit);
        const actorUser = dependencies
          ? await dependencies.users.ensure({ clerkId: input.actor.clerkId })
          : null;
        await db.transaction(async (tx) => {
          const context = await materialImageContext(tx, input.imageId);
          await restoreCatalogImage(tx, input);
          if (dependencies && actorUser) {
            if (!context) throw new Error("Image does not exist.");
            await writeProductAdminAudit(dependencies.audit, tx, {
              actor: input.actor,
              actorUser,
              after: { deleted: false, imageId: input.imageId },
              before: { deleted: true, imageId: input.imageId },
              definition: productAudit.materialImageRestored,
              targetId: context.materialId,
            });
          }
        });
        return;
      }
      if (input.targetType === "maker") {
        const dependencies = requireProductAudit(users, audit);
        const actorUser = dependencies
          ? await dependencies.users.ensure({ clerkId: input.actor.clerkId })
          : null;
        await db.transaction(async (tx) => {
          const context = await makerImageContext(tx, input.imageId);
          await restoreCatalogImage(tx, input);
          if (dependencies && actorUser) {
            if (!context) throw new Error("Image does not exist.");
            await writeProductAdminAudit(dependencies.audit, tx, {
              actor: input.actor,
              actorUser,
              after: { deleted: false, imageId: input.imageId },
              before: { deleted: true, imageId: input.imageId },
              definition: productAudit.makerImageRestored,
              reason: input.reason,
              targetId: context.makerId,
            });
          }
        });
        return;
      }
      if (input.targetType === "product") {
        const dependencies = requireProductAudit(users, audit);
        const actorUser = dependencies
          ? await dependencies.users.getByClerkId(input.actor.clerkId)
          : null;
        await db.transaction(async (tx) => {
          const context = dependencies
            ? await productImageContext(tx, input.imageId)
            : null;
          await restoreCatalogImage(tx, input);
          if (dependencies && actorUser) {
            if (!context) throw new Error("Image does not exist.");
            await writeProductAudit(dependencies.audit, tx, {
              actor: input.actor,
              actorUser,
              after: { deleted: false, imageId: input.imageId },
              before: { deleted: true, imageId: input.imageId },
              definition: productAudit.imageRestored,
              ownerClerkId: context.ownerClerkId,
              ownerUserId: context.ownerUserId,
              reason: input.reason,
              targetId: context.productId,
            });
          }
        });
        return;
      }
      const dependencies = requireCollectionAudit(
        users,
        audit,
        "collection_item",
      );
      if (!dependencies) throw new Error("Collection audit is not configured.");
      const actorUser = await dependencies.users.getByClerkId(
        input.actor.clerkId,
      );
      if (!actorUser) throw new Error("Image does not exist.");
      await db.transaction(async (tx) => {
        const context = await collectionItemImageContext(tx, input.imageId);
        await restoreCatalogImage(tx, input);
        if (!context) throw new Error("Image does not exist.");
        await writeCollectionAudit(dependencies.audit, tx, {
          actor: input.actor,
          actorUser,
          after: { deleted: false, imageId: input.imageId },
          before: { deleted: true, imageId: input.imageId },
          definition: collectionAudit.imageRestored,
          ownerUserId: context.ownerUserId,
          reason: input.reason,
          targetId: context.collectionItemId,
        });
      });
    },
    /**
     * Sets product visibility.
     *
     * @param input - Product visibility update and actor context.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async setVisibility(input) {
      const dependencies = requireProductAudit(users, audit);
      const actorUser = dependencies
        ? await dependencies.users.ensure({ clerkId: input.actor.clerkId })
        : null;
      await db.transaction(async (tx) => {
        const [product] = await tx
          .select({
            isPrivate: schema.product.isPrivate,
            ownerClerkId: schema.product.ownerClerkId,
            ownerUserId: schema.user.id,
            privatedByClerkId: schema.product.privatedByClerkId,
          })
          .from(schema.product)
          .leftJoin(
            schema.user,
            eq(schema.product.ownerClerkId, schema.user.clerkId),
          )
          .where(eq(schema.product.id, input.productId))
          .limit(1);
        if (
          !product ||
          (product.ownerClerkId !== input.actor.clerkId &&
            !hasPermission(input.actor, "products.manage"))
        ) {
          throw new Error("Product does not exist.");
        }
        const actorIsModerating =
          product.ownerClerkId !== input.actor.clerkId &&
          hasPermission(input.actor, "products.manage");
        if (
          !input.isPrivate &&
          product.privatedByClerkId &&
          product.privatedByClerkId !== input.actor.clerkId &&
          !actorIsModerating
        ) {
          throw new Error("Product is private by an administrator.");
        }
        if (actorIsModerating && input.isPrivate && !input.reason?.trim()) {
          throw new Error("A privacy reason is required.");
        }
        await tx
          .update(schema.product)
          .set(
            privacyUpdate({
              actorClerkId: input.actor.clerkId,
              actorIsModerating,
              isPrivate: input.isPrivate,
              reason: input.reason,
              touchUpdatedAt: false,
            }),
          )
          .where(eq(schema.product.id, input.productId));
        if (dependencies && actorUser) {
          await writeProductAudit(dependencies.audit, tx, {
            actor: input.actor,
            actorUser,
            after: { isPrivate: input.isPrivate },
            before: { isPrivate: product.isPrivate },
            definition: productAudit.productVisibilityChanged,
            ownerClerkId: product.ownerClerkId,
            ownerUserId: product.ownerUserId,
            reason: input.reason,
            targetId: input.productId,
          });
        }
      });
    },
    /**
     * Updates mutable maker profile fields without changing its stable slug.
     *
     * @param input - Maker fields and authenticated administrator.
     * @returns The updated maker profile.
     * @rejects When authorization, lookup, conflicts, persistence, auditing, or operation logging fails.
     */
    async updateMaker(input) {
      if (!hasPermission(input.actor, "products.manage"))
        throw new Error("Product does not exist.");
      const dependencies = requireProductAudit(users, audit);
      const actorUser = dependencies
        ? await dependencies.users.ensure({ clerkId: input.actor.clerkId })
        : null;
      return await logger.operation(
        loggerMessages.database.catalog.updateMaker,
        async () =>
          await db.transaction(async (tx) => {
            const [before] = await tx
              .select({
                description: schema.maker.description,
                id: schema.maker.id,
                name: schema.maker.name,
                rootUrl: schema.maker.rootUrl,
                slug: schema.maker.slug,
              })
              .from(schema.maker)
              .where(eq(schema.maker.id, input.makerId))
              .limit(1);
            if (!before) throw new Error("Maker does not exist.");

            const [after] = await tx
              .update(schema.maker)
              .set({
                description: input.description,
                name: input.name,
                rootUrl: input.rootUrl,
                updatedAt: new Date(),
              })
              .where(eq(schema.maker.id, input.makerId))
              .returning({
                description: schema.maker.description,
                id: schema.maker.id,
                name: schema.maker.name,
                rootUrl: schema.maker.rootUrl,
                slug: schema.maker.slug,
              })
              .catch(mapCatalogNameConflict);
            if (!after) throw new Error("Maker does not exist.");
            if (dependencies && actorUser) {
              await writeProductAdminAudit(dependencies.audit, tx, {
                actor: input.actor,
                actorUser,
                after,
                before,
                definition: productAudit.makerUpdated,
                targetId: after.id,
              });
            }
            const images = await queryMakerProfiles(tx, true, after.id);
            return images[0] ?? { ...after, images: [] };
          }),
        actorAttributes(input.actor.clerkId, { makerId: input.makerId }),
      );
    },
    /**
     * Sets maker product URL validity.
     *
     * @param input - Product, validity decision, actor, and optional moderation reason.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async setMakerProductUrlValidity(input) {
      if (!hasPermission(input.actor, "products.manage"))
        throw new Error("Product does not exist.");
      const dependencies = requireProductAudit(users, audit);
      const actorUser = dependencies
        ? await dependencies.users.ensure({ clerkId: input.actor.clerkId })
        : null;
      await logger.operation(
        loggerMessages.database.catalog.setMakerProductUrlValidity,
        async () =>
          await db.transaction(async (tx) => {
            const [product] = await tx
              .select({
                makerProductUrlValid: schema.product.makerProductUrlValid,
                ownerClerkId: schema.product.ownerClerkId,
                ownerUserId: schema.user.id,
              })
              .from(schema.product)
              .leftJoin(
                schema.user,
                eq(schema.product.ownerClerkId, schema.user.clerkId),
              )
              .where(eq(schema.product.id, input.productId))
              .limit(1);
            if (!product) throw new Error("Product does not exist.");
            if (
              product.ownerClerkId !== input.actor.clerkId &&
              !input.reason?.trim()
            ) {
              throw new Error("A moderation reason is required.");
            }
            await tx
              .update(schema.product)
              .set({
                makerProductUrlValid: input.makerProductUrlValid,
                updatedAt: new Date(),
              })
              .where(eq(schema.product.id, input.productId));
            if (dependencies && actorUser) {
              await writeProductAdminAudit(dependencies.audit, tx, {
                actor: input.actor,
                actorUser,
                after: { makerProductUrlValid: input.makerProductUrlValid },
                before: {
                  makerProductUrlValid: product.makerProductUrlValid,
                },
                definition: productAudit.makerProductUrlValidityChanged,
                ownerUserId: product.ownerUserId,
                reason: input.reason,
                targetId: input.productId,
              });
            }
          }),
        {
          attributes: {
            makerProductUrlValid: input.makerProductUrlValid,
            productId: input.productId,
          },
        },
      );
    },
    /**
     * Soft-deletes image.
     *
     * @param input - Actor, image, target type, and optional moderation reason.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async softDeleteImage(input) {
      if (input.targetType === "material") {
        if (!hasPermission(input.actor, "products.manage"))
          throw new Error("Image does not exist.");
        const dependencies = requireProductAudit(users, audit);
        const actorUser = dependencies
          ? await dependencies.users.ensure({ clerkId: input.actor.clerkId })
          : null;
        await db.transaction(async (tx) => {
          const context = await materialImageContext(tx, input.imageId);
          if (!(await softDeleteCatalogImage(tx, input))) return;
          if (dependencies && actorUser) {
            if (!context) throw new Error("Image does not exist.");
            await writeProductAdminAudit(dependencies.audit, tx, {
              actor: input.actor,
              actorUser,
              after: { deleted: true, imageId: input.imageId },
              before: { deleted: false, imageId: input.imageId },
              definition: productAudit.materialImageDeleted,
              targetId: context.materialId,
            });
          }
        });
        return;
      }
      if (input.targetType === "maker") {
        const dependencies = requireProductAudit(users, audit);
        const actorUser = dependencies
          ? await dependencies.users.ensure({ clerkId: input.actor.clerkId })
          : null;
        await db.transaction(async (tx) => {
          const context = await makerImageContext(tx, input.imageId);
          if (!(await softDeleteCatalogImage(tx, input))) return;
          if (dependencies && actorUser) {
            if (!context) throw new Error("Image does not exist.");
            await writeProductAdminAudit(dependencies.audit, tx, {
              actor: input.actor,
              actorUser,
              after: { deleted: true, imageId: input.imageId },
              before: { deleted: false, imageId: input.imageId },
              definition: productAudit.makerImageDeleted,
              reason: input.reason,
              targetId: context.makerId,
            });
          }
        });
        return;
      }
      if (input.targetType === "product") {
        const dependencies = requireProductAudit(users, audit);
        const actorUser = dependencies
          ? await dependencies.users.getByClerkId(input.actor.clerkId)
          : null;
        await db.transaction(async (tx) => {
          const context = dependencies
            ? await productImageContext(tx, input.imageId)
            : null;
          if (!(await softDeleteCatalogImage(tx, input))) return;
          if (dependencies && actorUser) {
            if (!context) throw new Error("Image does not exist.");
            await writeProductAudit(dependencies.audit, tx, {
              actor: input.actor,
              actorUser,
              after: { deleted: true, imageId: input.imageId },
              before: { deleted: false, imageId: input.imageId },
              definition: productAudit.imageDeleted,
              ownerClerkId: context.ownerClerkId,
              ownerUserId: context.ownerUserId,
              reason: input.reason,
              targetId: context.productId,
            });
          }
        });
        return;
      }
      const dependencies = requireCollectionAudit(
        users,
        audit,
        "collection_item",
      );
      if (!dependencies) throw new Error("Collection audit is not configured.");
      const actorUser = await dependencies.users.getByClerkId(
        input.actor.clerkId,
      );
      if (!actorUser) throw new Error("Image does not exist.");
      await db.transaction(async (tx) => {
        if (!(await softDeleteCatalogImage(tx, input))) return;
        const context = await collectionItemImageContext(tx, input.imageId);
        if (!context) throw new Error("Image does not exist.");
        await writeCollectionAudit(dependencies.audit, tx, {
          actor: input.actor,
          actorUser,
          after: { deleted: true, imageId: input.imageId },
          before: { deleted: false, imageId: input.imageId },
          definition: collectionAudit.imageDeleted,
          ownerUserId: context.ownerUserId,
          reason: input.reason,
          targetId: context.collectionItemId,
        });
      });
    },
    /**
     * Updates editable material content while preserving its stable slug.
     *
     * @param input - Material identifier, replacement content, and administrator.
     * @returns Updated material with images.
     * @rejects When authorization, validation, persistence, auditing, or logging fails.
     */
    async updateMaterial(input) {
      if (!hasPermission(input.actor, "products.manage"))
        throw new Error("Material does not exist.");
      const values = normalizeMaterialWrite(input);
      const dependencies = requireProductAudit(users, audit);
      const actorUser = dependencies
        ? await dependencies.users.ensure({ clerkId: input.actor.clerkId })
        : null;
      return await logger.operation(
        loggerMessages.database.catalog.updateMaterial,
        async () =>
          await db.transaction(async (tx) => {
            const [before] = await tx
              .select({
                description: schema.material.description,
                id: schema.material.id,
                name: schema.material.name,
                slug: schema.material.slug,
              })
              .from(schema.material)
              .where(eq(schema.material.id, input.materialId))
              .limit(1);
            if (!before) throw new Error("Material does not exist.");
            const [duplicate] = await tx
              .select({ id: schema.material.id })
              .from(schema.material)
              .where(
                and(
                  eq(
                    sql`lower(${schema.material.name})`,
                    values.name.toLowerCase(),
                  ),
                  sql`${schema.material.id} <> ${input.materialId}`,
                ),
              )
              .limit(1);
            if (duplicate) throw new Error("Material name already exists.");
            const [after] = await tx
              .update(schema.material)
              .set({ ...values, updatedAt: new Date() })
              .where(eq(schema.material.id, input.materialId))
              .returning({
                description: schema.material.description,
                id: schema.material.id,
                name: schema.material.name,
                slug: schema.material.slug,
              })
              .catch(mapCatalogNameConflict);
            if (!after) throw new Error("Material does not exist.");
            if (dependencies && actorUser) {
              await writeProductAdminAudit(dependencies.audit, tx, {
                actor: input.actor,
                actorUser,
                after,
                before,
                definition: productAudit.materialUpdated,
                targetId: input.materialId,
              });
            }
            const images = await queryMaterialImages(tx, input.materialId);
            return { ...after, images };
          }),
        actorAttributes(input.actor.clerkId, {
          materialId: input.materialId,
        }),
      );
    },
    /**
     * Updates product.
     *
     * @param input - Product identifier and replacement catalog fields.
     * @returns Updated product.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async updateProduct(input) {
      const dependencies = requireProductAudit(users, audit);
      const actorUser = dependencies
        ? await dependencies.users.ensure({ clerkId: input.actor.clerkId })
        : null;
      return await logger.operation(
        loggerMessages.database.catalog.updateProduct,
        async () => {
          if (!input.materialIds.length)
            throw new Error("At least one material is required.");
          await validateFinishOptions(db, input.finishOptions);
          await db.transaction(async (tx) => {
            const [existing] = await tx
              .select({
                id: schema.product.id,
                makerProductUrl: schema.product.makerProductUrl,
                makerProductUrlValid: schema.product.makerProductUrlValid,
                ownerClerkId: schema.product.ownerClerkId,
                ownerUserId: schema.user.id,
                slug: schema.product.slug,
              })
              .from(schema.product)
              .innerJoin(
                schema.productType,
                eq(schema.product.productTypeId, schema.productType.id),
              )
              .leftJoin(
                schema.user,
                eq(schema.product.ownerClerkId, schema.user.clerkId),
              )
              .where(
                and(
                  eq(schema.product.id, input.productId),
                  eq(schema.productType.slug, input.productTypeSlug),
                ),
              )
              .limit(1);
            if (!existing) throw new Error("Product does not exist.");
            if (
              existing.ownerClerkId !== input.actor.clerkId &&
              !hasPermission(input.actor, "products.manage")
            ) {
              throw new Error("Product does not exist.");
            }
            const before =
              dependencies && actorUser
                ? productAuditState(
                    (
                      await queryProducts(
                        tx as unknown as Database,
                        input.productTypeSlug,
                        existing.slug,
                        input.actor,
                      )
                    )[0] ?? failProductLoad(),
                  )
                : undefined;
            const makerProductUrl =
              input.makerProductUrl === undefined
                ? undefined
                : normalizeOptionalUrl(input.makerProductUrl);

            await tx
              .update(schema.product)
              .set({
                ...(input.description !== undefined
                  ? {
                      description: normalizeOptionalDescription(
                        input.description,
                      ),
                    }
                  : {}),
                makerId: input.makerId,
                ...(makerProductUrl !== undefined
                  ? {
                      makerProductUrl,
                      makerProductUrlValid:
                        makerProductUrl !==
                        normalizeOptionalUrl(existing.makerProductUrl)
                          ? true
                          : existing.makerProductUrlValid,
                    }
                  : {}),
                name: input.name,
                slug: input.slug,
                updatedAt: new Date(),
              })
              .where(eq(schema.product.id, input.productId));
            await tx
              .delete(schema.productMaterial)
              .where(eq(schema.productMaterial.productId, input.productId));
            await tx.insert(schema.productMaterial).values(
              input.materialIds.map((materialId) => ({
                materialId,
                productId: input.productId,
              })),
            );
            await replaceProductFinishOptions(
              tx,
              input.productId,
              input.finishOptions,
            );

            await updateProductSubtype(
              tx,
              input.productId,
              input.productTypeSlug,
              input.specs,
            );
            await replaceBodyHostedMagnetSetup(
              tx,
              input.productId,
              input,
              false,
            );
            await replaceInsertHostedMagnetOptions(
              tx,
              input.productId,
              input,
              false,
            );
            await replaceSliderInsertOffers(tx, input.productId, input, false);
            await replaceProductRelationships(tx, input.productId, input);
            if (dependencies && actorUser) {
              const [updated] = await queryProducts(
                tx as unknown as Database,
                input.productTypeSlug,
                input.slug,
                input.actor,
              );
              if (!updated) throw new Error("Failed to load updated product.");
              await writeProductAudit(dependencies.audit, tx, {
                actor: input.actor,
                actorUser,
                after: productAuditState(updated),
                before,
                definition: productAudit.productUpdated,
                ownerClerkId: existing.ownerClerkId,
                ownerUserId: existing.ownerUserId,
                reason: input.reason,
                targetId: input.productId,
              });
            }
          });

          const updated = await this.getProduct(
            input.productTypeSlug,
            input.slug,
            input.actor,
          );
          if (!updated) throw new Error("Failed to load updated product.");
          return updated;
        },
        productAttributes(input),
      );
    },
  };
}

/**
 * Creates the collection database service.
 *
 * @param db - Application database.
 * @param users - User lookup service.
 * @param audit - Audit writer.
 * @param logger - Structured operation logger.
 * @returns Collection database operations.
 */
export function createCollectionsService(
  db: Database,
  users: UsersService,
  audit: AuditService,
  logger: Logger,
): CollectionsService {
  return {
    /**
     * Applies one serialized collection-item approval transition with transactional auditing.
     *
     * @param input - Authorized approval decision.
     * @returns The resulting durable approval state.
     * @rejects When authorization, validation, lookup, persistence, or auditing fails.
     */
    async decideItemApproval(input) {
      if (!hasPermission(input.actor, "collections.manage")) {
        throw new Error("Collection item does not exist.");
      }
      const reason = input.reason.trim();
      if (!reason || reason.length > 1000) {
        throw new Error("A decision reason is required.");
      }
      return await loggedMutation(
        logger,
        loggerMessages.database.collections.updateItem,
        async () =>
          await db.transaction(async (tx) => {
            const [item] = await tx
              .select({
                approvalStatus: schema.collectionItem.approvalStatus,
                approvalDecidedAt: schema.collectionItem.approvalDecidedAt,
                ownerId: schema.collectionItem.ownerId,
              })
              .from(schema.collectionItem)
              .where(eq(schema.collectionItem.id, input.collectionItemId))
              .limit(1)
              .for("update");
            if (!item) throw new Error("Collection item does not exist.");
            const approvalStatus = nextApprovalStatus(
              item.approvalStatus,
              input.action,
            );
            const [actorUser] = await tx
              .select({ id: schema.user.id, username: schema.user.username })
              .from(schema.user)
              .where(eq(schema.user.clerkId, input.actor.clerkId))
              .limit(1);
            if (!actorUser) throw new Error("Collection item does not exist.");
            const occurredAt = new Date();
            await tx
              .update(schema.collectionItem)
              .set({
                approvalDecidedAt: occurredAt,
                approvalDecisionReason: reason,
                approvalStatus,
                updatedAt: occurredAt,
              })
              .where(eq(schema.collectionItem.id, input.collectionItemId));
            await writeCollectionAudit(audit, tx, {
              actor: input.actor,
              actorUser,
              after: {
                approvalStatus,
                approvalDecidedAt: occurredAt.toISOString(),
              },
              before: {
                approvalStatus: item.approvalStatus,
                approvalDecidedAt:
                  item.approvalDecidedAt?.toISOString() ?? null,
              },
              definition:
                input.action === "approve"
                  ? collectionAudit.itemApproved
                  : input.action === "reject"
                    ? collectionAudit.itemRejected
                    : collectionAudit.itemApprovalReversed,
              occurredAt,
              ownerUserId: item.ownerId,
              permissionRequired: true,
              reason,
              targetId: input.collectionItemId,
            });
            return approvalStatus;
          }),
        actorAttributes(input.actor.clerkId, {
          collectionItemId: input.collectionItemId,
        }),
      );
    },
    /**
     * Creates collection.
     *
     * @param input - Collection values and authenticated actor.
     * @returns Created collection.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async createCollection(input) {
      return await logger.operation(
        loggerMessages.database.collections.create,
        async () => {
          const owner = await users.ensure({ clerkId: input.actor.clerkId });
          const collectionId = await db.transaction(async (tx) => {
            const id = await insertCollection(tx, owner.id, input);
            await writeCollectionAudit(audit, tx, {
              actor: input.actor,
              actorUser: owner,
              after: {
                id,
                isPrivate: input.isPrivate,
                ...validatedCollectionValues(input),
              },
              definition: collectionAudit.collectionCreated,
              ownerUserId: owner.id,
              targetId: id,
            });
            return id;
          });
          const collection = (
            await queryCollections(db, {
              collectionId,
              includePrivate: true,
              ownerUserId: owner.id,
              viewerClerkId: input.actor.clerkId,
              viewerCanManage: false,
            })
          )[0];
          if (!collection) throw new Error("Failed to load collection.");
          return collection;
        },
        actorAttributes(input.actor.clerkId),
      );
    },
    /**
     * Adds a spinner and optional button to a collection.
     *
     * @param input - Collection, spinner, optional button, overrides, and actor.
     * @returns Identifiers of the created spinner and optional button items.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async addSpinner(input) {
      return await logger.operation(
        loggerMessages.database.collections.addSpinner,
        async () => {
          const owner = await users.ensure({ clerkId: input.actor.clerkId });
          return await db.transaction(async (tx) => {
            const resolvedCollection = await resolveCollectionForWrite(tx, {
              collectionId: input.collectionId ?? null,
              newCollection: input.newCollection ?? null,
              ownerId: owner.id,
            });
            const collectionId = resolvedCollection.id;
            if (resolvedCollection.created) {
              await writeCollectionAudit(audit, tx, {
                actor: input.actor,
                actorUser: owner,
                after: {
                  id: collectionId,
                  isPrivate: resolvedCollection.created.isPrivate,
                  ...validatedCollectionValues(resolvedCollection.created),
                },
                definition: collectionAudit.collectionCreated,
                ownerUserId: owner.id,
                targetId: collectionId,
              });
            }
            let buttonItemId: number | null = null;
            if (
              input.buttonProductId === null &&
              (input.buttonMaterialId !== null ||
                input.buttonFinishOptionId !== null ||
                input.buttonCustomFinish !== null)
            ) {
              throw new Error("Button product is required.");
            }
            if (input.buttonProductId !== null) {
              if (
                input.buttonMaterialId === null ||
                (input.buttonFinishOptionId !== null &&
                  input.buttonCustomFinish !== null)
              ) {
                throw new Error("Button material is required.");
              }
              await assertProductMaterial(
                tx,
                input.buttonProductId,
                input.buttonMaterialId,
              );
              const [buttonItem] = await tx
                .insert(schema.collectionItem)
                .values({
                  collectionId,
                  materialId: input.buttonMaterialId,
                  ownerId: owner.id,
                })
                .returning({ id: schema.collectionItem.id });
              if (!buttonItem) throw new Error("Failed to create button item.");
              await tx.insert(schema.collectionSpinnerButton).values({
                id: buttonItem.id,
                productSpinnerButtonId: input.buttonProductId,
              });
              await createCollectionFinishOption(tx, {
                collectionItemId: buttonItem.id,
                customFinish: input.buttonCustomFinish,
                productFinishOptionId: input.buttonFinishOptionId,
                productId: input.buttonProductId,
              });
              buttonItemId = buttonItem.id;
              await writeCollectionAudit(audit, tx, {
                actor: input.actor,
                actorUser: owner,
                after: {
                  collectionId,
                  id: buttonItem.id,
                  materialId: input.buttonMaterialId,
                },
                definition: collectionAudit.itemCreated,
                ownerUserId: owner.id,
                targetId: buttonItem.id,
              });
            }

            await assertProductMaterial(
              tx,
              input.spinnerProductId,
              input.spinnerMaterialId,
            );
            const [spinnerItem] = await tx
              .insert(schema.collectionItem)
              .values({
                collectionId,
                ...(input.description !== undefined
                  ? {
                      description: normalizeOptionalDescription(
                        input.description,
                      ),
                    }
                  : {}),
                displayName: input.displayName,
                materialId: input.spinnerMaterialId,
                ownerId: owner.id,
              })
              .returning({ id: schema.collectionItem.id });
            if (!spinnerItem) throw new Error("Failed to create spinner item.");
            await tx.insert(schema.collectionSpinner).values({
              ...(input.bearing !== undefined
                ? { bearing: normalizeOptionalText(input.bearing) }
                : {}),
              id: spinnerItem.id,
              installedButtonId: buttonItemId,
              productSpinnerId: input.spinnerProductId,
            });
            await createCollectionFinishOption(tx, {
              collectionItemId: spinnerItem.id,
              customFinish: input.spinnerCustomFinish,
              productFinishOptionId: input.spinnerFinishOptionId,
              productId: input.spinnerProductId,
            });
            await touchCollection(tx, collectionId);
            await writeCollectionAudit(audit, tx, {
              actor: input.actor,
              actorUser: owner,
              after: {
                collectionId,
                description: normalizeOptionalDescription(input.description),
                displayName: input.displayName,
                id: spinnerItem.id,
                installedButtonId: buttonItemId,
                materialId: input.spinnerMaterialId,
              },
              definition: collectionAudit.itemCreated,
              ownerUserId: owner.id,
              targetId: spinnerItem.id,
            });
            return { buttonItemId, spinnerItemId: spinnerItem.id };
          });
        },
        actorAttributes(input.actor.clerkId, {
          buttonProductId: input.buttonProductId,
          spinnerProductId: input.spinnerProductId,
        }),
      );
    },
    /**
     * Adds a spinner button to a collection.
     *
     * @param input - Collection item, button product, overrides, and actor.
     * @returns Identifier of the created button item.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async addSpinnerButton(input) {
      return await logger.operation(
        loggerMessages.database.collections.addSpinnerButton,
        async () => {
          const owner = await users.ensure({ clerkId: input.actor.clerkId });
          return await db.transaction(async (tx) => {
            const resolvedCollection = await resolveCollectionForWrite(tx, {
              collectionId: input.collectionId ?? null,
              newCollection: input.newCollection ?? null,
              ownerId: owner.id,
            });
            const collectionId = resolvedCollection.id;
            if (resolvedCollection.created) {
              await writeCollectionAudit(audit, tx, {
                actor: input.actor,
                actorUser: owner,
                after: {
                  id: collectionId,
                  isPrivate: resolvedCollection.created.isPrivate,
                  ...validatedCollectionValues(resolvedCollection.created),
                },
                definition: collectionAudit.collectionCreated,
                ownerUserId: owner.id,
                targetId: collectionId,
              });
            }
            await assertProductMaterial(tx, input.productId, input.materialId);
            const [item] = await tx
              .insert(schema.collectionItem)
              .values({
                collectionId,
                ...(input.description !== undefined
                  ? {
                      description: normalizeOptionalDescription(
                        input.description,
                      ),
                    }
                  : {}),
                displayName: input.displayName,
                materialId: input.materialId,
                ownerId: owner.id,
              })
              .returning({ id: schema.collectionItem.id });
            if (!item) throw new Error("Failed to create collection item.");
            await tx.insert(schema.collectionSpinnerButton).values({
              id: item.id,
              productSpinnerButtonId: input.productId,
            });
            await createCollectionFinishOption(tx, {
              collectionItemId: item.id,
              customFinish: input.customFinish,
              productFinishOptionId: input.finishOptionId,
              productId: input.productId,
            });
            await touchCollection(tx, collectionId);
            await writeCollectionAudit(audit, tx, {
              actor: input.actor,
              actorUser: owner,
              after: {
                collectionId,
                description: normalizeOptionalDescription(input.description),
                displayName: input.displayName,
                id: item.id,
                materialId: input.materialId,
              },
              definition: collectionAudit.itemCreated,
              ownerUserId: owner.id,
              targetId: item.id,
            });
            return item.id;
          });
        },
        actorAttributes(input.actor.clerkId, { productId: input.productId }),
      );
    },
    /**
     * Counts owned products.
     *
     * @param input - Actor and product identifiers to count.
     * @returns Owned-item counts keyed by requested product identifier.
     * @rejects When the user lookup or database query fails.
     */
    async countOwnedProducts(input) {
      const { actorClerkId, productIds } = input;
      if (!productIds.length) return {};
      const owner = await users.getByClerkId(actorClerkId);
      if (!owner) return {};
      const rows = await db
        .select({
          count: count(schema.collectionItem.id),
          spinnerId: schema.collectionSpinner.productSpinnerId,
          buttonId: schema.collectionSpinnerButton.productSpinnerButtonId,
        })
        .from(schema.collectionItem)
        .leftJoin(
          schema.collectionSpinner,
          eq(schema.collectionItem.id, schema.collectionSpinner.id),
        )
        .leftJoin(
          schema.collectionSpinnerButton,
          eq(schema.collectionItem.id, schema.collectionSpinnerButton.id),
        )
        .where(
          and(
            eq(schema.collectionItem.ownerId, owner.id),
            eq(schema.collectionItem.owned, true),
          ),
        )
        .groupBy(
          schema.collectionSpinner.productSpinnerId,
          schema.collectionSpinnerButton.productSpinnerButtonId,
        );
      const result: Record<number, number> = {};
      for (const row of rows) {
        const productId = row.spinnerId ?? row.buttonId;
        if (productId !== null && productIds.includes(productId)) {
          result[productId] = Number(row.count);
        }
      }
      return result;
    },
    /**
     * Moves or permanently deletes a collection and its contents.
     *
     * @param input - Authorized deletion request.
     * @returns Completion after the transaction commits.
     * @rejects When a collection is inaccessible or persistence, audit writing, or operation logging fails.
     */
    async deleteCollection(input) {
      if (input.confirmed !== true)
        throw new Error("Collection deletion confirmation is required.");
      await logger.operation(
        loggerMessages.database.collections.delete,
        async () => {
          await db.transaction(async (tx) => {
            // Resolve identity under the same lock used by account erasure and audit triggers.
            await tx.execute(
              sql`select pg_advisory_xact_lock(hashtextextended(${`account-erasure:${input.actor.clerkId}`}, 0))`,
            );
            const [actorUser] = await tx
              .select({ id: schema.user.id, username: schema.user.username })
              .from(schema.user)
              .where(eq(schema.user.clerkId, input.actor.clerkId));
            if (!actorUser) throw new Error("Collection does not exist.");
            const collectionIds = [
              input.collectionId,
              ...(input.destinationCollectionId === null
                ? []
                : [input.destinationCollectionId]),
            ];
            for (const id of [...new Set(collectionIds)].sort(
              (a, b) => a - b,
            )) {
              await lockTarget(tx, { type: "collection", id });
            }
            const collections = await tx
              .select({
                id: schema.userCollection.id,
                name: schema.userCollection.name,
                ownerId: schema.userCollection.ownerId,
              })
              .from(schema.userCollection)
              .where(inArray(schema.userCollection.id, collectionIds))
              .orderBy(asc(schema.userCollection.id))
              .for("update");
            const source = collections.find(
              ({ id }) => id === input.collectionId,
            );
            if (
              !source ||
              (source.ownerId !== actorUser.id &&
                !hasPermission(input.actor, "collections.manage"))
            ) {
              throw new Error("Collection does not exist.");
            }
            const destination =
              input.destinationCollectionId === null
                ? null
                : collections.find(
                    ({ id }) => id === input.destinationCollectionId,
                  );
            if (
              input.destinationCollectionId === input.collectionId ||
              (input.destinationCollectionId !== null &&
                (!destination || destination.ownerId !== source.ownerId))
            ) {
              throw new Error("Destination collection does not exist.");
            }

            const reason = input.reason?.trim();
            if (reason && reason.length > 1000)
              throw new Error("Moderation reason is too long.");
            if (source.ownerId !== actorUser.id && !reason)
              throw new Error("A moderation reason is required.");
            const candidateIds = (
              await tx
                .select({ id: schema.collectionItem.id })
                .from(schema.collectionItem)
                .where(eq(schema.collectionItem.collectionId, source.id))
                .orderBy(asc(schema.collectionItem.id))
            ).map(({ id }) => id);
            for (const id of candidateIds)
              await lockTarget(tx, { type: "collection_item", id });
            // Recheck membership after locking: a concurrent move may have committed.
            const itemIds = candidateIds.length
              ? (
                  await tx
                    .select({ id: schema.collectionItem.id })
                    .from(schema.collectionItem)
                    .where(
                      and(
                        inArray(schema.collectionItem.id, candidateIds),
                        eq(schema.collectionItem.collectionId, source.id),
                      ),
                    )
                    .orderBy(asc(schema.collectionItem.id))
                    .for("update")
                ).map(({ id }) => id)
              : [];
            const before = await collectionDeletionState(tx, source.id);
            const items = await collectionItemDeletionState(tx, itemIds);
            const detachedSpinners =
              !destination && itemIds.length
                ? await tx
                    .select({
                      id: schema.collectionSpinner.id,
                      installedButtonId:
                        schema.collectionSpinner.installedButtonId,
                    })
                    .from(schema.collectionSpinner)
                    .where(
                      and(
                        inArray(
                          schema.collectionSpinner.installedButtonId,
                          itemIds,
                        ),
                        notInArray(schema.collectionSpinner.id, itemIds),
                      ),
                    )
                    .orderBy(asc(schema.collectionSpinner.id))
                    .for("update")
                : [];

            const collectionImages = await tx
              .select({ objectPath: schema.collectionImage.objectPath })
              .from(schema.collectionImage)
              .where(
                eq(schema.collectionImage.collectionId, input.collectionId),
              );
            const itemImages = destination
              ? []
              : await tx
                  .select({ objectPath: schema.collectionItemImage.objectPath })
                  .from(schema.collectionItemImage)
                  .innerJoin(
                    schema.collectionItem,
                    eq(
                      schema.collectionItemImage.collectionItemId,
                      schema.collectionItem.id,
                    ),
                  )
                  .where(
                    eq(schema.collectionItem.collectionId, input.collectionId),
                  );
            await queueObjectDeletions(
              tx,
              [...collectionImages, ...itemImages].map(
                ({ objectPath }) => objectPath,
              ),
            );

            if (destination) {
              await tx
                .update(schema.collectionItem)
                .set({
                  collectionId: destination.id,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(schema.collectionItem.collectionId, input.collectionId),
                    eq(schema.collectionItem.ownerId, source.ownerId),
                  ),
                );
              await touchCollection(tx, destination.id);
            }
            await tx
              .delete(schema.userCollection)
              .where(eq(schema.userCollection.id, input.collectionId));
            await writeCollectionAudit(audit, tx, {
              actor: input.actor,
              actorUser,
              after: {
                deleted: true,
                destinationCollectionId: destination?.id ?? null,
                deletedItemIds: destination ? [] : itemIds,
                movedItemIds: destination ? itemIds : [],
                detachedSpinnerIds: detachedSpinners.map(({ id }) => id),
                queuedImageCount: new Set(
                  [...collectionImages, ...itemImages].map(
                    ({ objectPath }) => objectPath,
                  ),
                ).size,
              },
              before: { ...before, items, detachedSpinners },
              definition: collectionAudit.collectionDeleted,
              ownerUserId: source.ownerId,
              reason,
              targetId: input.collectionId,
            });
          });
        },
        actorAttributes(input.actor.clerkId, {
          collectionId: input.collectionId,
          destinationCollectionId: input.destinationCollectionId ?? undefined,
        }),
      );
    },
    /**
     * Deletes one item atomically with its audit event and deferred image cleanup.
     *
     * @param input - Confirmed owner or authorized staff deletion request.
     * @rejects When confirmation, authorization, auditing, persistence, or logging fails.
     */
    async deleteItem(input) {
      if (input.confirmed !== true)
        throw new Error("Collection item deletion confirmation is required.");
      await logger.operation(
        loggerMessages.database.collections.deleteItem,
        async () => {
          await db.transaction(async (tx) => {
            await tx.execute(
              sql`select pg_advisory_xact_lock(hashtextextended(${`account-erasure:${input.actor.clerkId}`}, 0))`,
            );
            const [actorUser] = await tx
              .select({ id: schema.user.id, username: schema.user.username })
              .from(schema.user)
              .where(eq(schema.user.clerkId, input.actor.clerkId));
            if (!actorUser) throw new Error("Collection item does not exist.");
            const [current] = await tx
              .select({ collectionId: schema.collectionItem.collectionId })
              .from(schema.collectionItem)
              .where(eq(schema.collectionItem.id, input.collectionItemId));
            if (!current) throw new Error("Collection item does not exist.");
            // Match whole-collection deletion's parent-before-item lock order.
            await lockTarget(tx, {
              type: "collection",
              id: current.collectionId,
            });
            await tx
              .select({ id: schema.userCollection.id })
              .from(schema.userCollection)
              .where(eq(schema.userCollection.id, current.collectionId))
              .for("update");
            await lockTarget(tx, {
              type: "collection_item",
              id: input.collectionItemId,
            });
            const [item] = await tx
              .select({
                id: schema.collectionItem.id,
                collectionId: schema.collectionItem.collectionId,
                ownerId: schema.collectionItem.ownerId,
                owned: schema.collectionItem.owned,
              })
              .from(schema.collectionItem)
              .where(eq(schema.collectionItem.id, input.collectionItemId))
              .for("update");
            if (
              item?.owned !== true ||
              item?.collectionId !== current.collectionId ||
              (item.ownerId !== actorUser.id &&
                !hasPermission(input.actor, "collections.manage"))
            ) {
              throw new Error("Collection item does not exist.");
            }
            const reason = input.reason?.trim();
            if (reason && reason.length > 1000)
              throw new Error("Moderation reason is too long.");
            if (item.ownerId !== actorUser.id && !reason)
              throw new Error("A moderation reason is required.");
            // FK link writers lock the button key, not the parent item.
            await tx
              .select({ id: schema.collectionSpinnerButton.id })
              .from(schema.collectionSpinnerButton)
              .where(eq(schema.collectionSpinnerButton.id, item.id))
              .for("update");
            const detachedSpinners = await tx
              .select({
                id: schema.collectionSpinner.id,
                installedButtonId: schema.collectionSpinner.installedButtonId,
              })
              .from(schema.collectionSpinner)
              .where(eq(schema.collectionSpinner.installedButtonId, item.id))
              .orderBy(asc(schema.collectionSpinner.id))
              .for("update");
            const [before] = await collectionItemDeletionState(tx, [item.id]);
            if (!before) throw new Error("Collection item does not exist.");
            const images = await tx
              .select({ objectPath: schema.collectionItemImage.objectPath })
              .from(schema.collectionItemImage)
              .where(eq(schema.collectionItemImage.collectionItemId, item.id));
            await queueObjectDeletions(
              tx,
              images.map(({ objectPath }) => objectPath),
            );
            await tx
              .delete(schema.collectionItem)
              .where(eq(schema.collectionItem.id, item.id));
            await touchCollection(tx, item.collectionId);
            await writeCollectionAudit(audit, tx, {
              actor: input.actor,
              actorUser,
              ownerUserId: item.ownerId,
              reason,
              targetId: item.id,
              definition: collectionAudit.itemDeleted,
              before: { ...before, detachedSpinners },
              after: {
                deleted: true,
                collectionId: item.collectionId,
                detachedSpinnerIds: detachedSpinners.map(({ id }) => id),
                retainedButtonId: before.installedButtonId ?? null,
                queuedImageCount: new Set(
                  images.map(({ objectPath }) => objectPath),
                ).size,
              },
            });
          });
        },
        actorAttributes(input.actor.clerkId, {
          collectionItemId: input.collectionItemId,
        }),
      );
    },
    /**
     * Loads valid deletion destinations and the affected item count.
     *
     * @param actor - Actor requesting the deletion choices.
     * @param collectionId - Collection being considered for deletion.
     * @returns Deletion context, or null when the collection is inaccessible.
     * @rejects When the user lookup or database query fails.
     */
    async getDeletionContext(actor, collectionId) {
      const canManage = hasPermission(actor, "collections.manage");
      const actorUser = await users.getByClerkId(actor.clerkId);
      if (!actorUser) return null;
      const [source] = await db
        .select({ ownerId: schema.userCollection.ownerId })
        .from(schema.userCollection)
        .where(eq(schema.userCollection.id, collectionId))
        .limit(1);
      if (!source || (source.ownerId !== actorUser.id && !canManage)) {
        return null;
      }
      const [itemCountRows, collections] = await Promise.all([
        db
          .select({ itemCount: count(schema.collectionItem.id) })
          .from(schema.collectionItem)
          .where(eq(schema.collectionItem.collectionId, collectionId)),
        queryCollections(db, {
          includePrivate: true,
          ownerUserId: source.ownerId,
          viewerCanManage: canManage,
          viewerClerkId: actor.clerkId,
        }),
      ]);
      return {
        destinations: collections.filter(({ id }) => id !== collectionId),
        itemCount: Number(itemCountRows[0]?.itemCount ?? 0),
      };
    },
    /**
     * Returns owned item.
     *
     * @param actor - Authenticated actor.
     * @param collectionItemId - Collection item identifier.
     * @returns Matching owned item, when available.
     * @rejects When the database query fails.
     */
    async getOwnedItem(actor, collectionItemId) {
      const canManage = hasPermission(actor, "collections.manage");
      return (
        (
          await queryOwnedItems(
            db,
            canManage ? undefined : actor.clerkId,
            collectionItemId,
            {
              includePrivate: true,
              viewerClerkId: actor.clerkId,
              viewerCanManage: canManage,
            },
          )
        )[0] ?? null
      );
    },
    /**
     * Returns default collection name.
     *
     * @param actorClerkId - Actor clerk identifier.
     * @returns Default collection name synthesized from the owner's username.
     * @rejects When the user profile is incomplete or the database query fails.
     */
    async getDefaultCollectionName(actorClerkId) {
      const [owner] = await db
        .select({ username: schema.user.username })
        .from(schema.user)
        .where(eq(schema.user.clerkId, actorClerkId))
        .limit(1);
      if (!owner?.username) {
        throw new Error("User profile sync is incomplete. Please retry.");
      }
      return `${owner.username}'s Collection`;
    },
    /**
     * Returns owned collection.
     *
     * @param actor - Authenticated actor.
     * @param collectionId - Collection identifier.
     * @returns Matching owned collection, when available.
     * @rejects When the user lookup or database query fails.
     */
    async getOwnedCollection(actor, collectionId) {
      const canManage = hasPermission(actor, "collections.manage");
      const owner = await users.getByClerkId(actor.clerkId);
      if (!owner && !canManage) return null;
      return (
        (
          await queryCollections(db, {
            collectionId,
            includePrivate: true,
            ownerUserId: canManage ? undefined : owner?.id,
            viewerClerkId: actor.clerkId,
            viewerCanManage: canManage,
          })
        )[0] ?? null
      );
    },
    /**
     * Returns public collection.
     *
     * @param input - Public collection lookup and optional viewer.
     * @returns Matching public collection, when available.
     * @rejects When the database query fails.
     */
    async getPublicCollection(input) {
      const { collectionId, ownerUserId, viewer } = input;
      return (
        (
          await queryCollections(db, {
            collectionId,
            includePrivate: hasPermission(viewer, "collections.manage"),
            ownerUserId,
            viewerClerkId: viewer?.clerkId,
            viewerCanManage: hasPermission(viewer, "collections.manage"),
          })
        )[0] ?? null
      );
    },
    /**
     * Lists collection items without excluding an owner's or staff's pending items.
     *
     * @param input - Collection, owner, and optional authenticated viewer.
     * @returns Items visible to the viewer.
     * @rejects When the required catalog data cannot be queried.
     */
    async listCollectionItems(input) {
      return await queryOwnedItems(db, undefined, undefined, {
        collectionId: input.collectionId,
        ownerUserId: input.ownerUserId,
        includePrivate: hasPermission(input.viewer, "collections.manage"),
        viewerClerkId: input.viewer?.clerkId,
        viewerCanManage: hasPermission(input.viewer, "collections.manage"),
      });
    },
    /**
     * Returns public item.
     *
     * @param input - Public collection-item lookup.
     * @returns Matching public item, when available.
     * @rejects When the required catalog data cannot be queried.
     */
    async getPublicItem(input) {
      const { collectionId, collectionItemId, ownerUserId, viewer } = input;
      return (
        (
          await queryOwnedItems(db, undefined, collectionItemId, {
            collectionId,
            includePrivate: hasPermission(viewer, "collections.manage"),
            ownerUserId,
            viewerClerkId: viewer?.clerkId,
            viewerCanManage: hasPermission(viewer, "collections.manage"),
          })
        )[0] ?? null
      );
    },
    /**
     * Lists collection items owned by the actor.
     *
     * @param actor - Authenticated actor.
     * @param collectionId - Collection identifier.
     * @returns Owned collection items visible to the actor.
     * @rejects When the required catalog data cannot be queried.
     */
    async listOwned(actor, collectionId) {
      return await queryOwnedItems(db, actor.clerkId, undefined, {
        collectionId,
        includePrivate: true,
        viewerClerkId: actor.clerkId,
        viewerCanManage: hasPermission(actor, "collections.manage"),
      });
    },
    /**
     * Lists owned collections.
     *
     * @param actor - Authenticated actor.
     * @returns Matching owned collections.
     * @rejects When the required catalog data cannot be queried.
     */
    async listOwnedCollections(actor) {
      const owner = await users.getByClerkId(actor.clerkId);
      if (!owner) return [];
      return await queryCollections(db, {
        includePrivate: true,
        ownerUserId: owner.id,
        viewerClerkId: actor.clerkId,
        viewerCanManage: hasPermission(actor, "collections.manage"),
      });
    },
    /**
     * Lists product items.
     *
     * @param productId - Product identifier.
     * @param viewer - Optional catalog viewer.
     * @returns Matching product items.
     * @rejects When the required catalog data cannot be queried.
     */
    async listProductItems(productId, viewer) {
      return await queryOwnedItems(db, undefined, undefined, {
        productId,
        publicOnly: true,
        viewerClerkId: viewer?.clerkId,
        viewerCanManage: hasPermission(viewer, "collections.manage"),
      });
    },
    /**
     * Lists owners with public collections or items.
     *
     * @param viewer - Optional catalog viewer.
     * @returns Matching owners.
     * @rejects When the required catalog data cannot be queried.
     */
    async listOwners(viewer) {
      const [items, collections] = await Promise.all([
        queryOwnedItems(db, undefined, undefined, {
          publicOnly: true,
          viewerClerkId: viewer?.clerkId,
          viewerCanManage: hasPermission(viewer, "collections.manage"),
        }),
        queryCollections(db, {
          publicOnly: true,
          viewerClerkId: viewer?.clerkId,
          viewerCanManage: hasPermission(viewer, "collections.manage"),
        }),
      ]);
      const ownerIds = [
        ...new Set(collections.map(({ ownerUserId }) => ownerUserId)),
      ];
      if (!ownerIds.length) return [];
      const owners = await db
        .select({
          clerkId: schema.user.clerkId,
          userId: schema.user.id,
          username: schema.user.username,
        })
        .from(schema.user)
        .where(inArray(schema.user.id, ownerIds));
      return owners
        .map((owner) => {
          const ownerItems = items.filter(
            ({ ownerUserId }) => ownerUserId === owner.userId,
          );
          return {
            collections: collections.filter(
              ({ ownerUserId }) => ownerUserId === owner.userId,
            ),
            itemCount: ownerItems.length,
            items: ownerItems,
            userId: owner.userId,
            username: owner.username ?? owner.clerkId,
          };
        })
        .sort((left, right) => left.username.localeCompare(right.username));
    },
    /**
     * Sets collection visibility.
     *
     * @param input - Collection, visibility state, actor, and optional moderation reason.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async setCollectionVisibility(input) {
      const canManage = hasPermission(input.actor, "collections.manage");
      const actorUser = await users.getByClerkId(input.actor.clerkId);
      if (!actorUser) throw new Error("Collection does not exist.");
      await db.transaction(async (tx) => {
        const [collection] = await tx
          .select({
            description: schema.userCollection.description,
            isPrivate: schema.userCollection.isPrivate,
            name: schema.userCollection.name,
            ownerId: schema.userCollection.ownerId,
            privatedByClerkId: schema.userCollection.privatedByClerkId,
            summary: schema.userCollection.summary,
          })
          .from(schema.userCollection)
          .where(eq(schema.userCollection.id, input.collectionId))
          .limit(1);
        if (
          !collection ||
          (collection.ownerId !== actorUser.id && !canManage)
        ) {
          throw new Error("Collection does not exist.");
        }
        const actorIsModerating = collection.ownerId !== actorUser.id;
        if (
          !input.isPrivate &&
          collection.privatedByClerkId &&
          collection.privatedByClerkId !== input.actor.clerkId &&
          !actorIsModerating
        ) {
          throw new Error("Collection is private by an administrator.");
        }
        const before = {
          description: collection.description,
          id: input.collectionId,
          isPrivate: collection.isPrivate,
          name: collection.name,
          summary: collection.summary,
        };
        await tx
          .update(schema.userCollection)
          .set(
            privacyUpdate({
              actorClerkId: input.actor.clerkId,
              actorIsModerating,
              isPrivate: input.isPrivate,
              reason: input.reason,
            }),
          )
          .where(eq(schema.userCollection.id, input.collectionId));
        await writeCollectionAudit(audit, tx, {
          actor: input.actor,
          actorUser,
          after: { ...before, isPrivate: input.isPrivate },
          before,
          definition: collectionAudit.collectionVisibilityChanged,
          ownerUserId: collection.ownerId,
          reason: input.reason,
          targetId: input.collectionId,
        });
      });
    },
    /**
     * Updates collection.
     *
     * @param input - Collection identifier, replacement values, and authenticated actor.
     * @returns Updated collection.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async updateCollection(input) {
      return await logger.operation(
        loggerMessages.database.collections.update,
        async () => {
          const canManage = hasPermission(input.actor, "collections.manage");
          const actorUser = await users.getByClerkId(input.actor.clerkId);
          if (!actorUser) throw new Error("Collection does not exist.");
          const current = await db.transaction(async (tx) => {
            const [row] = await tx
              .select({
                description: schema.userCollection.description,
                isPrivate: schema.userCollection.isPrivate,
                name: schema.userCollection.name,
                ownerId: schema.userCollection.ownerId,
                privatedByClerkId: schema.userCollection.privatedByClerkId,
                summary: schema.userCollection.summary,
              })
              .from(schema.userCollection)
              .where(eq(schema.userCollection.id, input.collectionId))
              .limit(1);
            if (!row || (row.ownerId !== actorUser.id && !canManage)) {
              throw new Error("Collection does not exist.");
            }
            const actorIsModerating = row.ownerId !== actorUser.id;
            if (
              !input.isPrivate &&
              row.privatedByClerkId &&
              row.privatedByClerkId !== input.actor.clerkId &&
              !actorIsModerating
            ) {
              throw new Error("Collection is private by an administrator.");
            }
            const values = validatedCollectionValues(input);
            const before = {
              description: row.description,
              id: input.collectionId,
              isPrivate: row.isPrivate,
              name: row.name,
              summary: row.summary,
            };
            await tx
              .update(schema.userCollection)
              .set({
                ...values,
                ...(input.isPrivate === row.isPrivate
                  ? { updatedAt: new Date() }
                  : privacyUpdate({
                      actorClerkId: input.actor.clerkId,
                      actorIsModerating,
                      isPrivate: input.isPrivate,
                      reason: input.reason,
                    })),
              })
              .where(eq(schema.userCollection.id, input.collectionId));
            const after = {
              description: values.description,
              id: input.collectionId,
              isPrivate: input.isPrivate,
              name: values.name,
              summary: values.summary,
            };
            await writeCollectionAudit(audit, tx, {
              actor: input.actor,
              actorUser,
              after,
              before,
              definition: collectionAudit.collectionUpdated,
              ownerUserId: row.ownerId,
              reason: input.reason,
              targetId: input.collectionId,
            });
            if (input.isPrivate !== row.isPrivate) {
              await writeCollectionAudit(audit, tx, {
                actor: input.actor,
                actorUser,
                after,
                before,
                definition: collectionAudit.collectionVisibilityChanged,
                ownerUserId: row.ownerId,
                reason: input.reason,
                targetId: input.collectionId,
              });
            }
            return row;
          });
          const collection = (
            await queryCollections(db, {
              collectionId: input.collectionId,
              includePrivate: true,
              ownerUserId: current.ownerId,
              viewerClerkId: input.actor.clerkId,
              viewerCanManage: canManage,
            })
          )[0];
          if (!collection) throw new Error("Failed to load collection.");
          return collection;
        },
        actorAttributes(input.actor.clerkId, {
          collectionId: input.collectionId,
        }),
      );
    },
    /**
     * Sets item visibility.
     *
     * @param input - Collection item, visibility state, actor, and optional moderation reason.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async setItemVisibility(input) {
      const canManage = hasPermission(input.actor, "collections.manage");
      const actorUser = await users.getByClerkId(input.actor.clerkId);
      if (!actorUser) throw new Error("Collection item does not exist.");
      await db.transaction(async (tx) => {
        const [item] = await tx
          .select({
            isPrivate: schema.collectionItem.isPrivate,
            ownerId: schema.collectionItem.ownerId,
            privatedByClerkId: schema.collectionItem.privatedByClerkId,
          })
          .from(schema.collectionItem)
          .where(eq(schema.collectionItem.id, input.collectionItemId))
          .limit(1);
        if (!item || (item.ownerId !== actorUser.id && !canManage))
          throw new Error("Collection item does not exist.");
        const actorIsModerating = item.ownerId !== actorUser.id;
        if (
          !input.isPrivate &&
          item.privatedByClerkId &&
          item.privatedByClerkId !== input.actor.clerkId &&
          !actorIsModerating
        ) {
          throw new Error("Collection item is private by an administrator.");
        }
        const before = {
          id: input.collectionItemId,
          isPrivate: item.isPrivate,
        };
        await tx
          .update(schema.collectionItem)
          .set(
            privacyUpdate({
              actorClerkId: input.actor.clerkId,
              actorIsModerating,
              isPrivate: input.isPrivate,
              reason: input.reason,
            }),
          )
          .where(eq(schema.collectionItem.id, input.collectionItemId));
        await writeCollectionAudit(audit, tx, {
          actor: input.actor,
          actorUser,
          after: { ...before, isPrivate: input.isPrivate },
          before,
          definition: collectionAudit.itemVisibilityChanged,
          ownerUserId: item.ownerId,
          reason: input.reason,
          targetId: input.collectionItemId,
        });
      });
    },
    /**
     * Updates item.
     *
     * @param input - Collection item, editable overrides, and authenticated actor.
     * @rejects When validation, authorization, persistence, auditing, or operation logging fails.
     */
    async updateItem(input) {
      await logger.operation(
        loggerMessages.database.collections.updateItem,
        async () => {
          const canManage = hasPermission(input.actor, "collections.manage");
          const owner = await users.getByClerkId(input.actor.clerkId);
          if (!owner) throw new Error("Collection item does not exist.");
          await db.transaction(async (tx) => {
            const [item] = await tx
              .select({
                buttonProductId:
                  schema.collectionSpinnerButton.productSpinnerButtonId,
                collectionId: schema.collectionItem.collectionId,
                description: schema.collectionItem.description,
                displayName: schema.collectionItem.displayName,
                installedButtonId: schema.collectionSpinner.installedButtonId,
                isPrivate: schema.collectionItem.isPrivate,
                materialId: schema.collectionItem.materialId,
                ownerId: schema.collectionItem.ownerId,
                spinnerProductId: schema.collectionSpinner.productSpinnerId,
              })
              .from(schema.collectionItem)
              .leftJoin(
                schema.collectionSpinner,
                eq(schema.collectionItem.id, schema.collectionSpinner.id),
              )
              .leftJoin(
                schema.collectionSpinnerButton,
                eq(schema.collectionItem.id, schema.collectionSpinnerButton.id),
              )
              .where(
                and(
                  eq(schema.collectionItem.id, input.collectionItemId),
                  canManage
                    ? undefined
                    : owner
                      ? eq(schema.collectionItem.ownerId, owner.id)
                      : sql`false`,
                  eq(schema.collectionItem.owned, true),
                ),
              )
              .limit(1);
            const productId =
              item?.spinnerProductId ?? item?.buttonProductId ?? null;
            if (!item || productId === null) {
              throw new Error("Collection item does not exist.");
            }
            const before = {
              collectionId: item.collectionId,
              description: item.description,
              displayName: item.displayName,
              id: input.collectionItemId,
              installedButtonId: item.installedButtonId,
              isPrivate: item.isPrivate,
              materialId: item.materialId,
            };

            const targetCollectionId = input.collectionId ?? item.collectionId;
            const [targetCollection] = await tx
              .select({ id: schema.userCollection.id })
              .from(schema.userCollection)
              .where(
                and(
                  eq(schema.userCollection.id, targetCollectionId),
                  eq(schema.userCollection.ownerId, item.ownerId),
                ),
              )
              .limit(1);
            if (!targetCollection)
              throw new Error("Collection does not exist.");

            if (item.collectionId !== targetCollectionId) {
              const linkedItemIds = [input.collectionItemId];
              if (item.installedButtonId !== null) {
                linkedItemIds.push(item.installedButtonId);
              }
              const linkedSpinners = await tx
                .select({ id: schema.collectionSpinner.id })
                .from(schema.collectionSpinner)
                .where(
                  eq(
                    schema.collectionSpinner.installedButtonId,
                    input.collectionItemId,
                  ),
                );
              linkedItemIds.push(...linkedSpinners.map(({ id }) => id));
              await tx
                .update(schema.collectionItem)
                .set({
                  collectionId: targetCollectionId,
                  updatedAt: new Date(),
                })
                .where(inArray(schema.collectionItem.id, linkedItemIds));
              await Promise.all([
                touchCollection(tx, item.collectionId),
                touchCollection(tx, targetCollectionId),
              ]);
            }

            await updateCollectionItemSnapshot(tx, {
              collectionItemId: input.collectionItemId,
              customFinish: input.customFinish,
              finishOptionId: input.finishOptionId,
              materialId: input.materialId,
              productId,
            });
            await tx
              .update(schema.collectionItem)
              .set({
                ...(input.description !== undefined
                  ? {
                      description: normalizeOptionalDescription(
                        input.description,
                      ),
                    }
                  : {}),
                displayName: input.displayName.trim(),
              })
              .where(eq(schema.collectionItem.id, input.collectionItemId));

            if (item.spinnerProductId !== null && input.bearing !== undefined) {
              await tx
                .update(schema.collectionSpinner)
                .set({ bearing: normalizeOptionalText(input.bearing) })
                .where(eq(schema.collectionSpinner.id, input.collectionItemId));
            }

            if (input.installedButton !== undefined) {
              if (item.spinnerProductId === null) {
                throw new Error("Collection item is not a spinner.");
              }
              if (input.installedButton !== null) {
                const [button] = await tx
                  .select({
                    id: schema.collectionSpinnerButton.id,
                    productId:
                      schema.collectionSpinnerButton.productSpinnerButtonId,
                  })
                  .from(schema.collectionSpinnerButton)
                  .innerJoin(
                    schema.collectionItem,
                    eq(
                      schema.collectionSpinnerButton.id,
                      schema.collectionItem.id,
                    ),
                  )
                  .where(
                    and(
                      eq(
                        schema.collectionSpinnerButton.id,
                        input.installedButton.collectionItemId,
                      ),
                      canManage
                        ? undefined
                        : owner
                          ? eq(schema.collectionItem.ownerId, owner.id)
                          : sql`false`,
                      eq(schema.collectionItem.owned, true),
                    ),
                  )
                  .limit(1);
                if (!button) {
                  throw new Error("Installed button does not exist.");
                }
                await tx
                  .update(schema.collectionItem)
                  .set({
                    collectionId: targetCollectionId,
                    updatedAt: new Date(),
                  })
                  .where(eq(schema.collectionItem.id, button.id));
                await updateCollectionItemSnapshot(tx, {
                  ...input.installedButton,
                  productId: button.productId,
                });
              }
              try {
                await tx
                  .update(schema.collectionSpinner)
                  .set({
                    installedButtonId:
                      input.installedButton?.collectionItemId ?? null,
                  })
                  .where(
                    eq(schema.collectionSpinner.id, input.collectionItemId),
                  );
              } catch (error) {
                if (
                  uniqueConstraint(error) ===
                  "collection_spinner_installed_button_unique"
                ) {
                  throw new CollectionButtonAlreadyInstalledError();
                }
                throw error;
              }
            }
            await touchCollection(tx, targetCollectionId);
            const after = {
              ...before,
              collectionId: targetCollectionId,
              description:
                input.description === undefined
                  ? item.description
                  : normalizeOptionalDescription(input.description),
              displayName: input.displayName.trim(),
              installedButtonId:
                input.installedButton === undefined
                  ? item.installedButtonId
                  : (input.installedButton?.collectionItemId ?? null),
              materialId: input.materialId,
            };
            await writeCollectionAudit(audit, tx, {
              actor: input.actor,
              actorUser: owner,
              after,
              before,
              definition: collectionAudit.itemUpdated,
              ownerUserId: item.ownerId,
              reason: input.reason,
              targetId: input.collectionItemId,
            });
            if (item.collectionId !== targetCollectionId) {
              await writeCollectionAudit(audit, tx, {
                actor: input.actor,
                actorUser: owner,
                after: { collectionId: targetCollectionId },
                before: { collectionId: item.collectionId },
                definition: collectionAudit.itemMoved,
                ownerUserId: item.ownerId,
                reason: input.reason,
                targetId: input.collectionItemId,
              });
            }
          });
        },
        actorAttributes(input.actor.clerkId, {
          collectionItemId: input.collectionItemId,
          installedButtonId: input.installedButton?.collectionItemId,
          materialId: input.materialId,
        }),
      );
    },
  };
}

/**
 * Loads ownership context for a collection image target.
 *
 * @param db - Application database.
 * @param target - Collection or collection-item upload target to resolve.
 * @returns Collection ownership context, or `null` when the target is unavailable.
 * @rejects When the database query fails.
 */
async function collectionImageTargetContext(
  db: Pick<Database, "select">,
  target: UploadTarget,
): Promise<{
  /**
   * Owner database user identifier.
   */
  ownerUserId: number;
} | null> {
  if (target.type === "collection") {
    const [row] = await db
      .select({ ownerUserId: schema.userCollection.ownerId })
      .from(schema.userCollection)
      .where(eq(schema.userCollection.id, target.id))
      .limit(1);
    return row ?? null;
  }
  if (target.type === "collection_item") {
    const [row] = await db
      .select({ ownerUserId: schema.collectionItem.ownerId })
      .from(schema.collectionItem)
      .where(eq(schema.collectionItem.id, target.id))
      .limit(1);
    return row ?? null;
  }
  return null;
}

/**
 * Loads ownership context for a product image target.
 *
 * @param db - Application database.
 * @param target - Product upload target to resolve.
 * @returns Product ownership context, or `null` when the target is unavailable.
 * @rejects When the database query fails.
 */
async function productImageTargetContext(
  db: Pick<Database, "select">,
  target: UploadTarget,
) {
  if (target.type !== "product") return null;
  const [row] = await db
    .select({
      ownerClerkId: schema.product.ownerClerkId,
      ownerUserId: schema.user.id,
    })
    .from(schema.product)
    .leftJoin(schema.user, eq(schema.product.ownerClerkId, schema.user.clerkId))
    .where(eq(schema.product.id, target.id))
    .limit(1);
  return row ?? null;
}

/**
 * Loads a material image target for administrative auditing.
 *
 * @param db - Application database.
 * @param target - Material upload target to resolve.
 * @returns Material context, or `null` for other or missing targets.
 * @rejects When the database query fails.
 */
async function materialImageTargetContext(
  db: Pick<Database, "select">,
  target: UploadTarget,
) {
  if (target.type !== "material") return null;
  const [row] = await db
    .select({ materialId: schema.material.id })
    .from(schema.material)
    .where(eq(schema.material.id, target.id))
    .limit(1);
  return row ?? null;
}

/**
 * Loads audit-safe state for a collection image target.
 *
 * @param db - Application database.
 * @param target - Collection image target whose state is being audited.
 * @returns Audit-safe collection image state.
 * @rejects When the database query fails.
 */
async function collectionImageState(
  db: Pick<Database, "select">,
  target: UploadTarget,
): Promise<AuditJsonObject> {
  if (target.type === "collection") {
    const images = await db
      .select({
        id: schema.collectionImage.id,
        isCurrent: schema.collectionImage.isCurrent,
      })
      .from(schema.collectionImage)
      .where(eq(schema.collectionImage.collectionId, target.id));
    return {
      currentImageId: images.find(({ isCurrent }) => isCurrent)?.id ?? null,
      imageIds: images.map(({ id }) => id),
    };
  }
  if (target.type === "collection_item") {
    const images = await db
      .select({ id: schema.collectionItemImage.id })
      .from(schema.collectionItemImage)
      .where(eq(schema.collectionItemImage.collectionItemId, target.id));
    return { imageIds: images.map(({ id }) => id) };
  }
  if (target.type === "product") {
    const images = await db
      .select({ id: schema.productImage.id })
      .from(schema.productImage)
      .where(eq(schema.productImage.productId, target.id));
    return { imageIds: images.map(({ id }) => id) };
  }
  if (target.type === "material") {
    const images = await db
      .select({ id: schema.materialImage.id })
      .from(schema.materialImage)
      .where(eq(schema.materialImage.materialId, target.id));
    return { imageIds: images.map(({ id }) => id) };
  }
  return {};
}

/**
 * Loads ownership and state for a collection-item image.
 *
 * @param db - Application database.
 * @param imageId - Image identifier.
 * @returns Collection-item image context, or `null` when unavailable.
 * @rejects When the database query fails.
 */
async function collectionItemImageContext(
  db: Pick<Database, "select">,
  imageId: number,
) {
  const [row] = await db
    .select({
      collectionItemId: schema.collectionItemImage.collectionItemId,
      ownerUserId: schema.collectionItem.ownerId,
    })
    .from(schema.collectionItemImage)
    .innerJoin(
      schema.collectionItem,
      eq(schema.collectionItemImage.collectionItemId, schema.collectionItem.id),
    )
    .where(eq(schema.collectionItemImage.id, imageId))
    .limit(1);
  return row ?? null;
}

/**
 * Loads material context for an image mutation.
 *
 * @param db - Application database.
 * @param imageId - Material-image identifier.
 * @returns Material image context, or `null` when unavailable.
 * @rejects When the database query fails.
 */
async function materialImageContext(
  db: Pick<Database, "select">,
  imageId: number,
) {
  const [row] = await db
    .select({ materialId: schema.materialImage.materialId })
    .from(schema.materialImage)
    .where(eq(schema.materialImage.id, imageId))
    .limit(1);
  return row ?? null;
}

/**
 * Loads ownership and state for a product image.
 *
 * @param db - Application database.
 * @param imageId - Image identifier.
 * @returns Product image context, or `null` when unavailable.
 * @rejects When the database query fails.
 */
async function productImageContext(
  db: Pick<Database, "select">,
  imageId: number,
) {
  const [row] = await db
    .select({
      ownerClerkId: schema.product.ownerClerkId,
      ownerUserId: schema.user.id,
      productId: schema.productImage.productId,
    })
    .from(schema.productImage)
    .innerJoin(
      schema.product,
      eq(schema.productImage.productId, schema.product.id),
    )
    .leftJoin(schema.user, eq(schema.product.ownerClerkId, schema.user.clerkId))
    .where(eq(schema.productImage.id, imageId))
    .limit(1);
  return row ?? null;
}

/**
 * Loads the maker owning a shared maker image.
 *
 * @param db - Application database.
 * @param imageId - Image identifier.
 * @returns Maker image context, or `null` when unavailable.
 * @rejects When the database query fails.
 */
async function makerImageContext(
  db: Pick<Database, "select">,
  imageId: number,
) {
  const [row] = await db
    .select({ makerId: schema.makerImage.makerId })
    .from(schema.makerImage)
    .where(eq(schema.makerImage.id, imageId))
    .limit(1);
  return row ?? null;
}

/**
 * Requires collection audit.
 *
 * @param users - User service.
 * @param audit - Audit service.
 * @param targetType - Target type.
 * @returns Configured audit dependencies, or `null` for non-collection targets.
 * @throws When collection auditing is only partially configured or unavailable.
 */
function requireCollectionAudit(
  users: UsersService | undefined,
  audit: AuditService | undefined,
  targetType: UploadTarget["type"],
) {
  if (
    targetType === "product" ||
    targetType === "material" ||
    targetType === "resource"
  )
    return null;
  if (!users || !audit) throw new Error("Collection audit is not configured.");
  return { audit, users };
}

/**
 * Requires product audit.
 *
 * @param users - User service.
 * @param audit - Audit service.
 * @returns Configured audit dependencies, or `null` when auditing is disabled.
 * @throws When product auditing is only partially configured.
 */
function requireProductAudit(
  users: UsersService | undefined,
  audit: AuditService | undefined,
) {
  if (!users && !audit) return null;
  if (!users || !audit) throw new Error("Product audit is not configured.");
  return { audit, users };
}

/**
 * Selects the product fields allowed in audit payloads.
 *
 * @param product - Product.
 * @returns Audit-safe product state.
 */
function productAuditState(product: CatalogProduct): AuditJsonObject {
  return {
    advertisedInsertOffers: product.advertisedInsertOffers.map(
      ({ id, insertProductId, isSliderAdvertisedDefault }) => ({
        id,
        insertProductId,
        isSliderAdvertisedDefault,
      }),
    ),
    bearing: product.bearing,
    bodyHostedMagnetSetup: product.bodyHostedMagnetSetup ?? null,
    buttonDiameterMm: product.buttonDiameterMm,
    compatibleButtonId: product.compatibleButtonId,
    compatibilityAdvisories: product.compatibilityAdvisories.map(
      ({ id, relatedProductId }) => ({ id, relatedProductId }),
    ),
    compatibilityFamilyIds: product.compatibilityFamilies.map(({ id }) => id),
    description: product.description,
    diameterMm: product.diameterMm,
    finishOptions: product.finishOptions.map((option) => ({
      colorEffectId: option.colorEffect?.id ?? null,
      colorIds: option.colors.map(({ id }) => id),
      finishIds: option.finishes.map(({ id }) => id),
      id: option.id,
      patternId: option.pattern?.id ?? null,
    })),
    id: product.id,
    imageIds: product.images.map(({ id }) => id),
    includedComponentIds: product.includedComponents.map(({ id }) => id),
    insertClickOptions: product.insertClickOptions,
    insertMagnetOffers: product.insertMagnetOffers,
    isPrivate: product.isPrivate,
    lengthMm: product.lengthMm,
    makerId: product.makerId,
    makerProductUrl: product.makerProductUrl,
    makerProductUrlValid: product.makerProductUrlValid,
    magnetSystem: product.magnetSystem,
    materialIds: product.materials.map(({ id }) => id),
    name: product.name,
    productTypeId: product.productTypeId,
    productTypeSlug: product.productTypeSlug,
    slug: product.slug,
    spinDiameterMm: product.spinDiameterMm,
    thicknessMm: product.thicknessMm,
    thicknessWithButtonMm: product.thicknessWithButtonMm,
    weightG: product.weightG,
    weightBasis: product.weightBasis,
    widthMm: product.widthMm,
  };
}

/**
 * Raises the shared hidden-product error.
 *
 * @returns Never returns.
 * @throws The shared hidden-product error.
 */
function failProductLoad(): never {
  throw new Error("Failed to load product audit state.");
}

/**
 * Builds a case-insensitive collection-name key.
 *
 * Trims whitespace, removes diacritics and punctuation, and lowercases letters.
 *
 * @param name - Display name to convert into a comparison key.
 * @returns Normalized collection name.
 */
export function normalizeCollectionName(name: string) {
  return name
    .trim()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * Validates and normalizes collection values.
 *
 * @param input - Raw collection name, summary, description, and visibility.
 * @returns Trimmed collection values and a normalized name.
 * @throws When the name, summary, or description violates collection constraints.
 */
function validatedCollectionValues(input: CollectionWriteInput) {
  const name = input.name.trim();
  const nameLength = [...name].length;
  if (nameLength < 2 || nameLength > 80) {
    throw new Error("Collection name must be between 2 and 80 characters.");
  }
  const normalizedName = normalizeCollectionName(name);
  if (!normalizedName) throw new Error("Collection name is invalid.");
  const description = input.description?.trim() || null;
  if (description && [...description].length > 5000) {
    throw new Error(
      "Collection description must be 5,000 characters or fewer.",
    );
  }
  const summary = input.summary?.trim() || null;
  if (summary && [...summary].length > 200) {
    throw new Error("Collection summary must be 200 characters or fewer.");
  }
  return { description, name, normalizedName, summary };
}

/**
 * Creates a user collection within the caller transaction.
 *
 * @param tx - Caller-owned database transaction.
 * @param ownerId - Owner identifier.
 * @param input - Validated collection fields to insert.
 * @returns Identifier of the created collection.
 * @rejects When collection values are invalid or insertion fails.
 */
async function insertCollection(
  tx: CatalogTransaction,
  ownerId: number,
  input: CollectionWriteInput,
) {
  const [collection] = await tx
    .insert(schema.userCollection)
    .values({
      ...validatedCollectionValues(input),
      isPrivate: input.isPrivate,
      ownerId,
    })
    .returning({ id: schema.userCollection.id });
  if (!collection) throw new Error("Failed to create collection.");
  return collection.id;
}

/**
 * Resolves collection for write.
 *
 * @param tx - Caller-owned database transaction.
 * @param input - Existing or new collection choice and owner identifier.
 * @returns Existing collection identifier or one created in the transaction.
 * @rejects When choices conflict, a selection is inaccessible, a default is ambiguous, a profile is incomplete, or persistence fails.
 */
async function resolveCollectionForWrite(
  tx: CatalogTransaction,
  input: {
    /**
     * Collection identifier.
     */
    collectionId: number | null;
    /**
     * New collection.
     */
    newCollection: CollectionWriteInput | null;
    /**
     * Owner identifier.
     */
    ownerId: number;
  },
) {
  if (input.collectionId !== null && input.newCollection !== null) {
    throw new Error("Choose an existing or new collection, not both.");
  }
  if (input.newCollection !== null) {
    return {
      created: input.newCollection,
      id: await insertCollection(tx, input.ownerId, input.newCollection),
    };
  }
  if (input.collectionId !== null) {
    const [collection] = await tx
      .select({ id: schema.userCollection.id })
      .from(schema.userCollection)
      .where(
        and(
          eq(schema.userCollection.id, input.collectionId),
          eq(schema.userCollection.ownerId, input.ownerId),
        ),
      )
      .limit(1);
    if (!collection) throw new Error("Collection does not exist.");
    return { created: null, id: collection.id };
  }

  const collections = await tx
    .select({ id: schema.userCollection.id })
    .from(schema.userCollection)
    .where(eq(schema.userCollection.ownerId, input.ownerId))
    .limit(2);
  if (collections.length > 1) throw new Error("Choose a collection.");
  const existingCollection = collections[0];
  if (existingCollection) return { created: null, id: existingCollection.id };

  const [owner] = await tx
    .select({ username: schema.user.username })
    .from(schema.user)
    .where(eq(schema.user.id, input.ownerId))
    .limit(1);
  if (!owner?.username) {
    throw new Error("User profile sync is incomplete. Please retry.");
  }
  const created = {
    description: null,
    isPrivate: true,
    name: `${owner.username}'s Collection`,
  };
  return {
    created,
    id: await insertCollection(tx, input.ownerId, created),
  };
}

/**
 * Updates a collection modification timestamp.
 *
 * @param tx - Caller-owned database transaction.
 * @param collectionId - Collection identifier.
 * @rejects When the database update fails.
 */
async function touchCollection(tx: CatalogTransaction, collectionId: number) {
  await tx
    .update(schema.userCollection)
    .set({ updatedAt: new Date() })
    .where(eq(schema.userCollection.id, collectionId));
}

/**
 * Lists collections visible to the requested viewer.
 *
 * @param db - Application database.
 * @param options - Collection identity, owner, privacy, and viewer filters.
 * @returns Collections visible to the viewer.
 * @rejects When the database query fails.
 */
async function queryCollections(
  db: Database,
  options: {
    /**
     * Collection identifier.
     */
    collectionId?: number;
    /**
     * Include private.
     */
    includePrivate?: boolean;
    /**
     * Owner database user identifier.
     */
    ownerUserId?: number;
    /**
     * Public only.
     */
    publicOnly?: boolean;
    /**
     * Viewer Clerk user identifier.
     */
    viewerClerkId?: string;
    /**
     * Viewer can manage.
     */
    viewerCanManage?: boolean;
  } = {},
): Promise<UserCollectionSummary[]> {
  const conditions = [];
  if (options.collectionId !== undefined) {
    conditions.push(eq(schema.userCollection.id, options.collectionId));
  }
  if (options.ownerUserId !== undefined) {
    conditions.push(eq(schema.userCollection.ownerId, options.ownerUserId));
  }
  if (options.publicOnly) {
    conditions.push(eq(schema.userCollection.isPrivate, false));
  } else if (!options.includePrivate) {
    conditions.push(
      options.viewerClerkId
        ? sql`(${schema.userCollection.isPrivate} = false or ${schema.user.clerkId} = ${options.viewerClerkId})`
        : eq(schema.userCollection.isPrivate, false),
    );
  }
  const rows = await db
    .select({
      createdAt: schema.userCollection.createdAt,
      description: schema.userCollection.description,
      id: schema.userCollection.id,
      isPrivate: schema.userCollection.isPrivate,
      name: schema.userCollection.name,
      ownerClerkId: schema.user.clerkId,
      ownerUserId: schema.userCollection.ownerId,
      privatedByClerkId: schema.userCollection.privatedByClerkId,
      summary: schema.userCollection.summary,
      updatedAt: schema.userCollection.updatedAt,
    })
    .from(schema.userCollection)
    .innerJoin(schema.user, eq(schema.userCollection.ownerId, schema.user.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.userCollection.updatedAt));
  const visibleRows = rows.filter(
    ({ isPrivate, ownerUserId }) =>
      (!options.publicOnly || !isPrivate) &&
      (options.ownerUserId === undefined ||
        ownerUserId === options.ownerUserId),
  );
  if (!visibleRows.length) return [];
  const collectionIds = visibleRows.map(({ id }) => id);
  const unrestrictedCollectionIds = options.publicOnly
    ? []
    : visibleRows
        .filter(
          (row) =>
            options.includePrivate ||
            row.ownerClerkId === options.viewerClerkId,
        )
        .map(({ id }) => id);
  const [counts, covers] = await Promise.all([
    db
      .select({
        collectionId: schema.collectionItem.collectionId,
        itemCount: count(schema.collectionItem.id),
      })
      .from(schema.collectionItem)
      .where(
        and(
          inArray(schema.collectionItem.collectionId, collectionIds),
          eq(schema.collectionItem.owned, true),
          or(
            and(
              eq(schema.collectionItem.isPrivate, false),
              eq(schema.collectionItem.approvalStatus, "approved"),
            ),
            unrestrictedCollectionIds.length
              ? inArray(
                  schema.collectionItem.collectionId,
                  unrestrictedCollectionIds,
                )
              : undefined,
          ),
        ),
      )
      .groupBy(schema.collectionItem.collectionId),
    db
      .select()
      .from(schema.collectionImage)
      .where(inArray(schema.collectionImage.collectionId, collectionIds))
      .orderBy(desc(schema.collectionImage.position)),
  ]);
  const countByCollection = new Map(
    counts.map(({ collectionId, itemCount }) => [
      collectionId,
      Number(itemCount),
    ]),
  );
  const coverByCollection = new Map(
    covers
      .filter(({ isCurrent }) => isCurrent)
      .map((cover) => [
        cover.collectionId,
        {
          contentType: cover.contentType,
          createdAt: cover.createdAt,
          deletedAt: null,
          deletedByClerkId: null,
          deletedByRole: null,
          fileName: cover.fileName,
          id: cover.id,
          objectPath: cover.objectPath,
          position: cover.position,
          size: cover.size,
          url: cover.url,
        } satisfies CatalogImage,
      ]),
  );
  return visibleRows.map((row) => ({
    canAdminister: Boolean(options.viewerCanManage),
    canEdit: Boolean(
      options.viewerCanManage || options.viewerClerkId === row.ownerClerkId,
    ),
    coverImage: coverByCollection.get(row.id) ?? null,
    coverImages: covers
      .filter(({ collectionId }) => collectionId === row.id)
      .map((cover) => ({
        contentType: cover.contentType,
        createdAt: cover.createdAt,
        deletedAt: null,
        deletedByClerkId: null,
        deletedByRole: null,
        fileName: cover.fileName,
        id: cover.id,
        objectPath: cover.objectPath,
        position: cover.position,
        size: cover.size,
        url: cover.url,
      })),
    createdAt: row.createdAt,
    description: row.description,
    id: row.id,
    isAdminPrivate:
      row.isPrivate &&
      row.privatedByClerkId !== null &&
      row.privatedByClerkId !== row.ownerClerkId,
    isPrivate: row.isPrivate,
    isOwner: options.viewerClerkId === row.ownerClerkId,
    itemCount: countByCollection.get(row.id) ?? 0,
    name: row.name,
    ownerUserId: row.ownerUserId,
    summary: row.summary,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Updates collection item snapshot.
 *
 * @param tx - Caller-owned database transaction.
 * @param input - Item identifier and replacement product snapshot.
 * @rejects When validation or the database update fails.
 */
async function updateCollectionItemSnapshot(
  tx: CatalogTransaction,
  input: {
    /**
     * Collection item identifier.
     */
    collectionItemId: number;
    /**
     * Custom finish.
     */
    customFinish: ProductWriteFinishOption | null;
    /**
     * Finish option identifier.
     */
    finishOptionId: number | null;
    /**
     * Material identifier.
     */
    materialId: number;
    /**
     * Product identifier.
     */
    productId: number;
  },
) {
  await assertProductMaterial(tx, input.productId, input.materialId);
  await tx
    .update(schema.collectionItem)
    .set({ materialId: input.materialId })
    .where(eq(schema.collectionItem.id, input.collectionItemId));

  await tx
    .delete(schema.finishOption)
    .where(eq(schema.finishOption.collectionItemId, input.collectionItemId));
  if (input.customFinish !== null || input.finishOptionId !== null) {
    await createCollectionFinishOption(tx, {
      collectionItemId: input.collectionItemId,
      customFinish: input.customFinish,
      productFinishOptionId: input.finishOptionId,
      productId: input.productId,
    });
  }
}

/**
 * Loads public products assigned to one material without hydrating unrelated products.
 *
 * @param db - Database used for product lookup.
 * @param materialId - Material whose products are returned.
 * @returns Visible approved products assigned to the material.
 * @rejects When product identifiers or display data cannot be queried.
 */
async function queryPublicMaterialProducts(db: Database, materialId: number) {
  const rows = await db
    .select({ productId: schema.productMaterial.productId })
    .from(schema.productMaterial)
    .where(eq(schema.productMaterial.materialId, materialId));
  return await queryProducts(
    db,
    undefined,
    undefined,
    undefined,
    rows.map(({ productId }) => productId),
  );
}

/**
 * Loads visible catalog products and their related display data.
 *
 * @param db - Database used for the query.
 * @param productTypeSlug - Optional product type filter.
 * @param productSlug - Optional product slug filter.
 * @param viewer - Optional viewer controlling private and review visibility.
 * @param productIds - Optional product identifier filter.
 * @returns Visible catalog products in display order.
 * @rejects When the database query fails.
 */
async function queryProducts(
  db: Pick<Database, "select">,
  productTypeSlug?: string,
  productSlug?: string,
  viewer?: CatalogViewer,
  productIds?: number[],
): Promise<CatalogProduct[]> {
  if (productIds?.length === 0) return [];
  const compatibleButtonProduct = alias(
    schema.product,
    "compatible_button_product",
  );
  const conditions = [];
  if (productTypeSlug) {
    conditions.push(eq(schema.productType.slug, productTypeSlug));
  }
  if (productSlug) conditions.push(eq(schema.product.slug, productSlug));
  if (productIds) conditions.push(inArray(schema.product.id, productIds));
  if (!hasPermission(viewer, "products.manage")) {
    conditions.push(
      viewer?.clerkId
        ? sql`((${schema.product.approvalStatus} = 'approved' and ${schema.product.isPrivate} = false) or ${schema.product.ownerClerkId} = ${viewer.clerkId})`
        : and(
            eq(schema.product.approvalStatus, "approved"),
            eq(schema.product.isPrivate, false),
          ),
    );
  }

  const rows = await db
    .select({
      approvalStatus: schema.product.approvalStatus,
      bearing: schema.productSpinner.bearing,
      buttonDiameterMm: schema.productSpinner.buttonDiameterMm,
      compatibleButtonId: schema.productSpinner.compatibleButtonId,
      compatibleButtonName: compatibleButtonProduct.name,
      createdAt: sql<Date>`coalesce(${schema.productSpinner.createdAt}, ${schema.productSpinnerButton.createdAt}, ${schema.productSlider.createdAt}, ${schema.productSliderPlate.createdAt}, ${schema.productSliderInsert.createdAt})`,
      description: schema.product.description,
      diameterMm: schema.productSpinnerButton.diameterMm,
      inherentClickCount: schema.productSlider.inherentClickCount,
      id: schema.product.id,
      isPrivate: schema.product.isPrivate,
      privatedByClerkId: schema.product.privatedByClerkId,
      lengthMm: sql<
        string | null
      >`coalesce(${schema.productSpinner.lengthMm}, ${schema.productSlider.lengthMm}, ${schema.productSliderPlate.lengthMm}, ${schema.productSliderInsert.lengthMm})`,
      makerId: schema.maker.id,
      makerName: schema.maker.name,
      makerSlug: schema.maker.slug,
      makerProductUrl: schema.product.makerProductUrl,
      makerProductUrlValid: schema.product.makerProductUrlValid,
      makerUrl: schema.maker.rootUrl,
      magnetSystem: schema.productSlider.magnetSystem,
      magnetSetupSourceNote: schema.productSlider.magnetSetupSourceNote,
      materialId: schema.material.id,
      materialName: schema.material.name,
      materialSlug: schema.material.slug,
      name: schema.product.name,
      ownerClerkId: schema.product.ownerClerkId,
      productTypeId: schema.productType.id,
      productTypeName: schema.productType.name,
      productTypeSlug: schema.productType.slug,
      slug: schema.product.slug,
      spinDiameterMm: schema.productSpinner.spinDiameterMm,
      thicknessMm: sql<
        string | null
      >`coalesce(${schema.productSpinner.thicknessMm}, ${schema.productSpinnerButton.thicknessMm}, ${schema.productSlider.thicknessMm}, ${schema.productSliderPlate.thicknessMm}, ${schema.productSliderInsert.thicknessMm})`,
      thicknessWithButtonMm: schema.productSpinner.thicknessWithButtonMm,
      updatedAt: schema.product.updatedAt,
      weightG: sql<
        string | null
      >`coalesce(${schema.productSpinner.weightG}, ${schema.productSpinnerButton.weightG}, ${schema.productSlider.weightG}, ${schema.productSliderPlate.weightG}, ${schema.productSliderInsert.weightG})`,
      weightBasis: schema.productSlider.weightBasis,
      widthMm: sql<
        string | null
      >`coalesce(${schema.productSpinner.widthMm}, ${schema.productSlider.widthMm}, ${schema.productSliderPlate.widthMm}, ${schema.productSliderInsert.widthMm})`,
    })
    .from(schema.product)
    .innerJoin(schema.maker, eq(schema.product.makerId, schema.maker.id))
    .innerJoin(
      schema.productType,
      eq(schema.product.productTypeId, schema.productType.id),
    )
    .leftJoin(
      schema.productMaterial,
      eq(schema.product.id, schema.productMaterial.productId),
    )
    .leftJoin(
      schema.material,
      eq(schema.productMaterial.materialId, schema.material.id),
    )
    .leftJoin(
      schema.productSpinner,
      eq(schema.product.id, schema.productSpinner.id),
    )
    .leftJoin(
      schema.productSpinnerButton,
      eq(schema.product.id, schema.productSpinnerButton.id),
    )
    .leftJoin(
      schema.productSlider,
      eq(schema.product.id, schema.productSlider.id),
    )
    .leftJoin(
      schema.productSliderPlate,
      eq(schema.product.id, schema.productSliderPlate.id),
    )
    .leftJoin(
      schema.productSliderInsert,
      eq(schema.product.id, schema.productSliderInsert.id),
    )
    .leftJoin(
      compatibleButtonProduct,
      eq(schema.productSpinner.compatibleButtonId, compatibleButtonProduct.id),
    )
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      desc(schema.product.updatedAt),
      asc(schema.product.name),
      asc(schema.product.id),
      asc(schema.material.name),
    );

  const products = new Map<number, CatalogProduct>();
  for (const row of rows) {
    const existing = products.get(row.id);
    if (existing) {
      if (row.materialId && row.materialName && row.materialSlug) {
        existing.materials.push({
          id: row.materialId,
          name: row.materialName,
          slug: row.materialSlug,
        });
      }
      continue;
    }
    products.set(row.id, {
      approvalStatus: row.approvalStatus,
      advertisedInsertOffers: [],
      bearing: row.bearing,
      bodyHostedMagnetSetup:
        row.magnetSystem === "body-hosted"
          ? {
              clickCount: row.inherentClickCount,
              configuration: null,
              sourceNote: row.magnetSetupSourceNote,
            }
          : null,
      buttonDiameterMm: row.buttonDiameterMm,
      compatibleButtonId: row.compatibleButtonId,
      compatibleButtonName: row.compatibleButtonName,
      canAdminister: hasPermission(viewer, "products.manage"),
      canEdit: Boolean(
        viewer?.clerkId === row.ownerClerkId ||
          hasPermission(viewer, "products.manage"),
      ),
      compatibilityAdvisories: [],
      compatibilityFamilies: [],
      createdAt: row.createdAt,
      description: row.description,
      diameterMm: row.diameterMm,
      finishOptions: [],
      imageCount: 0,
      images: [],
      includedComponents: [],
      insertClickOptions: [],
      insertMagnetOffers: [],
      id: row.id,
      lengthMm: row.lengthMm,
      makerId: row.makerId,
      makerName: row.makerName,
      makerSlug: row.makerSlug,
      makerProductUrl: row.makerProductUrl,
      makerProductUrlValid: row.makerProductUrlValid,
      makerUrl: row.makerUrl,
      magnetSystem: row.magnetSystem,
      materials:
        row.materialId && row.materialName && row.materialSlug
          ? [
              {
                id: row.materialId,
                name: row.materialName,
                slug: row.materialSlug,
              },
            ]
          : [],
      name: row.name,
      ownerClerkId: row.ownerClerkId,
      isPrivate: row.isPrivate,
      isAdminPrivate:
        row.isPrivate &&
        row.privatedByClerkId !== null &&
        row.privatedByClerkId !== row.ownerClerkId,
      isOwner: viewer?.clerkId === row.ownerClerkId,
      productTypeId: row.productTypeId,
      productTypeName: row.productTypeName,
      productTypeSlug: catalogProductType(row.productTypeSlug),
      slug: row.slug,
      spinDiameterMm: row.spinDiameterMm,
      thicknessMm: row.thicknessMm,
      thicknessWithButtonMm: row.thicknessWithButtonMm,
      updatedAt: row.updatedAt,
      weightG: row.weightG,
      weightBasis: row.weightBasis,
      widthMm: row.widthMm,
    });
  }
  const result = [...products.values()];
  await Promise.all([
    loadFinishOptions(db, result),
    loadProductImages(db, result, viewer),
    loadProductRelationships(db, result, viewer),
    loadProductMagnetConfigurations(db, result),
    loadInsertHostedMagnetOptions(db, result, viewer),
  ]);
  return result;
}

/**
 * Hydrates complete body-hosted magnet configurations without inferring gaps.
 *
 * @param db - Database used for exact configuration reads.
 * @param products - Products receiving their live catalog setup.
 * @rejects When exact configuration rows cannot be queried.
 */
async function loadProductMagnetConfigurations(
  db: Pick<Database, "select">,
  products: CatalogProduct[],
) {
  const bodyHosted = products.filter(
    (product) => product.bodyHostedMagnetSetup,
  );
  if (!bodyHosted.length) return;
  const productIds = bodyHosted.map(({ id }) => id);
  const configurations = await db
    .select({
      label: schema.magnetConfigurationLabel.name,
      productId: schema.productMagnetConfiguration.productId,
      sourceLabel: schema.productMagnetConfiguration.sourceLabel,
      sourceNotes: schema.productMagnetConfiguration.sourceNotes,
    })
    .from(schema.productMagnetConfiguration)
    .innerJoin(
      schema.magnetConfigurationLabel,
      eq(
        schema.productMagnetConfiguration.configurationLabelId,
        schema.magnetConfigurationLabel.id,
      ),
    )
    .where(inArray(schema.productMagnetConfiguration.productId, productIds));
  if (!configurations.length) return;
  const configurationIds = configurations.map(({ productId }) => productId);
  const [groups, slots] = await Promise.all([
    db
      .select({
        configurationProductId:
          schema.productMagnetGroup.configurationProductId,
        diameterMm: schema.productMagnetGroup.diameterMm,
        grade: schema.productMagnetGroup.grade,
        key: schema.productMagnetGroup.groupKey,
        label: schema.magnetGroupLabel.name,
        thicknessMm: schema.productMagnetGroup.thicknessMm,
      })
      .from(schema.productMagnetGroup)
      .innerJoin(
        schema.magnetGroupLabel,
        eq(schema.productMagnetGroup.groupLabelId, schema.magnetGroupLabel.id),
      )
      .where(
        inArray(
          schema.productMagnetGroup.configurationProductId,
          configurationIds,
        ),
      )
      .orderBy(asc(schema.productMagnetGroup.displayOrder)),
    db
      .select({
        configurationProductId: schema.productMagnetSlot.configurationProductId,
        documentedColumn: schema.productMagnetSlot.documentedColumn,
        documentedRow: schema.productMagnetSlot.documentedRow,
        groupKey: schema.productMagnetGroup.groupKey,
        half: schema.productMagnetSlot.half,
        key: schema.productMagnetSlot.slotKey,
        state: schema.productMagnetSlot.state,
      })
      .from(schema.productMagnetSlot)
      .leftJoin(
        schema.productMagnetGroup,
        and(
          eq(schema.productMagnetSlot.groupId, schema.productMagnetGroup.id),
          eq(
            schema.productMagnetSlot.configurationProductId,
            schema.productMagnetGroup.configurationProductId,
          ),
        ),
      )
      .where(
        inArray(
          schema.productMagnetSlot.configurationProductId,
          configurationIds,
        ),
      )
      .orderBy(asc(schema.productMagnetSlot.displayOrder)),
  ]);
  const byProductId = new Map(
    bodyHosted.map((product) => [product.id, product]),
  );
  for (const configuration of configurations) {
    const setup = byProductId.get(
      configuration.productId,
    )?.bodyHostedMagnetSetup;
    if (!setup) continue;
    setup.configuration = {
      groups: groups
        .filter(
          ({ configurationProductId }) =>
            configurationProductId === configuration.productId,
        )
        .map((group) => ({
          diameterMm: group.diameterMm,
          grade: group.grade,
          key: group.key,
          label: group.label,
          thicknessMm: group.thicknessMm,
        })),
      label: configuration.label,
      slots: slots
        .filter(
          ({ configurationProductId }) =>
            configurationProductId === configuration.productId,
        )
        .map((slot) => ({
          documentedColumn: slot.documentedColumn,
          documentedRow: slot.documentedRow,
          groupKey: slot.groupKey,
          half: slot.half,
          key: slot.key,
          state: slot.state,
        })),
      sourceLabel: configuration.sourceLabel,
      sourceNotes: configuration.sourceNotes,
    };
  }
}

/**
 * Hydrates insert-owned options and slider-specific advertised offers.
 *
 * @param db - Database used for option and offer reads.
 * @param products - Products receiving hydrated insert-hosted data.
 * @param viewer - Viewer controlling associated insert-product visibility.
 * @rejects When insert option or offer data cannot be queried.
 */
async function loadInsertHostedMagnetOptions(
  db: Pick<Database, "select">,
  products: CatalogProduct[],
  viewer?: CatalogViewer,
) {
  const inserts = products.filter(
    ({ productTypeSlug }) => productTypeSlug === "slider-insert",
  );
  const sliders = products.filter(
    ({ productTypeSlug }) => productTypeSlug === "slider",
  );
  const byProductId = new Map(products.map((product) => [product.id, product]));

  if (inserts.length) {
    const insertIds = inserts.map(({ id }) => id);
    const clickOptions = await db
      .select({
        clickCount: schema.productInsertClickOption.clickCount,
        id: schema.productInsertClickOption.id,
        insertionPosition: schema.productInsertClickOption.insertionPosition,
        insertProductId: schema.productInsertClickOption.insertProductId,
      })
      .from(schema.productInsertClickOption)
      .where(
        inArray(schema.productInsertClickOption.insertProductId, insertIds),
      )
      .orderBy(asc(schema.productInsertClickOption.insertionPosition));
    for (const option of clickOptions) {
      byProductId.get(option.insertProductId)?.insertClickOptions.push({
        clickCount: option.clickCount,
        id: option.id,
        insertionPosition: option.insertionPosition,
      });
    }
  }

  const associationRows = sliders.length
    ? await db
        .select({
          insertOfferId: schema.productSliderInsertOffer.insertOfferId,
          isSliderAdvertisedDefault:
            schema.productSliderInsertOffer.isAdvertisedDefault,
          sliderProductId: schema.productSliderInsertOffer.sliderProductId,
        })
        .from(schema.productSliderInsertOffer)
        .where(
          inArray(
            schema.productSliderInsertOffer.sliderProductId,
            sliders.map(({ id }) => id),
          ),
        )
    : [];
  const insertIds = inserts.map(({ id }) => id);
  const associatedOfferIds = associationRows.map(
    ({ insertOfferId }) => insertOfferId,
  );
  if (!insertIds.length && !associatedOfferIds.length) return;
  const offerCondition = and(
    insertIds.length
      ? inArray(schema.productInsertMagnetOffer.insertProductId, insertIds)
      : undefined,
  );
  const offerVisibility = hasPermission(viewer, "products.manage")
    ? undefined
    : viewer?.clerkId
      ? sql`((${schema.product.approvalStatus} = 'approved' and ${schema.product.isPrivate} = false) or ${schema.product.ownerClerkId} = ${viewer.clerkId})`
      : and(
          eq(schema.product.approvalStatus, "approved"),
          eq(schema.product.isPrivate, false),
        );
  const offers = await db
    .select({
      clickCount: schema.productInsertClickOption.clickCount,
      clickOptionId: schema.productInsertMagnetOffer.clickOptionId,
      copiedFromTemplateId:
        schema.productInsertMagnetOffer.copiedFromTemplateId,
      id: schema.productInsertMagnetOffer.id,
      insertProductId: schema.productInsertMagnetOffer.insertProductId,
      insertProductName: schema.product.name,
      isAdvertisedDefault: schema.productInsertMagnetOffer.isAdvertisedDefault,
      label: schema.magnetConfigurationLabel.name,
      sourceLabel: schema.productInsertMagnetOffer.sourceLabel,
      sourceNotes: schema.productInsertMagnetOffer.sourceNotes,
    })
    .from(schema.productInsertMagnetOffer)
    .innerJoin(
      schema.product,
      eq(schema.productInsertMagnetOffer.insertProductId, schema.product.id),
    )
    .innerJoin(
      schema.magnetConfigurationLabel,
      eq(
        schema.productInsertMagnetOffer.configurationLabelId,
        schema.magnetConfigurationLabel.id,
      ),
    )
    .leftJoin(
      schema.productInsertClickOption,
      eq(
        schema.productInsertMagnetOffer.clickOptionId,
        schema.productInsertClickOption.id,
      ),
    )
    .where(
      and(
        insertIds.length && associatedOfferIds.length
          ? or(
              offerCondition,
              inArray(schema.productInsertMagnetOffer.id, associatedOfferIds),
            )
          : insertIds.length
            ? offerCondition
            : inArray(schema.productInsertMagnetOffer.id, associatedOfferIds),
        offerVisibility,
      ),
    );
  if (!offers.length) return;
  const offerIds = offers.map(({ id }) => id);
  const [groups, slots] = await Promise.all([
    db
      .select({
        diameterMm: schema.productInsertMagnetGroup.diameterMm,
        grade: schema.productInsertMagnetGroup.grade,
        key: schema.productInsertMagnetGroup.groupKey,
        label: schema.magnetGroupLabel.name,
        offerId: schema.productInsertMagnetGroup.offerId,
        thicknessMm: schema.productInsertMagnetGroup.thicknessMm,
      })
      .from(schema.productInsertMagnetGroup)
      .innerJoin(
        schema.magnetGroupLabel,
        eq(
          schema.productInsertMagnetGroup.groupLabelId,
          schema.magnetGroupLabel.id,
        ),
      )
      .where(inArray(schema.productInsertMagnetGroup.offerId, offerIds))
      .orderBy(asc(schema.productInsertMagnetGroup.displayOrder)),
    db
      .select({
        documentedColumn: schema.productInsertMagnetSlot.documentedColumn,
        documentedRow: schema.productInsertMagnetSlot.documentedRow,
        groupKey: schema.productInsertMagnetGroup.groupKey,
        half: schema.productInsertMagnetSlot.half,
        key: schema.productInsertMagnetSlot.slotKey,
        offerId: schema.productInsertMagnetSlot.offerId,
        state: schema.productInsertMagnetSlot.state,
      })
      .from(schema.productInsertMagnetSlot)
      .leftJoin(
        schema.productInsertMagnetGroup,
        and(
          eq(
            schema.productInsertMagnetSlot.groupId,
            schema.productInsertMagnetGroup.id,
          ),
          eq(
            schema.productInsertMagnetSlot.offerId,
            schema.productInsertMagnetGroup.offerId,
          ),
        ),
      )
      .where(inArray(schema.productInsertMagnetSlot.offerId, offerIds))
      .orderBy(asc(schema.productInsertMagnetSlot.displayOrder)),
  ]);
  const hydrated = new Map<number, CatalogInsertMagnetOffer>();
  for (const offer of offers) {
    const value: CatalogInsertMagnetOffer = {
      clickCount: offer.clickCount,
      clickOptionId: offer.clickOptionId,
      configuration: {
        groups: groups
          .filter(({ offerId }) => offerId === offer.id)
          .map((group) => ({
            diameterMm: group.diameterMm,
            grade: group.grade,
            key: group.key,
            label: group.label,
            thicknessMm: group.thicknessMm,
          })),
        label: offer.label,
        slots: slots
          .filter(({ offerId }) => offerId === offer.id)
          .map((slot) => ({
            documentedColumn: slot.documentedColumn,
            documentedRow: slot.documentedRow,
            groupKey: slot.groupKey,
            half: slot.half,
            key: slot.key,
            state: slot.state,
          })),
        sourceLabel: offer.sourceLabel,
        sourceNotes: offer.sourceNotes,
      },
      copiedFromTemplateId: offer.copiedFromTemplateId,
      id: offer.id,
      insertProductId: offer.insertProductId,
      isAdvertisedDefault: offer.isAdvertisedDefault,
    };
    hydrated.set(offer.id, value);
    byProductId.get(offer.insertProductId)?.insertMagnetOffers.push(value);
  }
  for (const association of associationRows) {
    const offer = hydrated.get(association.insertOfferId);
    const slider = byProductId.get(association.sliderProductId);
    const insertName = offers.find(
      ({ id }) => id === association.insertOfferId,
    )?.insertProductName;
    if (!offer || !slider || !insertName) continue;
    slider.advertisedInsertOffers.push({
      ...offer,
      insertProductName: insertName,
      isSliderAdvertisedDefault: association.isSliderAdvertisedDefault,
    });
  }
}

/**
 * Loads reviewed compatibility and visible exact inclusion relationships.
 *
 * @param db - Database used for relationship queries.
 * @param products - Hydrated products receiving relationship data.
 * @param viewer - Optional viewer controlling related-product visibility.
 * @rejects When a relationship query fails.
 */
async function loadProductRelationships(
  db: Pick<Database, "select">,
  products: CatalogProduct[],
  viewer?: CatalogViewer,
) {
  if (!products.length) return;
  const productIds = products.map(({ id }) => id);
  const relatedProduct = alias(schema.product, "relationship_related_product");
  const relatedType = alias(schema.productType, "relationship_related_type");
  const relatedVisibility = hasPermission(viewer, "products.manage")
    ? undefined
    : viewer?.clerkId
      ? sql`((${relatedProduct.approvalStatus} = 'approved' and ${relatedProduct.isPrivate} = false) or ${relatedProduct.ownerClerkId} = ${viewer.clerkId})`
      : and(
          eq(relatedProduct.approvalStatus, "approved"),
          eq(relatedProduct.isPrivate, false),
        );
  const [families, advisories, components] = await Promise.all([
    db
      .select({
        id: schema.compatibilityFamily.id,
        makerId: schema.compatibilityFamily.makerId,
        makerName: schema.maker.name,
        name: schema.compatibilityFamily.name,
        productId: schema.productCompatibilityFamily.productId,
        slug: schema.compatibilityFamily.slug,
      })
      .from(schema.productCompatibilityFamily)
      .innerJoin(
        schema.compatibilityFamily,
        eq(
          schema.productCompatibilityFamily.compatibilityFamilyId,
          schema.compatibilityFamily.id,
        ),
      )
      .innerJoin(
        schema.maker,
        eq(schema.compatibilityFamily.makerId, schema.maker.id),
      )
      .where(inArray(schema.productCompatibilityFamily.productId, productIds))
      .orderBy(asc(schema.maker.name), asc(schema.compatibilityFamily.name)),
    db
      .select({
        id: schema.productCompatibilityAdvisory.id,
        productId: schema.productCompatibilityAdvisory.productId,
        relatedProductId: schema.productCompatibilityAdvisory.relatedProductId,
        relatedProductName: relatedProduct.name,
        reviewedAt: schema.productCompatibilityAdvisory.reviewedAt,
        text: schema.productCompatibilityAdvisory.text,
      })
      .from(schema.productCompatibilityAdvisory)
      .innerJoin(
        relatedProduct,
        eq(
          schema.productCompatibilityAdvisory.relatedProductId,
          relatedProduct.id,
        ),
      )
      .where(
        and(
          inArray(schema.productCompatibilityAdvisory.productId, productIds),
          relatedVisibility,
        ),
      )
      .orderBy(asc(schema.productCompatibilityAdvisory.id)),
    db
      .select({
        id: relatedProduct.id,
        name: relatedProduct.name,
        productId: schema.productIncludedComponent.productId,
        productTypeSlug: relatedType.slug,
        slug: relatedProduct.slug,
      })
      .from(schema.productIncludedComponent)
      .innerJoin(
        relatedProduct,
        eq(
          schema.productIncludedComponent.componentProductId,
          relatedProduct.id,
        ),
      )
      .innerJoin(relatedType, eq(relatedProduct.productTypeId, relatedType.id))
      .where(
        and(
          inArray(schema.productIncludedComponent.productId, productIds),
          relatedVisibility,
        ),
      )
      .orderBy(asc(relatedProduct.name)),
  ]);
  const productsById = new Map(
    products.map((product) => [product.id, product]),
  );
  for (const family of families) {
    productsById.get(family.productId)?.compatibilityFamilies.push({
      id: family.id,
      makerId: family.makerId,
      makerName: family.makerName,
      name: family.name,
      slug: family.slug,
    });
  }
  for (const advisory of advisories) {
    productsById.get(advisory.productId)?.compatibilityAdvisories.push({
      id: advisory.id,
      relatedProductId: advisory.relatedProductId,
      relatedProductName: advisory.relatedProductName,
      reviewedAt: advisory.reviewedAt,
      text: advisory.text,
    });
  }
  for (const component of components) {
    if (
      component.productTypeSlug !== "slider-insert" &&
      component.productTypeSlug !== "slider-plate"
    )
      continue;
    productsById.get(component.productId)?.includedComponents.push({
      id: component.id,
      name: component.name,
      productTypeSlug: component.productTypeSlug,
      slug: component.slug,
    });
  }
}

/**
 * Loads product images.
 *
 * @param db - Application database.
 * @param products - Products.
 * @param viewer - Optional catalog viewer.
 * @rejects When the required catalog data cannot be queried.
 */
async function loadProductImages(
  db: Pick<Database, "select">,
  products: CatalogProduct[],
  viewer?: CatalogViewer,
) {
  if (!products.length) return;
  const productById = new Map(products.map((product) => [product.id, product]));
  const rows = await db
    .select({
      contentType: schema.productImage.contentType,
      createdAt: schema.productImage.createdAt,
      deletedAt: schema.productImage.deletedAt,
      deletedByClerkId: schema.productImage.deletedByClerkId,
      deletedByRole: schema.productImage.deletedByRole,
      fileName: schema.productImage.fileName,
      id: schema.productImage.id,
      objectPath: schema.productImage.objectPath,
      position: schema.productImage.position,
      productId: schema.productImage.productId,
      size: schema.productImage.size,
      url: schema.productImage.url,
    })
    .from(schema.productImage)
    .where(inArray(schema.productImage.productId, [...productById.keys()]))
    .orderBy(asc(schema.productImage.position), asc(schema.productImage.id));
  for (const row of rows) {
    const product = productById.get(row.productId);
    if (!product) continue;
    const canSeeDeleted =
      hasPermission(viewer, "products.manage") ||
      (viewer?.clerkId === product.ownerClerkId &&
        row.deletedByRole === "owner");
    if (row.deletedAt && !canSeeDeleted) continue;
    if (!row.deletedAt) product.imageCount += 1;
    product.images.push({
      contentType: row.contentType,
      createdAt: row.createdAt,
      deletedAt: row.deletedAt,
      deletedByClerkId: row.deletedByClerkId,
      deletedByRole: row.deletedByRole,
      fileName: row.fileName,
      id: row.id,
      objectPath: row.objectPath,
      position: row.position,
      size: row.size,
      url: row.url,
    });
  }
}

/**
 * Loads finish options.
 *
 * @param db - Application database.
 * @param products - Products.
 * @rejects When the required catalog data cannot be queried.
 */
async function loadFinishOptions(
  db: Pick<Database, "select">,
  products: CatalogProduct[],
) {
  if (!products.length) return;

  const options = await db
    .select({
      colorEffectId: schema.colorEffect.id,
      colorEffectName: schema.colorEffect.name,
      colorEffectSlug: schema.colorEffect.slug,
      id: schema.finishOption.id,
      patternId: schema.pattern.id,
      patternName: schema.pattern.name,
      patternSlug: schema.pattern.slug,
      productId: schema.finishOption.productId,
    })
    .from(schema.finishOption)
    .leftJoin(
      schema.colorEffect,
      eq(schema.finishOption.colorEffectId, schema.colorEffect.id),
    )
    .leftJoin(
      schema.pattern,
      eq(schema.finishOption.patternId, schema.pattern.id),
    )
    .where(
      inArray(
        schema.finishOption.productId,
        products.map(({ id }) => id),
      ),
    )
    .orderBy(asc(schema.finishOption.position));

  if (!options.length) return;
  const loadedOptions = await loadFinishOptionComponents(db, options);
  const productsById = new Map(
    products.map((product) => [product.id, product]),
  );

  for (const option of options) {
    const product = option.productId
      ? productsById.get(option.productId)
      : undefined;
    const loaded = loadedOptions.get(option.id);
    if (product && loaded) product.finishOptions.push(loaded);
  }
}

/**
 * Loads finish option components.
 *
 * @param db - Application database.
 * @param options - Finish-option identities and effects to hydrate.
 * @returns Matching finish option components, when available.
 * @rejects When the required catalog data cannot be queried.
 */
async function loadFinishOptionComponents(
  db: Pick<Database, "select">,
  options: Array<{
    /**
     * Color effect identifier.
     */
    colorEffectId: number | null;
    /**
     * Color effect name.
     */
    colorEffectName: string | null;
    /**
     * Color effect slug.
     */
    colorEffectSlug: string | null;
    /**
     * Database identifier.
     */
    id: number;
    /** Pattern identifier. */
    patternId: number | null;
    /** Pattern name. */
    patternName: string | null;
    /** Pattern slug. */
    patternSlug: string | null;
  }>,
): Promise<Map<number, CatalogFinishOption>> {
  if (!options.length) return new Map();
  const optionIds = options.map(({ id }) => id);
  const [finishes, colors] = await Promise.all([
    db
      .select({
        finishOptionId: schema.finishOptionFinish.finishOptionId,
        id: schema.finish.id,
        name: schema.finish.name,
        slug: schema.finish.slug,
      })
      .from(schema.finishOptionFinish)
      .innerJoin(
        schema.finish,
        eq(schema.finishOptionFinish.finishId, schema.finish.id),
      )
      .where(inArray(schema.finishOptionFinish.finishOptionId, optionIds))
      .orderBy(asc(schema.finishOptionFinish.position)),
    db
      .select({
        finishOptionId: schema.finishOptionColor.finishOptionId,
        hex: schema.color.hex,
        id: schema.color.id,
        name: schema.color.name,
        slug: schema.color.slug,
      })
      .from(schema.finishOptionColor)
      .innerJoin(
        schema.color,
        eq(schema.finishOptionColor.colorId, schema.color.id),
      )
      .where(inArray(schema.finishOptionColor.finishOptionId, optionIds))
      .orderBy(asc(schema.finishOptionColor.position)),
  ]);
  const result = new Map<number, CatalogFinishOption>();

  for (const option of options) {
    result.set(option.id, {
      colorEffect:
        option.colorEffectId && option.colorEffectName && option.colorEffectSlug
          ? {
              id: option.colorEffectId,
              name: option.colorEffectName,
              slug: option.colorEffectSlug,
            }
          : null,
      colors: colors
        .filter(({ finishOptionId }) => finishOptionId === option.id)
        .map(({ hex, id, name, slug }) => ({ hex, id, name, slug })),
      finishes: finishes
        .filter(({ finishOptionId }) => finishOptionId === option.id)
        .map(({ id, name, slug }) => ({ id, name, slug })),
      id: option.id,
      pattern:
        option.patternId && option.patternName && option.patternSlug
          ? {
              id: option.patternId,
              name: option.patternName,
              slug: option.patternSlug,
            }
          : null,
    });
  }
  return result;
}

/**
 * Loads owned collection items subject to visibility and identity filters.
 *
 * @param db - Database used for the query.
 * @param actorClerkId - Optional collection owner Clerk identifier.
 * @param collectionItemId - Optional collection item identifier.
 * @param options - Visibility, owner, collection, and product filters.
 * @returns Matching collection items with effective product data.
 * @rejects When the database query fails.
 */
async function queryOwnedItems(
  db: Database,
  actorClerkId?: string,
  collectionItemId?: number,
  options: {
    /**
     * Collection identifier.
     */
    collectionId?: number;
    /**
     * Include private.
     */
    includePrivate?: boolean;
    /** Maker identifier. */
    makerId?: number;
    /**
     * Directly assigned material identifier.
     */
    materialId?: number;
    /**
     * Owner database user identifier.
     */
    ownerUserId?: number;
    /**
     * Product identifier.
     */
    productId?: number;
    /**
     * Public only.
     */
    publicOnly?: boolean;
    /**
     * Viewer Clerk user identifier.
     */
    viewerClerkId?: string;
    /**
     * Viewer can manage.
     */
    viewerCanManage?: boolean;
  } = {},
): Promise<UserCollectionItem[]> {
  const conditions = [
    eq(schema.collectionItem.owned, true),
    isNull(schema.collectionItem.soldAt),
  ];
  if (actorClerkId !== undefined) {
    conditions.push(eq(schema.user.clerkId, actorClerkId));
  }
  if (collectionItemId !== undefined) {
    conditions.push(eq(schema.collectionItem.id, collectionItemId));
  }
  if (options.collectionId !== undefined) {
    conditions.push(
      eq(schema.collectionItem.collectionId, options.collectionId),
    );
  }
  if (options.materialId !== undefined) {
    conditions.push(eq(schema.collectionItem.materialId, options.materialId));
  }
  if (options.makerId !== undefined) {
    conditions.push(eq(schema.maker.id, options.makerId));
  }
  if (options.ownerUserId !== undefined) {
    conditions.push(eq(schema.collectionItem.ownerId, options.ownerUserId));
  }
  if (options.productId !== undefined) {
    conditions.push(eq(schema.product.id, options.productId));
  }
  const publicItem = sql`(${schema.userCollection.isPrivate} = false and ${schema.collectionItem.isPrivate} = false and ${schema.collectionItem.soldAt} is null and ${schema.collectionItem.approvalStatus} = 'approved' and ${schema.product.approvalStatus} = 'approved' and ${schema.product.isPrivate} = false)`;
  if (options.publicOnly) {
    conditions.push(publicItem);
  } else if (!options.includePrivate) {
    conditions.push(
      options.viewerClerkId
        ? sql`(${publicItem} or ${schema.user.clerkId} = ${options.viewerClerkId})`
        : publicItem,
    );
  }
  const rows = await db
    .select({
      approvalStatus: schema.collectionItem.approvalStatus,
      bearingOverride: schema.collectionSpinner.bearing,
      productBearing: schema.productSpinner.bearing,
      collectionId: schema.userCollection.id,
      collectionItemId: schema.collectionItem.id,
      collectionIsPrivate: schema.userCollection.isPrivate,
      collectionName: schema.userCollection.name,
      displayName: sql<string>`coalesce(${schema.collectionItem.displayName}, ${schema.product.name})`,
      descriptionOverride: schema.collectionItem.description,
      productDescription: schema.product.description,
      colorEffectId: schema.colorEffect.id,
      colorEffectName: schema.colorEffect.name,
      colorEffectSlug: schema.colorEffect.slug,
      finishOptionId: schema.finishOption.id,
      installedButtonId: schema.collectionSpinner.installedButtonId,
      isPrivate: schema.collectionItem.isPrivate,
      privatedByClerkId: schema.collectionItem.privatedByClerkId,
      makerId: schema.maker.id,
      makerName: schema.maker.name,
      makerSlug: schema.maker.slug,
      makerUrl: schema.maker.rootUrl,
      materialId: schema.material.id,
      materialName: schema.material.name,
      materialSlug: schema.material.slug,
      name: schema.product.name,
      ownerClerkId: schema.user.clerkId,
      ownerUsername: schema.user.username,
      ownerUserId: schema.user.id,
      productId: schema.product.id,
      productSlug: schema.product.slug,
      productTypeName: schema.productType.name,
      patternId: schema.pattern.id,
      patternName: schema.pattern.name,
      patternSlug: schema.pattern.slug,
      sourceProductFinishOptionId:
        schema.finishOption.sourceProductFinishOptionId,
      spinnerId: schema.collectionSpinner.id,
      buttonId: schema.collectionSpinnerButton.id,
      updatedAt: schema.collectionItem.updatedAt,
    })
    .from(schema.collectionItem)
    .innerJoin(schema.user, eq(schema.collectionItem.ownerId, schema.user.id))
    .innerJoin(
      schema.userCollection,
      eq(schema.collectionItem.collectionId, schema.userCollection.id),
    )
    .leftJoin(
      schema.material,
      eq(schema.collectionItem.materialId, schema.material.id),
    )
    .leftJoin(
      schema.finishOption,
      eq(schema.collectionItem.id, schema.finishOption.collectionItemId),
    )
    .leftJoin(
      schema.colorEffect,
      eq(schema.finishOption.colorEffectId, schema.colorEffect.id),
    )
    .leftJoin(
      schema.pattern,
      eq(schema.finishOption.patternId, schema.pattern.id),
    )
    .leftJoin(
      schema.collectionSpinner,
      eq(schema.collectionItem.id, schema.collectionSpinner.id),
    )
    .leftJoin(
      schema.collectionSpinnerButton,
      eq(schema.collectionItem.id, schema.collectionSpinnerButton.id),
    )
    .innerJoin(
      schema.product,
      eq(
        schema.product.id,
        sql`coalesce(${schema.collectionSpinner.productSpinnerId}, ${schema.collectionSpinnerButton.productSpinnerButtonId})`,
      ),
    )
    .innerJoin(schema.maker, eq(schema.product.makerId, schema.maker.id))
    .leftJoin(
      schema.productSpinner,
      eq(schema.product.id, schema.productSpinner.id),
    )
    .innerJoin(
      schema.productType,
      eq(schema.product.productTypeId, schema.productType.id),
    )
    .where(and(...conditions))
    .orderBy(desc(schema.collectionItem.updatedAt));
  const visibleRows = rows.filter(
    ({ collectionIsPrivate, isPrivate, ownerClerkId, ownerUserId }) =>
      (!options.publicOnly || (!collectionIsPrivate && !isPrivate)) &&
      (actorClerkId === undefined || ownerClerkId === actorClerkId) &&
      (options.ownerUserId === undefined ||
        ownerUserId === options.ownerUserId),
  );
  const finishOptions = await loadFinishOptionComponents(
    db,
    visibleRows.flatMap((row) =>
      row.finishOptionId
        ? [
            {
              colorEffectId: row.colorEffectId,
              colorEffectName: row.colorEffectName,
              colorEffectSlug: row.colorEffectSlug,
              id: row.finishOptionId,
              patternId: row.patternId,
              patternName: row.patternName,
              patternSlug: row.patternSlug,
            },
          ]
        : [],
    ),
  );
  const items: UserCollectionItem[] = visibleRows.map((row) => ({
    approvalStatus: row.approvalStatus,
    bearing: row.bearingOverride ?? row.productBearing,
    bearingOverride: row.bearingOverride,
    canAdminister: Boolean(options.viewerCanManage),
    canEdit: Boolean(
      options.viewerCanManage || options.viewerClerkId === row.ownerClerkId,
    ),
    collectionIsPrivate: row.collectionIsPrivate,
    collectionId: row.collectionId,
    collectionItemId: row.collectionItemId,
    collectionName: row.collectionName,
    displayName: row.displayName,
    description: row.descriptionOverride ?? row.productDescription,
    descriptionOverride: row.descriptionOverride,
    finishOption: row.finishOptionId
      ? (finishOptions.get(row.finishOptionId) ?? null)
      : null,
    imageCount: 0,
    images: [],
    isPrivate: row.isPrivate,
    isAdminPrivate:
      row.isPrivate &&
      row.privatedByClerkId !== null &&
      row.privatedByClerkId !== row.ownerClerkId,
    installedButtonId: row.installedButtonId,
    isOwner: options.viewerClerkId === row.ownerClerkId,
    makerId: row.makerId,
    makerName: row.makerName,
    makerSlug: row.makerSlug,
    makerUrl: row.makerUrl,
    material:
      row.materialId && row.materialName && row.materialSlug
        ? {
            id: row.materialId,
            name: row.materialName,
            slug: row.materialSlug,
          }
        : null,
    name: row.name,
    ownerClerkId: row.ownerClerkId,
    ownerUsername: row.ownerUsername,
    ownerUserId: row.ownerUserId,
    productId: row.productId,
    productSlug: row.productSlug,
    productTypeName: row.productTypeName,
    productTypeSlug: row.spinnerId ? "spinner" : "spinner-button",
    productImages: [],
    sourceProductFinishOptionId: row.sourceProductFinishOptionId,
  }));
  await loadCollectionImages(
    db,
    items,
    options.viewerClerkId,
    options.includePrivate,
  );
  return items;
}

/**
 * Loads collection images.
 *
 * @param db - Application database.
 * @param items - Items.
 * @param viewerClerkId - Viewer clerk identifier.
 * @param includePrivate - Include private.
 * @rejects When the required catalog data cannot be queried.
 */
async function loadCollectionImages(
  db: Database,
  items: UserCollectionItem[],
  viewerClerkId?: string,
  includePrivate = false,
) {
  if (!items.length) return;
  const itemById = new Map(items.map((item) => [item.collectionItemId, item]));
  const productIds = [...new Set(items.map((item) => item.productId))];
  const [ownImages, productImages] = await Promise.all([
    db
      .select()
      .from(schema.collectionItemImage)
      .where(
        inArray(schema.collectionItemImage.collectionItemId, [
          ...itemById.keys(),
        ]),
      )
      .orderBy(
        asc(schema.collectionItemImage.position),
        asc(schema.collectionItemImage.id),
      ),
    db
      .select({
        contentType: schema.productImage.contentType,
        createdAt: schema.productImage.createdAt,
        deletedAt: schema.productImage.deletedAt,
        deletedByClerkId: schema.productImage.deletedByClerkId,
        deletedByRole: schema.productImage.deletedByRole,
        fileName: schema.productImage.fileName,
        id: schema.productImage.id,
        isPrivate: schema.product.isPrivate,
        ownerClerkId: schema.product.ownerClerkId,
        objectPath: schema.productImage.objectPath,
        position: schema.productImage.position,
        productId: schema.productImage.productId,
        size: schema.productImage.size,
        url: schema.productImage.url,
      })
      .from(schema.productImage)
      .innerJoin(
        schema.product,
        eq(schema.productImage.productId, schema.product.id),
      )
      .where(inArray(schema.productImage.productId, productIds))
      .orderBy(asc(schema.productImage.position), asc(schema.productImage.id)),
  ]);
  for (const row of ownImages) {
    const item = itemById.get(row.collectionItemId);
    if (!item) continue;
    const ownerCanSee = viewerClerkId === item.ownerClerkId;
    if (
      row.deletedAt &&
      !includePrivate &&
      (!ownerCanSee || row.deletedByRole === "admin")
    )
      continue;
    if (!row.deletedAt) item.imageCount += 1;
    item.images.push(toCatalogImage(row));
  }
  for (const row of productImages) {
    if (row.deletedAt) continue;
    if (row.isPrivate && !includePrivate && row.ownerClerkId !== viewerClerkId)
      continue;
    for (const item of items) {
      if (item.productId !== row.productId) continue;
      item.productImages.push(toCatalogImage(row));
      item.imageCount += 1;
    }
  }
}

/**
 * Maps a stored image row to its catalog representation.
 *
 * @param row - Row.
 * @returns Catalog image representation.
 */
/**
 * Loads name-sorted maker profiles with ordered image metadata.
 *
 * @param db - Application database.
 * @param includeDeleted - Whether archived images are included.
 * @param makerId - Optional maker identifier filter.
 * @returns Matching maker profiles.
 * @rejects When maker or image queries fail.
 */
async function queryMakerProfiles(
  db: Pick<Database, "select">,
  includeDeleted: boolean,
  makerId?: number,
): Promise<CatalogMaker[]> {
  const makers = await db
    .select({
      description: schema.maker.description,
      id: schema.maker.id,
      name: schema.maker.name,
      rootUrl: schema.maker.rootUrl,
      slug: schema.maker.slug,
    })
    .from(schema.maker)
    .where(makerId === undefined ? undefined : eq(schema.maker.id, makerId))
    .orderBy(asc(schema.maker.name));
  if (!makers.length) return [];
  const images = await db
    .select({
      contentType: schema.makerImage.contentType,
      createdAt: schema.makerImage.createdAt,
      deletedAt: schema.makerImage.deletedAt,
      deletedByClerkId: schema.makerImage.deletedByClerkId,
      deletedByRole: schema.makerImage.deletedByRole,
      fileName: schema.makerImage.fileName,
      id: schema.makerImage.id,
      makerId: schema.makerImage.makerId,
      objectPath: schema.makerImage.objectPath,
      position: schema.makerImage.position,
      size: schema.makerImage.size,
      url: schema.makerImage.url,
    })
    .from(schema.makerImage)
    .where(
      and(
        inArray(
          schema.makerImage.makerId,
          makers.map(({ id }) => id),
        ),
        includeDeleted ? undefined : isNull(schema.makerImage.deletedAt),
      ),
    )
    .orderBy(asc(schema.makerImage.position), asc(schema.makerImage.id));
  return makers.map((maker) => ({
    ...maker,
    images: images
      .filter((image) => image.makerId === maker.id)
      .map(toCatalogImage),
  }));
}

/**
 * Converts a selected image row into the shared catalog image shape.
 *
 * @param row - Selected image metadata.
 * @returns Shared catalog image metadata.
 */
function toCatalogImage(row: {
  /**
   * Content type.
   */
  contentType: string;
  /**
   * Created timestamp.
   */
  createdAt: Date;
  /**
   * Deleted timestamp.
   */
  deletedAt: Date | null;
  /**
   * Deleted by Clerk user identifier.
   */
  deletedByClerkId: string | null;
  /**
   * Deleted by role.
   */
  deletedByRole: "admin" | "owner" | null;
  /**
   * File name.
   */
  fileName: string;
  /**
   * Database identifier.
   */
  id: number;
  /**
   * Object path.
   */
  objectPath: string;
  /**
   * Display order position.
   */
  position: number;
  /**
   * File size in bytes.
   */
  size: number;
  /**
   * Public image URL.
   */
  url: string;
}): CatalogImage {
  return row;
}

/**
 * Normalizes editable material content at the service boundary.
 *
 * @param input - Untrusted name and optional Markdown description.
 * @returns Trimmed values safe to persist.
 * @throws When the name is blank or the description exceeds 5,000 characters.
 */
function normalizeMaterialWrite(input: {
  /** Optional Markdown description. */
  description?: string | null;
  /** Material display name. */
  name: string;
}) {
  const name = input.name.trim();
  const description = input.description?.trim() || null;
  if (!name) throw new Error("Material name is required.");
  if (description && description.length > 5000)
    throw new Error("Material description is too long.");
  return { description, name };
}

/**
 * Converts a material name to a lowercase ASCII slug.
 *
 * @param value - Material display name.
 * @returns Normalized slug, possibly empty.
 */
function materialSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

/**
 * Generates the first available material slug under a transaction lock.
 *
 * @param db - Transaction used to serialize and inspect slug allocation.
 * @param name - Material display name.
 * @returns Stable unique slug for a newly created material.
 * @rejects When the name cannot form a slug or database access fails.
 */
async function nextMaterialSlug(
  db: Pick<Database, "execute" | "select">,
  name: string,
) {
  const base = materialSlug(name);
  if (!base) throw new Error("Material name is invalid.");
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtextextended('material-slug-allocation', 0))`,
  );
  const rows = await db
    .select({ slug: schema.material.slug })
    .from(schema.material);
  const used = new Set(rows.map(({ slug }) => slug));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/**
 * Lists material images in stable display order, including soft-deleted rows.
 *
 * @param db - Database or transaction used for the query.
 * @param materialId - Material whose images are returned.
 * @returns Stored image metadata in display order.
 * @rejects When image lookup fails.
 */
async function queryMaterialImages(
  db: Pick<Database, "select">,
  materialId: number,
) {
  return await db
    .select({
      contentType: schema.materialImage.contentType,
      createdAt: schema.materialImage.createdAt,
      deletedAt: schema.materialImage.deletedAt,
      deletedByClerkId: schema.materialImage.deletedByClerkId,
      deletedByRole: schema.materialImage.deletedByRole,
      fileName: schema.materialImage.fileName,
      id: schema.materialImage.id,
      objectPath: schema.materialImage.objectPath,
      position: schema.materialImage.position,
      size: schema.materialImage.size,
      url: schema.materialImage.url,
    })
    .from(schema.materialImage)
    .where(eq(schema.materialImage.materialId, materialId))
    .orderBy(asc(schema.materialImage.position), asc(schema.materialImage.id));
}

/**
 * Loads material administration rows without changing lightweight public lookup queries.
 *
 * @param db - Database used for material lookup.
 * @param materialId - Optional material identifier filter.
 * @returns Name-sorted material content rows.
 * @rejects When material lookup fails.
 */
async function queryAdminMaterialRows(db: Database, materialId?: number) {
  return await db
    .select({
      description: schema.material.description,
      id: schema.material.id,
      name: schema.material.name,
      slug: schema.material.slug,
    })
    .from(schema.material)
    .where(
      materialId === undefined ? undefined : eq(schema.material.id, materialId),
    )
    .orderBy(asc(schema.material.name));
}

/**
 * Loads public material cards with independently computed product and item counts.
 *
 * Collection counts use the item's direct material snapshot and require the item,
 * collection, and source product all to be public. Sold items are excluded.
 *
 * @param db - Database used for material lookup.
 * @param materialId - Optional material identifier filter.
 * @returns Name-sorted public material summaries.
 * @rejects When material, image, product, or collection queries fail.
 */
async function queryPublicMaterialSummaries(
  db: Database,
  materialId?: number,
): Promise<PublicMaterialSummary[]> {
  const materials = await db
    .select({
      id: schema.material.id,
      name: schema.material.name,
      slug: schema.material.slug,
    })
    .from(schema.material)
    .where(
      materialId === undefined ? undefined : eq(schema.material.id, materialId),
    )
    .orderBy(asc(schema.material.name));
  if (!materials.length) return [];
  const materialIds = materials.map(({ id }) => id);
  const [images, productCounts, collectionItemCounts] = await Promise.all([
    db
      .select({
        contentType: schema.materialImage.contentType,
        createdAt: schema.materialImage.createdAt,
        deletedAt: schema.materialImage.deletedAt,
        deletedByClerkId: schema.materialImage.deletedByClerkId,
        deletedByRole: schema.materialImage.deletedByRole,
        fileName: schema.materialImage.fileName,
        id: schema.materialImage.id,
        materialId: schema.materialImage.materialId,
        objectPath: schema.materialImage.objectPath,
        position: schema.materialImage.position,
        size: schema.materialImage.size,
        url: schema.materialImage.url,
      })
      .from(schema.materialImage)
      .where(
        and(
          inArray(schema.materialImage.materialId, materialIds),
          isNull(schema.materialImage.deletedAt),
        ),
      )
      .orderBy(
        asc(schema.materialImage.position),
        asc(schema.materialImage.id),
      ),
    db
      .select({
        count: count(schema.productMaterial.productId),
        materialId: schema.productMaterial.materialId,
      })
      .from(schema.productMaterial)
      .innerJoin(
        schema.product,
        eq(schema.productMaterial.productId, schema.product.id),
      )
      .where(
        and(
          inArray(schema.productMaterial.materialId, materialIds),
          eq(schema.product.approvalStatus, "approved"),
          eq(schema.product.isPrivate, false),
        ),
      )
      .groupBy(schema.productMaterial.materialId),
    db
      .select({
        count: count(schema.collectionItem.id),
        materialId: schema.collectionItem.materialId,
      })
      .from(schema.collectionItem)
      .innerJoin(
        schema.userCollection,
        eq(schema.collectionItem.collectionId, schema.userCollection.id),
      )
      .leftJoin(
        schema.collectionSpinner,
        eq(schema.collectionItem.id, schema.collectionSpinner.id),
      )
      .leftJoin(
        schema.collectionSpinnerButton,
        eq(schema.collectionItem.id, schema.collectionSpinnerButton.id),
      )
      .innerJoin(
        schema.product,
        eq(
          schema.product.id,
          sql`coalesce(${schema.collectionSpinner.productSpinnerId}, ${schema.collectionSpinnerButton.productSpinnerButtonId})`,
        ),
      )
      .where(
        and(
          inArray(schema.collectionItem.materialId, materialIds),
          eq(schema.collectionItem.owned, true),
          isNull(schema.collectionItem.soldAt),
          eq(schema.collectionItem.approvalStatus, "approved"),
          eq(schema.collectionItem.isPrivate, false),
          eq(schema.userCollection.isPrivate, false),
          eq(schema.product.approvalStatus, "approved"),
          eq(schema.product.isPrivate, false),
        ),
      )
      .groupBy(schema.collectionItem.materialId),
  ]);
  const firstImageByMaterial = new Map<number, CatalogImage>();
  for (const { materialId: imageMaterialId, ...image } of images) {
    if (!firstImageByMaterial.has(imageMaterialId)) {
      firstImageByMaterial.set(imageMaterialId, image);
    }
  }
  const productCountByMaterial = new Map(
    productCounts.map((row) => [row.materialId, Number(row.count)]),
  );
  const itemCountByMaterial = new Map(
    collectionItemCounts.flatMap((row) =>
      row.materialId === null
        ? []
        : [[row.materialId, Number(row.count)] as const],
    ),
  );
  return materials.map((material) => ({
    ...material,
    collectionItemCount: itemCountByMaterial.get(material.id) ?? 0,
    leadImage: firstImageByMaterial.get(material.id) ?? null,
    productCount: productCountByMaterial.get(material.id) ?? 0,
  }));
}

/**
 * Builds privacy and moderation fields for a visibility update.
 *
 * @param input - Visibility, actor ownership, moderation state, and reason.
 * @returns Visibility, ownership, and moderation fields to persist.
 */
function privacyUpdate(input: {
  /**
   * Actor Clerk user identifier.
   */
  actorClerkId: string;
  /**
   * Actor is moderating.
   */
  actorIsModerating: boolean;
  /**
   * Whether the record is private.
   */
  isPrivate: boolean;
  /**
   * Administrative reason for the operation.
   */
  reason?: string;
  /** Whether this visibility change also represents a meaningful content update. */
  touchUpdatedAt?: boolean;
}) {
  return input.isPrivate
    ? {
        isPrivate: true,
        privateReason: input.actorIsModerating ? input.reason?.trim() : "",
        privatedAt: new Date(),
        privatedByClerkId: input.actorClerkId,
        ...(input.touchUpdatedAt === false ? {} : { updatedAt: new Date() }),
      }
    : {
        isPrivate: false,
        privateReason: null,
        privatedAt: null,
        privatedByClerkId: null,
        ...(input.touchUpdatedAt === false ? {} : { updatedAt: new Date() }),
      };
}

/**
 * Soft-deletes catalog image.
 *
 * @param db - Application database.
 * @param input - Actor, image identifier, and image target type.
 * @returns `true` after deletion, or `false` when the image was already deleted.
 * @rejects When authorization or a database query or update fails.
 */
async function softDeleteCatalogImage(
  db: Pick<Database, "select" | "update">,
  input: {
    /**
     * Authenticated actor.
     */
    actor: Actor;
    /**
     * Image identifier.
     */
    imageId: number;
    /**
     * Target type.
     */
    targetType: CatalogImageTargetType;
  },
) {
  const deletedAt = new Date();
  if (input.targetType === "material") {
    if (!hasPermission(input.actor, "products.manage"))
      throw new Error("Image does not exist.");
    const [image] = await db
      .select({ deletedAt: schema.materialImage.deletedAt })
      .from(schema.materialImage)
      .where(eq(schema.materialImage.id, input.imageId))
      .limit(1);
    if (!image) throw new Error("Image does not exist.");
    if (image.deletedAt) return false;
    await db
      .update(schema.materialImage)
      .set({
        deletedAt,
        deletedByClerkId: input.actor.clerkId,
        deletedByRole: "admin",
      })
      .where(eq(schema.materialImage.id, input.imageId));
    return true;
  }
  if (input.targetType === "maker") {
    if (!hasPermission(input.actor, "products.manage"))
      throw new Error("Image does not exist.");
    const [image] = await db
      .select({ deletedAt: schema.makerImage.deletedAt })
      .from(schema.makerImage)
      .where(eq(schema.makerImage.id, input.imageId))
      .limit(1);
    if (!image) throw new Error("Image does not exist.");
    if (image.deletedAt) return false;
    await db
      .update(schema.makerImage)
      .set({
        deletedAt,
        deletedByClerkId: input.actor.clerkId,
        deletedByRole: "admin",
      })
      .where(eq(schema.makerImage.id, input.imageId));
    return true;
  }
  if (input.targetType === "product") {
    const canManage = hasPermission(input.actor, "products.manage");
    const [image] = await db
      .select({
        deletedAt: schema.productImage.deletedAt,
        ownerClerkId: schema.product.ownerClerkId,
        productId: schema.product.id,
      })
      .from(schema.productImage)
      .innerJoin(
        schema.product,
        eq(schema.productImage.productId, schema.product.id),
      )
      .where(eq(schema.productImage.id, input.imageId))
      .limit(1);
    if (!image || (image.ownerClerkId !== input.actor.clerkId && !canManage))
      throw new Error("Image does not exist.");
    if (image.deletedAt) return false;
    const actorIsModerating =
      canManage && image.ownerClerkId !== input.actor.clerkId;
    await db
      .update(schema.productImage)
      .set({
        deletedAt,
        deletedByClerkId: input.actor.clerkId,
        deletedByRole: actorIsModerating ? "admin" : "owner",
      })
      .where(eq(schema.productImage.id, input.imageId));
    await db
      .update(schema.product)
      .set({ updatedAt: deletedAt })
      .where(eq(schema.product.id, image.productId));
    return true;
  }
  const [image] = await db
    .select({
      deletedAt: schema.collectionItemImage.deletedAt,
      ownerClerkId: schema.user.clerkId,
    })
    .from(schema.collectionItemImage)
    .innerJoin(
      schema.collectionItem,
      eq(schema.collectionItemImage.collectionItemId, schema.collectionItem.id),
    )
    .innerJoin(schema.user, eq(schema.collectionItem.ownerId, schema.user.id))
    .where(eq(schema.collectionItemImage.id, input.imageId))
    .limit(1);
  const canManage = hasPermission(input.actor, "collections.manage");
  if (!image || (image.ownerClerkId !== input.actor.clerkId && !canManage))
    throw new Error("Image does not exist.");
  if (image.deletedAt) return false;
  const actorIsModerating =
    canManage && image.ownerClerkId !== input.actor.clerkId;
  await db
    .update(schema.collectionItemImage)
    .set({
      deletedAt,
      deletedByClerkId: input.actor.clerkId,
      deletedByRole: actorIsModerating ? "admin" : "owner",
    })
    .where(eq(schema.collectionItemImage.id, input.imageId));
  return true;
}

/**
 * Restores catalog image.
 *
 * @param db - Application database.
 * @param input - Actor, image identifier, and image target type.
 * @rejects When authorization or a database query or update fails.
 */
async function restoreCatalogImage(
  db: Pick<Database, "select" | "update">,
  input: {
    /**
     * Authenticated actor.
     */
    actor: Actor;
    /**
     * Image identifier.
     */
    imageId: number;
    /**
     * Target type.
     */
    targetType: CatalogImageTargetType;
  },
) {
  if (input.targetType === "material") {
    if (!hasPermission(input.actor, "products.manage"))
      throw new Error("Image does not exist.");
    const [image] = await db
      .select({ id: schema.materialImage.id })
      .from(schema.materialImage)
      .where(
        and(
          eq(schema.materialImage.id, input.imageId),
          isNotNull(schema.materialImage.deletedAt),
        ),
      )
      .limit(1);
    if (!image) throw new Error("Image does not exist.");
    await db
      .update(schema.materialImage)
      .set({ deletedAt: null, deletedByClerkId: null, deletedByRole: null })
      .where(eq(schema.materialImage.id, input.imageId));
    return;
  }
  if (input.targetType === "maker") {
    const [image] = await db
      .select({
        deletedByClerkId: schema.makerImage.deletedByClerkId,
        deletedByRole: schema.makerImage.deletedByRole,
        ownerClerkId: sql<string | null>`null`,
      })
      .from(schema.makerImage)
      .where(
        and(
          eq(schema.makerImage.id, input.imageId),
          isNotNull(schema.makerImage.deletedAt),
        ),
      )
      .limit(1);
    assertCanRestoreImage(image, input.actor, "products.manage");
    await db
      .update(schema.makerImage)
      .set({ deletedAt: null, deletedByClerkId: null, deletedByRole: null })
      .where(eq(schema.makerImage.id, input.imageId));
    return;
  }
  if (input.targetType === "product") {
    const [image] = await db
      .select({
        deletedByClerkId: schema.productImage.deletedByClerkId,
        deletedByRole: schema.productImage.deletedByRole,
        ownerClerkId: schema.product.ownerClerkId,
        productId: schema.product.id,
      })
      .from(schema.productImage)
      .innerJoin(
        schema.product,
        eq(schema.productImage.productId, schema.product.id),
      )
      .where(
        and(
          eq(schema.productImage.id, input.imageId),
          isNotNull(schema.productImage.deletedAt),
        ),
      )
      .limit(1);
    if (!image) throw new Error("Image does not exist.");
    assertCanRestoreImage(image, input.actor, "products.manage");
    await db
      .update(schema.productImage)
      .set({ deletedAt: null, deletedByClerkId: null, deletedByRole: null })
      .where(eq(schema.productImage.id, input.imageId));
    await db
      .update(schema.product)
      .set({ updatedAt: new Date() })
      .where(eq(schema.product.id, image.productId));
    return;
  }
  const [image] = await db
    .select({
      deletedByClerkId: schema.collectionItemImage.deletedByClerkId,
      deletedByRole: schema.collectionItemImage.deletedByRole,
      ownerClerkId: schema.user.clerkId,
    })
    .from(schema.collectionItemImage)
    .innerJoin(
      schema.collectionItem,
      eq(schema.collectionItemImage.collectionItemId, schema.collectionItem.id),
    )
    .innerJoin(schema.user, eq(schema.collectionItem.ownerId, schema.user.id))
    .where(
      and(
        eq(schema.collectionItemImage.id, input.imageId),
        isNotNull(schema.collectionItemImage.deletedAt),
      ),
    )
    .limit(1);
  assertCanRestoreImage(image, input.actor, "collections.manage");
  await db
    .update(schema.collectionItemImage)
    .set({ deletedAt: null, deletedByClerkId: null, deletedByRole: null })
    .where(eq(schema.collectionItemImage.id, input.imageId));
}

/**
 * Verifies that an actor may restore a deleted image.
 *
 * @param image - Image.
 * @param actor - Authenticated actor.
 * @param permission - Permission.
 * @throws When the image is missing or inaccessible to the actor.
 */
function assertCanRestoreImage(
  image:
    | {
        /**
         * Deleted by Clerk user identifier.
         */
        deletedByClerkId: string | null;
        /**
         * Deleted by role.
         */
        deletedByRole: "admin" | "owner" | null;
        /**
         * Owner Clerk user identifier.
         */
        ownerClerkId: string | null;
      }
    | undefined,
  actor: Actor,
  permission: "products.manage" | "collections.manage",
) {
  const isOwner = image?.ownerClerkId === actor.clerkId;
  const actorIsModerating = hasPermission(actor, permission) && !isOwner;
  if (
    !image ||
    (!actorIsModerating &&
      (!isOwner ||
        image.deletedByRole === "admin" ||
        image.deletedByClerkId !== actor.clerkId))
  ) {
    throw new Error("Image does not exist.");
  }
}

/**
 * Lists catalog image trash.
 *
 * @param db - Application database.
 * @param input - Actor whose visible deleted images should be returned.
 * @returns Matching catalog image trash.
 * @rejects When the required catalog data cannot be queried.
 */
async function listCatalogImageTrash(
  db: Database,
  input: {
    /**
     * Authenticated actor.
     */
    actor: Actor;
  },
): Promise<CatalogImageTrashItem[]> {
  const { actor } = input;
  const [materials, makers, products, collectionItems] = await Promise.all([
    db
      .select({
        contentType: schema.materialImage.contentType,
        createdAt: schema.materialImage.createdAt,
        deletedAt: schema.materialImage.deletedAt,
        deletedByClerkId: schema.materialImage.deletedByClerkId,
        deletedByRole: schema.materialImage.deletedByRole,
        fileName: schema.materialImage.fileName,
        id: schema.materialImage.id,
        objectPath: schema.materialImage.objectPath,
        ownerClerkId: sql<string | null>`null`,
        position: schema.materialImage.position,
        size: schema.materialImage.size,
        targetId: schema.material.id,
        targetName: schema.material.name,
        url: schema.materialImage.url,
      })
      .from(schema.materialImage)
      .innerJoin(
        schema.material,
        eq(schema.materialImage.materialId, schema.material.id),
      )
      .where(
        and(
          isNotNull(schema.materialImage.deletedAt),
          hasPermission(actor, "products.manage") ? undefined : sql`false`,
        ),
      ),
    hasPermission(actor, "products.manage")
      ? db
          .select({
            contentType: schema.makerImage.contentType,
            createdAt: schema.makerImage.createdAt,
            deletedAt: schema.makerImage.deletedAt,
            deletedByClerkId: schema.makerImage.deletedByClerkId,
            deletedByRole: schema.makerImage.deletedByRole,
            fileName: schema.makerImage.fileName,
            id: schema.makerImage.id,
            objectPath: schema.makerImage.objectPath,
            ownerClerkId: sql<string | null>`null`,
            position: schema.makerImage.position,
            size: schema.makerImage.size,
            targetId: schema.maker.id,
            targetName: schema.maker.name,
            url: schema.makerImage.url,
          })
          .from(schema.makerImage)
          .innerJoin(
            schema.maker,
            eq(schema.makerImage.makerId, schema.maker.id),
          )
          .where(isNotNull(schema.makerImage.deletedAt))
      : Promise.resolve([]),
    db
      .select({
        contentType: schema.productImage.contentType,
        createdAt: schema.productImage.createdAt,
        deletedAt: schema.productImage.deletedAt,
        deletedByClerkId: schema.productImage.deletedByClerkId,
        deletedByRole: schema.productImage.deletedByRole,
        fileName: schema.productImage.fileName,
        id: schema.productImage.id,
        objectPath: schema.productImage.objectPath,
        ownerClerkId: schema.product.ownerClerkId,
        position: schema.productImage.position,
        size: schema.productImage.size,
        targetId: schema.product.id,
        targetName: schema.product.name,
        url: schema.productImage.url,
      })
      .from(schema.productImage)
      .innerJoin(
        schema.product,
        eq(schema.productImage.productId, schema.product.id),
      )
      .where(
        and(
          isNotNull(schema.productImage.deletedAt),
          hasPermission(actor, "products.manage")
            ? undefined
            : and(
                eq(schema.product.ownerClerkId, actor.clerkId),
                eq(schema.productImage.deletedByRole, "owner"),
                eq(schema.productImage.deletedByClerkId, actor.clerkId),
              ),
        ),
      ),
    db
      .select({
        contentType: schema.collectionItemImage.contentType,
        createdAt: schema.collectionItemImage.createdAt,
        deletedAt: schema.collectionItemImage.deletedAt,
        deletedByClerkId: schema.collectionItemImage.deletedByClerkId,
        deletedByRole: schema.collectionItemImage.deletedByRole,
        fileName: schema.collectionItemImage.fileName,
        id: schema.collectionItemImage.id,
        objectPath: schema.collectionItemImage.objectPath,
        ownerClerkId: schema.user.clerkId,
        position: schema.collectionItemImage.position,
        size: schema.collectionItemImage.size,
        targetId: schema.collectionItem.id,
        targetName: schema.product.name,
        url: schema.collectionItemImage.url,
      })
      .from(schema.collectionItemImage)
      .innerJoin(
        schema.collectionItem,
        eq(
          schema.collectionItemImage.collectionItemId,
          schema.collectionItem.id,
        ),
      )
      .innerJoin(schema.user, eq(schema.collectionItem.ownerId, schema.user.id))
      .leftJoin(
        schema.collectionSpinner,
        eq(schema.collectionItem.id, schema.collectionSpinner.id),
      )
      .leftJoin(
        schema.collectionSpinnerButton,
        eq(schema.collectionItem.id, schema.collectionSpinnerButton.id),
      )
      .innerJoin(
        schema.product,
        eq(
          schema.product.id,
          sql`coalesce(${schema.collectionSpinner.productSpinnerId}, ${schema.collectionSpinnerButton.productSpinnerButtonId})`,
        ),
      )
      .where(
        and(
          isNotNull(schema.collectionItemImage.deletedAt),
          hasPermission(actor, "collections.manage")
            ? undefined
            : and(
                eq(schema.user.clerkId, actor.clerkId),
                eq(schema.collectionItemImage.deletedByRole, "owner"),
                eq(schema.collectionItemImage.deletedByClerkId, actor.clerkId),
              ),
        ),
      ),
  ]);
  return [
    ...materials.map((image) => ({
      ...image,
      targetType: "material" as const,
    })),
    ...makers.map((image) => ({ ...image, targetType: "maker" as const })),
    ...products.map((image) => ({ ...image, targetType: "product" as const })),
    ...collectionItems.map((image) => ({
      ...image,
      targetType: "collection_item" as const,
    })),
  ].sort(
    (a, b) => (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0),
  );
}

/**
 * Caller-owned database transaction used for atomic catalog writes.
 */
type CatalogTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Marks a catalog product as meaningfully updated inside its caller transaction.
 *
 * @param tx - Caller-owned catalog transaction.
 * @param productId - Product whose public content changed.
 * @rejects When the canonical product timestamp cannot be updated.
 */
async function touchProductUpdatedAt(
  tx: CatalogTransaction,
  productId: number,
) {
  await tx
    .update(schema.product)
    .set({ updatedAt: new Date() })
    .where(eq(schema.product.id, productId));
}

/** Normalized exact setup ready for atomic replacement. */
type NormalizedBodyHostedMagnetSetup = CatalogBodyHostedMagnetSetup;

/**
 * Replaces the inherent body-hosted setup while preserving undocumented facts as nulls.
 *
 * @param tx - Caller-owned product transaction.
 * @param productId - Slider product identifier.
 * @param input - Product write carrying the candidate setup.
 * @param creating - Whether this is the initial product write.
 * @rejects When setup facts are invalid for the product or cannot be persisted.
 */
async function replaceBodyHostedMagnetSetup(
  tx: CatalogTransaction,
  productId: number,
  input: ProductWriteInput,
  creating: boolean,
) {
  if (input.bodyHostedMagnetSetup === undefined && !creating) return;
  if (
    input.bodyHostedMagnetSetup !== null &&
    input.bodyHostedMagnetSetup !== undefined &&
    (input.productTypeSlug !== "slider" ||
      input.specs.magnetSystem !== "body-hosted")
  ) {
    throw new Error("Only body-hosted sliders may define an inherent setup.");
  }
  if (input.productTypeSlug !== "slider") return;
  const normalized = normalizeBodyHostedMagnetSetup(
    input.specs.magnetSystem === "body-hosted"
      ? (input.bodyHostedMagnetSetup ?? null)
      : null,
  );
  await tx
    .update(schema.productSlider)
    .set({
      inherentClickCount: normalized?.clickCount ?? null,
      magnetSetupSourceNote: normalized?.sourceNote ?? null,
    })
    .where(eq(schema.productSlider.id, productId));
  await tx
    .delete(schema.productMagnetConfiguration)
    .where(eq(schema.productMagnetConfiguration.productId, productId));
  const configuration = normalized?.configuration;
  if (!configuration) return;

  const configurationLabelId = await getOrCreateMagnetConfigurationLabel(
    tx,
    configuration.label,
  );
  await tx.insert(schema.productMagnetConfiguration).values({
    configurationLabelId,
    productId,
    sourceLabel: configuration.sourceLabel,
    sourceNotes: configuration.sourceNotes,
  });
  const groupsByKey = new Map<string, number>();
  for (const [displayOrder, group] of configuration.groups.entries()) {
    const groupLabelId = await getOrCreateMagnetGroupLabel(tx, group.label);
    const [created] = await tx
      .insert(schema.productMagnetGroup)
      .values({
        configurationProductId: productId,
        diameterMm: group.diameterMm,
        displayOrder,
        grade: group.grade,
        groupKey: group.key,
        groupLabelId,
        thicknessMm: group.thicknessMm,
      })
      .returning({ id: schema.productMagnetGroup.id });
    if (!created) throw new Error("Failed to create magnet group.");
    groupsByKey.set(group.key, created.id);
  }
  await tx.insert(schema.productMagnetSlot).values(
    configuration.slots.map((slot, displayOrder) => ({
      configurationProductId: productId,
      displayOrder,
      documentedColumn: slot.documentedColumn,
      documentedRow: slot.documentedRow,
      groupId: slot.groupKey ? (groupsByKey.get(slot.groupKey) ?? null) : null,
      half: slot.half,
      slotKey: slot.key,
      state: slot.state,
    })),
  );
}

/**
 * Replaces insert-owned click counts and exact offers while retaining stable IDs.
 *
 * @param tx - Caller-owned product transaction.
 * @param productId - Exact insert host product identifier.
 * @param input - Product write containing insert-hosted options.
 * @param creating - Whether this is the initial product write.
 * @rejects When authorization, validation, or persistence fails.
 */
async function replaceInsertHostedMagnetOptions(
  tx: CatalogTransaction,
  productId: number,
  input: ProductWriteInput,
  creating: boolean,
) {
  if (input.insertHostedMagnetOptions === undefined && !creating) return;
  const candidate = input.insertHostedMagnetOptions ?? {
    clickCounts: [],
    offers: [],
  };
  if (
    input.productTypeSlug !== "slider-insert" &&
    (candidate.clickCounts.length || candidate.offers.length)
  ) {
    throw new Error("Only slider inserts may define insert-hosted options.");
  }
  if (input.productTypeSlug !== "slider-insert") return;

  const clickCounts = candidate.clickCounts.map((clickCount) => {
    if (!Number.isSafeInteger(clickCount) || clickCount <= 0)
      throw new Error("Click count must be a positive integer.");
    return clickCount;
  });
  if (new Set(clickCounts).size !== clickCounts.length)
    throw new Error("Insert click counts must be unique.");
  if (
    candidate.offers.filter(({ isAdvertisedDefault }) => isAdvertisedDefault)
      .length > 1
  )
    throw new Error("An insert may have at most one advertised default.");

  const currentOptions = await tx
    .select({
      clickCount: schema.productInsertClickOption.clickCount,
      id: schema.productInsertClickOption.id,
      insertionPosition: schema.productInsertClickOption.insertionPosition,
    })
    .from(schema.productInsertClickOption)
    .where(eq(schema.productInsertClickOption.insertProductId, productId));
  const optionByCount = new Map(
    currentOptions.map((option) => [option.clickCount, option]),
  );
  let nextPosition =
    Math.max(
      -1,
      ...currentOptions.map(({ insertionPosition }) => insertionPosition),
    ) + 1;
  for (const clickCount of clickCounts) {
    if (optionByCount.has(clickCount)) continue;
    const [created] = await tx
      .insert(schema.productInsertClickOption)
      .values({
        clickCount,
        insertionPosition: nextPosition,
        insertProductId: productId,
      })
      .returning({
        clickCount: schema.productInsertClickOption.clickCount,
        id: schema.productInsertClickOption.id,
        insertionPosition: schema.productInsertClickOption.insertionPosition,
      });
    if (!created) throw new Error("Failed to create insert click option.");
    optionByCount.set(clickCount, created);
    nextPosition += 1;
  }

  const currentOffers = await tx
    .select({ id: schema.productInsertMagnetOffer.id })
    .from(schema.productInsertMagnetOffer)
    .where(eq(schema.productInsertMagnetOffer.insertProductId, productId));
  const currentOfferIds = new Set(currentOffers.map(({ id }) => id));
  const submittedIds = candidate.offers.flatMap(({ id }) =>
    id === undefined ? [] : [id],
  );
  if (
    new Set(submittedIds).size !== submittedIds.length ||
    submittedIds.some((id) => !currentOfferIds.has(id))
  ) {
    throw new Error("Insert offer does not belong to this product.");
  }
  const removedOfferIds = [...currentOfferIds].filter(
    (id) => !submittedIds.includes(id),
  );
  if (removedOfferIds.length) {
    await tx
      .delete(schema.productInsertMagnetOffer)
      .where(inArray(schema.productInsertMagnetOffer.id, removedOfferIds));
  }
  if (currentOfferIds.size) {
    await tx
      .update(schema.productInsertMagnetOffer)
      .set({ isAdvertisedDefault: false })
      .where(eq(schema.productInsertMagnetOffer.insertProductId, productId));
  }

  for (const offer of candidate.offers) {
    if (offer.clickCount !== null && !clickCounts.includes(offer.clickCount))
      throw new Error("Offer click count must belong to the same insert.");
    const configuration = normalizeCatalogMagnetConfiguration(
      offer.configuration,
    );
    const copiedFromTemplateId = offer.copiedFromTemplateId ?? null;
    if (copiedFromTemplateId !== null) {
      if (!hasPermission(input.actor, "products.manage"))
        throw new Error("Product does not exist.");
      const [template] = await tx
        .select({
          compatibilityFamilyId:
            schema.magnetConfigurationTemplate.compatibilityFamilyId,
          id: schema.magnetConfigurationTemplate.id,
          makerId: schema.magnetConfigurationTemplate.makerId,
          scope: schema.magnetConfigurationTemplate.scope,
        })
        .from(schema.magnetConfigurationTemplate)
        .where(eq(schema.magnetConfigurationTemplate.id, copiedFromTemplateId))
        .limit(1);
      if (!template)
        throw new Error("Magnet configuration template does not exist.");
      if (
        (template.scope === "maker" && template.makerId !== input.makerId) ||
        (template.scope === "family" &&
          !input.compatibilityFamilyIds?.includes(
            template.compatibilityFamilyId ?? 0,
          ))
      ) {
        throw new Error(
          "Magnet configuration template is outside this product scope.",
        );
      }
    }
    const configurationLabelId = await getOrCreateMagnetConfigurationLabel(
      tx,
      configuration.label,
    );
    const clickOptionId =
      offer.clickCount === null
        ? null
        : (optionByCount.get(offer.clickCount)?.id ?? null);
    let offerId = offer.id;
    if (offerId === undefined) {
      const [created] = await tx
        .insert(schema.productInsertMagnetOffer)
        .values({
          clickOptionId,
          configurationLabelId,
          copiedFromTemplateId,
          insertProductId: productId,
          isAdvertisedDefault: offer.isAdvertisedDefault,
          sourceLabel: configuration.sourceLabel,
          sourceNotes: configuration.sourceNotes,
        })
        .returning({ id: schema.productInsertMagnetOffer.id });
      if (!created) throw new Error("Failed to create insert offer.");
      offerId = created.id;
    } else {
      await tx
        .update(schema.productInsertMagnetOffer)
        .set({
          clickOptionId,
          configurationLabelId,
          copiedFromTemplateId,
          isAdvertisedDefault: offer.isAdvertisedDefault,
          sourceLabel: configuration.sourceLabel,
          sourceNotes: configuration.sourceNotes,
          updatedAt: new Date(),
        })
        .where(eq(schema.productInsertMagnetOffer.id, offerId));
      await tx
        .delete(schema.productInsertMagnetSlot)
        .where(eq(schema.productInsertMagnetSlot.offerId, offerId));
      await tx
        .delete(schema.productInsertMagnetGroup)
        .where(eq(schema.productInsertMagnetGroup.offerId, offerId));
    }
    const groupsByKey = new Map<string, number>();
    for (const [displayOrder, group] of configuration.groups.entries()) {
      const groupLabelId = await getOrCreateMagnetGroupLabel(tx, group.label);
      const [created] = await tx
        .insert(schema.productInsertMagnetGroup)
        .values({
          diameterMm: group.diameterMm,
          displayOrder,
          grade: group.grade,
          groupKey: group.key,
          groupLabelId,
          offerId,
          thicknessMm: group.thicknessMm,
        })
        .returning({ id: schema.productInsertMagnetGroup.id });
      if (!created) throw new Error("Failed to create insert magnet group.");
      groupsByKey.set(group.key, created.id);
    }
    await tx.insert(schema.productInsertMagnetSlot).values(
      configuration.slots.map((slot, displayOrder) => ({
        displayOrder,
        documentedColumn: slot.documentedColumn,
        documentedRow: slot.documentedRow,
        groupId: slot.groupKey
          ? (groupsByKey.get(slot.groupKey) ?? null)
          : null,
        half: slot.half,
        offerId,
        slotKey: slot.key,
        state: slot.state,
      })),
    );
  }
  const removedOptionIds = currentOptions
    .filter(({ clickCount }) => !clickCounts.includes(clickCount))
    .map(({ id }) => id);
  if (removedOptionIds.length) {
    await tx
      .delete(schema.productInsertClickOption)
      .where(inArray(schema.productInsertClickOption.id, removedOptionIds));
  }
}

/**
 * Replaces exact insert-offer merchandising for one insert-driven slider.
 *
 * @param tx - Caller-owned product transaction.
 * @param productId - Insert-driven slider product identifier.
 * @param input - Product write containing exact offer associations.
 * @param creating - Whether this is the initial product write.
 * @rejects When associations are invalid or cannot be persisted.
 */
async function replaceSliderInsertOffers(
  tx: CatalogTransaction,
  productId: number,
  input: ProductWriteInput,
  creating: boolean,
) {
  if (input.advertisedInsertOffers === undefined && !creating) {
    if (
      input.productTypeSlug !== "slider" ||
      input.specs.magnetSystem === "insert-driven"
    ) {
      return;
    }
    await tx
      .delete(schema.productSliderInsertOffer)
      .where(eq(schema.productSliderInsertOffer.sliderProductId, productId));
    return;
  }
  const associations = input.advertisedInsertOffers ?? [];
  if (
    associations.length &&
    (input.productTypeSlug !== "slider" ||
      input.specs.magnetSystem !== "insert-driven")
  ) {
    throw new Error("Only insert-driven sliders may advertise insert offers.");
  }
  if (input.productTypeSlug !== "slider") return;
  if (
    new Set(associations.map(({ offerId }) => offerId)).size !==
    associations.length
  )
    throw new Error("Duplicate slider insert offers are not allowed.");
  if (
    associations.length &&
    associations.filter(({ isAdvertisedDefault }) => isAdvertisedDefault)
      .length !== 1
  ) {
    throw new Error(
      "A slider with insert offers requires exactly one advertised default.",
    );
  }
  const offers = associations.length
    ? await tx
        .select({
          id: schema.productInsertMagnetOffer.id,
          insertProductId: schema.productInsertMagnetOffer.insertProductId,
        })
        .from(schema.productInsertMagnetOffer)
        .where(
          inArray(
            schema.productInsertMagnetOffer.id,
            associations.map(({ offerId }) => offerId),
          ),
        )
    : [];
  if (offers.length !== associations.length)
    throw new Error("Insert offer does not exist.");
  await tx
    .delete(schema.productSliderInsertOffer)
    .where(eq(schema.productSliderInsertOffer.sliderProductId, productId));
  if (associations.length) {
    const byId = new Map(offers.map((offer) => [offer.id, offer]));
    await tx.insert(schema.productSliderInsertOffer).values(
      associations.map((association) => ({
        insertOfferId: association.offerId,
        insertProductId: byId.get(association.offerId)?.insertProductId ?? 0,
        isAdvertisedDefault: association.isAdvertisedDefault,
        sliderProductId: productId,
      })),
    );
  }
}

/**
 * Validates and normalizes one body-hosted setup without inventing missing facts.
 *
 * @param setup - Candidate setup or undocumented state.
 * @returns Normalized setup suitable for persistence.
 * @throws When a catalog configuration is incomplete or internally inconsistent.
 */
function normalizeBodyHostedMagnetSetup(
  setup: CatalogBodyHostedMagnetSetup | null,
): NormalizedBodyHostedMagnetSetup | null {
  if (!setup) return null;
  const clickCount = setup.clickCount;
  if (
    clickCount !== null &&
    (!Number.isSafeInteger(clickCount) || clickCount <= 0)
  ) {
    throw new Error("Click count must be a positive integer.");
  }
  const sourceNote = normalizeBoundedText(setup.sourceNote, 5000);
  if (!setup.configuration) {
    return { clickCount, configuration: null, sourceNote };
  }
  return {
    clickCount,
    configuration: normalizeCatalogMagnetConfiguration(setup.configuration),
    sourceNote,
  };
}

/**
 * Validates one complete exact catalog magnet layout.
 *
 * @param configuration - Candidate exact configuration.
 * @returns Normalized complete catalog configuration.
 * @throws When the configuration is incomplete or internally inconsistent.
 */
function normalizeCatalogMagnetConfiguration(
  configuration: CatalogMagnetConfiguration,
): CatalogMagnetConfiguration {
  const label = normalizeRequiredVocabulary(configuration.label);
  const sourceLabel = normalizeBoundedText(configuration.sourceLabel, 200);
  const sourceNotes = normalizeBoundedText(configuration.sourceNotes, 5000);
  if (!configuration.slots.length)
    throw new Error("A structured magnet configuration requires slots.");

  const groupKeys = new Set<string>();
  const referencedGroupKeys = new Set<string>();
  const groups = configuration.groups.map((candidate) => {
    const key = normalizeStableKey(candidate.key);
    if (groupKeys.has(key))
      throw new Error("Magnet group keys must be unique.");
    groupKeys.add(key);
    return {
      diameterMm: normalizePositiveDecimal(candidate.diameterMm),
      grade: normalizeMagnetGrade(candidate.grade),
      key,
      label: normalizeRequiredVocabulary(candidate.label),
      thicknessMm: normalizePositiveDecimal(candidate.thicknessMm),
    };
  });
  const slotKeys = new Set<string>();
  const slots = configuration.slots.map((candidate) => {
    const key = normalizeStableKey(candidate.key);
    if (slotKeys.has(key)) throw new Error("Magnet slot keys must be unique.");
    slotKeys.add(key);
    if (candidate.half !== "half-a" && candidate.half !== "half-b")
      throw new Error("A magnet slot requires Half A or Half B.");
    if (candidate.state !== "occupied" && candidate.state !== "empty")
      throw new Error("Catalog magnet slots cannot be unknown.");
    const groupKey = candidate.groupKey
      ? normalizeStableKey(candidate.groupKey)
      : null;
    if (candidate.state === "occupied" && !groupKey)
      throw new Error("An occupied magnet slot requires a group.");
    if (candidate.state === "empty" && groupKey)
      throw new Error("An empty magnet slot cannot belong to a group.");
    if (groupKey && !groupKeys.has(groupKey))
      throw new Error("Magnet group does not belong to this configuration.");
    if (groupKey) referencedGroupKeys.add(groupKey);
    return {
      documentedColumn: normalizeDocumentedPosition(candidate.documentedColumn),
      documentedRow: normalizeDocumentedPosition(candidate.documentedRow),
      groupKey,
      half: candidate.half,
      key,
      state: candidate.state,
    };
  });
  if (groups.some(({ key }) => !referencedGroupKeys.has(key)))
    throw new Error("Every magnet group must contain an occupied slot.");
  return { groups, label, slots, sourceLabel, sourceNotes };
}

/**
 * Returns a trimmed optional string while enforcing its storage bound.
 *
 * @param value - Candidate optional text.
 * @param maximum - Maximum stored character count.
 * @returns Trimmed text or `null`.
 * @throws When nonblank text exceeds the storage bound.
 */
function normalizeBoundedText(value: string | null, maximum: number) {
  const normalized = value?.trim() || null;
  if (normalized && normalized.length > maximum)
    throw new Error("Magnet setup text is too long.");
  return normalized;
}

/**
 * Returns one nonblank stable source key.
 *
 * @param value - Candidate key.
 * @returns Trimmed stable key.
 * @throws When the key is blank or too long.
 */
function normalizeStableKey(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 100)
    throw new Error("Magnet setup key is invalid.");
  return normalized;
}

/**
 * Returns one normalized global vocabulary name.
 *
 * @param value - Candidate vocabulary label.
 * @returns Unicode-normalized, whitespace-collapsed label.
 * @throws When the label is blank or too long.
 */
function normalizeRequiredVocabulary(value: string) {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > 100)
    throw new Error("Magnet vocabulary label is invalid.");
  return normalized;
}

/**
 * Returns a positive arbitrary-precision decimal string.
 *
 * @param value - Candidate metric dimension.
 * @returns Validated decimal text without reducing precision.
 * @throws When the dimension is not a positive plain decimal.
 */
function normalizePositiveDecimal(value: string) {
  const normalized = value.trim();
  if (
    normalized.length > 50 ||
    !/^\d+(?:\.\d+)?$/.test(normalized) ||
    !Number.isFinite(Number(normalized)) ||
    Number(normalized) <= 0
  ) {
    throw new Error("Magnet dimensions must be positive decimals.");
  }
  return normalized;
}

/**
 * Returns normalized conservative magnet grade text.
 *
 * @param value - Candidate magnet grade.
 * @returns Trimmed uppercase grade.
 * @throws When the grade contains unsupported characters or length.
 */
function normalizeMagnetGrade(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9+_-]{0,19}$/.test(normalized))
    throw new Error("Magnet grade is invalid.");
  return normalized;
}

/**
 * Returns a positive source-documented row or column.
 *
 * @param value - Candidate documented position.
 * @returns Positive integer or `null` when undocumented.
 * @throws When a documented position is not a positive safe integer.
 */
function normalizeDocumentedPosition(value: number | null) {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error("Documented magnet positions must be positive integers.");
  return value;
}

/**
 * Creates or reuses one global configuration vocabulary row.
 *
 * @param tx - Caller-owned product transaction.
 * @param name - Normalized display label.
 * @returns Global configuration-label identifier.
 * @rejects When the vocabulary row cannot be written or loaded.
 */
async function getOrCreateMagnetConfigurationLabel(
  tx: CatalogTransaction,
  name: string,
) {
  const normalizedName = name.toLocaleLowerCase("en-US");
  const [created] = await tx
    .insert(schema.magnetConfigurationLabel)
    .values({ name, normalizedName })
    .onConflictDoNothing({
      target: schema.magnetConfigurationLabel.normalizedName,
    })
    .returning({ id: schema.magnetConfigurationLabel.id });
  if (created) return created.id;
  const [existing] = await tx
    .select({ id: schema.magnetConfigurationLabel.id })
    .from(schema.magnetConfigurationLabel)
    .where(eq(schema.magnetConfigurationLabel.normalizedName, normalizedName))
    .limit(1);
  if (!existing) throw new Error("Failed to load magnet configuration label.");
  return existing.id;
}

/**
 * Creates or reuses one global group vocabulary row.
 *
 * @param tx - Caller-owned product transaction.
 * @param name - Normalized display label.
 * @returns Global group-label identifier.
 * @rejects When the vocabulary row cannot be written or loaded.
 */
async function getOrCreateMagnetGroupLabel(
  tx: CatalogTransaction,
  name: string,
) {
  const normalizedName = name.toLocaleLowerCase("en-US");
  const [created] = await tx
    .insert(schema.magnetGroupLabel)
    .values({ name, normalizedName })
    .onConflictDoNothing({ target: schema.magnetGroupLabel.normalizedName })
    .returning({ id: schema.magnetGroupLabel.id });
  if (created) return created.id;
  const [existing] = await tx
    .select({ id: schema.magnetGroupLabel.id })
    .from(schema.magnetGroupLabel)
    .where(eq(schema.magnetGroupLabel.normalizedName, normalizedName))
    .limit(1);
  if (!existing) throw new Error("Failed to load magnet group label.");
  return existing.id;
}

/**
 * Inserts the subtype row required by one canonical product type.
 *
 * @param tx - Caller-owned product transaction.
 * @param productId - New product identifier.
 * @param productTypeSlug - Canonical product type.
 * @param specs - Type-specific product facts.
 * @rejects When required facts are missing, forbidden facts are present, or persistence fails.
 */
async function insertProductSubtype(
  tx: CatalogTransaction,
  productId: number,
  productTypeSlug: CatalogProductType,
  specs: ProductWriteInput["specs"],
) {
  switch (productTypeSlug) {
    case "spinner":
      assertNoSliderOnlySpecs(specs);
      await tx
        .insert(schema.productSpinner)
        .values({ id: productId, ...spinnerSpecs(specs) });
      return;
    case "spinner-button":
      assertNoSliderOnlySpecs(specs);
      await tx
        .insert(schema.productSpinnerButton)
        .values({ id: productId, ...buttonSpecs(specs) });
      return;
    case "slider":
      await tx
        .insert(schema.productSlider)
        .values({ id: productId, ...sliderSpecs(specs) });
      return;
    case "slider-plate":
      assertNoSliderOnlySpecs(specs);
      await tx
        .insert(schema.productSliderPlate)
        .values({ id: productId, ...sliderComponentSpecs(specs) });
      return;
    case "slider-insert":
      assertNoSliderOnlySpecs(specs);
      await tx
        .insert(schema.productSliderInsert)
        .values({ id: productId, ...sliderComponentSpecs(specs) });
  }
}

/**
 * Updates exactly the subtype row belonging to one product.
 *
 * @param tx - Caller-owned product transaction.
 * @param productId - Product identifier.
 * @param productTypeSlug - Canonical product type.
 * @param specs - Type-specific product facts.
 * @rejects When required facts are missing, forbidden facts are present, or persistence fails.
 */
async function updateProductSubtype(
  tx: CatalogTransaction,
  productId: number,
  productTypeSlug: CatalogProductType,
  specs: ProductWriteInput["specs"],
) {
  const updatedAt = new Date();
  switch (productTypeSlug) {
    case "spinner":
      assertNoSliderOnlySpecs(specs);
      await tx
        .update(schema.productSpinner)
        .set({ ...spinnerSpecs(specs), updatedAt })
        .where(eq(schema.productSpinner.id, productId));
      return;
    case "spinner-button":
      assertNoSliderOnlySpecs(specs);
      await tx
        .update(schema.productSpinnerButton)
        .set({ ...buttonSpecs(specs), updatedAt })
        .where(eq(schema.productSpinnerButton.id, productId));
      return;
    case "slider":
      await tx
        .update(schema.productSlider)
        .set({ ...sliderSpecs(specs), updatedAt })
        .where(eq(schema.productSlider.id, productId));
      return;
    case "slider-plate":
      assertNoSliderOnlySpecs(specs);
      await tx
        .update(schema.productSliderPlate)
        .set({ ...sliderComponentSpecs(specs), updatedAt })
        .where(eq(schema.productSliderPlate.id, productId));
      return;
    case "slider-insert":
      assertNoSliderOnlySpecs(specs);
      await tx
        .update(schema.productSliderInsert)
        .set({ ...sliderComponentSpecs(specs), updatedAt })
        .where(eq(schema.productSliderInsert.id, productId));
  }
}

/**
 * Replaces reviewed compatibility, advisory, and exact-inclusion relationships.
 *
 * @param tx - Caller-owned product transaction.
 * @param productId - Product identifier.
 * @param input - Product write containing replacement relationships.
 * @rejects When authorization, relationship validation, or persistence fails.
 */
async function replaceProductRelationships(
  tx: CatalogTransaction,
  productId: number,
  input: ProductWriteInput,
) {
  const familyIds = input.compatibilityFamilyIds ?? [];
  const componentIds = input.includedComponentIds ?? [];
  const advisories = input.compatibilityAdvisories ?? [];
  if (
    (familyIds.length || componentIds.length || advisories.length) &&
    !hasPermission(input.actor, "products.manage")
  ) {
    throw new Error("Product does not exist.");
  }
  if (new Set(familyIds).size !== familyIds.length)
    throw new Error("Duplicate compatibility families are not allowed.");
  if (new Set(componentIds).size !== componentIds.length)
    throw new Error("Duplicate included components are not allowed.");
  if (componentIds.length && input.productTypeSlug !== "slider")
    throw new Error("Only sliders may declare included slider components.");

  if (familyIds.length) {
    const families = await tx
      .select({ id: schema.compatibilityFamily.id })
      .from(schema.compatibilityFamily)
      .where(inArray(schema.compatibilityFamily.id, familyIds));
    if (families.length !== familyIds.length)
      throw new Error("Compatibility family does not exist.");
  }
  if (componentIds.length) {
    const components = await tx
      .select({ id: schema.product.id, type: schema.productType.slug })
      .from(schema.product)
      .innerJoin(
        schema.productType,
        eq(schema.product.productTypeId, schema.productType.id),
      )
      .where(inArray(schema.product.id, componentIds));
    if (
      components.length !== componentIds.length ||
      components.some(
        ({ type }) => type !== "slider-plate" && type !== "slider-insert",
      )
    ) {
      throw new Error("Included product must be a slider plate or insert.");
    }
  }

  const advisoryKeys = new Set<string>();
  for (const advisory of advisories) {
    const text = advisory.text.trim();
    if (!text || text.length > 1000)
      throw new Error("Compatibility advisory text is invalid.");
    if (advisory.relatedProductId === productId)
      throw new Error("A product cannot advise against itself.");
    const key = `${advisory.relatedProductId}:${text.toLocaleLowerCase()}`;
    if (advisoryKeys.has(key))
      throw new Error("Duplicate compatibility advisories are not allowed.");
    advisoryKeys.add(key);
  }
  if (advisories.length) {
    const relatedIds = [
      ...new Set(advisories.map(({ relatedProductId }) => relatedProductId)),
    ];
    const relatedProducts = await tx
      .select({ id: schema.product.id })
      .from(schema.product)
      .where(inArray(schema.product.id, relatedIds));
    if (relatedProducts.length !== relatedIds.length)
      throw new Error("Advisory product does not exist.");
  }

  await tx
    .delete(schema.productCompatibilityFamily)
    .where(eq(schema.productCompatibilityFamily.productId, productId));
  await tx
    .delete(schema.productCompatibilityAdvisory)
    .where(eq(schema.productCompatibilityAdvisory.productId, productId));
  await tx
    .delete(schema.productIncludedComponent)
    .where(eq(schema.productIncludedComponent.productId, productId));

  if (familyIds.length) {
    await tx.insert(schema.productCompatibilityFamily).values(
      familyIds.map((compatibilityFamilyId) => ({
        compatibilityFamilyId,
        productId,
        reviewedByClerkId: input.actor.clerkId,
      })),
    );
  }
  if (componentIds.length) {
    await tx.insert(schema.productIncludedComponent).values(
      componentIds.map((componentProductId) => ({
        componentProductId,
        productId,
      })),
    );
  }
  if (advisories.length) {
    await tx.insert(schema.productCompatibilityAdvisory).values(
      advisories.map(({ relatedProductId, text }) => ({
        productId,
        relatedProductId,
        reviewedByClerkId: input.actor.clerkId,
        text: text.trim(),
      })),
    );
  }
}

/**
 * Validates product material.
 *
 * @param tx - Caller-owned database transaction.
 * @param productId - Product identifier.
 * @param materialId - Material identifier.
 * @rejects When the material is not assigned to the product or the query fails.
 */
async function assertProductMaterial(
  tx: CatalogTransaction,
  productId: number,
  materialId: number,
) {
  const [row] = await tx
    .select({ materialId: schema.productMaterial.materialId })
    .from(schema.productMaterial)
    .where(
      and(
        eq(schema.productMaterial.productId, productId),
        eq(schema.productMaterial.materialId, materialId),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Material is not available for this product.");
}

/**
 * Copies a product finish option onto a collection item.
 *
 * @param tx - Caller-owned database transaction.
 * @param productId - Product identifier.
 * @param sourceFinishOptionId - Source finish option identifier.
 * @param collectionItemId - Collection item identifier.
 * @rejects When the source option is missing or the database write fails.
 */
async function copyProductFinishOption(
  tx: CatalogTransaction,
  productId: number,
  sourceFinishOptionId: number,
  collectionItemId: number,
) {
  const [source] = await tx
    .select({
      colorEffectId: schema.finishOption.colorEffectId,
      patternId: schema.finishOption.patternId,
    })
    .from(schema.finishOption)
    .where(
      and(
        eq(schema.finishOption.id, sourceFinishOptionId),
        eq(schema.finishOption.productId, productId),
      ),
    )
    .limit(1);
  if (!source)
    throw new Error("Finish option is not available for this product.");

  const finishes = await tx
    .select({
      finishId: schema.finishOptionFinish.finishId,
      position: schema.finishOptionFinish.position,
    })
    .from(schema.finishOptionFinish)
    .where(eq(schema.finishOptionFinish.finishOptionId, sourceFinishOptionId))
    .orderBy(asc(schema.finishOptionFinish.position));
  const colors = await tx
    .select({
      colorId: schema.finishOptionColor.colorId,
      position: schema.finishOptionColor.position,
    })
    .from(schema.finishOptionColor)
    .where(eq(schema.finishOptionColor.finishOptionId, sourceFinishOptionId))
    .orderBy(asc(schema.finishOptionColor.position));
  const [snapshot] = await tx
    .insert(schema.finishOption)
    .values({
      collectionItemId,
      colorEffectId: source.colorEffectId,
      patternId: source.patternId,
      position: 0,
      sourceProductFinishOptionId: sourceFinishOptionId,
    })
    .returning({ id: schema.finishOption.id });
  if (!snapshot) throw new Error("Failed to create finish snapshot.");

  if (finishes.length) {
    await tx.insert(schema.finishOptionFinish).values(
      finishes.map(({ finishId, position }) => ({
        finishId,
        finishOptionId: snapshot.id,
        position,
      })),
    );
  }
  if (colors.length) {
    await tx.insert(schema.finishOptionColor).values(
      colors.map(({ colorId, position }) => ({
        colorId,
        finishOptionId: snapshot.id,
        position,
      })),
    );
  }
}

/**
 * Creates collection finish option.
 *
 * @param tx - Caller-owned database transaction.
 * @param input - Collection item and source or custom finish values.
 * @rejects When the finish values are invalid or the database write fails.
 */
async function createCollectionFinishOption(
  tx: CatalogTransaction,
  input: {
    /**
     * Collection item identifier.
     */
    collectionItemId: number;
    /**
     * Custom finish.
     */
    customFinish: ProductWriteFinishOption | null;
    /**
     * Product finish option identifier.
     */
    productFinishOptionId: number | null;
    /**
     * Product identifier.
     */
    productId: number;
  },
) {
  if (input.productFinishOptionId !== null && input.customFinish !== null) {
    throw new Error("Select at most one appearance option.");
  }
  if (input.productFinishOptionId === null && input.customFinish === null)
    return;
  if (input.productFinishOptionId !== null) {
    await copyProductFinishOption(
      tx,
      input.productId,
      input.productFinishOptionId,
      input.collectionItemId,
    );
    return;
  }

  const customFinish = input.customFinish;
  if (!customFinish) return;
  await validateFinishOptions(tx, [customFinish]);
  const [option] = await tx
    .insert(schema.finishOption)
    .values({
      collectionItemId: input.collectionItemId,
      colorEffectId: customFinish.colorEffectId,
      patternId: customFinish.patternId ?? null,
      position: 0,
    })
    .returning({ id: schema.finishOption.id });
  if (!option) throw new Error("Failed to create finish snapshot.");

  if (customFinish.finishIds.length) {
    await tx.insert(schema.finishOptionFinish).values(
      customFinish.finishIds.map((finishId, position) => ({
        finishId,
        finishOptionId: option.id,
        position,
      })),
    );
  }
  if (customFinish.colorIds.length) {
    await tx.insert(schema.finishOptionColor).values(
      customFinish.colorIds.map((colorId, position) => ({
        colorId,
        finishOptionId: option.id,
        position,
      })),
    );
  }
}

/**
 * Replaces every finish option assigned to a product.
 *
 * @param tx - Caller-owned database transaction.
 * @param productId - Product identifier.
 * @param options - Replacement finish definitions in display order.
 * @rejects When an option is invalid or a database write fails.
 */
async function replaceProductFinishOptions(
  tx: CatalogTransaction,
  productId: number,
  options: ProductWriteFinishOption[],
) {
  await tx
    .delete(schema.finishOption)
    .where(eq(schema.finishOption.productId, productId));

  for (const [position, option] of options.entries()) {
    const [row] = await tx
      .insert(schema.finishOption)
      .values({
        colorEffectId: option.colorEffectId,
        patternId: option.patternId ?? null,
        position,
        productId,
      })
      .returning({ id: schema.finishOption.id });
    if (!row) throw new Error("Failed to create finish option.");

    if (option.finishIds.length) {
      await tx.insert(schema.finishOptionFinish).values(
        option.finishIds.map((finishId, componentPosition) => ({
          finishId,
          finishOptionId: row.id,
          position: componentPosition,
        })),
      );
    }
    if (option.colorIds.length) {
      await tx.insert(schema.finishOptionColor).values(
        option.colorIds.map((colorId, componentPosition) => ({
          colorId,
          finishOptionId: row.id,
          position: componentPosition,
        })),
      );
    }
  }
}

/**
 * Validates finish options.
 *
 * @param db - Application database.
 * @param options - Finish definitions whose references and structure are checked.
 * @rejects When an option is invalid or the reference query fails.
 */
async function validateFinishOptions(
  db: Pick<Database, "select">,
  options: ProductWriteFinishOption[],
) {
  const effectIds = [
    ...new Set(
      options.flatMap(({ colorEffectId }) =>
        colorEffectId === null ? [] : [colorEffectId],
      ),
    ),
  ];
  const effects = effectIds.length
    ? await db
        .select({ id: schema.colorEffect.id, slug: schema.colorEffect.slug })
        .from(schema.colorEffect)
        .where(inArray(schema.colorEffect.id, effectIds))
    : [];
  assertValidFinishOptions(options, effects);
}

/**
 * Validates finish-option structure and referenced color effects.
 *
 * @param options - Finish definitions to validate for completeness and uniqueness.
 * @param effects - Referenced effects with the slugs that govern color rules.
 * @throws When an option is incomplete or incompatible with its color effect.
 */
export function assertValidFinishOptions(
  options: ProductWriteFinishOption[],
  effects: Array<Pick<CatalogLookup, "id" | "slug">>,
) {
  const effectsById = new Map(effects.map((effect) => [effect.id, effect]));
  const signatures = new Set<string>();

  for (const option of options) {
    if (
      !option.finishIds.length &&
      !option.colorIds.length &&
      option.patternId == null
    ) {
      throw new Error("An appearance option requires a visible component.");
    }
    if (new Set(option.finishIds).size !== option.finishIds.length) {
      throw new Error("Duplicate finishes are not allowed.");
    }
    if (new Set(option.colorIds).size !== option.colorIds.length) {
      throw new Error("Duplicate colors are not allowed.");
    }
    if (!option.colorIds.length && option.colorEffectId !== null) {
      throw new Error("A color effect requires colors.");
    }
    if (option.colorIds.length && option.colorEffectId === null) {
      throw new Error("Colors require a color effect.");
    }
    const effect =
      option.colorEffectId === null
        ? null
        : effectsById.get(option.colorEffectId);
    if (option.colorEffectId !== null && !effect) {
      throw new Error("Color effect does not exist.");
    }
    if (effect?.slug === "fade" && option.colorIds.length < 2) {
      throw new Error("A fade requires at least two colors.");
    }
    if (effect?.slug === "solid" && option.colorIds.length !== 1) {
      throw new Error("A solid finish requires exactly one color.");
    }

    const signature = `${option.finishIds.join(",")}|${option.colorEffectId ?? ""}|${option.colorIds.join(",")}|${option.patternId ?? ""}`;
    if (signatures.has(signature)) {
      throw new Error("Duplicate finish options are not allowed.");
    }
    signatures.add(signature);
  }
}

/**
 * Rejects slider-only facts on all other catalog product types.
 *
 * @param specs - Candidate type-specific facts.
 * @throws When magnet capability or slider weight basis is present.
 */
function assertNoSliderOnlySpecs(specs: ProductWriteInput["specs"]) {
  if (specs.magnetSystem != null || specs.weightBasis != null)
    throw new Error("Slider-only specifications are not allowed.");
}

/**
 * Selects slider body facts and enforces explicit magnet and weight semantics.
 *
 * @param specs - Slider product specifications.
 * @returns Slider subtype columns.
 * @throws When the magnet host is absent or weight and its basis are incomplete.
 */
function sliderSpecs(specs: ProductWriteInput["specs"]) {
  if (!specs.magnetSystem)
    throw new Error("A slider magnet system is required.");
  const weightG = specs.weightG ?? null;
  const weightBasis = specs.weightBasis ?? null;
  if ((weightG === null) !== (weightBasis === null))
    throw new Error(
      "Slider weight and weight basis must be recorded together.",
    );
  return {
    lengthMm: specs.lengthMm ?? null,
    magnetSystem: specs.magnetSystem,
    thicknessMm: specs.thicknessMm ?? null,
    weightBasis,
    weightG,
    widthMm: specs.widthMm ?? null,
  };
}

/**
 * Selects set-level facts shared by slider plate and insert products.
 *
 * @param specs - Component product specifications.
 * @returns Component subtype columns.
 */
function sliderComponentSpecs(specs: ProductWriteInput["specs"]) {
  return {
    lengthMm: specs.lengthMm ?? null,
    thicknessMm: specs.thicknessMm ?? null,
    weightG: specs.weightG ?? null,
    widthMm: specs.widthMm ?? null,
  };
}

/**
 * Selects spinner-specific product specifications.
 *
 * @param specs - Product specifications to map into spinner columns.
 * @returns Spinner specification columns.
 */
function spinnerSpecs(specs: ProductWriteInput["specs"]) {
  return {
    ...(specs.bearing !== undefined
      ? { bearing: normalizeOptionalText(specs.bearing) }
      : {}),
    buttonDiameterMm: specs.buttonDiameterMm ?? null,
    compatibleButtonId: specs.compatibleButtonId ?? null,
    lengthMm: specs.lengthMm ?? null,
    ...(specs.spinDiameterMm !== undefined
      ? { spinDiameterMm: specs.spinDiameterMm }
      : {}),
    thicknessMm: specs.thicknessMm ?? null,
    thicknessWithButtonMm: specs.thicknessWithButtonMm ?? null,
    weightG: specs.weightG ?? null,
    widthMm: specs.widthMm ?? null,
  };
}

/**
 * Trims optional text and collapses blank input to `null`.
 *
 * @param value - Optional text to normalize.
 * @returns Trimmed text, or `null` when absent or blank.
 */
function normalizeOptionalText(value: string | null | undefined) {
  return value?.trim() || null;
}

/**
 * Trims an optional URL and removes trailing slashes.
 *
 * @param value - Optional URL to normalize.
 * @returns URL without trailing slashes, or `null` when absent or blank.
 */
function normalizeOptionalUrl(value: string | null | undefined) {
  return value?.trim().replace(/\/+$/, "") || null;
}

/**
 * Collapses an absent or whitespace-only description to `null`.
 *
 * @param value - Optional description to inspect.
 * @returns The original nonblank description, otherwise `null`.
 */
function normalizeOptionalDescription(value: string | null | undefined) {
  return value?.trim() ? value : null;
}

/**
 * Resolves a valid product or collection-item approval transition.
 *
 * @param current - Current durable approval state.
 * @param action - Requested administrative action.
 * @returns The resulting approval state.
 * @throws When the requested transition is not allowed.
 */
function nextApprovalStatus(
  current: CatalogApprovalStatus,
  action: CatalogApprovalAction,
): CatalogApprovalStatus {
  if (current === "pending" && action === "approve") return "approved";
  if (current === "pending" && action === "reject") return "rejected";
  if (current !== "pending" && action === "reverse") return "pending";
  throw new Error("Approval transition is invalid.");
}

/**
 * Selects spinner-button product specifications.
 *
 * @param specs - Product specifications to map into spinner-button columns.
 * @returns Spinner-button specification columns.
 */
function buttonSpecs(specs: ProductWriteInput["specs"]) {
  return {
    diameterMm: specs.diameterMm ?? null,
    thicknessMm: specs.thicknessMm ?? null,
    weightG: specs.weightG ?? null,
  };
}

/**
 * Adds a hashed actor identifier to log attributes.
 *
 * @param actorClerkId - Actor clerk identifier.
 * @param attributes - Safe fields to attach to the operation log.
 * @returns Log attributes containing the hashed actor identifier.
 */
function actorAttributes(
  actorClerkId: string,
  attributes: Record<string, unknown> = {},
) {
  return {
    attributes: {
      ...attributes,
      clerkIdHash: hashLogIdentifier(actorClerkId),
    },
  };
}

/**
 * Builds structured log attributes for a product mutation.
 *
 * @param input - Product fields used to build safe operation-log attributes.
 * @returns Structured product-mutation log attributes.
 */
function productAttributes(input: ProductWriteInput) {
  return actorAttributes(input.actor.clerkId, {
    finishOptionCount: input.finishOptions.length,
    materialIds: input.materialIds,
    productTypeSlug: input.productTypeSlug,
    slug: input.slug,
  });
}
