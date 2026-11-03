import { useAuth } from "@clerk/tanstack-react-start";
import {
  faArrowRotateLeft,
  faTrash,
  faXmark,
} from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type {
  CatalogColor,
  CatalogFinishOption,
  CatalogImage,
  CatalogLookup,
  CatalogMaker,
  CatalogProduct,
  CatalogProductType,
  CatalogTerminologyAlias,
  CollectionItemOwnershipPeriod,
  OwnershipEntryReason,
  OwnershipExitReason,
  SliderMagnetConfiguration,
  SliderMagnetLayout,
  UserCollectionItem,
  UserCollectionSummary,
} from "@package/services";
import {
  maxImageBytes,
  maxImageSessionBytes,
  maxImageSessionFiles,
  sliderMagnetLayoutDetails,
  sliderMagnetLayouts,
} from "@package/services/constants";
import type { TranslationKey } from "@pocket-trash/localizations";
import { useForm, useStore } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import React from "react";
import { createPortal } from "react-dom";
import {
  type EffectEntity,
  type EffectReducer,
  useEffectReducer,
} from "use-effect-reducer";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { CatalogMarkdownEditor } from "@/components/catalog-markdown-editor";
import {
  CollectionCoverManager,
  CollectionForm,
  type CollectionFormValue,
  CollectionImageUploader,
} from "@/components/collection-form";
import { CollectionSelector } from "@/components/collection-selector";
import type { MarkdownEditorHandle } from "@/components/markdown-editor";
import {
  MeasurementInput,
  type MeasurementInputValue,
} from "@/components/measurement-input";
import { PermanentDeletionControls } from "@/components/permanent-deletion-controls";
import { FileDropInput } from "@/components/resource-file-input";
import { SliderMagnetConfigurationEditor } from "@/components/slider-magnet-configuration-editor";
import { Button } from "@/components/ui/button";
import {
  CatalogCombobox,
  CatalogMultiCombobox,
  type ComboboxOption,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UserPageShell } from "@/components/user-page-shell";
import {
  filterButtonsByDiameter,
  finishOptionLabel,
  materialCombinationLabel,
  positiveDecimalSchema,
} from "@/lib/catalog";
import {
  addCollectionProduct,
  authorCatalogPensData,
  type CatalogOptions,
  collectionProductTypeIsSupported,
  createCatalogColor,
  createCatalogFinish,
  createCatalogMaker,
  createCatalogMaterial,
  createCatalogPattern,
  createCatalogTerminologyAlias,
  deleteCollectionItem,
  deleteUserCollection,
  type EditableCatalogProductType,
  finishOptionSchema,
  materialCombinationSignature,
  type ProductFormInput,
  type ProductFormValue,
  productFormSchema,
  productSlugPreview,
  productTypeIsSupported,
  restoreCatalogImage,
  saveCatalogProduct,
  saveCollection,
  selectCollectionCover,
  setCollectionVisibility,
  softDeleteCatalogImage,
  updateCollectionItem,
} from "@/lib/catalog-api";
import { useCatalogCopy } from "@/lib/catalog-copy";
import {
  collectionOwnershipEntryReasons,
  collectionOwnershipExitReasons,
} from "@/lib/catalog-ownership";
import { getImageUploadGuidance } from "@/lib/help-content";
import {
  deleteCollectionCover,
  formatMiB,
  type ImageUploadError,
  uploadImages,
  validateImages,
} from "@/lib/upload-sessions";
import { useLocale } from "@/providers/locale-provider";

/**
 * Renders the product create or edit page.
 *
 * @param props - Product form page properties.
 * @param props.initialProduct - Existing product being edited.
 * @param props.options - Catalog lookup options.
 * @returns The product form page.
 */
export function ProductFormPage({
  initialProduct,
  options: initialOptions,
}: {
  /** Existing product being edited. */
  initialProduct?: CatalogProduct;
  /** Catalog lookup options. */
  options: CatalogOptions;
}) {
  const t = useCatalogCopy();
  const typeForm = useForm({
    defaultValues: {
      productType: initialProduct
        ? {
            id: initialProduct.productTypeId,
            name: initialProduct.productTypeName,
          }
        : (null as ComboboxOption | null),
    },
  });
  const selectedType = useStore(
    typeForm.store,
    (state) => state.values.productType,
  );
  const productType =
    initialProduct?.productTypeSlug ??
    initialOptions.productTypes.find(({ id }) => id === selectedType?.id)?.slug;

  return (
    <AppShell
      breadcrumbItems={[
        { label: t("web.navigation.products"), to: "/products" },
      ]}
      title={initialProduct ? initialProduct.name : t("web.action.addProduct")}
    >
      <main className="grid w-full max-w-6xl gap-6 p-6">
        {!initialProduct ? (
          <Field label={t("web.catalog.field.productType")}>
            <CatalogCombobox
              ariaLabel={t("web.catalog.field.productType")}
              items={initialOptions.productTypes}
              onValueChange={(value) =>
                typeForm.setFieldValue("productType", value)
              }
              placeholder={t("web.catalog.selectProductType")}
              value={selectedType}
            />
          </Field>
        ) : null}
        {productType && productTypeIsSupported(productType) ? (
          <>
            <ProductEditor
              initialProduct={initialProduct}
              key={`${productType}-${initialProduct?.id ?? "new"}`}
              options={initialOptions}
              productTypeSlug={productType}
            />
            {initialProduct?.canAdminister &&
            initialOptions.pensAdminOptions ? (
              <PensAdminEditor
                options={initialOptions}
                product={initialProduct}
              />
            ) : null}
          </>
        ) : productType ? (
          <Notice>{t("web.catalog.notImplemented")}</Notice>
        ) : null}
      </main>
    </AppShell>
  );
}

/** Structured Pens administration actions exposed by the editor. */
const pensAdminActions = [
  "refill-offering",
  "offering-identifier",
  "compatibility-membership",
  "compatibility-membership-remove",
  "refill-tip-style",
  "refill-ink-color",
  "compatibility-group",
] as const;
/** One structured Pens administration action. */
type PensAdminAction = (typeof pensAdminActions)[number];

/** Pending Pens administrative save effect. */
type PensAdminSaveState =
  | EffectEntity<PensAdminSaveState, PensAdminSaveEvent>
  | undefined;
/** Administrative mutation and terminal events. */
type PensAdminSaveEvent =
  | {
      /** Submits a structured administrative mutation. */
      type: "requested";
      /** Existing validated server input boundary. */
      data: unknown;
    }
  | {
      /** Clears the completed save effect. */
      type: "finished";
    };
/** Committed Pens administration request. */
type PensAdminSaveEffect = {
  /** Save implementation. */
  type: "save";
  /** Existing server input payload. */
  data: unknown;
};

/**
 * Renders structured Pens administration for an existing product.
 *
 * @param root0 - Editor properties.
 * @param root0.options - Available catalog lookups.
 * @param root0.product - Product being administered.
 * @returns The Pens administration editor, or nothing without admin options.
 */
export function PensAdminEditor({
  options,
  product,
}: {
  /** Available catalog lookups. */
  options: CatalogOptions;
  /** Product being administered. */
  product: CatalogProduct;
}) {
  const t = useCatalogCopy();
  /**
   * Resolves one Pens administration translation.
   *
   * @param key - Key suffix within the Pens admin namespace.
   * @returns Localized text or its fallback key.
   */
  const copy = (key: string) => t(`web.pens.admin.${key}` as TranslationKey);
  const admin = options.pensAdminOptions;
  const form = useForm({
    defaultValues: {
      action: (product.productTypeSlug === "refill"
        ? "refill-offering"
        : "compatibility-group") as PensAdminAction,
      primaryId: "",
      secondaryId: "",
      text: "",
      text2: "",
    },
    validators: {
      /**
       * Requires the fields used by the selected structured action.
       * @param context - Current administrative fields.
       * @returns Existing required-field feedback for incomplete input.
       */
      onSubmit: ({ value }): string | undefined => {
        const textAction =
          value.action === "refill-tip-style" ||
          value.action === "refill-ink-color";
        if (
          textAction
            ? !value.text.trim() || !value.text2.trim()
            : !value.primaryId
        )
          return "web.catalog.error.required";
        if (
          value.action === "refill-offering" &&
          (!value.secondaryId || !value.text.trim())
        )
          return "web.catalog.error.required";
        if (
          value.action === "offering-identifier" &&
          (!value.text.trim() || !value.text2)
        )
          return "web.catalog.error.required";
        return undefined;
      },
    },
    /**
     * Submits the selected structured Pens administration action.
     * @returns Nothing; the committed save owns response handling.
     */
    onSubmit: () => submit(),
  });
  const { action, primaryId, secondaryId, text, text2 } = useStore(
    form.store,
    (state) => state.values,
  );
  const message = useStore(form.store, (state) => state.errorMap.onSubmit);
  const pending = React.useRef<ReturnType<typeof authorCatalogPensData> | null>(
    null,
  );
  const [saving, dispatch] = useEffectReducer<
    PensAdminSaveState,
    PensAdminSaveEvent,
    PensAdminSaveEffect
  >(
    (
      state: EffectEntity<PensAdminSaveState, PensAdminSaveEvent> | undefined,
      event: PensAdminSaveEvent,
      exec,
    ) => {
      if (event.type === "requested")
        return state ?? exec({ type: "save", data: event.data });
      exec.stop(state);
      return undefined;
    },
    undefined as PensAdminSaveState,
    {
      /**
       * Runs a single administrative mutation and observes it across resumption.
       * @param _state - Current pending effect.
       * @param effect - Submitted structured payload.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current observer lifetime.
       */
      save: (_state, effect: PensAdminSaveEffect, dispatch, { signal }) => {
        pending.current ??= authorCatalogPensData({ data: effect.data });
        void pending.current.then(
          (result) => {
            if (signal.aborted) return;
            pending.current = null;
            dispatch({ type: "finished" });
            if (!result.ok) {
              form.setErrorMap({ onSubmit: result.formError });
              return;
            }
            window.location.reload();
          },
          () => {
            if (signal.aborted) return;
            pending.current = null;
            dispatch({ type: "finished" });
            form.setErrorMap({ onSubmit: "error.generic" });
          },
        );
      },
    },
  );
  if (!admin) return null;

  const compatibilityMemberships = admin.compatibilityMemberships
    .filter(({ refillProductId }) => refillProductId === product.id)
    .map(({ groupId, id }) => ({
      id,
      name:
        admin.compatibilityGroups.find((group) => group.id === groupId)?.name ??
        String(groupId),
    }));

  /**
   * Renders a labeled single-value select.
   *
   * @param label - Accessible field label.
   * @param value - Selected value.
   * @param onChange - Selection callback.
   * @param items - Available values.
   * @param required - Whether the browser requires a non-empty selection.
   * @returns The labeled select field.
   */
  const select = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    items: ReadonlyArray<{
      /** Submitted identifier. */
      id: number | string;
      /** Visible option name. */
      name: string;
    }>,
    required = true,
  ) => (
    <Field label={label}>
      <select
        aria-label={label}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      >
        <option value="" />
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </Field>
  );

  /**
   * Renders a labeled text-like input.
   *
   * @param label - Accessible field label.
   * @param value - Current value.
   * @param onChange - Value callback.
   * @param type - Native input type.
   * @returns The labeled input field.
   */
  const input = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    type = "text",
  ) => (
    <Field label={label}>
      <Input
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        required
        type={type}
        value={value}
      />
    </Field>
  );

  /**
   * Validates and submits the selected structured mutation.
   *
   * @returns Nothing; response handling belongs to the committed save.
   */
  const submit = () => {
    const id = Number(primaryId);
    const id2 = Number(secondaryId);
    const data: unknown =
      action === "refill-offering"
        ? {
            inkColorId: id2,
            kind: action,
            refillProductId: product.id,
            tipSize: text,
            tipStyleId: id,
          }
        : action === "offering-identifier"
          ? {
              identifierKind: text2,
              kind: action,
              makerId: product.makerId,
              offeringId: id,
              sourceValue: text,
            }
          : action === "compatibility-membership"
            ? {
                groupId: id,
                kind: action,
                refillProductId: product.id,
              }
            : action === "compatibility-membership-remove"
              ? {
                  kind: action,
                  membershipId: id,
                  refillProductId: product.id,
                }
              : action === "compatibility-group"
                ? { conceptId: id, kind: action }
                : {
                    kind: action,
                    name: text,
                    slug: text2,
                  };
    dispatch({ type: "requested", data });
  };

  return (
    <section className="grid gap-4 rounded-xl border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">
        {t("web.pens.admin.heading" as TranslationKey)}
      </h2>
      {select(
        t("web.pens.admin.actionLabel" as TranslationKey),
        action,
        (value) => {
          form.setFieldValue("action", value as PensAdminAction);
          form.setFieldValue("primaryId", "");
          form.setFieldValue("secondaryId", "");
          form.setErrorMap({ onSubmit: undefined });
        },
        pensAdminActions.map((id) => ({ id, name: copy(`action.${id}`) })),
      )}
      {action === "refill-offering" ? (
        <>
          {select(
            copy("tipStyle"),
            primaryId,
            (value) => form.setFieldValue("primaryId", value),
            admin.tipStyles,
          )}
          {select(
            copy("inkColor"),
            secondaryId,
            (value) => form.setFieldValue("secondaryId", value),
            admin.inkColors,
          )}
          {input(copy("tipSize"), text, (value) =>
            form.setFieldValue("text", value),
          )}
        </>
      ) : null}
      {action === "offering-identifier" ? (
        <>
          {select(
            copy("offering"),
            primaryId,
            (value) => form.setFieldValue("primaryId", value),
            admin.offerings,
          )}
          {input(copy("identifier"), text, (value) =>
            form.setFieldValue("text", value),
          )}
          {select(
            copy("identifierKindLabel"),
            text2,
            (value) => form.setFieldValue("text2", value),
            [
              { id: "maker-code", name: copy("identifierKind.makerCode") },
              { id: "sku", name: copy("identifierKind.sku") },
            ],
          )}
        </>
      ) : null}
      {action === "compatibility-membership" ? (
        <>
          {select(
            copy("compatibilityGroup"),
            primaryId,
            (value) => form.setFieldValue("primaryId", value),
            admin.compatibilityGroups,
          )}
        </>
      ) : null}
      {action === "compatibility-membership-remove"
        ? select(
            copy("compatibilityMembership"),
            primaryId,
            (value) => form.setFieldValue("primaryId", value),
            compatibilityMemberships,
          )
        : null}
      {action === "refill-tip-style" || action === "refill-ink-color" ? (
        <>
          {input(copy("name"), text, (value) =>
            form.setFieldValue("text", value),
          )}
          {input(copy("slug"), text2, (value) =>
            form.setFieldValue("text2", value),
          )}
        </>
      ) : null}
      {action === "compatibility-group"
        ? select(
            copy("registeredGroup"),
            primaryId,
            (value) => form.setFieldValue("primaryId", value),
            admin.compatibilityGroupConcepts,
          )
        : null}
      {typeof message === "string" ? (
        <Notice>{t(message as TranslationKey)}</Notice>
      ) : null}
      <Button
        disabled={Boolean(saving)}
        onClick={() => void form.handleSubmit()}
        type="button"
        variant={action.endsWith("-remove") ? "destructive" : "default"}
      >
        {action.endsWith("-remove")
          ? t("web.action.delete")
          : t("web.action.save")}
      </Button>
    </section>
  );
}

/** Editable dimension text and its independently selected unit. */
type EditableDimensionMeasurement = {
  /** Selected storage unit. */
  unit: "in" | "mm";
  /** Exact numeric input text. */
  value: string;
};

/** Editable weight text and its independently selected unit. */
type EditableWeightMeasurement = {
  /** Selected storage unit. */
  unit: "g" | "oz";
  /** Exact numeric input text. */
  value: string;
};

/** Product types accepted as direct Pen parts. */
type PenPartProductType =
  | "pen-actuator"
  | "pen-clip"
  | "pen-mechanism"
  | "pen-tip"
  | "pen-top-cap";

/** Ordered Pen-part roles exposed by the compatibility editor. */
const penPartProductTypes: Array<{
  /** Localized plural role label. */
  label: TranslationKey;
  /** Canonical part product type. */
  type: PenPartProductType;
}> = [
  { label: "web.pens.productType.tip", type: "pen-tip" },
  { label: "web.pens.productType.clip", type: "pen-clip" },
  { label: "web.pens.productType.mechanism", type: "pen-mechanism" },
  { label: "web.pens.productType.actuator", type: "pen-actuator" },
  { label: "web.pens.productType.topCap", type: "pen-top-cap" },
];

/** Controlled editor value keeps text inputs as strings before schema parsing. */
type ProductEditorValue = Omit<
  ProductFormValue,
  | "bearing"
  | "buttonDiameter"
  | "description"
  | "diameter"
  | "length"
  | "materialAssignments"
  | "spinDiameter"
  | "thickness"
  | "thicknessWithButton"
  | "weight"
  | "width"
> & {
  /** Bearing text before blank normalization. */
  bearing: string;
  /** Markdown description before blank normalization. */
  description: string;
  /** Material combinations with editable optional weights. */
  materialAssignments: Array<
    Omit<ProductFormValue["materialAssignments"][number], "weight"> & {
      /** Optional assignment weight before blank normalization. */
      weight: EditableWeightMeasurement;
    }
  >;
  /** Button diameter text and independently selected unit. */
  buttonDiameter: EditableDimensionMeasurement;
  /** Diameter text and independently selected unit. */
  diameter: EditableDimensionMeasurement;
  /** Length text and independently selected unit. */
  length: EditableDimensionMeasurement;
  /** Spin diameter text and independently selected unit. */
  spinDiameter: EditableDimensionMeasurement;
  /** Thickness text and independently selected unit. */
  thickness: EditableDimensionMeasurement;
  /** Thickness-with-button text and independently selected unit. */
  thicknessWithButton: EditableDimensionMeasurement;
  /** Weight text and independently selected unit. */
  weight: EditableWeightMeasurement;
  /** Width text and independently selected unit. */
  width: EditableDimensionMeasurement;
};

/** Product save feedback owned by TanStack Form. */
type ProductValidation = {
  /** Localized form feedback. */
  form: string;
  /** Field errors returned by the existing schema or server. */
  fields?: Record<string, string[] | undefined>;
};
/** Product editor disclosures, shared options, and committed save lifetime. */
type ProductEditorState = {
  /** Current shared lookup choices. */
  options: CatalogOptions;
  /** Identifier retained after saving before an upload retry. */
  savedProductId: number | null;
  /** Whether assignment weight fields are exposed. */
  showMaterialWeights: boolean;
  /** Whether changing layout discarded an incompatible snapshot. */
  magnetConfigurationNotice: boolean;
  /** Part type currently being created. */
  activePartType: PenPartProductType | null;
  /** Disclosed part compatibility roles. */
  openPartRoles: Set<PenPartProductType>;
  /** Whether Markdown initialization is pending. */
  descriptionLoading: boolean;
  /** Current save effect, absent after terminal feedback. */
  save: EffectEntity<ProductEditorState, ProductEditorEvent> | undefined;
};
/** Product editing intents and save completion. */
type ProductEditorEvent =
  | {
      /** Accepts the stable shared-control options callback. */
      type: "lookupOptionsChanged";
      /** Complete choices or a pure updater from an existing caller. */
      update: React.SetStateAction<CatalogOptions>;
    }
  | {
      /** Changes assignment weight disclosure. */
      type: "materialWeightsToggled";
    }
  | {
      /** Records a discarded incompatible magnet snapshot. */
      type: "magnetSnapshotDiscarded";
    }
  | {
      /** Opens or closes embedded part creation. */
      type: "partCreationChanged";
      /** Part type being created, absent when closed. */
      partType: PenPartProductType | null;
    }
  | {
      /** Toggles one compatibility role disclosure. */
      type: "partRoleToggled";
      /** Compatibility role to disclose. */
      role: PenPartProductType;
    }
  | {
      /** Receives committed editor readiness. */
      type: "descriptionLoadingChanged";
      /** Whether initialization is pending. */
      loading: boolean;
    }
  | {
      /** Submits validated fields and the current file selection. */
      type: "saveRequested";
      /** Validated product fields. */
      value: ProductEditorValue;
      /** Optional moderation reason. */
      reason?: string;
      /** Files belonging to this save attempt. */
      files: File[];
    }
  | {
      /** Completes a save attempt, including a retryable upload failure. */
      type: "saveFinished";
      /** Identifier returned before any image upload. */
      productId?: number;
    };
/** One validated product save and its ordered uploads. */
type ProductEditorEffect = {
  /** Save implementation. */
  type: "save";
  /** Captured validated fields, including the last saved identifier. */
  value: ProductEditorValue;
  /** Optional moderation reason. */
  reason?: string;
  /** Files selected at submission. */
  files: File[];
};
/** Product save result retained while its UI is suspended. */
type ProductSaveResult = {
  /** Saved product, including when a subsequent upload failed. */
  product?: CatalogProduct;
  /** Files requiring retry. */
  files: File[];
  /** Existing localized failure response. */
  error?: ProductValidation;
};
/**
 * Owns product UI and save transitions without performing mutations in render.
 * @param state - Current editor controls and save lifetime.
 * @param event - Editing intent or terminal save event.
 * @param exec - Committed effect queue.
 * @returns Updated controls and pending save.
 */
const productEditorReducer: EffectReducer<
  ProductEditorState,
  ProductEditorEvent,
  ProductEditorEffect
> = (state, event, exec) => {
  switch (event.type) {
    case "lookupOptionsChanged":
      return {
        ...state,
        options:
          typeof event.update === "function"
            ? event.update(state.options)
            : event.update,
      };
    case "materialWeightsToggled":
      return { ...state, showMaterialWeights: !state.showMaterialWeights };
    case "magnetSnapshotDiscarded":
      return { ...state, magnetConfigurationNotice: true };
    case "partCreationChanged":
      return { ...state, activePartType: event.partType };
    case "partRoleToggled": {
      const roles = new Set(state.openPartRoles);
      if (roles.has(event.role)) roles.delete(event.role);
      else roles.add(event.role);
      return { ...state, openPartRoles: roles };
    }
    case "descriptionLoadingChanged":
      return state.descriptionLoading === event.loading
        ? state
        : { ...state, descriptionLoading: event.loading };
    case "saveRequested":
      if (state.save) return state;
      return {
        ...state,
        save: exec({
          type: "save",
          value: {
            ...event.value,
            productId: state.savedProductId ?? event.value.productId,
          },
          reason: event.reason,
          files: event.files,
        }),
      };
    case "saveFinished":
      exec.stop(state.save);
      return {
        ...state,
        savedProductId: event.productId ?? state.savedProductId,
        save: undefined,
      };
  }
};

/** Properties for the product material-combination editor. */
type MaterialAssignmentsEditorProps = {
  /**
   * Updates product material combinations.
   *
   * @param value - Next complete combination list.
   */
  onChange(value: ProductEditorValue["materialAssignments"]): void;
  /** Updates shared lookup choices when a material is created. */
  onOptionsChange: React.Dispatch<React.SetStateAction<CatalogOptions>>;
  /** Available canonical material choices. */
  options: CatalogOptions;
  /** Whether the product type accepts only one assignment. */
  singleAssignment: boolean;
  /** Localized catalog message formatter. */
  t: ReturnType<typeof useCatalogCopy>;
  /** Current product material combinations. */
  value: ProductEditorValue["materialAssignments"];
};

/** Material sheet context; edited fields belong to its form. */
type MaterialAssignmentSession = {
  /** Whether the sheet is visible. */
  open: boolean;
  /** Initial assignment and its identity in this form session. */
  initial: {
    /** Existing assignment position, or new assignment. */
    index: number | null;
    /** Editable component and weight fields. */
    assignment: ProductEditorValue["materialAssignments"][number];
  };
};
/** Material sheet disclosure events. */
type MaterialAssignmentEvent =
  | {
      /** Begins editing an existing or new assignment. */
      type: "opened";
      /** Existing assignment position. */
      index: number | null;
      /** Initial editable assignment. */
      assignment: MaterialAssignmentSession["initial"]["assignment"];
    }
  | {
      /** Dismisses or saves this editing session. */
      type: "closed";
    };

/**
 * Edits each material combination in a focused modal.
 *
 * @param props - Controlled material editor properties.
 * @returns Material assignment summaries and their modal editor.
 */
export function MaterialAssignmentsEditor({
  onChange,
  onOptionsChange,
  options,
  singleAssignment,
  t,
  value,
}: MaterialAssignmentsEditorProps) {
  const [editing, dispatch] = React.useReducer(
    (
      state: MaterialAssignmentSession,
      event: MaterialAssignmentEvent,
    ): MaterialAssignmentSession => {
      switch (event.type) {
        case "opened":
          return {
            open: true,
            initial: { index: event.index, assignment: event.assignment },
          };
        case "closed":
          return { ...state, open: false };
      }
    },
    {
      open: false,
      initial: {
        index: null,
        assignment: {
          materials: [{ materialId: 0, materialSpecificId: null }],
          weight: { unit: "g", value: "" },
        },
      },
    },
  );
  /**
   * Validates component completeness and uniqueness within this draft and product.
   * @param input - Draft fields and the existing assignment identity.
   * @returns Existing immediate validation categories, when invalid.
   */
  const validateDraft = ({
    value: current,
  }: {
    /** Draft form values. */ value: MaterialAssignmentSession["initial"];
  }) => {
    const signatures = current.assignment.materials
      .filter(({ materialId }) => materialId !== 0)
      .map(
        ({ materialId, materialSpecificId }) =>
          `${materialId}:${materialSpecificId ?? "general"}`,
      );
    const incomplete =
      current.assignment.materials.length === 0 ||
      current.assignment.materials.some(({ materialId }) => materialId === 0);
    const duplicate =
      new Set(signatures).size !== signatures.length ||
      value.some(
        (assignment, index) =>
          index !== current.index &&
          materialCombinationSignature(assignment) ===
            materialCombinationSignature(current.assignment),
      );
    return incomplete || duplicate ? { incomplete, duplicate } : undefined;
  };
  const draftForm = useForm({
    defaultValues: editing.initial,
    validators: {
      onMount: validateDraft,
      onChange: validateDraft,
      onSubmit: validateDraft,
    },
    /**
     * Applies one valid combination through the existing controlled callback.
     * @param input - Validated assignment and its edit identity.
     */
    onSubmit: ({ value: current }) => {
      onChange(
        current.index === null
          ? [...value, current.assignment]
          : value.map((assignment, index) =>
              index === current.index ? current.assignment : assignment,
            ),
      );
      dispatch({ type: "closed" });
    },
  });
  const draft = useStore(draftForm.store, (state) => state.values.assignment);
  const feedback = useStore(draftForm.store, (state) => state.errors[0]);
  const canSave = useStore(draftForm.store, (state) => state.canSubmit);
  const isOpen = editing.open;
  /**
   * Opens a new or existing material combination.
   *
   * @param index - Existing assignment index, or null for a new assignment.
   * @param componentCount - Number of empty component rows for a new assignment.
   */
  const open = (index: number | null, componentCount = 1) => {
    const assignment =
      index === null
        ? {
            materials: Array.from({ length: componentCount }, () => ({
              materialId: 0,
              materialSpecificId: null,
            })),
            weight: { unit: "g", value: "" } as const,
          }
        : value[index];
    if (!assignment) return;
    const initial = structuredClone(assignment);
    draftForm.reset({ index, assignment: initial });
    void draftForm.validate("mount");
    dispatch({ type: "opened", index, assignment: initial });
  };
  /**
   * Resolves one stored combination to its current display label.
   *
   * @param assignment - Stored material identifier pairs.
   * @returns Current human-readable combination label.
   */
  const label = (
    assignment: ProductEditorValue["materialAssignments"][number],
  ) =>
    materialCombinationLabel(
      assignment.materials.map(({ materialId, materialSpecificId }) => {
        const material = options.materials.find(({ id }) => id === materialId);
        const specific = (options.materialSpecifics ?? []).find(
          ({ id }) => id === materialSpecificId,
        );
        return {
          name: material?.name ?? t("web.catalog.selectMaterial"),
          specific: specific ? { name: specific.name } : null,
        };
      }),
    );

  return (
    <>
      {value.map((assignment, index) => (
        <div className="flex items-center gap-2" key={index}>
          <span className="min-w-0 flex-1 wrap-anywhere">
            {label(assignment)}
          </span>
          <Button onClick={() => open(index)} type="button" variant="outline">
            {t("web.catalog.materialCombination.edit")}
          </Button>
          <Button
            aria-label={t("web.action.close")}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
            type="button"
            variant="outline"
          >
            <FontAwesomeIcon aria-hidden="true" icon={faXmark} />
          </Button>
        </div>
      ))}
      <Button
        disabled={singleAssignment && value.length > 0}
        onClick={() => open(null)}
        type="button"
        variant="outline"
      >
        {t("web.catalog.materialCombination.addSingle")}
      </Button>
      <Button
        disabled={singleAssignment && value.length > 0}
        onClick={() => open(null, 2)}
        type="button"
        variant="outline"
      >
        {t("web.catalog.materialCombination.add")}
      </Button>
      <LookupDialog
        kind="material"
        t={t}
        onCreated={(material) => {
          onOptionsChange((current) => ({
            ...current,
            materials: [...current.materials, material].sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
          }));
          draftForm.setFieldValue("assignment.materials", (current) => [
            ...current.filter(({ materialId }) => materialId !== 0),
            { materialId: material.id, materialSpecificId: null },
          ]);
        }}
      />
      <Sheet
        onOpenChange={(open) => {
          if (!open) dispatch({ type: "closed" });
        }}
        open={isOpen}
      >
        <SheetContent className="sm:w-[40rem] sm:max-w-[90vw]">
          <SheetHeader>
            <SheetTitle>
              {t("web.catalog.materialCombination.title")}
            </SheetTitle>
          </SheetHeader>
          <div className="grid min-h-0 gap-4 overflow-y-auto p-6">
            {draft.materials.map((selection, index) => (
              <div
                className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                key={index}
              >
                <CatalogCombobox
                  ariaLabel={t("web.catalog.materialCombination.component", {
                    number: index + 1,
                  })}
                  items={options.materials}
                  onValueChange={(material) =>
                    draftForm.setFieldValue("assignment.materials", (current) =>
                      current.map((row, i) =>
                        i === index
                          ? {
                              materialId: Number(material?.id ?? 0),
                              materialSpecificId: null,
                            }
                          : row,
                      ),
                    )
                  }
                  placeholder={t("web.catalog.selectMaterial")}
                  value={
                    options.materials.find(
                      ({ id }) => id === selection.materialId,
                    ) ?? null
                  }
                />
                <CatalogCombobox
                  ariaLabel={t("web.materials.specific.optional")}
                  items={(options.materialSpecifics ?? []).filter(
                    ({ materialId }) => materialId === selection.materialId,
                  )}
                  onValueChange={(specific) =>
                    draftForm.setFieldValue("assignment.materials", (current) =>
                      current.map((row, i) =>
                        i === index
                          ? {
                              ...row,
                              materialSpecificId: specific
                                ? Number(specific.id)
                                : null,
                            }
                          : row,
                      ),
                    )
                  }
                  placeholder={t("web.materials.specific.general")}
                  removeLabel={t("web.action.close")}
                  showSelectedPill
                  value={
                    (options.materialSpecifics ?? []).find(
                      ({ id }) => id === selection.materialSpecificId,
                    ) ?? null
                  }
                />
                <Button
                  aria-label={t("web.action.close")}
                  onClick={() =>
                    draftForm.setFieldValue("assignment.materials", (current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                  type="button"
                  variant="outline"
                >
                  <FontAwesomeIcon aria-hidden="true" icon={faXmark} />
                </Button>
              </div>
            ))}
            <Button
              onClick={() =>
                draftForm.setFieldValue("assignment.materials", (current) => [
                  ...current,
                  { materialId: 0, materialSpecificId: null },
                ])
              }
              type="button"
              variant="outline"
            >
              {t("web.catalog.materialCombination.addSingle")}
            </Button>
            {feedback?.incomplete ? (
              <p className="text-sm text-destructive" role="alert">
                {t("web.catalog.materialCombination.empty")}
              </p>
            ) : null}
            {feedback?.duplicate ? (
              <p className="text-sm text-destructive" role="alert">
                {t("web.catalog.materialCombination.duplicate")}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => dispatch({ type: "closed" })}
                type="button"
                variant="outline"
              >
                {t("action.cancel")}
              </Button>
              <Button
                disabled={!canSave}
                onClick={() => void draftForm.handleSubmit()}
                type="button"
              >
                {t("action.save")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * Renders the product fields shared by add and edit flows.
 *
 * @param props - Product type, catalog options, and optional existing product.
 * @param props.initialProduct - Existing product being edited.
 * @param props.onCancel - Optional cancellation callback for embedded creation.
 * @param props.onCreated - Optional callback receiving an embedded creation result.
 * @param props.options - Catalog lookup options.
 * @param props.productTypeSlug - Product type being edited.
 * @param props.quickCreate - Whether to hide fields outside the plate quick-create scope.
 * @returns The product editor form.
 */
export function ProductEditor({
  initialProduct,
  onCancel,
  onCreated,
  options: initialOptions,
  productTypeSlug,
  quickCreate = false,
}: {
  /** Existing product being edited. */
  initialProduct?: CatalogProduct;
  /** Cancels embedded product creation. */
  onCancel?(): void;
  /**
   * Receives an embedded product creation result.
   *
   * @param product - Newly created catalog product.
   */
  onCreated?(product: CatalogProduct): void;
  /** Catalog lookup options. */
  options: CatalogOptions;
  /** Product type being edited. */
  productTypeSlug: EditableCatalogProductType;
  /** Hides fields outside the plate quick-create scope. */
  quickCreate?: boolean;
}) {
  const t = useCatalogCopy();
  const { locale } = useLocale();
  const imageGuidance = getImageUploadGuidance(locale);
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const imageForm = useForm({
    defaultValues: {
      pending: [] as File[],
      existing: initialProduct?.images ?? [],
    },
  });
  const images = useStore(imageForm.store, (state) => state.values.pending);
  const existingImages = useStore(
    imageForm.store,
    (state) => state.values.existing,
  );
  const pendingSave = React.useRef<Promise<ProductSaveResult> | null>(null);
  const [ui, dispatch] = useEffectReducer(
    productEditorReducer,
    () => ({
      options: initialOptions,
      savedProductId: initialProduct?.id ?? null,
      showMaterialWeights:
        initialProduct?.materials.some(({ weight }) => weight !== null) ??
        false,
      magnetConfigurationNotice: false,
      activePartType: null,
      openPartRoles: new Set(
        initialProduct?.compatibleParts.map(
          ({ productTypeSlug }) => productTypeSlug as PenPartProductType,
        ) ?? [],
      ),
      descriptionLoading: true,
      save: undefined,
    }),
    {
      /**
       * Runs one submitted mutation and reattaches to it after Activity resumption.
       * @param _state - State that queued this attempt.
       * @param effect - Captured validated submission.
       * @param dispatch - Terminal save dispatcher.
       * @param context - Current observer lifetime.
       */
      save: (_state, effect, dispatch, { signal }) => {
        // Retain the mutation promise across Activity; resumption only reattaches feedback.
        pendingSave.current ??= (async (): Promise<ProductSaveResult> => {
          let product: CatalogProduct | undefined;
          try {
            const result = await saveCatalogProduct({
              data: { ...effect.value, reason: effect.reason },
            });
            if (!result.ok)
              return {
                files: effect.files,
                error: { form: result.formError, fields: result.fieldErrors },
              };
            product = result.product;
            if (quickCreate || effect.files.length === 0)
              return { product, files: [] };
            const uploads = await uploadImages({
              locale,
              files: effect.files,
              getToken,
              /**
               * Offers to restore an owner-deleted duplicate before continuing uploads.
               * @param imageId - Duplicate image identifier.
               * @returns Whether the owner accepted and restored the image.
               */
              onOwnerDeletedDuplicate: async (imageId) => {
                if (
                  !window.confirm(
                    t("web.resources.trash.restoreConfirmationDescription", {
                      name: result.product.name,
                    }),
                  )
                )
                  return false;
                await restoreCatalogImage({
                  data: {
                    imageId,
                    reason: effect.reason,
                    targetType: "product",
                  },
                });
                return true;
              },
              targetId: product.id,
              targetType: "product",
              reason: effect.reason,
            });
            return {
              product,
              files: uploads.failed,
              error: uploads.failed.length
                ? { form: "web.resources.upload.sessionFailure" }
                : undefined,
            };
          } catch (error) {
            return {
              product,
              files: effect.files,
              error: {
                form: (error as ImageUploadError).key ?? "error.generic",
              },
            };
          }
        })();
        void pendingSave.current.then((result) => {
          if (signal.aborted) return;
          pendingSave.current = null;
          dispatch({ type: "saveFinished", productId: result.product?.id });
          imageForm.setFieldValue("pending", (current) =>
            current.filter(
              (file) =>
                !effect.files.includes(file) || result.files.includes(file),
            ),
          );
          if (result.error) {
            form.setErrorMap({ onSubmit: result.error });
            return;
          }
          if (!result.product) return;
          if (onCreated) {
            onCreated(result.product);
            return;
          }
          if (!quickCreate)
            void navigate({
              params: {
                productSlug: result.product.slug,
                productTypeSlug: result.product.productTypeSlug,
              },
              to: "/products/$productTypeSlug/$productSlug",
            });
        });
      },
    },
  );
  const {
    options,
    showMaterialWeights,
    magnetConfigurationNotice,
    activePartType,
    openPartRoles,
    descriptionLoading,
  } = ui;
  const supportsMaterialWeights =
    productTypeSlug === "spinner" ||
    productTypeSlug === "spinner-button" ||
    productTypeSlug === "slider";
  /**
   * Accepts the existing shared-control lookup update contract.
   * @param update - Replacement choices or a pure options updater.
   * @returns Nothing.
   */
  const receiveOptions = (update: React.SetStateAction<CatalogOptions>) =>
    dispatch({ type: "lookupOptionsChanged", update });
  /**
   * Receives editor readiness through a stable callback for existing Markdown callers.
   * @param loading - Whether the editor is initializing.
   */
  const receiveDescriptionLoading = React.useCallback(
    (loading: boolean) => {
      dispatch({ type: "descriptionLoadingChanged", loading });
    },
    [dispatch],
  );
  const descriptionRef = React.useRef<MarkdownEditorHandle>(null);
  const plateDialog = React.useRef<HTMLDialogElement>(null);
  const plateTrigger = React.useRef<HTMLButtonElement>(null);
  const plateDialogTitleId = React.useId();
  const insertDialog = React.useRef<HTMLDialogElement>(null);
  const insertTrigger = React.useRef<HTMLButtonElement>(null);
  const insertDialogTitleId = React.useId();
  const partDialog = React.useRef<HTMLDialogElement>(null);
  const partTrigger = React.useRef<HTMLButtonElement>(null);
  const partDialogTitleId = React.useId();
  /**
   * Owns the part-creation modal from its committed DOM lifetime.
   * @param node - Current modal node.
   * @returns Cleanup closing only this mounted dialog.
   */
  const bindPartDialog = React.useCallback((node: HTMLDialogElement | null) => {
    partDialog.current = node;
    if (!node) return;
    node.showModal();
    return () => {
      node.close();
      if (partDialog.current === node) partDialog.current = null;
    };
  }, []);
  const defaultValues: ProductEditorValue = {
    aliases: initialProduct?.aliases ?? [],
    bearing: initialProduct?.bearing ?? "",
    buttonDiameter: initialProduct?.buttonDiameter ?? { unit: "mm", value: "" },
    compatibleButtonId: initialProduct?.compatibleButtonId ?? null,
    compatiblePartProductIds:
      initialProduct?.compatibleParts.map(({ id }) => id) ?? [],
    description: initialProduct?.description ?? "",
    diameter: initialProduct?.diameter ?? { unit: "mm", value: "" },
    finishOptions: initialProduct?.finishOptions.length
      ? initialProduct.finishOptions.map((option) => ({
          colorEffectId: option.colorEffect?.id ?? null,
          colorEffectSlug:
            option.colorEffect?.slug === "solid"
              ? ("solid" as const)
              : option.colorEffect?.slug === "fade"
                ? ("fade" as const)
                : null,
          colorIds: option.colors.map(({ id }) => id),
          finishIds: option.finishes.map(({ id }) => id),
          patternId: option.pattern?.id ?? null,
        }))
      : [],
    includedInsertProductId: initialProduct?.includedInsert?.id ?? null,
    includedPlateProductId: initialProduct?.includedPlate?.id ?? null,
    length: initialProduct?.length ?? { unit: "mm", value: "" },
    makerId: initialProduct?.makerId ?? 0,
    productLinks: initialProduct?.productLinks.map(({ url }) => url) ?? [],
    magnetConfiguration: initialProduct?.magnetConfiguration ?? null,
    magnetLayout:
      productTypeSlug === "slider-insert"
        ? (initialProduct?.magnetLayout ?? "2x4")
        : productTypeSlug === "slider" && !initialProduct?.includedInsert
          ? (initialProduct?.magnetLayout ?? "2x4")
          : null,
    mechanismId: initialProduct?.mechanismId ?? null,
    materialAssignments:
      initialProduct?.materials.map(({ materials, weight }) => ({
        materials: materials.map(({ id, specific }) => ({
          materialId: id,
          materialSpecificId: specific?.id ?? null,
        })),
        weight: weight ?? { unit: "g", value: "" },
      })) ??
      (productTypeSlug === "refill"
        ? []
        : [
            {
              materials: [{ materialId: 0, materialSpecificId: null }],
              weight: { unit: "g", value: "" },
            },
          ]),
    name: initialProduct?.name ?? "",
    productId: initialProduct?.id ?? null,
    productTypeSlug,
    refillCompatibility: initialProduct?.refillCompatibility ?? [],
    refillModel: initialProduct?.refillModel ?? null,
    spinDiameter: initialProduct?.spinDiameter ?? { unit: "mm", value: "" },
    thickness: initialProduct?.thickness ?? { unit: "mm", value: "" },
    thicknessWithButton: initialProduct?.thicknessWithButton ?? {
      unit: "mm",
      value: "",
    },
    weight: initialProduct?.weight ?? { unit: "g", value: "" },
    width: initialProduct?.width ?? { unit: "mm", value: "" },
    usesInserts:
      initialProduct?.usesInserts ??
      (productTypeSlug === "slider" ? false : null),
  };
  const form = useForm({
    defaultValues,
    validators: {
      /**
       * Keeps schema and file validation in the form before any mutation starts.
       * @param context - Current form values.
       * @returns Existing field and form errors, if validation fails.
       */
      onSubmit: ({ value }): ProductValidation | undefined => {
        const result = productFormSchema.safeParse(value);
        if (!result.success)
          return {
            fields: z.flattenError(result.error).fieldErrors,
            form: "web.catalog.error.form",
          };
        const imageError = validateImages(
          imageForm.state.values.pending,
          locale,
        );
        if (imageError) return { form: imageError.key };
        return undefined;
      },
    },
    /**
     * Queues one validated save with its moderation reason and selected files.
     * @param context - Validated form submission.
     */
    onSubmit: ({ value }) => {
      if (descriptionRef.current?.isLoading() || ui.save) return;
      const moderating = Boolean(
        initialProduct?.canAdminister && !initialProduct.isOwner,
      );
      const reason = moderating
        ? window.prompt(t("web.resources.moderation.reasonLabel"))?.trim()
        : undefined;
      if (moderating && !reason) return;
      dispatch({
        type: "saveRequested",
        value,
        reason,
        files: imageForm.state.values.pending,
      });
    },
  });
  const serverErrors = useStore(form.store, (state) => state.fieldMeta);
  const formError = useStore(form.store, (state) => state.errorMap.onSubmit);

  /**
   * Replaces the layout and clears an incompatible snapshot.
   *
   * @param layout - Newly selected physical layout.
   */
  const changeMagnetLayout = (layout: SliderMagnetLayout) => {
    if (
      form.state.values.magnetLayout !== layout &&
      form.state.values.magnetConfiguration !== null
    ) {
      form.setFieldValue("magnetConfiguration", null);
      dispatch({ type: "magnetSnapshotDiscarded" });
    }
    form.setFieldValue("magnetLayout", layout);
  };

  return (
    <form
      className="grid min-w-0 gap-5 rounded-xl border border-border bg-card p-6 lg:grid-cols-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (descriptionRef.current?.isLoading() || ui.save) return;
        form.setFieldValue(
          "description",
          descriptionRef.current?.getValue() ?? form.state.values.description,
        );
        form.setErrorMap({ onSubmit: { form: "", fields: {} } });
        void form.handleSubmit();
      }}
    >
      <div className="grid min-w-0 content-start gap-5">
        <form.Field name="name">
          {(field) => (
            <Field label={t("web.catalog.field.name")}>
              <Input
                aria-label={t("web.catalog.field.name")}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                required
                value={field.state.value}
              />
              <FieldError error={serverErrors.name?.errors[0]} t={t} />
            </Field>
          )}
        </form.Field>
        {!quickCreate ? (
          <form.Subscribe selector={(state) => state.values.name}>
            {(name) => (
              <Field label={t("web.catalog.field.slug")}>
                <Input
                  aria-label={t("web.catalog.field.slug")}
                  readOnly
                  value={productSlugPreview(name)}
                />
              </Field>
            )}
          </form.Subscribe>
        ) : null}
        <form.Field name="makerId">
          {(field) => {
            const selected =
              options.makers.find(({ id }) => id === field.state.value) ?? null;
            return (
              <Field label={t("web.catalog.field.maker")}>
                <CatalogCombobox
                  ariaLabel={t("web.catalog.field.maker")}
                  items={options.makers}
                  onValueChange={(value) =>
                    field.handleChange(Number(value?.id ?? 0))
                  }
                  placeholder={t("web.catalog.selectMaker")}
                  value={selected}
                />
                <LookupDialog
                  kind="maker"
                  onCreated={(maker) => {
                    receiveOptions((current) => ({
                      ...current,
                      makers: [...current.makers, maker].sort((a, b) =>
                        a.name.localeCompare(b.name),
                      ),
                    }));
                    field.handleChange(maker.id);
                  }}
                  t={t}
                />
                <FieldError error={serverErrors.makerId?.errors[0]} t={t} />
              </Field>
            );
          }}
        </form.Field>
        {!quickCreate ? (
          <form.Subscribe selector={(state) => state.values.makerId}>
            {(makerId) =>
              makerId > 0 ? (
                <Field label={t("web.slider.alias.managementLabel")}>
                  {(options.terminologyAliases ?? [])
                    .filter(
                      (alias) =>
                        alias.makerId === makerId &&
                        alias.canonicalKey === productTypeSlug,
                    )
                    .map((alias) => (
                      <p className="text-sm" key={alias.id}>
                        {alias.label}
                        {alias.isPreferred
                          ? ` · ${t("web.slider.alias.preferred")}`
                          : ""}
                      </p>
                    ))}
                  <LookupDialog
                    canonicalKey={productTypeSlug}
                    kind="terminologyAlias"
                    makerId={makerId}
                    onCreated={(terminologyAlias) =>
                      receiveOptions((current) => ({
                        ...current,
                        terminologyAliases: [
                          ...(current.terminologyAliases ?? []),
                          terminologyAlias,
                        ],
                      }))
                    }
                    t={t}
                  />
                </Field>
              ) : null
            }
          </form.Subscribe>
        ) : null}
        {!quickCreate ? (
          <form.Field name="productLinks">
            {(field) => (
              <Field label={t("web.catalog.field.productLinks")}>
                <div className="space-y-3">
                  {field.state.value.map((url, index) => (
                    <div className="space-y-2" key={index}>
                      <Input
                        aria-label={t("web.catalog.field.productLink", {
                          number: index + 1,
                        })}
                        aria-describedby="product-links-help"
                        name={`${field.name}.${index}`}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(
                            field.state.value.map((currentUrl, position) =>
                              position === index
                                ? event.target.value
                                : currentUrl,
                            ),
                          )
                        }
                        type="url"
                        value={url}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={index === 0}
                          onClick={() => {
                            const next = [...field.state.value];
                            const previous = next[index - 1];
                            if (previous === undefined) return;
                            next[index - 1] = url;
                            next[index] = previous;
                            field.handleChange(next);
                          }}
                          type="button"
                          variant="outline"
                        >
                          {t("web.action.moveProductLinkUp", {
                            number: index + 1,
                          })}
                        </Button>
                        <Button
                          disabled={index === field.state.value.length - 1}
                          onClick={() => {
                            const next = [...field.state.value];
                            const following = next[index + 1];
                            if (following === undefined) return;
                            next[index] = following;
                            next[index + 1] = url;
                            field.handleChange(next);
                          }}
                          type="button"
                          variant="outline"
                        >
                          {t("web.action.moveProductLinkDown", {
                            number: index + 1,
                          })}
                        </Button>
                        <Button
                          onClick={() =>
                            field.handleChange(
                              field.state.value.filter(
                                (_, position) => position !== index,
                              ),
                            )
                          }
                          type="button"
                          variant="outline"
                        >
                          {t("web.action.removeProductLink", {
                            number: index + 1,
                          })}
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    className="w-fit"
                    onClick={() =>
                      field.handleChange([...field.state.value, ""])
                    }
                    type="button"
                    variant="outline"
                  >
                    {t("web.action.addProductLink")}
                  </Button>
                </div>
                <p
                  className="text-xs text-muted-foreground"
                  id="product-links-help"
                >
                  {t("web.catalog.help.productLinks")}
                </p>
                <FieldError
                  error={serverErrors.productLinks?.errors[0]}
                  t={t}
                />
              </Field>
            )}
          </form.Field>
        ) : null}
        {!quickCreate ? (
          <form.Field name="aliases">
            {(field) => (
              <Field label={t("web.pens.admin.aliases" as TranslationKey)}>
                <Input
                  aria-label={t("web.pens.admin.aliases" as TranslationKey)}
                  onChange={(event) =>
                    field.handleChange(
                      event.target.value
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    )
                  }
                  value={field.state.value.join(", ")}
                />
                <FieldError error={serverErrors.aliases?.errors[0]} t={t} />
              </Field>
            )}
          </form.Field>
        ) : null}
        {productTypeSlug === "pen-mechanism" ? (
          <form.Field name="mechanismId">
            {(field) => (
              <Field label={t("web.pens.admin.mechanism" as TranslationKey)}>
                <CatalogCombobox
                  ariaLabel={t("web.pens.admin.mechanism" as TranslationKey)}
                  items={options.mechanisms}
                  onValueChange={(value) =>
                    field.handleChange(value ? Number(value.id) : null)
                  }
                  placeholder={t("web.pens.admin.mechanism" as TranslationKey)}
                  value={
                    options.mechanisms.find(
                      ({ id }) => id === field.state.value,
                    ) ?? null
                  }
                />
                <FieldError error={serverErrors.mechanismId?.errors[0]} t={t} />
              </Field>
            )}
          </form.Field>
        ) : null}
        {productTypeSlug === "refill" ? (
          <form.Field name="refillModel">
            {(field) => (
              <Field label={t("web.pens.admin.refillModel" as TranslationKey)}>
                <Input
                  aria-label={t("web.pens.admin.refillModel" as TranslationKey)}
                  maxLength={200}
                  onChange={(event) => field.handleChange(event.target.value)}
                  required
                  value={field.state.value ?? ""}
                />
                <FieldError error={serverErrors.refillModel?.errors[0]} t={t} />
              </Field>
            )}
          </form.Field>
        ) : null}
        {productTypeSlug !== "refill" ? (
          <form.Field name="materialAssignments">
            {(field) => (
              <Field label={t("web.catalog.field.materials")}>
                <MaterialAssignmentsEditor
                  onChange={field.handleChange}
                  onOptionsChange={receiveOptions}
                  options={options}
                  singleAssignment={productTypeSlug === "slider-insert"}
                  t={t}
                  value={field.state.value}
                />
                {supportsMaterialWeights ? (
                  <div className="grid gap-3">
                    <Button
                      aria-pressed={showMaterialWeights}
                      className="w-fit"
                      onClick={() =>
                        dispatch({ type: "materialWeightsToggled" })
                      }
                      type="button"
                      variant="outline"
                    >
                      {t("web.catalog.materialWeights.title")}
                    </Button>
                    {showMaterialWeights ? (
                      <div className="grid gap-3">
                        {field.state.value.map((assignment, index) => {
                          const label = materialCombinationLabel(
                            assignment.materials.map(
                              ({ materialId, materialSpecificId }) => {
                                const material = options.materials.find(
                                  ({ id }) => id === materialId,
                                );
                                const specific = (
                                  options.materialSpecifics ?? []
                                ).find(({ id }) => id === materialSpecificId);
                                return {
                                  name:
                                    material?.name ??
                                    t("web.catalog.selectMaterial"),
                                  specific: specific
                                    ? { name: specific.name }
                                    : null,
                                };
                              },
                            ),
                          );
                          const weightLabel = t(
                            "web.catalog.materialWeights.field",
                            { material: label },
                          );
                          return (
                            <Field key={index} label={weightLabel}>
                              <MeasurementInput
                                kind="weight"
                                label={weightLabel}
                                onChange={(weight) =>
                                  field.handleChange(
                                    field.state.value.map((current, i) =>
                                      i === index
                                        ? {
                                            ...current,
                                            weight:
                                              weight as EditableWeightMeasurement,
                                          }
                                        : current,
                                    ),
                                  )
                                }
                                unitLabel={t(
                                  "web.catalog.field.measurementUnit",
                                  { field: weightLabel },
                                )}
                                value={assignment.weight}
                              />
                              <FieldError
                                error={
                                  positiveDecimalSchema.safeParse(
                                    assignment.weight.value,
                                  ).success
                                    ? undefined
                                    : "web.catalog.error.positive"
                                }
                                t={t}
                              />
                            </Field>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <FieldError
                  error={serverErrors.materialAssignments?.errors[0]}
                  t={t}
                />
              </Field>
            )}
          </form.Field>
        ) : null}

        {productTypeSlug !== "slider-insert" && productTypeSlug !== "refill" ? (
          <>
            <form.Field mode="array" name="finishOptions">
              {(field) => (
                <FinishOptionsEditor
                  onChange={field.handleChange}
                  onOptionsChange={receiveOptions}
                  options={options}
                  t={t}
                  value={field.state.value}
                />
              )}
            </form.Field>
            <FieldError error={serverErrors.finishOptions?.errors[0]} t={t} />
          </>
        ) : null}

        {productTypeSlug === "pen" ? (
          <>
            <form.Field mode="array" name="refillCompatibility">
              {(field) => {
                const groupOptions: ComboboxOption[] = (
                  options.refillCompatibilityGroups ?? []
                ).map(({ id, name }) => ({
                  group: "groups",
                  id: `group:${id}`,
                  name,
                  selectionName: `${t("web.pens.admin.targetType.group" as TranslationKey)}: ${name}`,
                }));
                const refillOptions: ComboboxOption[] =
                  options.relationshipProducts
                    .filter(
                      ({ productTypeSlug }) => productTypeSlug === "refill",
                    )
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(({ id, name }) => ({
                      group: "refills",
                      id: `refill:${id}`,
                      name,
                    }));
                const items = [...groupOptions, ...refillOptions];
                const selected = field.state.value.flatMap(
                  ({ targetGroupId, targetRefillProductId }) => {
                    const id =
                      targetGroupId === null
                        ? `refill:${targetRefillProductId}`
                        : `group:${targetGroupId}`;
                    const option = items.find(
                      (candidate) => candidate.id === id,
                    );
                    return option ? [option] : [];
                  },
                );
                const label = t(
                  "web.pens.field.compatibleRefills" as TranslationKey,
                );
                return (
                  <Field label={label}>
                    <CatalogMultiCombobox
                      ariaLabel={label}
                      groups={[
                        {
                          id: "groups",
                          label: t(
                            "web.pens.admin.targetType.group" as TranslationKey,
                          ),
                        },
                        {
                          id: "refills",
                          label: t(
                            "web.pens.admin.targetType.refill" as TranslationKey,
                          ),
                        },
                      ]}
                      items={items}
                      onValueChange={(value) =>
                        field.handleChange(
                          value.map(({ id }) => {
                            const [kind, rawId] = String(id).split(":");
                            return {
                              targetGroupId:
                                kind === "group" ? Number(rawId) : null,
                              targetRefillProductId:
                                kind === "refill" ? Number(rawId) : null,
                            };
                          }),
                        )
                      }
                      placeholder={label}
                      removeLabel={(name) =>
                        `${t("web.action.delete")} ${name}`
                      }
                      value={selected}
                    />
                    <FieldError
                      error={serverErrors.refillCompatibility?.errors[0]}
                      t={t}
                    />
                  </Field>
                );
              }}
            </form.Field>
            <form.Field mode="array" name="compatiblePartProductIds">
              {(field) => (
                <fieldset className="grid gap-4 rounded-md border border-border p-4">
                  <legend className="px-1 font-semibold">
                    {t("web.pens.compatibleParts.heading")}
                  </legend>
                  {penPartProductTypes.map((role) => {
                    const checked = openPartRoles.has(role.type);
                    const items = options.relationshipProducts.filter(
                      (candidate) =>
                        candidate.id !== initialProduct?.id &&
                        candidate.productTypeSlug === role.type,
                    );
                    const selected = items.filter((candidate) =>
                      field.state.value.includes(candidate.id),
                    );
                    return (
                      <div className="grid gap-2" key={role.type}>
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <input
                            checked={checked}
                            onChange={(event) => {
                              dispatch({
                                type: "partRoleToggled",
                                role: role.type,
                              });
                              if (!event.target.checked)
                                field.handleChange(
                                  field.state.value.filter(
                                    (id) =>
                                      !items.some(
                                        (candidate) => candidate.id === id,
                                      ),
                                  ),
                                );
                            }}
                            type="checkbox"
                          />
                          {t(role.label)}
                        </label>
                        {checked ? (
                          <div className="grid gap-2 pl-6">
                            <CatalogMultiCombobox
                              ariaLabel={t(role.label)}
                              items={items}
                              onValueChange={(value) => {
                                const otherRoleIds = field.state.value.filter(
                                  (id) =>
                                    !items.some(
                                      (candidate) => candidate.id === id,
                                    ),
                                );
                                field.handleChange([
                                  ...otherRoleIds,
                                  ...value.map(({ id }) => Number(id)),
                                ]);
                              }}
                              placeholder={t("web.catalog.selectProductType")}
                              removeLabel={(name) =>
                                t("web.action.removeSelection", { name })
                              }
                              value={selected}
                            />
                            <Button
                              aria-haspopup="dialog"
                              onClick={(event) => {
                                partTrigger.current = event.currentTarget;
                                dispatch({
                                  type: "partCreationChanged",
                                  partType: role.type,
                                });
                              }}
                              type="button"
                              variant="outline"
                            >
                              {t("web.action.addProduct")}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  <FieldError
                    error={serverErrors.compatiblePartProductIds?.errors[0]}
                    t={t}
                  />
                </fieldset>
              )}
            </form.Field>
          </>
        ) : null}

        {(productTypeSlug === "pen" ||
        productTypeSlug.startsWith("pen-") ||
        productTypeSlug === "refill"
          ? ([] as const)
          : productTypeSlug === "spinner"
            ? ([
                "weight",
                "length",
                "width",
                "thickness",
                "thicknessWithButton",
                "buttonDiameter",
                "spinDiameter",
              ] as const)
            : productTypeSlug === "spinner-button"
              ? (["weight", "diameter", "thickness"] as const)
              : productTypeSlug === "slider-plate" ||
                  productTypeSlug === "slider-insert"
                ? ([] as const)
                : (["weight", "length", "width", "thickness"] as const)
        ).map((name) => {
          const labels = {
            buttonDiameter: "web.catalog.field.buttonDiameter",
            diameter: "web.archive.spec.diameter",
            length: "web.archive.spec.length",
            spinDiameter: "web.catalog.field.spinDiameter",
            thickness: "web.catalog.field.thickness",
            thicknessWithButton: "web.catalog.field.thicknessWithButton",
            weight: "web.catalog.field.defaultWeight",
            width: "web.catalog.field.width",
          } as const;
          return (
            <form.Field key={name} name={name}>
              {(field) => (
                <Field label={t(labels[name])}>
                  <MeasurementInput
                    kind={name === "weight" ? "weight" : "dimension"}
                    label={t(labels[name])}
                    onBlur={field.handleBlur}
                    onChange={(value: MeasurementInputValue) => {
                      field.handleChange(value as never);
                      if (name === "buttonDiameter") {
                        form.setFieldValue("compatibleButtonId", null);
                      }
                    }}
                    unitLabel={t("web.catalog.field.measurementUnit", {
                      field: t(labels[name]),
                    })}
                    value={field.state.value as never}
                  />
                  <FieldError error={serverErrors[name]?.errors[0]} t={t} />
                </Field>
              )}
            </form.Field>
          );
        })}
        {productTypeSlug === "slider" ? (
          <form.Field name="includedPlateProductId">
            {(field) => {
              const plates = options.relationshipProducts.filter(
                (candidate) =>
                  candidate.id !== initialProduct?.id &&
                  candidate.productTypeSlug === "slider-plate",
              );
              const included = {
                id: "included",
                name: t("web.slider.relationship.includedPlates"),
              };
              return (
                <Field label={t("web.slider.relationship.plates")}>
                  <CatalogCombobox
                    ariaLabel={t("web.slider.relationship.plates")}
                    items={[included, ...plates]}
                    onValueChange={(value) =>
                      field.handleChange(
                        value && value.id !== "included"
                          ? Number(value.id)
                          : null,
                      )
                    }
                    placeholder={t("web.slider.relationship.includedPlates")}
                    value={
                      plates.find(({ id }) => id === field.state.value) ??
                      included
                    }
                  />
                  <Button
                    aria-haspopup="dialog"
                    onClick={() => plateDialog.current?.showModal()}
                    ref={plateTrigger}
                    type="button"
                    variant="outline"
                  >
                    {t("web.slider.relationship.addPlates")}
                  </Button>
                  <FieldError
                    error={serverErrors.includedPlateProductId?.errors[0]}
                    t={t}
                  />
                </Field>
              );
            }}
          </form.Field>
        ) : null}
        {productTypeSlug === "slider" ? (
          <form.Field name="usesInserts">
            {(field) => (
              <Field label={t("web.slider.capability.usesInserts")}>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    checked={field.state.value === true}
                    onChange={(event) => {
                      const usesInserts = event.target.checked;
                      field.handleChange(usesInserts);
                      form.setFieldValue("includedInsertProductId", null);
                      changeMagnetLayout("2x4");
                    }}
                    type="checkbox"
                  />
                  {t("web.slider.capability.usesInserts")}
                </label>
                <FieldError error={serverErrors.usesInserts?.errors[0]} t={t} />
              </Field>
            )}
          </form.Field>
        ) : null}
        {productTypeSlug === "slider" ? (
          <form.Subscribe selector={(state) => state.values.usesInserts}>
            {(usesInserts) =>
              usesInserts ? (
                <form.Field name="includedInsertProductId">
                  {(field) => {
                    const inserts = options.relationshipProducts.filter(
                      (candidate) =>
                        candidate.id !== initialProduct?.id &&
                        candidate.productTypeSlug === "slider-insert",
                    );
                    const included = {
                      id: "included",
                      name: t("web.slider.relationship.includedInsert"),
                    };
                    return (
                      <Field label={t("web.slider.relationship.inserts")}>
                        <CatalogCombobox
                          ariaLabel={t("web.slider.relationship.inserts")}
                          items={[included, ...inserts]}
                          onValueChange={(value) => {
                            const currentLayout =
                              form.state.values.magnetLayout ??
                              options.relationshipProducts.find(
                                ({ id }) =>
                                  id ===
                                  form.state.values.includedInsertProductId,
                              )?.magnetLayout ??
                              null;
                            const insertId =
                              value && value.id !== "included"
                                ? Number(value.id)
                                : null;
                            const nextLayout = insertId
                              ? (inserts.find(({ id }) => id === insertId)
                                  ?.magnetLayout ?? null)
                              : "2x4";
                            field.handleChange(insertId);
                            form.setFieldValue(
                              "magnetLayout",
                              nextLayout
                                ? insertId === null
                                  ? nextLayout
                                  : null
                                : null,
                            );
                            if (
                              currentLayout !== nextLayout &&
                              form.state.values.magnetConfiguration !== null
                            ) {
                              form.setFieldValue("magnetConfiguration", null);
                              dispatch({ type: "magnetSnapshotDiscarded" });
                            }
                          }}
                          placeholder={t(
                            "web.slider.relationship.includedInsert",
                          )}
                          value={
                            inserts.find(
                              ({ id }) => id === field.state.value,
                            ) ?? included
                          }
                        />
                        <Button
                          aria-haspopup="dialog"
                          onClick={() => insertDialog.current?.showModal()}
                          ref={insertTrigger}
                          type="button"
                          variant="outline"
                        >
                          {t("web.slider.relationship.addInsert")}
                        </Button>
                        <FieldError
                          error={
                            serverErrors.includedInsertProductId?.errors[0]
                          }
                          t={t}
                        />
                      </Field>
                    );
                  }}
                </form.Field>
              ) : null
            }
          </form.Subscribe>
        ) : null}
        {productTypeSlug === "slider" || productTypeSlug === "slider-insert" ? (
          <form.Subscribe
            selector={(state) => state.values.includedInsertProductId}
          >
            {(includedInsertProductId) =>
              includedInsertProductId === null ? (
                <form.Field name="magnetLayout">
                  {(field) => {
                    const items = sliderMagnetLayouts.map((layout) => ({
                      id: layout,
                      name: t("web.slider.layout.option", {
                        count: sliderMagnetLayoutDetails[layout].clickCount,
                        layout: sliderMagnetLayoutDetails[layout].label,
                      }),
                    }));
                    const selected = items.find(
                      ({ id }) => id === field.state.value,
                    );
                    const details = field.state.value
                      ? sliderMagnetLayoutDetails[field.state.value]
                      : null;
                    return (
                      <Field label={t("web.slider.layout.label")}>
                        <CatalogCombobox
                          ariaLabel={t("web.slider.layout.label")}
                          items={items}
                          onValueChange={(value) =>
                            changeMagnetLayout(
                              sliderMagnetLayouts.find(
                                (layout) => layout === value?.id,
                              ) ?? "2x4",
                            )
                          }
                          placeholder={t("web.slider.layout.label")}
                          value={selected ?? items[2] ?? null}
                        />
                        {details ? (
                          <p className="m-0 text-sm text-muted-foreground">
                            {t("web.slider.layout.help", {
                              clicks: details.clickCount,
                              columns: details.columnCount,
                              layout: details.label,
                              rows: details.rowCount,
                              slots: details.slotsPerSide,
                            })}
                          </p>
                        ) : null}
                        <FieldError
                          error={serverErrors.magnetLayout?.errors[0]}
                          t={t}
                        />
                      </Field>
                    );
                  }}
                </form.Field>
              ) : null
            }
          </form.Subscribe>
        ) : null}
        {productTypeSlug === "slider" ? (
          <form.Subscribe
            selector={(state) =>
              [
                state.values.includedInsertProductId,
                state.values.magnetLayout,
              ] as const
            }
          >
            {([includedInsertProductId, magnetLayout]) => {
              const effectiveLayout =
                magnetLayout ??
                options.relationshipProducts.find(
                  ({ id }) => id === includedInsertProductId,
                )?.magnetLayout ??
                null;
              return effectiveLayout ? (
                <form.Field name="magnetConfiguration">
                  {(field) => (
                    <SliderMagnetConfigurationEditor
                      layout={effectiveLayout}
                      onChange={field.handleChange}
                      presets={options.magnetPresets}
                      t={t}
                      value={field.state.value}
                    />
                  )}
                </form.Field>
              ) : null;
            }}
          </form.Subscribe>
        ) : null}
        {magnetConfigurationNotice ? (
          <Notice>{t("web.slider.magnet.layoutChanged")}</Notice>
        ) : null}
        {productTypeSlug === "spinner" ? (
          <form.Field name="bearing">
            {(field) => (
              <Field label={t("web.catalog.field.bearing")}>
                <Input
                  aria-label={t("web.catalog.field.bearing")}
                  maxLength={200}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
                <FieldError error={serverErrors.bearing?.errors[0]} t={t} />
              </Field>
            )}
          </form.Field>
        ) : null}
        {productTypeSlug === "spinner" ? (
          <form.Subscribe selector={(state) => state.values.buttonDiameter}>
            {(diameter) => (
              <form.Field name="compatibleButtonId">
                {(field) => {
                  const selected = field.state.value
                    ? (options.spinnerButtons.find(
                        ({ id }) => id === field.state.value,
                      ) ?? null)
                    : { id: "default", name: t("web.catalog.defaultButton") };
                  return (
                    <Field label={t("web.catalog.field.button")}>
                      <CatalogCombobox
                        ariaLabel={t("web.catalog.field.button")}
                        items={[
                          {
                            id: "default",
                            name: t("web.catalog.defaultButton"),
                          },
                          ...filterButtonsByDiameter(
                            options.spinnerButtons,
                            diameter,
                          ),
                        ]}
                        onValueChange={(value) =>
                          field.handleChange(
                            value && value.id !== "default"
                              ? Number(value.id)
                              : null,
                          )
                        }
                        placeholder={t("web.catalog.defaultButton")}
                        removeLabel={t("web.action.close")}
                        showSelectedPill
                        value={selected}
                      />
                      <FieldError
                        error={serverErrors.compatibleButtonId?.errors[0]}
                        t={t}
                      />
                    </Field>
                  );
                }}
              </form.Field>
            )}
          </form.Subscribe>
        ) : null}
      </div>

      <div className="grid min-w-0 content-start gap-5">
        <form.Field name="description">
          {(field) => (
            <CatalogMarkdownEditor
              defaultValue={field.state.value}
              error={
                serverErrors.description?.errors[0]
                  ? t(serverErrors.description.errors[0])
                  : undefined
              }
              help={t("web.catalog.help.markdownDescription")}
              id="product-description"
              label={t("web.catalog.field.description")}
              onChange={field.handleChange}
              onLoadingChange={receiveDescriptionLoading}
              ref={descriptionRef}
            />
          )}
        </form.Field>
        {!quickCreate ? (
          <FileDropInput
            accept=".avif,.jpeg,.jpg,.png,.webp"
            disabled={Boolean(ui.save)}
            aspectRatio={4 / 3}
            aspectRatioHelpHref="/help/image-size-and-resolution-guide"
            aspectRatioHelpLabel={imageGuidance.helpLabel}
            aspectRatioWarning={imageGuidance.warning}
            browseLabel={t("web.resources.upload.browseFiles")}
            description={t("web.resources.upload.imagesHelp", {
              maxFileSize: formatMiB(maxImageBytes, locale),
              maxImages: maxImageSessionFiles,
              maxSessionSize: formatMiB(maxImageSessionBytes, locale),
            })}
            fileTypes={t("web.resources.upload.imageTypes")}
            files={images}
            id="product-images"
            label={t("web.resources.upload.imagesLabel")}
            multiple
            onFilesChange={(additions) =>
              imageForm.setFieldValue("pending", (current) => [
                ...current,
                ...additions,
              ])
            }
            onRemove={(index) =>
              imageForm.setFieldValue("pending", (current) =>
                current.filter((_, candidate) => candidate !== index),
              )
            }
            removeFileLabel={t("web.action.close")}
          />
        ) : null}
        {initialProduct ? (
          <CatalogImageEditor
            getReason={
              initialProduct.canAdminister && !initialProduct.isOwner
                ? () =>
                    window
                      .prompt(t("web.resources.moderation.reasonLabel"))
                      ?.trim()
                : undefined
            }
            images={existingImages}
            onChange={(value) => imageForm.setFieldValue("existing", value)}
            t={t}
            targetType="product"
          />
        ) : null}
        {!initialProduct && !quickCreate ? (
          <p className="m-0 text-sm text-muted-foreground">
            {t("web.erasure.productNotice")}
          </p>
        ) : null}
      </div>
      {formError ? (
        <div className="lg:col-span-2">
          <Notice>
            {t(typeof formError === "string" ? formError : formError.form)}
          </Notice>
        </div>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2 lg:col-span-2">
        <Button
          onClick={() => {
            if (onCancel) {
              onCancel();
              return;
            }
            if (initialProduct) {
              void navigate({
                params: {
                  productSlug: initialProduct.slug,
                  productTypeSlug: initialProduct.productTypeSlug,
                },
                to: "/products/$productTypeSlug/$productSlug",
              });
              return;
            }
            void navigate({ to: "/products" });
          }}
          type="button"
          variant="outline"
        >
          {t("action.cancel")}
        </Button>
        <form.Subscribe
          selector={(state) => [state.isSubmitting, state.values.description]}
        >
          {([isSubmitting, description]) => (
            <Button
              disabled={
                Boolean(isSubmitting) ||
                Boolean(ui.save) ||
                descriptionLoading ||
                String(description).length > 5000
              }
              type="submit"
            >
              {initialProduct ? t("action.save") : t("web.action.addProduct")}
            </Button>
          )}
        </form.Subscribe>
      </div>
      {typeof document !== "undefined" && productTypeSlug === "slider"
        ? createPortal(
            <dialog
              aria-labelledby={plateDialogTitleId}
              className="m-auto w-[min(64rem,calc(100%-2rem))] rounded-xl border border-border bg-card p-0 text-card-foreground backdrop:bg-black/60"
              ref={plateDialog}
            >
              <div className="grid gap-4 p-6">
                <h2 className="text-lg font-semibold" id={plateDialogTitleId}>
                  {t("web.slider.relationship.addPlates")}
                </h2>
                <ProductEditor
                  onCancel={() => {
                    plateDialog.current?.close();
                    plateTrigger.current?.focus();
                  }}
                  onCreated={(plate) => {
                    receiveOptions((current) => ({
                      ...current,
                      relationshipProducts: [
                        ...current.relationshipProducts,
                        plate,
                      ].sort((a, b) => a.name.localeCompare(b.name)),
                    }));
                    form.setFieldValue("includedPlateProductId", plate.id);
                    plateDialog.current?.close();
                    plateTrigger.current?.focus();
                  }}
                  options={options}
                  productTypeSlug="slider-plate"
                  quickCreate
                />
              </div>
            </dialog>,
            document.body,
          )
        : null}
      {typeof document !== "undefined" &&
      productTypeSlug === "pen" &&
      activePartType
        ? createPortal(
            <dialog
              aria-labelledby={partDialogTitleId}
              className="m-auto w-[min(64rem,calc(100%-2rem))] rounded-xl border border-border bg-card p-0 text-card-foreground backdrop:bg-black/60"
              onCancel={(event) => {
                event.preventDefault();
                dispatch({ type: "partCreationChanged", partType: null });
                partTrigger.current?.focus();
              }}
              ref={bindPartDialog}
            >
              <div className="grid gap-4 p-6">
                <h2 className="text-lg font-semibold" id={partDialogTitleId}>
                  {t("web.action.addProduct")}
                </h2>
                <ProductEditor
                  onCancel={() => {
                    partDialog.current?.close();
                    dispatch({ type: "partCreationChanged", partType: null });
                    partTrigger.current?.focus();
                  }}
                  onCreated={(part) => {
                    receiveOptions((current) => ({
                      ...current,
                      relationshipProducts: [
                        ...current.relationshipProducts,
                        part,
                      ].sort((a, b) => a.name.localeCompare(b.name)),
                    }));
                    form.setFieldValue("compatiblePartProductIds", [
                      ...form.state.values.compatiblePartProductIds,
                      part.id,
                    ]);
                    partDialog.current?.close();
                    dispatch({ type: "partCreationChanged", partType: null });
                    partTrigger.current?.focus();
                  }}
                  options={options}
                  productTypeSlug={activePartType}
                />
              </div>
            </dialog>,
            document.body,
          )
        : null}
      {typeof document !== "undefined" && productTypeSlug === "slider"
        ? createPortal(
            <dialog
              aria-labelledby={insertDialogTitleId}
              className="m-auto w-[min(64rem,calc(100%-2rem))] rounded-xl border border-border bg-card p-0 text-card-foreground backdrop:bg-black/60"
              ref={insertDialog}
            >
              <div className="grid gap-4 p-6">
                <h2 className="text-lg font-semibold" id={insertDialogTitleId}>
                  {t("web.slider.relationship.addInsert")}
                </h2>
                <ProductEditor
                  onCancel={() => {
                    insertDialog.current?.close();
                    insertTrigger.current?.focus();
                  }}
                  onCreated={(insert) => {
                    receiveOptions((current) => ({
                      ...current,
                      relationshipProducts: [
                        ...current.relationshipProducts,
                        insert,
                      ].sort((a, b) => a.name.localeCompare(b.name)),
                    }));
                    form.setFieldValue("includedInsertProductId", insert.id);
                    form.setFieldValue("magnetLayout", null);
                    insertDialog.current?.close();
                    insertTrigger.current?.focus();
                  }}
                  options={options}
                  productTypeSlug="slider-insert"
                  quickCreate
                />
              </div>
            </dialog>,
            document.body,
          )
        : null}
    </form>
  );
}
/** Editable finish option value used by product and collection forms. */
type FinishOptionFormValue = ProductFormInput["finishOptions"][number];

/**
 * Performs a collection cover change.
 *
 * @param reason - Optional moderation reason.
 * @returns A promise that resolves after the cover changes.
 */
type CollectionCoverAction = (reason?: string) => Promise<void>;

/**
 * Creates an empty editable finish option.
 *
 * @returns A finish option without selected values.
 */
const emptyFinishOption = (): FinishOptionFormValue => ({
  colorEffectId: null,
  colorEffectSlug: null,
  colorIds: [],
  finishIds: [],
  patternId: null,
});

/**
 * Renders editable appearance options for catalog products and collection items.
 *
 * @param root0 - Finish option editor properties.
 * @returns The finish option fields.
 */
export function FinishOptionsEditor({
  onChange,
  onOptionsChange,
  options,
  singleOption = false,
  t,
  value,
}: {
  /**
   * Receives the next ordered finish options.
   *
   * @param value - Updated finish options.
   */
  onChange: (value: FinishOptionFormValue[]) => void;
  /**
   * Updates shared catalog lookup options.
   *
   * @param value - Next options or an updater function.
   */
  onOptionsChange: React.Dispatch<React.SetStateAction<CatalogOptions>>;
  /** Available catalog lookup values. */
  options: CatalogOptions;
  /** Whether the editor contains exactly one option. */
  singleOption?: boolean;
  /** Localized catalog message formatter. */
  t: ReturnType<typeof useCatalogCopy>;
  /** Current ordered finish options. */
  value: FinishOptionFormValue[];
}) {
  /**
   * Replaces one finish option.
   *
   * @param index - Position to update.
   * @param option - Replacement finish option.
   * @returns Nothing.
   */
  const update = (index: number, option: FinishOptionFormValue) =>
    onChange(
      value.map((current, position) => (position === index ? option : current)),
    );
  /**
   * Moves one finish option by a relative offset.
   *
   * @param index - Current option position.
   * @param offset - Relative destination offset.
   */
  const move = (index: number, offset: number) => {
    const next = [...value];
    const target = index + offset;
    const current = next[index];
    const destination = next[target];
    if (!current || !destination) return;
    next[index] = destination;
    next[target] = current;
    onChange(next);
  };

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-medium">
        {t("web.slider.appearance.label")}
      </legend>
      {value.map((option, index) => {
        const effectOptions = options.colorEffects.map((effect) => ({
          ...effect,
          name:
            effect.slug === "fade"
              ? t("web.catalog.colorEffect.fade")
              : effect.slug === "solid"
                ? t("web.catalog.colorEffect.solid")
                : effect.name,
        }));
        const selectedFinishes = option.finishIds.flatMap(
          (id) => options.finishes.find((finish) => finish.id === id) ?? [],
        );
        const selectedColors = option.colorIds.flatMap(
          (id) => options.colors.find((color) => color.id === id) ?? [],
        );
        const selectedEffect =
          effectOptions.find(({ id }) => id === option.colorEffectId) ?? null;
        const selectedPattern =
          options.patterns.find(({ id }) => id === option.patternId) ?? null;
        const preview = finishOptionLabel({
          colorEffect: selectedEffect,
          colors: selectedColors,
          finishes: selectedFinishes,
          pattern: selectedPattern,
        });

        return (
          <section
            className="grid gap-4 rounded-lg border border-border bg-background p-4"
            key={index}
          >
            <Field label={t("web.catalog.field.finishes")}>
              <CatalogMultiCombobox
                ariaLabel={t("web.catalog.field.finishes")}
                items={options.finishes}
                onValueChange={(finishes) =>
                  update(index, {
                    ...option,
                    finishIds: finishes.map(({ id }) => Number(id)),
                  })
                }
                placeholder={t("web.catalog.selectFinishes")}
                removeLabel={t("web.action.close")}
                value={selectedFinishes}
              />
              <LookupDialog
                kind="finish"
                onCreated={(finish) => {
                  onOptionsChange((current) => ({
                    ...current,
                    finishes: [...current.finishes, finish].sort((a, b) =>
                      a.name.localeCompare(b.name),
                    ),
                  }));
                  update(index, {
                    ...option,
                    finishIds: [...option.finishIds, finish.id],
                  });
                }}
                t={t}
              />
            </Field>
            <Field label={t("web.catalog.field.colors")}>
              <CatalogMultiCombobox
                ariaLabel={t("web.catalog.field.colors")}
                items={options.colors}
                onValueChange={(colors) =>
                  update(index, {
                    ...option,
                    colorEffectId: colors.length ? option.colorEffectId : null,
                    colorEffectSlug: colors.length
                      ? option.colorEffectSlug
                      : null,
                    colorIds: colors.map(({ id }) => Number(id)),
                  })
                }
                placeholder={t("web.catalog.selectColors")}
                removeLabel={t("web.action.close")}
                value={selectedColors}
              />
              <LookupDialog
                kind="color"
                onCreated={(color) => {
                  onOptionsChange((current) => ({
                    ...current,
                    colors: [...current.colors, color].sort((a, b) =>
                      a.name.localeCompare(b.name),
                    ),
                  }));
                  update(index, {
                    ...option,
                    colorIds: [...option.colorIds, color.id],
                  });
                }}
                t={t}
              />
            </Field>
            {option.colorIds.length ? (
              <Field label={t("web.catalog.field.colorEffect")}>
                <CatalogCombobox
                  ariaLabel={t("web.catalog.field.colorEffect")}
                  items={effectOptions}
                  onValueChange={(effect) =>
                    update(index, {
                      ...option,
                      colorEffectId: effect ? Number(effect.id) : null,
                      colorEffectSlug:
                        effect?.id ===
                        effectOptions.find(({ slug }) => slug === "fade")?.id
                          ? "fade"
                          : effect
                            ? "solid"
                            : null,
                    })
                  }
                  placeholder={t("web.catalog.selectColorEffect")}
                  value={selectedEffect}
                />
              </Field>
            ) : null}
            <Field label={t("web.slider.appearance.pattern")}>
              <CatalogCombobox
                ariaLabel={t("web.slider.appearance.pattern")}
                items={options.patterns}
                onValueChange={(pattern) =>
                  update(index, {
                    ...option,
                    patternId: pattern ? Number(pattern.id) : null,
                  })
                }
                placeholder={t("web.slider.appearance.selectPattern")}
                removeLabel={t("web.action.close")}
                value={selectedPattern}
              />
              <LookupDialog
                kind="pattern"
                onCreated={(pattern) => {
                  onOptionsChange((current) => ({
                    ...current,
                    patterns: [...current.patterns, pattern].sort((a, b) =>
                      a.name.localeCompare(b.name),
                    ),
                  }));
                  update(index, { ...option, patternId: pattern.id });
                }}
                t={t}
              />
            </Field>
            {preview ? (
              <p className="text-sm text-muted-foreground">
                {t("web.catalog.finishPreview", { finish: preview })}
              </p>
            ) : null}
            {!singleOption ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  type="button"
                  variant="outline"
                >
                  {t("web.action.moveFinishOptionUp")}
                </Button>
                <Button
                  disabled={index === value.length - 1}
                  onClick={() => move(index, 1)}
                  type="button"
                  variant="outline"
                >
                  {t("web.action.moveFinishOptionDown")}
                </Button>
                <Button
                  onClick={() =>
                    onChange(value.filter((_, position) => position !== index))
                  }
                  type="button"
                  variant="outline"
                >
                  {t("web.action.removeFinishOption")}
                </Button>
              </div>
            ) : null}
          </section>
        );
      })}
      {!singleOption ? (
        <Button
          className="w-fit"
          onClick={() => onChange([...value, emptyFinishOption()])}
          type="button"
          variant="outline"
        >
          {t("web.action.addFinishOption")}
        </Button>
      ) : null}
    </fieldset>
  );
}

/** Properties for catalog lookup creation dialogs. */
type LookupDialogProps = (
  | {
      /** Lookup kind created by this dialog. */
      kind: "maker";
      /**
       * Receives a newly created maker.
       *
       * @param value - Created maker value.
       */
      onCreated: (value: CatalogMaker) => void;
    }
  | {
      /** Lookup kind created by this dialog. */
      kind: "color";
      /**
       * Receives a newly created color.
       *
       * @param value - Created color value.
       */
      onCreated: (value: CatalogColor) => void;
    }
  | {
      /** Product type named by the alias. */
      canonicalKey: CatalogProductType;
      /** Lookup kind created by this dialog. */
      kind: "terminologyAlias";
      /** Maker that owns the terminology alias. */
      makerId: number;
      /**
       * Receives the created terminology alias.
       *
       * @param value - Created catalog terminology alias.
       */
      onCreated: (value: CatalogTerminologyAlias) => void;
    }
  | {
      /** Lookup kind created by this dialog. */
      kind: "finish" | "material" | "pattern";
      /**
       * Receives a newly created finish or material.
       *
       * @param value - Created lookup value.
       */
      onCreated: (value: CatalogLookup) => void;
    }
) & {
  /** Localized catalog message formatter. */
  t: ReturnType<typeof useCatalogCopy>;
};

/** Inline lookup fields owned by the dialog form. */
type LookupFields = {
  /** Canonical lookup name or maker terminology label. */
  name: string;
  /** Color hex input. */
  hex: string;
  /** Optional maker root URL. */
  rootUrl: string;
  /** Preferred maker terminology choice. */
  isPreferred: boolean;
};
/** Created lookup discriminated by its stable caller contract. */
type CreatedLookup =
  | {
      /** Maker result. */
      kind: "maker";
      /** Created maker. */
      value: CatalogMaker;
    }
  | {
      /** Color result. */
      kind: "color";
      /** Created color. */
      value: CatalogColor;
    }
  | {
      /** Maker terminology result. */
      kind: "terminologyAlias";
      /** Created terminology alias. */
      value: CatalogTerminologyAlias;
    }
  | {
      /** Shared lookup result. */
      kind: "finish" | "material" | "pattern";
      /** Created canonical lookup. */
      value: CatalogLookup;
    };
/** Inline lookup result retained across lifecycle resumption. */
type LookupSaveResult = {
  /** Created value on success. */
  created?: CreatedLookup;
  /** Existing field and form failures. */
  error?: ProductValidation;
};
/** Pending inline lookup creation. */
type LookupSaveState =
  | EffectEntity<LookupSaveState, LookupSaveEvent>
  | undefined;
/** Creation, dismissal, and terminal lookup events. */
type LookupSaveEvent =
  | {
      /** Submits captured inline fields. */
      type: "requested";
      /** Fields validated by the dialog form. */
      fields: LookupFields;
    }
  | {
      /** Disposes a dismissed or completed lookup. */
      type: "closed" | "finished";
    };
/** Committed inline lookup creation. */
type LookupSaveEffect = {
  /** Creation implementation. */
  type: "create";
  /** Captured inline form values. */
  fields: LookupFields;
};

/**
 * Renders a modal for creating one catalog lookup value.
 *
 * @param props - Lookup kind, callback, and localized copy.
 * @returns The lookup creation dialog.
 */
function LookupDialog(props: LookupDialogProps) {
  const { kind, t } = props;
  const ref = React.useRef<HTMLDialogElement>(null);
  const dialogId = React.useId();
  const titleId = React.useId();
  const form = useForm({
    defaultValues: {
      name: "",
      hex: "#808080",
      rootUrl: "",
      isPreferred: false,
    },
    validators: {
      /**
       * Requires a lookup name before creation.
       * @param context - Current lookup fields.
       * @returns Existing localized validation feedback.
       */
      onSubmit: ({ value }): ProductValidation | undefined =>
        value.name.trim()
          ? undefined
          : {
              form: "web.catalog.error.form",
              fields: { name: ["web.catalog.error.required"] },
            },
    },
    /**
     * Queues the validated lookup without restarting completed mutations.
     * @param context - Current form submission.
     * @returns Nothing.
     */
    onSubmit: ({ value }) => dispatch({ type: "requested", fields: value }),
  });
  const { name, hex, rootUrl, isPreferred } = useStore(
    form.store,
    (state) => state.values,
  );
  const fieldErrors = useStore(form.store, (state) => state.fieldMeta);
  const error = useStore(form.store, (state) => state.errorMap.onSubmit);
  const pending = React.useRef<{
    /** Descriptor whose mutation must not replay. */
    effect: LookupSaveEffect;
    /** Mutation completion retained across suspended observers. */
    promise: Promise<LookupSaveResult>;
  } | null>(null);
  const [saving, dispatch] = useEffectReducer<
    LookupSaveState,
    LookupSaveEvent,
    LookupSaveEffect
  >(
    (state, event, exec) => {
      if (event.type === "requested")
        return state ?? exec({ type: "create", fields: event.fields });
      exec.stop(state);
      return undefined;
    },
    undefined,
    {
      /**
       * Creates one lookup and publishes only to its active dialog observer.
       * @param _state - Current creation lifetime.
       * @param effect - Captured fields.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current observer lifetime.
       */
      create: (_state, effect, dispatch, { signal }) => {
        if (pending.current?.effect !== effect)
          pending.current = { effect, promise: create(effect.fields) };
        void pending.current.promise.then((result) => {
          if (signal.aborted) return;
          pending.current = null;
          dispatch({ type: "finished" });
          if (result.error) {
            form.setErrorMap({ onSubmit: result.error });
            return;
          }
          const created = result.created;
          if (!created) return;
          if (created.kind === "maker" && props.kind === "maker")
            props.onCreated(created.value);
          else if (created.kind === "color" && props.kind === "color")
            props.onCreated(created.value);
          else if (
            created.kind === "terminologyAlias" &&
            props.kind === "terminologyAlias"
          )
            props.onCreated(created.value);
          else if (
            (created.kind === "finish" ||
              created.kind === "material" ||
              created.kind === "pattern") &&
            (props.kind === "finish" ||
              props.kind === "material" ||
              props.kind === "pattern")
          )
            props.onCreated(created.value);
          form.reset();
          ref.current?.close();
        });
      },
    },
  );
  const action = {
    color: "web.action.addColor",
    finish: "web.action.addFinish",
    maker: "web.action.addMaker",
    material: "web.action.addMaterial",
    pattern: "web.slider.appearance.pattern",
    terminologyAlias: "web.slider.alias.add",
  }[kind] as TranslationKey;

  /**
   * Creates the configured lookup using captured fields.
   * @param input - Validated inline lookup fields.
   * @returns Created lookup or existing localized failures.
   */
  const create = async ({
    name,
    hex,
    rootUrl,
    isPreferred,
  }: LookupFields): Promise<LookupSaveResult> => {
    try {
      if (props.kind === "maker") {
        const result = await createCatalogMaker({ data: { name, rootUrl } });
        return result.ok
          ? { created: { kind: "maker", value: result.maker } }
          : { error: { form: result.formError, fields: result.fieldErrors } };
      }
      if (props.kind === "terminologyAlias") {
        const result = await createCatalogTerminologyAlias({
          data: {
            canonicalKey: props.canonicalKey,
            canonicalNamespace: "product-type",
            isPreferred,
            label: name,
            makerId: props.makerId,
          },
        });
        return result.ok
          ? {
              created: {
                kind: "terminologyAlias",
                value: result.terminologyAlias,
              },
            }
          : { error: { form: result.formError, fields: result.fieldErrors } };
      }
      if (props.kind === "material") {
        const result = await createCatalogMaterial({ data: { name } });
        return result.ok
          ? { created: { kind: "material", value: result.material } }
          : { error: { form: result.formError, fields: result.fieldErrors } };
      }
      if (props.kind === "finish") {
        const result = await createCatalogFinish({ data: { name } });
        return result.ok
          ? { created: { kind: "finish", value: result.finish } }
          : { error: { form: result.formError, fields: result.fieldErrors } };
      }
      if (props.kind === "pattern") {
        const result = await createCatalogPattern({ data: { name } });
        return result.ok
          ? { created: { kind: "pattern", value: result.pattern } }
          : { error: { form: result.formError, fields: result.fieldErrors } };
      }
      const result = await createCatalogColor({ data: { hex, name } });
      return result.ok
        ? { created: { kind: "color", value: result.color } }
        : { error: { form: result.formError, fields: result.fieldErrors } };
    } catch {
      return { error: { form: "error.generic" } };
    }
  };

  return (
    <>
      <Button
        aria-controls={dialogId}
        aria-haspopup="dialog"
        onClick={() => {
          form.setErrorMap({ onSubmit: undefined });
          ref.current?.showModal();
        }}
        type="button"
        variant="outline"
      >
        {t(action)}
      </Button>
      <dialog
        aria-labelledby={titleId}
        className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-xl border border-border bg-card p-0 text-card-foreground backdrop:bg-black/60"
        id={dialogId}
        ref={ref}
        onClose={() => dispatch({ type: "closed" })}
      >
        <div className="grid gap-4 p-6">
          <h2 className="text-lg font-semibold" id={titleId}>
            {t(action)}
          </h2>
          <form.Field name="name">
            {() => (
              <Field label={t("web.catalog.field.name")}>
                <Input
                  aria-label={t("web.catalog.field.name")}
                  onChange={(event) =>
                    form.setFieldValue("name", event.target.value)
                  }
                  required
                  value={name}
                />
                <FieldError error={fieldErrors.name?.errors[0]} t={t} />
              </Field>
            )}
          </form.Field>
          {kind === "maker" ? (
            <form.Field name="rootUrl">
              {() => (
                <Field label={t("web.catalog.field.rootUrl")}>
                  <Input
                    aria-label={t("web.catalog.field.rootUrl")}
                    onChange={(event) =>
                      form.setFieldValue("rootUrl", event.target.value)
                    }
                    type="url"
                    value={rootUrl}
                  />
                  <FieldError error={fieldErrors.rootUrl?.errors[0]} t={t} />
                </Field>
              )}
            </form.Field>
          ) : kind === "terminologyAlias" ? null : (
            <Field label={t("web.catalog.field.slug")}>
              <Input
                aria-label={t("web.catalog.field.slug")}
                readOnly
                value={productSlugPreview(name)}
              />
            </Field>
          )}
          {kind === "terminologyAlias" ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={isPreferred}
                onChange={(event) =>
                  form.setFieldValue("isPreferred", event.target.checked)
                }
                type="checkbox"
              />
              {t("web.slider.alias.preferred")}
            </label>
          ) : null}
          {kind === "color" ? (
            <Field label={t("web.catalog.field.colors")}>
              <Input
                aria-label={t("web.catalog.field.colors")}
                onChange={(event) =>
                  form.setFieldValue("hex", event.target.value.toUpperCase())
                }
                required
                type="color"
                value={hex}
              />
            </Field>
          ) : null}
          {error ? (
            <Notice>{t(typeof error === "string" ? error : error.form)}</Notice>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => ref.current?.close()}
              type="button"
              variant="outline"
            >
              {t("action.cancel")}
            </Button>
            <Button
              disabled={Boolean(saving)}
              onClick={() => {
                form.setErrorMap({ onSubmit: { form: "", fields: {} } });
                void form.handleSubmit();
              }}
              type="button"
            >
              {t(action)}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** One collection metadata, cover, or gallery operation. */
type CollectionPageOperation =
  | {
      /** Saves metadata before initial images. */
      kind: "save";
      /** Submitted metadata. */
      value: CollectionFormValue;
      /** Initial collection images. */
      files: File[];
      /** Existing or just-created collection identifier. */
      collectionId: number | null;
      /** Optional moderation reason. */
      reason?: string;
      /** Resolves the existing form callback after terminal feedback. */
      complete(): void;
    }
  | {
      /** Changes or deletes an existing cover. */
      kind: "cover";
      /** Existing authorized cover callback. */
      action: CollectionCoverAction;
      /** Optional moderation reason. */
      reason?: string;
      /** Resolves the existing cover callback. */
      complete(): void;
    }
  | {
      /** Uploads an existing collection gallery batch. */
      kind: "gallery";
      /** Collection receiving the batch. */
      collectionId: number;
      /** Selected image batch. */
      files: File[];
      /**
       * Resolves the existing uploader callback.
       * @param clear - Whether all selected files uploaded.
       */
      complete(clear: boolean): void;
    };
/** Durable outcome retained while collection UI is suspended. */
type CollectionPageResult = {
  /** Saved collection, including after upload failure. */
  collection?: UserCollectionSummary;
  /** Localized metadata/cover failure. */
  error?: string;
  /** Localized gallery failure. */
  uploadError?: string;
  /** Whether the successful gallery batch may be cleared. */
  uploaded?: boolean;
  /** Destination after a successful metadata save. */
  navigateId?: number;
  /** Whether cover/gallery data should be reloaded after success. */
  reload?: boolean;
};
/** Collection page data and its one active workflow. */
type CollectionPageState = {
  /** Latest durable collection. */
  current: UserCollectionSummary | undefined;
  /** Localized metadata or cover failure. */
  error: string | null;
  /** Localized gallery failure. */
  uploadError: string | null;
  /** Active metadata, gallery, or cover effect. */
  operation: EffectEntity<CollectionPageState, CollectionPageEvent> | undefined;
};
/** Collection-page operation requests and terminal feedback. */
type CollectionPageEvent =
  | {
      /** Requests one authorized workflow. */
      type: "requested";
      /** Captured operation and existing callback completion. */
      operation: CollectionPageOperation;
    }
  | {
      /** Delivers the operation result and stops its effect. */
      type: "finished";
      /** Operation whose feedback should be updated. */
      kind: CollectionPageOperation["kind"];
      /** Durable result. */
      result: CollectionPageResult;
    };
/** Committed collection-page operation. */
type CollectionPageEffect = {
  /** Workflow implementation. */
  type: "run";
  /** Immutable operation and completion callback. */
  operation: CollectionPageOperation;
};

/**
 * Renders the collection create or edit form.
 *
 * @param props - Collection form properties.
 * @param props.collection - Existing collection being edited.
 * @param props.deletion - Available deletion destinations and item count.
 * @returns The collection form page.
 */
export function CollectionFormPage({
  collection,
  deletion,
}: {
  /** Existing collection being edited. */
  collection?: UserCollectionSummary;
  /** Available deletion destinations and item count. */
  deletion?: {
    /** Collections eligible to receive moved items. */
    destinations: UserCollectionSummary[];
    /** Number of items affected by deletion. */
    itemCount: number;
  };
}) {
  const { locale } = useLocale();
  const t = useCatalogCopy();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const task = React.useRef<{
    /** Descriptor whose mutation must not replay. */
    effect: CollectionPageEffect;
    /** Completion retained across suspended observers. */
    promise: Promise<CollectionPageResult>;
  } | null>(null);
  const active = React.useRef(false);
  const [page, dispatch] = useEffectReducer<
    CollectionPageState,
    CollectionPageEvent,
    CollectionPageEffect
  >(
    (state, event, exec) => {
      if (event.type === "requested") {
        if (state.operation) return state;
        return {
          ...state,
          error: event.operation.kind === "gallery" ? state.error : null,
          uploadError:
            event.operation.kind === "gallery" ? null : state.uploadError,
          operation: exec({ type: "run", operation: event.operation }),
        };
      }
      exec.stop(state.operation);
      return {
        ...state,
        current: event.result.collection ?? state.current,
        error:
          event.kind === "gallery" ? state.error : (event.result.error ?? null),
        uploadError:
          event.kind === "gallery"
            ? (event.result.uploadError ?? null)
            : state.uploadError,
        operation: undefined,
      };
    },
    {
      current: collection,
      error: null,
      uploadError: null,
      operation: undefined,
    },
    {
      /**
       * Runs one collection mutation and observes it across lifecycle resumption.
       * @param _state - Current page data.
       * @param effect - Captured authorized operation.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current observer lifetime.
       */
      run: (_state, effect, dispatch, { signal }) => {
        if (task.current?.effect !== effect)
          task.current = { effect, promise: perform(effect.operation) };
        void task.current.promise.then((result) => {
          if (signal.aborted) return;
          active.current = false;
          dispatch({ type: "finished", kind: effect.operation.kind, result });
          if (effect.operation.kind === "gallery")
            effect.operation.complete(result.uploaded ?? false);
          else effect.operation.complete();
          if (result.reload) window.location.reload();
          else if (result.navigateId !== undefined)
            void navigate({
              params: { collectionId: result.navigateId },
              to: "/user/collections/$collectionId",
            });
        });
      },
    },
  );
  const { current, error, uploadError } = page;
  const saving = Boolean(page.operation);
  /**
   * Performs metadata, cover, or gallery I/O without publishing disposed UI feedback.
   * @param operation - Captured authorized operation.
   * @returns Durable result retained for the active observer.
   */
  async function perform(
    operation: CollectionPageOperation,
  ): Promise<CollectionPageResult> {
    if (operation.kind === "gallery") {
      try {
        const upload = await uploadImages({
          locale,
          files: operation.files,
          getToken,
          targetId: operation.collectionId,
          targetType: "collection",
        });
        return upload.failed.length
          ? { uploadError: t("web.collections.error.upload"), uploaded: false }
          : { uploaded: true, reload: true };
      } catch (error) {
        const failure = error as ImageUploadError;
        return {
          uploadError: t(failure.key ?? "error.generic", failure.params),
          uploaded: false,
        };
      }
    }
    if (operation.kind === "cover") {
      try {
        await operation.action(operation.reason);
        return { reload: true };
      } catch {
        return { error: t("error.generic") };
      }
    }
    let saved: UserCollectionSummary | undefined;
    try {
      const result = await saveCollection({
        data: {
          collectionId: operation.collectionId,
          ...operation.value,
          reason: operation.reason,
        },
      });
      if (!result.ok) return { error: t(result.formError) };
      saved = result.collection;
      if (operation.files.length) {
        const upload = await uploadImages({
          locale,
          files: operation.files,
          getToken,
          reason: operation.reason,
          targetId: saved.id,
          targetType: "collection",
        });
        if (upload.failed.length)
          return {
            collection: saved,
            error: t("web.collections.error.upload"),
          };
      }
      return { collection: saved, navigateId: saved.id };
    } catch {
      return {
        collection: saved,
        error: t(saved ? "web.collections.error.upload" : "error.generic"),
      };
    }
  }
  const copy = {
    browse: t("web.resources.upload.browseFiles"),
    cancel: t("action.cancel"),
    cover: t("web.resources.upload.imagesLabel"),
    description: t("web.collections.field.description"),
    descriptionPlaceholder: t("web.collections.placeholder.description"),
    imageHelp: t("web.resources.upload.imagesHelp", {
      maxFileSize: formatMiB(maxImageBytes, locale),
      maxImages: maxImageSessionFiles,
      maxSessionSize: formatMiB(maxImageSessionBytes, locale),
    }),
    imageTypes: t("web.resources.upload.imageTypes"),
    name: t("web.collections.field.name"),
    namePlaceholder: t("web.collections.placeholder.name"),
    public: t("web.resources.visibility.public"),
    removeFile: t("web.resources.action.removeFile"),
    submit: t("action.save"),
    summary: t("web.collections.field.summary"),
    summaryPlaceholder: t("web.collections.placeholder.summary"),
  };

  /**
   * Queues metadata and initial images with any required staff reason.
   * @param value - Collection metadata.
   * @param images - Initial image batch.
   * @returns Completion after active terminal feedback.
   */
  function submit(value: CollectionFormValue, images: File[]): Promise<void> {
    if (active.current) return Promise.resolve();
    const moderating = Boolean(current?.canAdminister && !current.isOwner);
    const reason = moderating
      ? window.prompt(t("web.resources.moderation.reasonLabel"))?.trim()
      : undefined;
    if (moderating && !reason) return Promise.resolve();
    active.current = true;
    return new Promise((complete) =>
      dispatch({
        type: "requested",
        operation: {
          kind: "save",
          value,
          files: images,
          collectionId: current?.id ?? null,
          reason,
          complete,
        },
      }),
    );
  }
  /**
   * Queues an existing cover action after its staff-reason check.
   * @param action - Authorized cover operation.
   * @returns Completion after active terminal feedback.
   */
  function updateCover(action: CollectionCoverAction): Promise<void> {
    if (!current || active.current) return Promise.resolve();
    const moderating = Boolean(current.canAdminister && !current.isOwner);
    const reason = moderating
      ? window.prompt(t("web.resources.moderation.reasonLabel"))?.trim()
      : undefined;
    if (moderating && !reason) return Promise.resolve();
    active.current = true;
    return new Promise((complete) =>
      dispatch({
        type: "requested",
        operation: { kind: "cover", action, reason, complete },
      }),
    );
  }

  return (
    <UserPageShell
      breadcrumbItems={[
        { label: t("web.navigation.collections"), to: "/user/collections" },
      ]}
      contentClassName="p-0"
      section="collections"
      title={
        current
          ? t("web.collections.edit.title")
          : t("web.collections.add.title")
      }
    >
      <main className="grid w-full max-w-6xl gap-6 p-6">
        <CollectionForm
          copy={copy}
          disabled={saving}
          error={error}
          includeImages={!collection}
          initialValue={
            current
              ? {
                  description: current.description ?? "",
                  isPrivate: current.isPrivate,
                  name: current.name,
                  summary: current.summary ?? "",
                }
              : undefined
          }
          media={
            collection && current ? (
              <div className="grid min-w-0 content-start gap-6">
                <CollectionImageUploader
                  copy={{
                    browse: t("web.resources.upload.browseFiles"),
                    imageHelp: t("web.collections.gallery.imagesHelp", {
                      maxFileSize: formatMiB(maxImageBytes, locale),
                      maxImages: maxImageSessionFiles,
                      maxSessionSize: formatMiB(maxImageSessionBytes, locale),
                    }),
                    imageTypes: t("web.resources.upload.imageTypes"),
                    label: t("web.collections.gallery.title"),
                    removeFile: t("web.resources.action.removeFile"),
                    submit: t("web.action.uploadImages"),
                  }}
                  disabled={saving}
                  embedded
                  error={uploadError}
                  onUpload={(files) => {
                    if (active.current) return Promise.resolve(false);
                    active.current = true;
                    return new Promise((complete) =>
                      dispatch({
                        type: "requested",
                        operation: {
                          kind: "gallery",
                          collectionId: current.id,
                          files,
                          complete,
                        },
                      }),
                    );
                  }}
                />
                {current.coverImages.length ? (
                  <CollectionCoverManager
                    collection={current}
                    copy={{
                      clear: t("web.action.clearCover"),
                      clearConfirmation: t(
                        "web.collections.cover.clearConfirmation",
                      ),
                      current: t("web.collections.cover.current"),
                      delete: t("web.action.deleteImage"),
                      deleteConfirmation: t(
                        "web.collections.gallery.deleteConfirmation",
                      ),
                      history: t("web.collections.gallery.title"),
                      nextPage: t("web.collections.gallery.nextPage"),
                      /**
                       * Formats collection cover pagination status.
                       *
                       * @param page - Current page number.
                       * @param pageCount - Total page count.
                       * @returns The localized pagination status.
                       */
                      pageStatus: (page, pageCount) =>
                        t("web.collections.gallery.pageStatus", {
                          page,
                          pageCount,
                        }),
                      previousPage: t("web.collections.gallery.previousPage"),
                      select: t("web.action.selectCover"),
                    }}
                    disabled={saving}
                    embedded
                    onClear={() =>
                      updateCover((reason) =>
                        selectCollectionCover({
                          data: {
                            collectionId: current.id,
                            imageId: null,
                            reason,
                          },
                        }),
                      )
                    }
                    onDelete={(image) =>
                      updateCover((reason) =>
                        deleteCollectionCover({
                          getToken,
                          imageId: image.id,
                          reason,
                        }),
                      )
                    }
                    onSelect={(image) =>
                      updateCover((reason) =>
                        selectCollectionCover({
                          data: {
                            collectionId: current.id,
                            imageId: image.id,
                            reason,
                          },
                        }),
                      )
                    }
                  />
                ) : null}
              </div>
            ) : undefined
          }
          onCancel={
            collection && current
              ? () =>
                  void navigate({
                    params: { collectionId: current.id },
                    to: "/user/collections/$collectionId",
                  })
              : undefined
          }
          onSubmit={submit}
          splitOnLargeScreens={Boolean(collection)}
        />
        {current?.canEdit && deletion ? (
          <div className="lg:col-span-2">
            <CollectionDeletionSection
              collection={current}
              destinations={deletion.destinations}
              itemCount={deletion.itemCount}
              onSubmit={async (choice, destinationId, reason) => {
                if (choice === "archive") {
                  await setCollectionVisibility({
                    data: { collectionId: current.id, isPrivate: true, reason },
                  });
                  await navigate({
                    params: { collectionId: current.id },
                    to: "/user/collections/$collectionId",
                  });
                } else {
                  await deleteUserCollection({
                    data: {
                      collectionId: current.id,
                      confirmed: true,
                      destinationCollectionId:
                        choice === "move" ? destinationId : null,
                      reason,
                    },
                  });
                  await navigate(
                    choice === "move" && destinationId !== null
                      ? {
                          params: { collectionId: destinationId },
                          to: "/user/collections/$collectionId",
                        }
                      : { to: "/user/collections" },
                  );
                }
              }}
            />
          </div>
        ) : null}
      </main>
    </UserPageShell>
  );
}

/** Collection lifecycle confirmation fields. */
type CollectionDeletionFields = {
  /** Archive, delete, or move operation. */
  choice: "archive" | "delete" | "move";
  /** Explicit destructive-action confirmation. */
  confirmed: boolean;
  /** Same-owner destination for a move. */
  destinationId: number | null;
  /** Cross-owner moderation reason. */
  reason: string;
};
/** Pending confirmed collection lifecycle operation. */
type CollectionDeletionState =
  | EffectEntity<CollectionDeletionState, CollectionDeletionEvent>
  | undefined;
/** Confirmation submission and terminal feedback. */
type CollectionDeletionEvent =
  | {
      /** Commits validated confirmation fields. */
      type: "requested";
      /** Captured confirmation fields. */
      fields: CollectionDeletionFields;
    }
  | {
      /** Stops the completed operation. */
      type: "finished";
    };
/** Committed collection lifecycle request. */
type CollectionDeletionEffect = {
  /** Lifecycle operation implementation. */
  type: "commit";
  /** Validated confirmation fields. */
  fields: CollectionDeletionFields;
};

/**
 * Renders the archive and deletion choices for an existing collection.
 *
 * @param props - Deletion section properties.
 * @param props.collection - Collection being changed.
 * @param props.destinations - Collections eligible to receive moved items.
 * @param props.itemCount - Number of affected items.
 * @param props.onSubmit - Authorized archive, delete, or move operation and navigation.
 * @returns The collection deletion controls.
 */
export function CollectionDeletionSection({
  collection,
  destinations,
  itemCount,
  onSubmit,
}: {
  /** Collection being changed. */
  collection: UserCollectionSummary;
  /** Collections eligible to receive moved items. */
  destinations: UserCollectionSummary[];
  /** Number of affected items. */
  itemCount: number;
  /**
   * Commits the selected action and navigates away on success.
   *
   * @param choice - Archive, delete all contents, or move items before deleting.
   * @param destinationId - Required same-owner destination when moving items.
   * @param reason - Required nonblank staff reason for cross-owner intervention.
   * @returns Completion after the operation commits.
   * @rejects When the action fails.
   */
  onSubmit(
    choice: "archive" | "delete" | "move",
    destinationId: number | null,
    reason?: string,
  ): Promise<void>;
}) {
  const t = useCatalogCopy();
  const dialog = React.useRef<HTMLDialogElement>(null);
  const moderating = Boolean(collection.canAdminister && !collection.isOwner);
  /**
   * Enforces the current action's confirmation, destination, and staff reason.
   * @param input - Current confirmation fields.
   * @returns Whether a required confirmation field is missing.
   */
  const validate = ({
    value,
  }: {
    /** Current confirmation fields. */ value: CollectionDeletionFields;
  }) =>
    (value.choice !== "archive" && !value.confirmed) ||
    (value.choice === "move" && value.destinationId === null) ||
    (moderating && !value.reason.trim())
      ? true
      : undefined;
  const form = useForm({
    defaultValues: {
      choice: "archive",
      confirmed: false,
      destinationId: null,
      reason: "",
    } as CollectionDeletionFields,
    validators: { onMount: validate, onChange: validate, onSubmit: validate },
    /**
     * Queues the validated lifecycle operation.
     * @param input - Current confirmation fields.
     */
    onSubmit: ({ value }) => {
      dispatch({ type: "requested", fields: value });
    },
  });
  const { choice, confirmed, destinationId, reason } = useStore(
    form.store,
    (state) => state.values,
  );
  const failed = useStore(form.store, (state) => state.errorMap.onSubmit);
  const canSubmit = useStore(
    form.store,
    (state) => !validate({ value: state.values }) && !state.isSubmitting,
  );
  const task = React.useRef<{
    /** Descriptor whose mutation must not replay. */
    effect: CollectionDeletionEffect;
    /** Completion retained across suspended observers. */
    promise: Promise<void>;
  } | null>(null);
  const [pending, dispatch] = useEffectReducer<
    CollectionDeletionState,
    CollectionDeletionEvent,
    CollectionDeletionEffect
  >(
    (state, event, exec) => {
      if (event.type === "requested")
        return state ?? exec({ type: "commit", fields: event.fields });
      exec.stop(state);
      return undefined;
    },
    undefined,
    {
      /**
       * Runs a confirmed lifecycle operation once across Activity resumption.
       * @param _state - Pending request.
       * @param effect - Captured confirmation fields.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current observer lifetime.
       */
      commit: (_state, effect, dispatch, { signal }) => {
        if (task.current?.effect !== effect)
          task.current = {
            effect,
            promise: onSubmit(
              effect.fields.choice,
              effect.fields.destinationId,
              moderating ? effect.fields.reason.trim() : undefined,
            ),
          };
        void task.current.promise.then(
          () => {
            if (signal.aborted) return;
            dispatch({ type: "finished" });
            dialog.current?.close();
          },
          () => {
            if (signal.aborted) return;
            dispatch({ type: "finished" });
            form.setErrorMap({ onSubmit: true });
          },
        );
      },
    },
  );
  const submitting = Boolean(pending);
  const reasonId = React.useId();
  const titleId = React.useId();
  const destination = destinations.find(({ id }) => id === destinationId);
  const destructive = choice !== "archive";

  return (
    <section className="border-t border-border pt-6">
      <Button
        onClick={() => dialog.current?.showModal()}
        type="button"
        variant="destructive"
      >
        <FontAwesomeIcon aria-hidden="true" icon={faTrash} />
        {t("web.collections.deletion.open")}
      </Button>
      <dialog
        aria-labelledby={titleId}
        className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-lg border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
        onClose={() => form.reset()}
        onCancel={(event) => {
          if (submitting) event.preventDefault();
        }}
        ref={dialog}
      >
        <form
          className="grid gap-5 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!submitting) void form.handleSubmit();
          }}
        >
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-xl font-semibold" id={titleId}>
              {t("web.collections.deletion.open")}
            </legend>
            {(
              [
                ["archive", t("web.resources.action.markPrivate")],
                ["delete", t("web.collections.deletion.deleteChoice")],
                ["move", t("web.collections.deletion.moveChoice")],
              ] as const
            ).map(([value, label]) => (
              <label
                className="flex items-start gap-3 border border-border p-3 text-sm"
                key={value}
              >
                <input
                  checked={choice === value}
                  className="mt-0.5 size-4"
                  disabled={submitting}
                  name="collection-deletion-choice"
                  onChange={() => {
                    form.setFieldValue("choice", value);
                    form.setFieldValue("confirmed", false);
                  }}
                  type="radio"
                  value={value}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <p className="m-0 text-sm text-muted-foreground">
            {t("web.collections.directory.itemCount", { count: itemCount })}
          </p>
          {choice === "move" ? (
            destinations.length ? (
              <div className="grid gap-3">
                <CollectionSelector
                  addLabel={t("web.action.addCollection")}
                  collections={destinations}
                  label={t("web.collections.deletion.destination")}
                  onChange={(value) =>
                    form.setFieldValue("destinationId", value)
                  }
                  placeholder={t("web.collections.select.placeholder")}
                  selectedId={destinationId}
                />
                {destination ? (
                  <p className="m-0 text-sm text-muted-foreground">
                    {t("web.collections.deletion.moveSummary", {
                      count: itemCount,
                      destination: destination.name,
                    })}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="m-0 text-sm text-muted-foreground">
                {t("web.collections.deletion.noDestination")}
              </p>
            )
          ) : null}
          {destructive ? (
            <label className="flex items-start gap-3 text-sm">
              <input
                checked={confirmed}
                className="mt-0.5 size-4"
                disabled={submitting}
                onChange={(event) =>
                  form.setFieldValue("confirmed", event.target.checked)
                }
                type="checkbox"
              />
              <span>
                {t(
                  choice === "move"
                    ? "web.collections.deletion.moveConfirmation"
                    : "web.collections.deletion.deleteConfirmation",
                )}
              </span>
            </label>
          ) : null}
          {moderating ? (
            <div className="grid gap-2">
              <label htmlFor={reasonId}>
                {t("web.resources.moderation.reasonLabel")}
              </label>
              <textarea
                id={reasonId}
                className="min-h-20 rounded-md border border-input bg-background p-3 text-foreground"
                required
                maxLength={1000}
                disabled={submitting}
                value={reason}
                onChange={(event) =>
                  form.setFieldValue("reason", event.target.value)
                }
              />
            </div>
          ) : null}
          {failed ? (
            <p aria-live="polite" className="m-0 text-sm text-destructive">
              {t("error.generic")}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={submitting}
              onClick={() => dialog.current?.close()}
              type="button"
              variant="outline"
            >
              {t("action.cancel")}
            </Button>
            <Button
              disabled={submitting || !canSubmit}
              type="submit"
              variant={destructive ? "destructive" : "default"}
            >
              {choice === "archive"
                ? t("web.resources.action.markPrivate")
                : choice === "move"
                  ? t("web.collections.deletion.moveAction")
                  : t("web.resources.action.permanentlyDelete")}
            </Button>
          </div>
        </form>
      </dialog>
    </section>
  );
}

/** Controlled lifecycle fields used by collection-item create and edit forms. */
type OwnershipEditorValue = {
  /** Effective acquisition date when known. */
  effectiveStartDate: string;
  /** Effective departure date when the item is no longer owned. */
  effectiveEndDate: string;
  /** Acquisition reason code. */
  entryReason: OwnershipEntryReason;
  /** Departure reason code, or an empty unselected value. */
  exitReason: OwnershipExitReason | "";
  /** Whether the selected period is still open. */
  currentlyOwned: boolean;
  /** Existing period identifier, or null for a new period. */
  periodId: number | null;
  /** Whether Pocket Trash entry time supplies the acquisition date. */
  startDateUnknown: boolean;
};

/**
 * Builds editable lifecycle state from an existing period or a new acquisition.
 *
 * @param period - Existing period, or nothing for a new acquisition.
 * @returns Editable form state.
 */
function ownershipEditorValue(
  period?: CollectionItemOwnershipPeriod,
): OwnershipEditorValue {
  return {
    currentlyOwned: period?.effectiveEndDate == null,
    effectiveEndDate: period?.effectiveEndDate ?? "",
    effectiveStartDate: period?.startDateImputed
      ? ""
      : (period?.effectiveStartDate ?? ""),
    entryReason: period?.entryReason ?? "unknown",
    exitReason: period?.exitReason ?? "",
    periodId: period?.id ?? null,
    startDateUnknown: period?.startDateImputed ?? true,
  };
}

/**
 * Renders localized ownership period controls and recorded-time context.
 *
 * @param root0 - Ownership lifecycle field properties.
 * @returns Ownership lifecycle fields.
 */
function OwnershipLifecycleFields({
  allowDeparture,
  onChange,
  onPeriodChange,
  periods = [],
  value,
}: {
  /** Whether this form can close an ownership period. */
  allowDeparture: boolean;
  /**
   * Receives lifecycle field changes.
   *
   * @param value - Next lifecycle field state.
   * @returns Nothing.
   */
  onChange(value: OwnershipEditorValue): void;
  /**
   * Selects an existing period or starts a reacquisition.
   *
   * @param periodId - Existing period identifier, or `null` for reacquisition.
   * @returns Nothing.
   */
  onPeriodChange?(periodId: number | null): void;
  /** Existing periods available for review and correction. */
  periods?: CollectionItemOwnershipPeriod[];
  /** Current lifecycle field values. */
  value: OwnershipEditorValue;
}) {
  const t = useCatalogCopy();
  const { locale } = useLocale();
  const selectedPeriod = periods.find(({ id }) => id === value.periodId);
  const dateFormatter = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );
  const periodOptions = periods.map((period) => ({
    label: `${period.effectiveStartDate} – ${period.effectiveEndDate ?? t("web.collections.lifecycle.currentlyOwned")}`,
    value: String(period.id),
  }));
  if (
    periods.length &&
    periods.every(({ effectiveEndDate }) => effectiveEndDate !== null)
  ) {
    periodOptions.push({
      label: t("web.collections.lifecycle.newPeriod"),
      value: "new",
    });
  }
  return (
    <fieldset className="grid gap-4 rounded-md border border-border p-4">
      <legend className="px-1 text-sm font-medium">
        {t("web.collections.lifecycle.title")}
      </legend>
      {periodOptions.length > 1 ? (
        <Field label={t("web.collections.lifecycle.title")}>
          <Select
            items={periodOptions}
            onValueChange={(next) =>
              onPeriodChange?.(next === "new" ? null : Number(next))
            }
            value={value.periodId === null ? "new" : String(value.periodId)}
          >
            <SelectTrigger
              aria-label={t("web.collections.lifecycle.title")}
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      <label className="flex items-center gap-3 text-sm">
        <input
          checked={value.startDateUnknown}
          className="size-4"
          onChange={(event) =>
            onChange({
              ...value,
              effectiveStartDate: event.target.checked
                ? ""
                : value.effectiveStartDate,
              startDateUnknown: event.target.checked,
            })
          }
          type="checkbox"
        />
        <span>{t("web.collections.lifecycle.acquisitionDateUnknown")}</span>
      </label>
      <Field label={t("web.collections.lifecycle.acquisitionDate")}>
        <Input
          aria-label={t("web.collections.lifecycle.acquisitionDate")}
          disabled={value.startDateUnknown}
          onChange={(event) =>
            onChange({ ...value, effectiveStartDate: event.target.value })
          }
          required={!value.startDateUnknown}
          type="date"
          value={value.effectiveStartDate}
        />
      </Field>
      <Field label={t("web.collections.lifecycle.entryReason")}>
        <Select
          items={collectionOwnershipEntryReasons.map((reason) => ({
            label: t(`web.collections.lifecycle.reason.entry.${reason}`),
            value: reason,
          }))}
          onValueChange={(entryReason) =>
            onChange({
              ...value,
              entryReason: entryReason as OwnershipEntryReason,
            })
          }
          value={value.entryReason}
        >
          <SelectTrigger
            aria-label={t("web.collections.lifecycle.entryReason")}
            className="w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {collectionOwnershipEntryReasons.map((reason) => (
              <SelectItem key={reason} value={reason}>
                {t(`web.collections.lifecycle.reason.entry.${reason}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {allowDeparture ? (
        <>
          <label className="flex items-center gap-3 text-sm">
            <input
              checked={value.currentlyOwned}
              className="size-4"
              disabled={value.periodId === null}
              onChange={(event) =>
                onChange({
                  ...value,
                  currentlyOwned: event.target.checked,
                  effectiveEndDate: event.target.checked
                    ? ""
                    : value.effectiveEndDate,
                  exitReason: event.target.checked ? "" : value.exitReason,
                })
              }
              type="checkbox"
            />
            <span>{t("web.collections.lifecycle.currentlyOwned")}</span>
          </label>
          {!value.currentlyOwned ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("web.collections.lifecycle.departureDate")}>
                <Input
                  aria-label={t("web.collections.lifecycle.departureDate")}
                  onChange={(event) =>
                    onChange({ ...value, effectiveEndDate: event.target.value })
                  }
                  required
                  type="date"
                  value={value.effectiveEndDate}
                />
              </Field>
              <Field label={t("web.collections.lifecycle.exitReason")}>
                <Select
                  items={collectionOwnershipExitReasons.map((reason) => ({
                    label: t(`web.collections.lifecycle.reason.exit.${reason}`),
                    value: reason,
                  }))}
                  onValueChange={(exitReason) =>
                    onChange({
                      ...value,
                      exitReason: exitReason as OwnershipExitReason,
                    })
                  }
                  value={value.exitReason || null}
                >
                  <SelectTrigger
                    aria-label={t("web.collections.lifecycle.exitReason")}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {collectionOwnershipExitReasons.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {t(`web.collections.lifecycle.reason.exit.${reason}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          ) : null}
        </>
      ) : null}
      {selectedPeriod ? (
        <div className="grid gap-1 text-xs text-muted-foreground">
          <span>
            {t("web.collections.lifecycle.recordedStart", {
              date: dateFormatter.format(
                new Date(selectedPeriod.startedRecordedAt),
              ),
            })}
          </span>
          {selectedPeriod.startDateImputed ? (
            <span>{t("web.collections.lifecycle.imputed")}</span>
          ) : null}
          {selectedPeriod.endedRecordedAt ? (
            <span>
              {t("web.collections.lifecycle.recordedEnd", {
                date: dateFormatter.format(
                  new Date(selectedPeriod.endedRecordedAt),
                ),
              })}
            </span>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}

/** Product-derived collection fields that are safe to initialize automatically. */
type CollectionProductDefaults = Readonly<{
  /** Collection-item display name. */
  displayName: string;
  /** Sole offered finish, when unambiguous. */
  finish: ComboboxOption | null;
  /** Sole offered material assignment, when unambiguous. */
  material: CatalogLookup | null;
}>;

/**
 * Resolves only unambiguous collection defaults from a catalog product.
 *
 * @param product - Selected catalog product, when present.
 * @param t - Catalog translation formatter.
 * @returns Display name and sole material and finish choices.
 */
function collectionProductDefaults(
  product: CatalogProduct | undefined,
  t: ReturnType<typeof useCatalogCopy>,
): CollectionProductDefaults {
  const assignment =
    product?.materials.length === 1 ? product.materials[0] : null;
  const material = assignment?.materials[0];
  const option =
    product?.finishOptions.length === 1 ? product.finishOptions[0] : null;
  return {
    displayName: product?.name ?? "",
    finish: option
      ? { id: option.id, name: localizedFinishLabel(option, t) }
      : null,
    material:
      assignment && material
        ? {
            id: assignment.assignmentId,
            name: materialCombinationLabel(assignment.materials),
            slug: material.slug,
          }
        : null,
  };
}

/** Collection-item creation response retained through Activity suspension. */
type CollectionAddResult = {
  /** Created item identifier, including after upload failure. */
  itemId: number | null;
  /** Created or selected collection identifier. */
  collectionId: number | null;
  /** Item images still needing upload. */
  images: File[];
  /** Collection images still needing upload. */
  collectionImages: File[];
  /** Duplicate confirmation counts returned by the existing endpoint. */
  duplicateCounts?: Record<number, number>;
  /** Existing localized failure. */
  error?: string;
  /** Whether all ordered creation/upload work completed. */
  complete?: boolean;
};
/** Committed collection-item creation and ordered image uploads. */
type CollectionAddEffect = {
  /** Creation implementation. */
  type: "save";
  /** Existing server input, validated by its unchanged endpoint. */
  data: unknown;
  /** Captured product name for duplicate-image confirmation. */
  productName: string;
  /** Existing item identifier retained for upload-only retry. */
  itemId: number | null;
  /** Existing destination retained for upload-only retry. */
  collectionId: number | null;
  /** Captured item images. */
  images: File[];
  /** Captured initial collection images. */
  collectionImages: File[];
};
/** Collection creation disclosures, lookup choices, and mutation lifetime. */
type CollectionAddState = {
  /** Available lookup choices. */
  options: CatalogOptions;
  /** Last saved item identifier. */
  savedItemId: number | null;
  /** Last saved destination identifier. */
  savedCollectionId: number | null;
  /** Whether the Markdown surface is initializing. */
  descriptionLoading: boolean;
  /** Duplicate counts awaiting confirmation. */
  duplicateCounts: Record<number, number>;
  /** Whether the product chooser is disclosed. */
  productSelectorOpen: boolean;
  /** Current product chooser page. */
  productPage: number;
  /** Pending ordered creation workflow. */
  save: EffectEntity<CollectionAddState, CollectionAddEvent> | undefined;
};
/** Product selection, disclosure, and creation events. */
type CollectionAddEvent =
  | {
      /** Dismisses duplicate confirmation after changing a dependent choice. */
      type: "confirmationDismissed";
    }
  | {
      /** Accepts the existing shared lookup callback. */
      type: "lookupOptionsChanged";
      /** Pure replacement or updater. */
      update: React.SetStateAction<CatalogOptions>;
    }
  | {
      /** Applies a different product and clears stale creation state. */
      type: "productSelected";
      /** Whether selection is complete or the chooser remains open. */
      selected: boolean;
    }
  | {
      /** Changes product chooser disclosure. */
      type: "selectorChanged";
      /** Requested disclosure. */
      open: boolean;
    }
  | {
      /** Selects a product chooser page. */
      type: "pageSelected";
      /** Zero-based chooser page. */
      page: number;
    }
  | {
      /** Receives committed Markdown readiness. */
      type: "descriptionLoadingChanged";
      /** Whether initialization is pending. */
      loading: boolean;
    }
  | {
      /** Queues a validated creation attempt. */
      type: "saveRequested";
      /** Captured creation inputs. */
      request: Omit<CollectionAddEffect, "type" | "itemId" | "collectionId">;
    }
  | {
      /** Settles an ordered creation workflow. */
      type: "saveFinished";
      /** Durable result retained across resumption. */
      result: CollectionAddResult;
    };

/**
 * Renders the form for adding a product to a collection.
 *
 * @param root0 - Collection-item creation properties.
 * @param root0.collections - Collections available as destinations.
 * @param root0.defaultCollectionName - Suggested name for a new collection.
 * @param root0.initialProductId - Initially selected product identifier.
 * @param root0.options - Catalog lookup options.
 * @param root0.products - Products available to add.
 * @param root0.syncIncomplete - Whether catalog synchronization is incomplete.
 * @returns The collection-item creation page.
 */
export function CollectionAddPage({
  collections,
  defaultCollectionName,
  initialProductId,
  syncIncomplete = false,
  options: initialOptions,
  ownedItems = [],
  products,
}: {
  /** Collections available as destinations. */
  collections: UserCollectionSummary[];
  /** Suggested name for a new collection. */
  defaultCollectionName: string | null;
  /** Initially selected product identifier. */
  initialProductId?: number;
  /** Catalog lookup options. */
  options: CatalogOptions;
  /** Current owner's collection items available as physical Pen parts. */
  ownedItems?: UserCollectionItem[];
  /** Products available to add. */
  products: CatalogProduct[];
  /** Whether catalog synchronization is incomplete. */
  syncIncomplete?: boolean;
}) {
  const t = useCatalogCopy();
  const { locale } = useLocale();
  const imageGuidance = getImageUploadGuidance(locale);
  const displayNameLabel = t("web.collections.field.displayName");
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const initialProduct = products.find(({ id }) => id === initialProductId);
  const initialDefaults = collectionProductDefaults(initialProduct, t);
  const initialNewCollection = (
    collections.length === 0 && defaultCollectionName
      ? {
          description: "",
          isPrivate: true,
          name: defaultCollectionName,
          summary: "",
        }
      : null
  ) as CollectionFormValue | null;
  /** Initial collection-item fields. */
  const defaultValues = {
    images: [] as File[],
    newCollection: initialNewCollection,
    collectionImages: [] as File[],
    selectedCollectionId: (collections.length === 1
      ? (collections[0]?.id ?? null)
      : initialNewCollection
        ? -1
        : null) as number | null,
    type: (initialProduct
      ? (initialOptions.productTypes.find(
          ({ slug }) => slug === initialProduct.productTypeSlug,
        ) ?? null)
      : null) as ComboboxOption | null,
    product: (initialProduct ?? null) as CatalogProduct | null,
    displayName: initialDefaults.displayName,
    description: "",
    bearing: "",
    serialNumber: null as string | null,
    ownership: ownershipEditorValue() as OwnershipEditorValue,
    installedPenPartIds: [] as number[],
    installedRefillProductId: null as number | null,
    installedRefillOfferingId: null as number | null,
    material: initialDefaults.material as CatalogLookup | null,
    finish: initialDefaults.finish as ComboboxOption | null,
    customFinish: emptyFinishOption(),
    button: null as CatalogProduct | ComboboxOption | null,
    buttonMaterial: null as CatalogLookup | null,
    buttonFinish: null as ComboboxOption | null,
    buttonCustomFinish: emptyFinishOption(),
    productQuery: "",
  };
  /**
   * Validates collection-item and compatibility fields before enabling a submission.
   * @param input - Current form fields.
   * @returns Existing localized validation feedback, when invalid.
   */
  const validateDraft = ({
    value,
  }: {
    /** Current collection-item fields. */ value: typeof defaultValues;
  }): string | undefined => {
    const selected =
      typeof value.button?.id === "number"
        ? ui.options.spinnerButtons.find(({ id }) => id === value.button?.id)
        : null;
    if (
      !value.product ||
      !value.displayName.trim() ||
      value.description.length > 5000 ||
      value.selectedCollectionId === null ||
      (!value.product.productTypeSlug.startsWith("pen") &&
        (!value.material || !value.finish)) ||
      (value.serialNumber !== null && !value.serialNumber.trim()) ||
      (value.finish?.id === "custom" &&
        !finishOptionSchema.safeParse(value.customFinish).success) ||
      !collectionProductTypeIsSupported(value.product.productTypeSlug) ||
      (selected &&
        (!value.buttonMaterial ||
          !value.buttonFinish ||
          (value.buttonFinish?.id === "custom" &&
            !finishOptionSchema.safeParse(value.buttonCustomFinish).success)))
    )
      return "web.catalog.error.form";
    return validateImages(value.images, locale)?.key;
  };
  const form = useForm({
    onSubmitMeta: { confirmed: false },
    defaultValues,
    validators: {
      onMount: validateDraft,
      onChange: validateDraft,
      onSubmit: validateDraft,
    },
    /**
     * Captures one valid item creation without changing its server payload.
     * @param input - Validated fields and duplicate-confirmation metadata.
     */
    onSubmit: ({ value, meta: { confirmed } }) => {
      const {
        bearing,
        buttonCustomFinish,
        buttonFinish,
        buttonMaterial,
        selectedCollectionId,
        installedPenPartIds,
        customFinish,
        displayName,
        finish,
        installedRefillOfferingId,
        installedRefillProductId,
        material,
        newCollection,
        product,
        ownership,
        serialNumber,
      } = value;
      if (!product || ui.save) return;
      const currentDescription = value.description;
      const selectedButton =
        typeof value.button?.id === "number"
          ? ui.options.spinnerButtons.find(({ id }) => id === value.button?.id)
          : null;
      const data = {
        bearing,
        buttonCustomFinish:
          selectedButton && buttonFinish?.id === "custom"
            ? buttonCustomFinish
            : null,
        buttonFinishOptionId:
          selectedButton && buttonFinish?.id !== "custom"
            ? Number(buttonFinish?.id)
            : null,
        buttonMaterialAssignmentId: selectedButton
          ? (buttonMaterial?.id ?? null)
          : null,
        buttonProductId: selectedButton?.id ?? null,
        collectionId: selectedCollectionId === -1 ? null : selectedCollectionId,
        confirmed,
        installedPenPartCollectionItemIds: installedPenPartIds,
        customFinish: finish?.id === "custom" ? customFinish : null,
        displayName,
        description: currentDescription,
        finishOptionId:
          finish?.id === "custom" ? null : finish ? Number(finish.id) : null,
        installedRefillOfferingId,
        installedRefillProductId,
        materialAssignmentId:
          material?.id === -1 ? null : (material?.id ?? null),
        newCollection:
          selectedCollectionId === -1 && newCollection
            ? {
                description: newCollection.description || null,
                isPrivate: newCollection.isPrivate,
                name: newCollection.name,
                summary: newCollection.summary || null,
              }
            : null,
        productId: product.id,
        productTypeSlug: product.productTypeSlug,
        ownership: {
          effectiveStartDate: ownership.startDateUnknown
            ? null
            : ownership.effectiveStartDate,
          entryReason: ownership.entryReason,
        },
        serialNumber,
      };
      dispatch({
        type: "saveRequested",
        request: {
          data,
          productName: product.name,
          images: value.images,
          collectionImages: value.collectionImages,
        },
      });
    },
  });
  const {
    images,
    product,
    newCollection,
    selectedCollectionId,
    type,
    displayName,
    description,
    bearing,
    serialNumber,
    ownership,
    installedPenPartIds,
    installedRefillProductId,
    installedRefillOfferingId,
    material,
    finish,
    customFinish,
    button,
    buttonMaterial,
    buttonFinish,
    buttonCustomFinish,
    productQuery,
  } = useStore(form.store, (state) => state.values);

  const collectionDialog = React.useRef<HTMLDialogElement>(null);

  const task = React.useRef<{
    /** Descriptor whose mutation must not replay. */
    effect: CollectionAddEffect;
    /** Completion retained across suspended observers. */
    promise: Promise<CollectionAddResult>;
  } | null>(null);
  const [ui, dispatch] = useEffectReducer<
    CollectionAddState,
    CollectionAddEvent,
    CollectionAddEffect
  >(
    (state, event, exec) => {
      switch (event.type) {
        case "lookupOptionsChanged":
          return {
            ...state,
            options:
              typeof event.update === "function"
                ? event.update(state.options)
                : event.update,
          };
        case "productSelected":
          exec.stop(state.save);
          return {
            ...state,
            savedItemId: null,
            savedCollectionId: null,
            duplicateCounts: {},
            productSelectorOpen: !event.selected,
            save: undefined,
          };
        case "confirmationDismissed":
          return { ...state, duplicateCounts: {} };
        case "selectorChanged":
          return { ...state, productSelectorOpen: event.open };
        case "pageSelected":
          return { ...state, productPage: event.page };
        case "descriptionLoadingChanged":
          return state.descriptionLoading === event.loading
            ? state
            : { ...state, descriptionLoading: event.loading };
        case "saveRequested":
          if (state.save) return state;
          return {
            ...state,
            duplicateCounts: {},
            save: exec({
              type: "save",
              ...event.request,
              itemId: state.savedItemId,
              collectionId: state.savedCollectionId,
            }),
          };
        case "saveFinished":
          exec.stop(state.save);
          return {
            ...state,
            savedItemId: event.result.itemId,
            savedCollectionId: event.result.collectionId,
            duplicateCounts: event.result.duplicateCounts ?? {},
            save: undefined,
          };
      }
    },
    {
      options: initialOptions,
      savedItemId: null,
      savedCollectionId: null,
      descriptionLoading: true,
      duplicateCounts: {},
      productSelectorOpen: !initialProduct,
      productPage: 0,
      save: undefined,
    },
    {
      /**
       * Observes one creation/upload pipeline without replaying completed mutations.
       * @param _state - Current creation UI.
       * @param effect - Captured creation and image inputs.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current observer lifetime.
       */
      save: (_state, effect, dispatch, { signal }) => {
        if (task.current?.effect !== effect)
          task.current = { effect, promise: performCreation(effect) };
        void task.current.promise.then((result) => {
          if (signal.aborted) return;
          dispatch({ type: "saveFinished", result });
          form.setFieldValue("images", (current) =>
            current.filter(
              (file) =>
                !effect.images.includes(file) || result.images.includes(file),
            ),
          );
          form.setFieldValue("collectionImages", (current) =>
            current.filter(
              (file) =>
                !effect.collectionImages.includes(file) ||
                result.collectionImages.includes(file),
            ),
          );
          if (result.error) form.setErrorMap({ onSubmit: result.error });
          if (result.complete && result.collectionId)
            void navigate({
              params: { collectionId: result.collectionId },
              to: "/user/collections/$collectionId",
            });
        });
      },
    },
  );
  const {
    options,
    descriptionLoading,
    duplicateCounts,
    productSelectorOpen,
    productPage,
  } = ui;
  const descriptionRef = React.useRef<MarkdownEditorHandle>(null);
  /**
   * Receives readiness without changing callback identity for legacy Markdown callers.
   * @param loading - Whether initialization is pending.
   */
  const receiveDescriptionLoading = React.useCallback(
    (loading: boolean) => {
      dispatch({ type: "descriptionLoadingChanged", loading });
    },
    [dispatch],
  );
  /**
   * Accepts the stable shared-control lookup contract.
   * @param update - Pure catalog replacement or updater.
   */
  const receiveOptions = (update: React.SetStateAction<CatalogOptions>) => {
    dispatch({ type: "lookupOptionsChanged", update });
  };
  const canSubmit = useStore(
    form.store,
    (state) =>
      validateDraft({ value: state.values }) === undefined &&
      !state.isSubmitting,
  );
  const formError = useStore(form.store, (state) => state.errorMap.onSubmit);
  /**
   * Creates an item, uploads item images, then uploads collection images in the existing order.
   * @param request - Captured submission or upload-only retry.
   * @returns Durable identifiers, retained files, and existing failure feedback.
   */
  async function performCreation(
    request: CollectionAddEffect,
  ): Promise<CollectionAddResult> {
    let itemId = request.itemId;
    let collectionId = request.collectionId;
    let images = request.images;
    let collectionImages = request.collectionImages;
    let created = false;
    try {
      if (!itemId || !collectionId) {
        const result = await addCollectionProduct({ data: request.data });
        if (!result.ok && result.requiresConfirmation)
          return {
            itemId,
            collectionId,
            images,
            collectionImages,
            duplicateCounts: result.duplicateCounts,
          };
        if (!result.ok)
          return {
            itemId,
            collectionId,
            images,
            collectionImages,
            error: result.formError,
          };
        itemId = result.collectionItemId;
        collectionId = result.collectionId;
        created = true;
      }
      if (images.length) {
        const uploaded = await uploadImages({
          locale,
          files: images,
          getToken,
          targetId: itemId,
          targetType: "collection_item",
          /**
           * Offers the existing restore choice for duplicate images on initial creation.
           * @param imageId - Owner-deleted duplicate identifier.
           * @returns Whether the duplicate was restored.
           */
          onOwnerDeletedDuplicate: created
            ? async (imageId) => {
                if (
                  !window.confirm(
                    t("web.resources.trash.restoreConfirmationDescription", {
                      name: request.productName,
                    }),
                  )
                )
                  return false;
                await restoreCatalogImage({
                  data: { imageId, targetType: "collection_item" },
                });
                return true;
              }
            : undefined,
        });
        images = uploaded.failed;
        if (images.length)
          return {
            itemId,
            collectionId,
            images,
            collectionImages,
            error: "web.resources.upload.sessionFailure",
          };
      }
      if (collectionImages.length) {
        try {
          const uploaded = await uploadImages({
            locale,
            files: collectionImages,
            getToken,
            targetId: collectionId,
            targetType: "collection",
          });
          collectionImages = uploaded.failed;
          if (collectionImages.length)
            return {
              itemId,
              collectionId,
              images,
              collectionImages,
              error: "web.collections.error.upload",
            };
        } catch {
          return {
            itemId,
            collectionId,
            images,
            collectionImages,
            error: "web.collections.error.upload",
          };
        }
      }
      return { itemId, collectionId, images, collectionImages, complete: true };
    } catch (error) {
      return {
        itemId,
        collectionId,
        images,
        collectionImages,
        error: (error as ImageUploadError).key ?? "error.generic",
      };
    }
  }
  const slug = options.productTypes.find(({ id }) => id === type?.id)?.slug;
  const matchingProducts = products.filter(
    (candidate) =>
      candidate.productTypeSlug === slug &&
      `${candidate.name} ${candidate.makerName}`
        .toLocaleLowerCase(locale)
        .includes(productQuery.trim().toLocaleLowerCase(locale)),
  );
  const productPageCount = Math.max(1, Math.ceil(matchingProducts.length / 12));
  const currentProductPage = Math.min(productPage, productPageCount - 1);
  const visibleProducts = matchingProducts.slice(
    currentProductPage * 12,
    (currentProductPage + 1) * 12,
  );
  const selectedButton =
    typeof button?.id === "number"
      ? (options.spinnerButtons.find(({ id }) => id === button.id) ?? null)
      : null;
  const selectedCollection = collections.find(
    ({ id }) => id === selectedCollectionId,
  );
  const collectionIsPrivate =
    selectedCollection?.isPrivate ?? newCollection?.isPrivate ?? true;
  const collectionChoices = newCollection
    ? [
        ...collections,
        {
          coverImage: null,
          coverImages: [],
          createdAt: new Date(0),
          description: newCollection.description || null,
          id: -1,
          isAdminPrivate: false,
          isPrivate: newCollection.isPrivate,
          itemCount: 0,
          name: newCollection.name,
          ownerUserId: 0,
          summary: newCollection.summary || null,
          updatedAt: new Date(0),
        },
      ]
    : collections;

  /**
   * Selects one product, applies its unambiguous defaults, and clears stale ownership state.
   *
   * @param candidate - Product selected from the catalog.
   */
  const selectProduct = (candidate: CatalogProduct) => {
    const defaults = collectionProductDefaults(candidate, t);
    form.setFieldValue("product", candidate);
    dispatch({ type: "productSelected", selected: true });
    form.setFieldValue("displayName", defaults.displayName);
    form.setFieldValue("description", "");
    form.setFieldValue("bearing", "");
    form.setFieldValue("serialNumber", null);
    form.setFieldValue("installedPenPartIds", []);
    form.setFieldValue("installedRefillProductId", null);
    form.setFieldValue("installedRefillOfferingId", null);
    form.setFieldValue("material", defaults.material);
    form.setFieldValue("finish", defaults.finish);
    form.setFieldValue("customFinish", emptyFinishOption());
    form.setFieldValue("button", null);
    form.setFieldValue("buttonMaterial", null);
    form.setFieldValue("buttonFinish", null);
    form.setFieldValue("buttonCustomFinish", emptyFinishOption());
    form.setErrorMap({ onSubmit: undefined });
    dispatch({ type: "selectorChanged", open: false });
  };

  /**
   * Saves the current collection-item fields.
   *
   * @param confirmed - Whether duplicate items were confirmed.
   * @returns A promise that resolves after the save flow completes.
   */
  const submit = (confirmed: boolean) => {
    if (descriptionRef.current?.isLoading() || ui.save) return;
    form.setFieldValue(
      "description",
      descriptionRef.current?.getValue() ?? form.state.values.description,
    );
    form.setErrorMap({ onSubmit: undefined });
    void form.handleSubmit({ confirmed });
  };

  return (
    <AppShell
      breadcrumbItems={[
        { label: t("web.navigation.collections"), to: "/collections" },
      ]}
      title={t("web.action.addToCollection")}
    >
      <main className="grid max-w-5xl gap-6 p-6">
        <Field label={displayNameLabel}>
          <Input
            aria-label={displayNameLabel}
            disabled={!product}
            onChange={(event) =>
              form.setFieldValue("displayName", event.target.value)
            }
            required
            value={displayName}
          />
        </Field>
        <CatalogMarkdownEditor
          defaultValue={description}
          disabled={!product}
          help={t("web.catalog.help.markdownDescription")}
          id="collection-item-description"
          key={product?.id ?? "no-product"}
          label={t("web.catalog.field.description")}
          onChange={(value) => form.setFieldValue("description", value)}
          onLoadingChange={receiveDescriptionLoading}
          ref={descriptionRef}
        />
        {product?.productTypeSlug === "spinner" ? (
          <Field label={t("web.catalog.field.bearing")}>
            <Input
              aria-label={t("web.catalog.field.bearing")}
              maxLength={200}
              onChange={(event) =>
                form.setFieldValue("bearing", event.target.value)
              }
              value={bearing}
            />
          </Field>
        ) : null}
        {product &&
        collectionProductTypeSupportsSerial(product.productTypeSlug) ? (
          <SerialNumberFields
            onChange={(value) => form.setFieldValue("serialNumber", value)}
            t={t}
            value={serialNumber}
          />
        ) : null}
        <OwnershipLifecycleFields
          allowDeparture={false}
          onChange={(value) => form.setFieldValue("ownership", value)}
          value={ownership}
        />
        {syncIncomplete ? (
          <Notice>{t("web.collections.error.syncIncomplete")}</Notice>
        ) : null}
        <CollectionSelector
          addLabel={t("web.collections.select.addNew")}
          collections={collectionChoices}
          label={t("web.collections.field.collection")}
          onAdd={() => collectionDialog.current?.showModal()}
          onChange={(collectionId) => {
            form.setFieldValue("selectedCollectionId", collectionId);
            if (collectionId !== -1) {
              form.setFieldValue("newCollection", null);
              form.setFieldValue("collectionImages", []);
            }
          }}
          placeholder={t("web.collections.select.placeholder")}
          selectedId={selectedCollectionId}
        />
        <dialog
          className="m-auto w-[min(48rem,calc(100%-2rem))] rounded-xl border border-border bg-background p-0 text-foreground backdrop:bg-black/60"
          ref={collectionDialog}
        >
          <div className="p-4">
            <CollectionForm
              copy={{
                browse: t("web.resources.upload.browseFiles"),
                cancel: t("action.cancel"),
                cover: t("web.resources.upload.imagesLabel"),
                description: t("web.collections.field.description"),
                descriptionPlaceholder: t(
                  "web.collections.placeholder.description",
                ),
                imageHelp: t("web.resources.upload.imagesHelp", {
                  maxFileSize: formatMiB(maxImageBytes, locale),
                  maxImages: maxImageSessionFiles,
                  maxSessionSize: formatMiB(maxImageSessionBytes, locale),
                }),
                imageTypes: t("web.resources.upload.imageTypes"),
                name: t("web.collections.field.name"),
                namePlaceholder: t("web.collections.placeholder.name"),
                public: t("web.resources.visibility.public"),
                removeFile: t("web.resources.action.removeFile"),
                submit: t("action.save"),
                summary: t("web.collections.field.summary"),
                summaryPlaceholder: t("web.collections.placeholder.summary"),
              }}
              onSubmit={(value, collectionImages) => {
                form.setFieldValue("newCollection", value);
                form.setFieldValue("collectionImages", collectionImages);
                form.setFieldValue("selectedCollectionId", -1);
                collectionDialog.current?.close();
              }}
            />
            <Button
              className="mt-3"
              onClick={() => collectionDialog.current?.close()}
              type="button"
              variant="outline"
            >
              {t("action.cancel")}
            </Button>
          </div>
        </dialog>
        <details
          onToggle={(event) =>
            dispatch({
              type: "selectorChanged",
              open: event.currentTarget.open,
            })
          }
          open={productSelectorOpen}
        >
          <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {t("web.collections.productSelector")}
          </summary>
          <div className="mt-4 grid gap-4">
            <Field label={t("web.catalog.field.productType")}>
              <CatalogCombobox
                ariaLabel={t("web.catalog.field.productType")}
                items={options.productTypes}
                onValueChange={(value) => {
                  form.setFieldValue("type", value);
                  dispatch({ type: "pageSelected", page: 0 });
                  form.setFieldValue("productQuery", "");
                  form.setFieldValue("product", null);
                  dispatch({ type: "productSelected", selected: false });
                  form.setFieldValue("displayName", "");
                  form.setFieldValue("description", "");
                  form.setFieldValue("bearing", "");
                  form.setFieldValue("serialNumber", null);
                  form.setFieldValue("installedPenPartIds", []);
                  form.setFieldValue("installedRefillProductId", null);
                  form.setFieldValue("installedRefillOfferingId", null);
                  form.setFieldValue("material", null);
                  form.setFieldValue("finish", null);
                  form.setFieldValue("customFinish", emptyFinishOption());
                  form.setFieldValue("button", null);
                  form.setFieldValue("buttonMaterial", null);
                  form.setFieldValue("buttonFinish", null);
                  form.setFieldValue("buttonCustomFinish", emptyFinishOption());
                  dispatch({ type: "confirmationDismissed" });
                  form.setErrorMap({ onSubmit: undefined });
                }}
                placeholder={t("web.catalog.selectProductType")}
                value={type}
              />
            </Field>
            {slug && !collectionProductTypeIsSupported(slug) ? (
              <Notice>{t("web.catalog.notImplemented")}</Notice>
            ) : null}
            <Input
              aria-label={t("web.action.search")}
              onChange={(event) => {
                form.setFieldValue("productQuery", event.target.value);
                dispatch({ type: "pageSelected", page: 0 });
              }}
              placeholder={t("web.archive.searchPlaceholder")}
              type="search"
              value={productQuery}
            />
            <div className="grid grid-cols-1 gap-[18px] empty:hidden min-[481px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(max(240px,calc((100%_-_4_*_18px)_/_5)),1fr))]">
              {visibleProducts.map((candidate) => {
                const image = candidate.images.find(
                  ({ deletedAt }) => !deletedAt,
                );
                return (
                  <Button
                    aria-pressed={candidate.id === product?.id}
                    className="h-full min-w-0 flex-col items-stretch justify-start gap-0 overflow-hidden p-0 text-left wrap-anywhere whitespace-normal"
                    key={candidate.id}
                    onClick={() => {
                      selectProduct(candidate);
                    }}
                    type="button"
                    variant={
                      candidate.id === product?.id ? "default" : "outline"
                    }
                  >
                    <span className="aspect-4/3 w-full shrink-0 overflow-hidden bg-muted">
                      {image ? (
                        <img
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          src={image.url}
                        />
                      ) : null}
                    </span>
                    <span className="p-3 text-sm font-semibold">
                      {candidate.name}
                    </span>
                  </Button>
                );
              })}
            </div>
            {slug && matchingProducts.length === 0 ? (
              <Notice>{t("web.archive.noItems")}</Notice>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                disabled={currentProductPage === 0}
                onClick={() =>
                  dispatch({
                    type: "pageSelected",
                    page: currentProductPage - 1,
                  })
                }
                type="button"
                variant="outline"
              >
                {t("web.collections.gallery.previousPage")}
              </Button>
              <span aria-live="polite" className="text-sm">
                {t("web.collections.gallery.pageStatus", {
                  page: currentProductPage + 1,
                  pageCount: productPageCount,
                })}
              </span>
              <Button
                disabled={currentProductPage + 1 === productPageCount}
                onClick={() =>
                  dispatch({
                    type: "pageSelected",
                    page: currentProductPage + 1,
                  })
                }
                type="button"
                variant="outline"
              >
                {t("web.collections.gallery.nextPage")}
              </Button>
            </div>
          </div>
        </details>
        {product ? (
          <CollectionProductFields
            customFinish={customFinish}
            finish={finish}
            material={material}
            onCustomFinishChange={(value) =>
              form.setFieldValue("customFinish", value)
            }
            onFinishChange={(value) => form.setFieldValue("finish", value)}
            onMaterialChange={(value) => form.setFieldValue("material", value)}
            onOptionsChange={receiveOptions}
            options={options}
            product={product}
            t={t}
          />
        ) : null}
        {product?.productTypeSlug === "pen" ? (
          <PenCollectionFields
            allProducts={products}
            onRefillOfferingChange={(value) =>
              form.setFieldValue("installedRefillOfferingId", value)
            }
            onRefillProductChange={(value) =>
              form.setFieldValue("installedRefillProductId", value)
            }
            onInstalledPartIdsChange={(value) =>
              form.setFieldValue("installedPenPartIds", value)
            }
            ownedItems={ownedItems}
            product={product}
            refillOfferingId={installedRefillOfferingId}
            refillProductId={installedRefillProductId}
            installedPartIds={installedPenPartIds}
            t={t}
          />
        ) : null}
        {product?.productTypeSlug === "slider" ? (
          <Notice>
            <p>{t("web.slider.relationship.inclusionHelp")}</p>
            <ul className="mt-2 grid list-disc gap-1 pl-5">
              <li>
                {product.includedPlate?.name ??
                  t("web.slider.relationship.includedPlates")}
              </li>
              {product.usesInserts ? (
                <li>
                  {product.includedInsert?.name ??
                    t("web.slider.relationship.includedInsert")}
                </li>
              ) : null}
            </ul>
          </Notice>
        ) : null}
        {product && collectionIsPrivate ? (
          <Notice>{t("web.collections.visibility.privateCallout")}</Notice>
        ) : null}
        {product ? (
          <Button
            aria-pressed
            disabled={collectionIsPrivate}
            type="button"
            variant="outline"
          >
            {t("web.resources.visibility.public")}
          </Button>
        ) : null}
        {product?.productTypeSlug === "spinner" ? (
          <Field label={t("web.catalog.field.button")}>
            <CatalogCombobox
              ariaLabel={t("web.catalog.field.button")}
              items={[
                { id: "default", name: t("web.catalog.defaultButton") },
                ...options.spinnerButtons,
              ]}
              onValueChange={(value) => {
                form.setFieldValue(
                  "button",
                  typeof value?.id === "number"
                    ? (options.spinnerButtons.find(
                        ({ id }) => id === value.id,
                      ) ?? null)
                    : value,
                );
                form.setFieldValue("buttonMaterial", null);
                form.setFieldValue("buttonFinish", null);
                form.setFieldValue("buttonCustomFinish", emptyFinishOption());
                dispatch({ type: "confirmationDismissed" });
              }}
              placeholder={t("web.catalog.defaultButton")}
              removeLabel={t("web.action.close")}
              showSelectedPill
              value={button}
            />
          </Field>
        ) : null}
        {selectedButton ? (
          <CollectionProductFields
            customFinish={buttonCustomFinish}
            finish={buttonFinish}
            material={buttonMaterial}
            onCustomFinishChange={(value) =>
              form.setFieldValue("buttonCustomFinish", value)
            }
            onFinishChange={(value) =>
              form.setFieldValue("buttonFinish", value)
            }
            onMaterialChange={(value) =>
              form.setFieldValue("buttonMaterial", value)
            }
            onOptionsChange={receiveOptions}
            options={options}
            product={selectedButton}
            t={t}
          />
        ) : null}
        {Object.keys(duplicateCounts).length ? (
          <Notice>
            <ul className="grid gap-1">
              {[product, button?.id === "default" ? null : button]
                .filter(
                  (candidate): candidate is NonNullable<typeof candidate> =>
                    Boolean(candidate),
                )
                .map((candidate) => ({
                  count: duplicateCounts[Number(candidate.id)] ?? 0,
                  id: candidate.id,
                  name: candidate.name,
                }))
                .filter(({ count }) => count > 0)
                .map(({ count, id, name }) => (
                  <li key={id}>
                    {name}: {t("web.collections.duplicateWarning", { count })}
                  </li>
                ))}
            </ul>
          </Notice>
        ) : null}
        {product ? (
          <FileDropInput
            accept=".avif,.jpeg,.jpg,.png,.webp"
            disabled={Boolean(ui.save)}
            aspectRatio={4 / 3}
            aspectRatioHelpHref="/help/image-size-and-resolution-guide"
            aspectRatioHelpLabel={imageGuidance.helpLabel}
            aspectRatioWarning={imageGuidance.warning}
            browseLabel={t("web.resources.upload.browseFiles")}
            description={t("web.resources.upload.imagesHelp", {
              maxFileSize: formatMiB(maxImageBytes, locale),
              maxImages: maxImageSessionFiles,
              maxSessionSize: formatMiB(maxImageSessionBytes, locale),
            })}
            fileTypes={t("web.resources.upload.imageTypes")}
            files={images}
            id="collection-item-images"
            label={t("web.resources.upload.imagesLabel")}
            multiple
            onFilesChange={(additions) =>
              form.setFieldValue("images", (current) => [
                ...current,
                ...additions,
              ])
            }
            onRemove={(index) =>
              form.setFieldValue("images", (current) =>
                current.filter((_, candidate) => candidate !== index),
              )
            }
            removeFileLabel={t("web.action.close")}
          />
        ) : null}
        {formError ? <Notice>{t(formError)}</Notice> : null}
        {product ? (
          <Button
            disabled={descriptionLoading || Boolean(ui.save) || !canSubmit}
            onClick={() => void submit(Object.keys(duplicateCounts).length > 0)}
            type="button"
          >
            {Object.keys(duplicateCounts).length
              ? t("web.action.confirmAdd")
              : t("web.action.addToCollection")}
          </Button>
        ) : null}
      </main>
    </AppShell>
  );
}

/**
 * Reports whether a product type exposes the optional serial-number control.
 *
 * @param productTypeSlug - Catalog product type.
 * @returns Whether owned items of the type may record a maker serial.
 */
export function collectionProductTypeSupportsSerial(
  productTypeSlug: CatalogProductType,
): boolean {
  return productTypeSlug !== "refill" && productTypeSlug !== "slider-insert";
}

/**
 * Renders the optional maker-serial toggle and value input.
 *
 * @param props - Controlled serial value, translator, and update callback.
 * @returns Serial-number controls.
 */
function SerialNumberFields({
  onChange,
  t,
  value,
}: {
  /**
   * Updates the serial, using `null` when the product is not serialized.
   *
   * @param value - Next serial value.
   */
  onChange: (value: string | null) => void;
  /** Catalog translator. */
  t: ReturnType<typeof useCatalogCopy>;
  /** Current optional serial value. */
  value: string | null;
}) {
  const label = t("web.collections.serial.hasSerialNumber" as TranslationKey);
  return (
    <div className="grid gap-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          checked={value !== null}
          className="size-4 accent-primary"
          onChange={(event) => onChange(event.target.checked ? "" : null)}
          type="checkbox"
        />
        {label}
      </label>
      {value !== null ? (
        <Field
          label={t("web.collections.field.serialNumber" as TranslationKey)}
        >
          <Input
            aria-label={t(
              "web.collections.field.serialNumber" as TranslationKey,
            )}
            maxLength={200}
            onChange={(event) => onChange(event.target.value)}
            required
            value={value}
          />
        </Field>
      ) : null}
    </div>
  );
}

/**
 * Renders owned-Pen installed-part and refill selectors.
 *
 * @param props - Catalog, owned parts, controlled selections, and translator.
 * @returns Pen part and refill fields with non-blocking compatibility warnings.
 */
function PenCollectionFields({
  allProducts,
  currentCollectionItemId,
  onRefillOfferingChange,
  onRefillProductChange,
  onInstalledPartIdsChange,
  ownedItems,
  product,
  refillOfferingId,
  refillProductId,
  installedPartIds,
  t,
}: {
  /** Visible catalog products, including refill models. */
  allProducts: CatalogProduct[];
  /** Parent item being edited, when applicable. */
  currentCollectionItemId?: number;
  /**
   * Updates the installed offering.
   *
   * @param value - Next offering identifier.
   */
  onRefillOfferingChange: (value: number | null) => void;
  /**
   * Updates the installed refill model.
   *
   * @param value - Next refill-product identifier.
   */
  onRefillProductChange: (value: number | null) => void;
  /**
   * Updates the installed physical Pen-part collection items.
   *
   * @param value - Next installed collection-item identifiers.
   */
  onInstalledPartIdsChange: (value: number[]) => void;
  /** Current owner's physical collection items. */
  ownedItems: UserCollectionItem[];
  /** Pen product. */
  product: CatalogProduct;
  /** Selected offering identifier. */
  refillOfferingId: number | null;
  /** Selected refill product identifier. */
  refillProductId: number | null;
  /** Installed physical Pen-part collection item identifiers. */
  installedPartIds: number[];
  /** Catalog translator. */
  t: ReturnType<typeof useCatalogCopy>;
}) {
  const compatiblePartProductIds = new Set(
    product.compatibleParts.map(({ id }) => id),
  );
  const availableParts = ownedItems.filter(
    (item) =>
      compatiblePartProductIds.has(item.productId) &&
      (item.privacyInheritedFromItemId === null ||
        item.privacyInheritedFromItemId === currentCollectionItemId),
  );
  const warning = t("web.pens.collection.notSupported" as TranslationKey);
  const refills = allProducts
    .filter(({ productTypeSlug }) => productTypeSlug === "refill")
    .map((refill) => ({
      compatible: refill.compatiblePens.some((pen) => pen.id === product.id),
      refill,
    }))
    .sort(
      (left, right) =>
        Number(right.compatible) - Number(left.compatible) ||
        left.refill.name.localeCompare(right.refill.name),
    );
  const selectedRefill = refills.find(
    ({ refill }) => refill.id === refillProductId,
  );

  return (
    <div className="grid gap-5">
      {availableParts.length ? (
        <Field
          label={t("web.pens.collection.installedParts" as TranslationKey)}
        >
          <CatalogMultiCombobox
            ariaLabel={t(
              "web.pens.collection.installedParts" as TranslationKey,
            )}
            items={availableParts.map((item) => ({
              id: item.collectionItemId,
              name: item.displayName,
            }))}
            onValueChange={(next) =>
              onInstalledPartIdsChange(next.map(({ id }) => Number(id)))
            }
            placeholder={t(
              "web.pens.collection.noInstalledParts" as TranslationKey,
            )}
            removeLabel={t("web.action.close")}
            value={availableParts
              .filter(({ collectionItemId }) =>
                installedPartIds.includes(collectionItemId),
              )
              .map((item) => ({
                id: item.collectionItemId,
                name: item.displayName,
              }))}
          />
        </Field>
      ) : null}
      <Field label={t("web.pens.collection.refill" as TranslationKey)}>
        <CatalogCombobox
          ariaLabel={t("web.pens.collection.refill" as TranslationKey)}
          items={refills.map(({ compatible, refill }) => ({
            id: refill.id,
            name: refill.name,
            warning: compatible ? undefined : warning,
          }))}
          onValueChange={(next) => {
            onRefillProductChange(next ? Number(next.id) : null);
            onRefillOfferingChange(null);
          }}
          placeholder={t("web.pens.collection.noRefill" as TranslationKey)}
          removeLabel={t("web.action.close")}
          showSelectedPill
          value={
            selectedRefill
              ? {
                  id: selectedRefill.refill.id,
                  name: selectedRefill.refill.name,
                  warning: selectedRefill.compatible ? undefined : warning,
                }
              : null
          }
        />
        {selectedRefill && !selectedRefill.compatible ? (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-destructive"
            />
            {warning}
          </p>
        ) : null}
      </Field>
      {selectedRefill ? (
        <Field
          label={t("web.pens.collection.refillOffering" as TranslationKey)}
        >
          <CatalogCombobox
            ariaLabel={t(
              "web.pens.collection.refillOffering" as TranslationKey,
            )}
            items={selectedRefill.refill.refillOfferings.map((offering) => ({
              id: offering.id,
              name: `${offering.tipSize} · ${offering.tipStyle} · ${offering.inkColor}`,
            }))}
            onValueChange={(next) =>
              onRefillOfferingChange(next ? Number(next.id) : null)
            }
            placeholder={t(
              "web.pens.collection.noRefillOffering" as TranslationKey,
            )}
            removeLabel={t("web.action.close")}
            showSelectedPill
            value={
              selectedRefill.refill.refillOfferings
                .map((offering) => ({
                  id: offering.id,
                  name: `${offering.tipSize} · ${offering.tipStyle} · ${offering.inkColor}`,
                }))
                .find(({ id }) => id === refillOfferingId) ?? null
            }
          />
        </Field>
      ) : null}
    </div>
  );
}

/**
 * Resolves a stored canonical pair to a current offer or a retained selector choice.
 *
 * @param product - Product's current offered assignments.
 * @param materials - Item's stored canonical material combination.
 * @returns Current assignment choice, retained choice, or null for no material.
 */
function collectionMaterialChoice(
  product: CatalogProduct | undefined,
  materials: UserCollectionItem["materials"] | undefined,
): CatalogLookup | null {
  if (!materials?.length) return null;
  /**
   * Builds an order-independent identity for stored material components.
   *
   * @param components - Material components to identify.
   * @returns Stable sorted component identity.
   */
  const signature = (components: UserCollectionItem["materials"]) =>
    components
      .map(({ id, specific }) => `${id}:${specific?.id ?? "general"}`)
      .sort()
      .join("|");
  const assignment = product?.materials.find(
    (candidate) => signature(candidate.materials) === signature(materials),
  );
  return {
    id: assignment?.assignmentId ?? -1,
    slug: materials[0]?.slug ?? "",
    name: materialCombinationLabel(materials),
  };
}

/**
 * Renders material and finish fields for a collection item.
 *
 * @param root0 - Collection product field properties.
 * @returns The collection product fields.
 */
export function CollectionProductFields({
  currentFinish,
  customFinish,
  finish,
  material,
  onCustomFinishChange,
  onFinishChange,
  onMaterialChange,
  onOptionsChange,
  options,
  product,
  t,
}: {
  /** Existing item finish available as a choice. */
  currentFinish?: CatalogFinishOption | null;
  /** Current custom finish value. */
  customFinish: FinishOptionFormValue;
  /** Selected finish choice. */
  finish: ComboboxOption | null;
  /** Selected material. */
  material: CatalogLookup | null;
  /**
   * Updates the custom finish value.
   *
   * @param value - Updated custom finish.
   */
  onCustomFinishChange: (value: FinishOptionFormValue) => void;
  /**
   * Updates the selected finish.
   *
   * @param value - Selected finish, or null to clear it.
   */
  onFinishChange: (value: ComboboxOption | null) => void;
  /**
   * Updates the selected material.
   *
   * @param value - Selected material, or null to clear it.
   */
  onMaterialChange: (value: CatalogLookup | null) => void;
  /**
   * Updates shared catalog lookup options.
   *
   * @param value - Next options or an updater function.
   */
  onOptionsChange: React.Dispatch<React.SetStateAction<CatalogOptions>>;
  /** Available catalog lookup options. */
  options: CatalogOptions;
  /** Product supplying available materials and finishes. */
  product: CatalogProduct;
  /** Localized catalog message formatter. */
  t: ReturnType<typeof useCatalogCopy>;
}) {
  const finishItems: ComboboxOption[] = [
    ...(currentFinish
      ? [{ id: "current", name: localizedFinishLabel(currentFinish, t) }]
      : []),
    ...product.finishOptions.map((option) => ({
      id: option.id,
      name: localizedFinishLabel(option, t),
    })),
    { id: "custom", name: t("web.collections.finishChoice.custom") },
  ];

  return (
    <fieldset className="grid min-w-0 gap-5 rounded-lg border border-border p-4">
      <legend className="max-w-full wrap-anywhere px-1 text-sm font-semibold">
        {product.name}
      </legend>
      <Field label={t("web.catalog.field.materials")}>
        <CatalogCombobox
          ariaLabel={t("web.catalog.field.materials")}
          items={[
            ...(material?.id === -1 ? [material] : []),
            ...product.materials.map((assignment) => ({
              id: assignment.assignmentId,
              slug: assignment.materials[0]?.slug ?? "",
              name: materialCombinationLabel(assignment.materials),
            })),
          ]}
          onValueChange={(value) =>
            onMaterialChange(
              value
                ? {
                    id: Number(value.id),
                    name: value.name,
                    slug:
                      product.materials.find(
                        ({ assignmentId }) => assignmentId === value.id,
                      )?.materials[0]?.slug ??
                      material?.slug ??
                      "",
                  }
                : null,
            )
          }
          placeholder={t("web.catalog.selectMaterial")}
          removeLabel={t("web.action.close")}
          showSelectedPill
          value={material}
        />
      </Field>
      <Field label={t("web.catalog.field.finishOptions")}>
        <CatalogCombobox
          ariaLabel={t("web.catalog.field.finishOptions")}
          items={finishItems}
          onValueChange={onFinishChange}
          placeholder={t("web.catalog.selectFinishOption")}
          removeLabel={t("web.action.close")}
          showSelectedPill
          value={finish}
        />
      </Field>
      {finish?.id === "custom" ? (
        <FinishOptionsEditor
          onChange={(value) => {
            const next = value[0];
            if (next) onCustomFinishChange(next);
          }}
          onOptionsChange={onOptionsChange}
          options={options}
          singleOption
          t={t}
          value={[customFinish]}
        />
      ) : null}
    </fieldset>
  );
}

/**
 * Formats a finish option with localized built-in color effects.
 *
 * @param option - Finish option to format.
 * @param t - Catalog translation formatter.
 * @returns The localized finish label.
 */
function localizedFinishLabel(
  option: CatalogFinishOption,
  t: ReturnType<typeof useCatalogCopy>,
) {
  return finishOptionLabel({
    ...option,
    colorEffect: option.colorEffect
      ? {
          ...option.colorEffect,
          name:
            option.colorEffect.slug === "fade"
              ? t("web.catalog.colorEffect.fade")
              : option.colorEffect.slug === "solid"
                ? t("web.catalog.colorEffect.solid")
                : option.colorEffect.name,
        }
      : null,
  });
}

/** Localized collection-item validation or save feedback. */
type CollectionEditFeedback = {
  /** Existing primary failure key. */
  message: string;
  /** Optional privacy/compatibility explanation from the endpoint. */
  detail?: {
    /** Existing secondary localization key. */
    key: string;
    /** Existing interpolation values. */
    values?: Readonly<Record<string, unknown>>;
  };
};
/** Committed collection-item edit and preceding image uploads. */
type CollectionEditEffect = {
  /** Save implementation. */
  type: "save";
  /** Unchanged server payload, absent for an upload-only save. */
  data: unknown;
  /** Whether details should be saved after images. */
  mode: "save" | "upload";
  /** Captured image batch. */
  files: File[];
  /** Edited item identifier. */
  itemId: number;
  /** Item name for duplicate-image restore confirmation. */
  itemName: string;
  /** Destination after success. */
  collectionId: number;
  /** Existing optional moderation reason. */
  reason?: string;
};
/** Edit outcome retained across lifecycle suspension. */
type CollectionEditResult = {
  /** Images requiring retry. */
  files: File[];
  /** Existing localized failure response. */
  error?: CollectionEditFeedback;
};
/** Collection-item controls and committed edit lifetime. */
type CollectionEditState = {
  /** Available lookup choices. */
  options: CatalogOptions;
  /** Whether Markdown is still initializing. */
  descriptionLoading: boolean;
  /** Whether the magnet override must be saved. */
  magnetConfigurationDirty: boolean;
  /** Whether a layout change discarded an incompatible snapshot. */
  magnetConfigurationNotice: boolean;
  /** Pending ordered image/upload operation. */
  save: EffectEntity<CollectionEditState, CollectionEditEvent> | undefined;
};
/** Editing control and terminal save events. */
type CollectionEditEvent =
  | {
      /** Accepts the shared lookup callback. */
      type: "lookupOptionsChanged";
      /** Pure replacement or updater. */
      update: React.SetStateAction<CatalogOptions>;
    }
  | {
      /** Receives committed editor readiness. */
      type: "descriptionLoadingChanged";
      /** Whether initialization is pending. */
      loading: boolean;
    }
  | {
      /** Records an explicit magnet override edit. */
      type: "magnetConfigurationEdited";
    }
  | {
      /** Records a discarded incompatible magnet override. */
      type: "magnetLayoutChanged";
    }
  | {
      /** Queues validated fields and image files. */
      type: "saveRequested";
      /** Immutable edit inputs. */
      request: Omit<CollectionEditEffect, "type">;
    }
  | {
      /** Stops the completed edit workflow. */
      type: "saveFinished";
    };

/**
 * Renders the collection-item edit page.
 *
 * @param root0 - Existing item, product, and lookup values.
 * @param root0.assemblyMoveItemCount - Connected assembly members moved with this item.
 * @param root0.buttonProducts - Catalog products for owned spinner buttons.
 * @param root0.collections - Collections available as destinations.
 * @param root0.item - Collection item being edited.
 * @param root0.options - Catalog lookup options.
 * @param root0.ownedButtons - Owned spinner buttons available to install.
 * @param root0.ownedSliderComponents - Owned slider plates and inserts available to install.
 * @param root0.product - Source catalog product.
 * @returns The collection-item edit page.
 */
export function CollectionEditPage({
  assemblyMoveItemCount = 1,
  buttonProducts,
  catalogProducts = [],
  collections,
  item,
  options: initialOptions,
  ownedButtons,
  ownedItems = [],
  ownedSliderComponents = [],
  product,
}: {
  /** Connected assembly members moved with this item. */
  assemblyMoveItemCount?: number;
  /** Catalog products for owned spinner buttons. */
  buttonProducts: CatalogProduct[];
  /** Visible catalog products used for Pen refill selection. */
  catalogProducts?: CatalogProduct[];
  /** Collections available as destinations. */
  collections: UserCollectionSummary[];
  /** Collection item being edited. */
  item: UserCollectionItem;
  /** Catalog lookup options. */
  options: CatalogOptions;
  /** Owned spinner buttons available to install. */
  ownedButtons: UserCollectionItem[];
  /** Current owner's collection items available as physical Pen parts. */
  ownedItems?: UserCollectionItem[];
  /** Owned slider components available to install. */
  ownedSliderComponents?: UserCollectionItem[];
  /** Source catalog product. */
  product: CatalogProduct;
}) {
  const t = useCatalogCopy();
  const { locale } = useLocale();
  const imageGuidance = getImageUploadGuidance(locale);
  const displayNameLabel = t("web.collections.field.displayName");
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const ownershipPeriods = item.ownershipPeriods ?? [];
  const initialButton = ownedButtons.find(
    ({ collectionItemId }) => collectionItemId === item.installedButtonId,
  );
  const initialPlate = ownedSliderComponents.find(
    ({ collectionItemId }) => collectionItemId === item.installedPlateId,
  );
  const initialInsert = ownedSliderComponents.find(
    ({ collectionItemId }) => collectionItemId === item.installedInsertId,
  );

  /** Initial collection-item editing fields. */
  const defaultValues = {
    images: [] as File[],
    existingImages: item.images,
    collectionId: item.collectionId,
    displayName: item.displayName,
    description: item.descriptionOverride ?? "",
    bearing: item.bearingOverride ?? "",
    serialNumber: (item.serialNumber ?? null) as string | null,
    ownership: ownershipEditorValue(
      ownershipPeriods.at(-1),
    ) as OwnershipEditorValue,
    installedPenPartIds: (item.installedPenPartCollectionItemIds ??
      []) as number[],
    installedRefillProductId: item.installedRefillProductId ?? null,
    installedRefillOfferingId: item.installedRefillOfferingId ?? null,
    material: collectionMaterialChoice(
      product,
      item.materials,
    ) as CatalogLookup | null,
    finish: (item.finishOption
      ? { id: "current", name: localizedFinishLabel(item.finishOption, t) }
      : null) as ComboboxOption | null,
    customFinish: emptyFinishOption(),
    magnetConfiguration: (item.magnetConfiguration ??
      item.effectiveSliderSetup?.configuration ??
      null) as SliderMagnetConfiguration | null,
    button: (initialButton
      ? {
          id: initialButton.collectionItemId,
          name: initialButton.displayName,
        }
      : {
          id: "default",
          name: t("web.catalog.defaultButton"),
        }) as ComboboxOption | null,
    buttonMaterial: collectionMaterialChoice(
      buttonProducts.find(({ id }) => id === initialButton?.productId),
      initialButton?.materials,
    ) as CatalogLookup | null,
    buttonFinish: (initialButton?.finishOption
      ? {
          id: "current",
          name: localizedFinishLabel(initialButton.finishOption, t),
        }
      : null) as ComboboxOption | null,
    buttonCustomFinish: emptyFinishOption(),
    plate: (initialPlate
      ? {
          id: initialPlate.collectionItemId,
          name: initialPlate.displayName,
        }
      : {
          id: "default",
          name: t("web.slider.component.noPlate"),
        }) as ComboboxOption | null,
    insert: (initialInsert
      ? {
          id: initialInsert.collectionItemId,
          name: initialInsert.displayName,
        }
      : {
          id: "default",
          name: t("web.slider.component.noInsert"),
        }) as ComboboxOption | null,
  };
  /**
   * Selects the existing save/upload-only mode from a current form snapshot.
   * @param value - Current editing fields.
   * @returns Existing submission mode for valid details or selected images.
   */
  const draftMode = (value: typeof defaultValues) => {
    const selectedButton = ownedButtons.find(
      ({ collectionItemId }) => collectionItemId === value.button?.id,
    );
    const selectedButtonProduct = buttonProducts.find(
      ({ id }) => id === selectedButton?.productId,
    );
    const selectedPlate = ownedSliderComponents.find(
      ({ collectionItemId }) => collectionItemId === value.plate?.id,
    );
    const selectedInsert = ownedSliderComponents.find(
      ({ collectionItemId }) => collectionItemId === value.insert?.id,
    );
    const buttonValid =
      item.productTypeSlug !== "spinner" ||
      value.button?.id === "default" ||
      Boolean(selectedButton && selectedButtonProduct && value.buttonMaterial);
    const sliderValid =
      item.productTypeSlug !== "slider" ||
      ((value.plate?.id === "default" || Boolean(selectedPlate)) &&
        (!product.usesInserts ||
          value.insert?.id === "default" ||
          Boolean(selectedInsert)));
    const finishValid =
      value.finish?.id !== "custom" ||
      finishOptionSchema.safeParse(value.customFinish).success;
    const buttonFinishValid =
      value.buttonFinish?.id !== "custom" ||
      finishOptionSchema.safeParse(value.buttonCustomFinish).success;
    const valid = Boolean(
      value.displayName.trim() &&
        value.description.length <= 5000 &&
        (product.productTypeSlug.startsWith("pen") || value.material) &&
        (value.serialNumber === null || value.serialNumber.trim()) &&
        finishValid &&
        buttonValid &&
        sliderValid &&
        (!selectedButton || buttonFinishValid),
    );
    return collectionEditSubmissionMode(valid, value.images.length);
  };
  const form = useForm({
    defaultValues,
    validators: {
      /**
       * Retains upload-only saves while validating images and details before mutation.
       * @param input - Current edit fields.
       * @returns Existing localized feedback when no save mode is eligible.
       */
      onSubmit: ({ value }): CollectionEditFeedback | undefined => {
        if (draftMode(value) === "disabled")
          return { message: "web.catalog.error.form" };
        const error = validateImages(value.images, locale);
        return error ? { message: error.key } : undefined;
      },
    },
    /**
     * Captures validated edits using the unchanged payload and moderation reason.
     * @param input - Current edit fields.
     */
    onSubmit: ({ value }) => {
      if (ui.save) return;
      const mode = draftMode(value);
      if (mode === "disabled") return;
      const moderating = item.canAdminister && !item.isOwner;
      const reason = moderating
        ? window.prompt(t("web.resources.moderation.reasonLabel"))?.trim()
        : undefined;
      if (moderating && !reason) return;
      const {
        collectionId,
        displayName,
        description,
        bearing,
        serialNumber,
        ownership,
        installedPenPartIds,
        installedRefillProductId,
        installedRefillOfferingId,
        material,
        finish,
        customFinish,
        magnetConfiguration,
        button,
        buttonMaterial,
        buttonFinish,
        buttonCustomFinish,
        plate,
        insert,
      } = value;
      const currentDescription = description;
      const selectedButton = ownedButtons.find(
        ({ collectionItemId }) => collectionItemId === button?.id,
      );
      const selectedPlate = ownedSliderComponents.find(
        ({ collectionItemId }) => collectionItemId === plate?.id,
      );
      const selectedInsert = ownedSliderComponents.find(
        ({ collectionItemId }) => collectionItemId === insert?.id,
      );
      const buttonFinishSelectionIsValid =
        buttonFinish?.id !== "custom" ||
        finishOptionSchema.safeParse(buttonCustomFinish).success;
      const magnetConfigurationDirty = ui.magnetConfigurationDirty;
      let data: unknown;
      if (mode === "save") {
        let installedButton:
          | {
              /** Installed collection item identifier. */
              collectionItemId: number;
              /** Custom finish applied to the installed button. */
              customFinish: FinishOptionFormValue | null;
              /** Catalog finish option applied to the installed button. */
              finishOptionId: number | null;
              /** Material applied to the installed button. */
              materialAssignmentId?: number;
            }
          | null
          | undefined;
        if (item.productTypeSlug === "spinner") {
          if (button?.id === "default") {
            installedButton = null;
          } else {
            if (
              !selectedButton ||
              !buttonMaterial ||
              !buttonFinish ||
              !buttonFinishSelectionIsValid
            ) {
              return;
            }
            installedButton = {
              collectionItemId: selectedButton.collectionItemId,
              customFinish:
                buttonFinish.id === "custom" ? buttonCustomFinish : null,
              finishOptionId:
                buttonFinish.id === "current" || buttonFinish.id === "custom"
                  ? null
                  : Number(buttonFinish.id),
              materialAssignmentId:
                buttonMaterial.id === -1 ? undefined : buttonMaterial.id,
            };
          }
        }
        const installedPlate =
          item.productTypeSlug === "slider"
            ? plate?.id === "default"
              ? null
              : selectedPlate
                ? { collectionItemId: selectedPlate.collectionItemId }
                : undefined
            : undefined;
        const installedInsert =
          item.productTypeSlug === "slider" && product.usesInserts
            ? insert?.id === "default"
              ? null
              : selectedInsert
                ? { collectionItemId: selectedInsert.collectionItemId }
                : undefined
            : undefined;
        data = {
          bearing,
          collectionId,
          collectionItemId: item.collectionItemId,
          installedPenPartCollectionItemIds: installedPenPartIds,
          customFinish: finish?.id === "custom" ? customFinish : null,
          displayName,
          description: currentDescription,
          finishOptionId:
            finish?.id === "current" || finish?.id === "custom"
              ? null
              : finish
                ? Number(finish.id)
                : null,
          ...(item.productTypeSlug === "pen"
            ? {
                installedRefillOfferingId,
                installedRefillProductId,
              }
            : {}),
          ...(item.productTypeSlug === "spinner" ? { installedButton } : {}),
          ...(item.productTypeSlug === "slider"
            ? {
                installedInsert,
                installedPlate,
                ...(magnetConfigurationDirty ? { magnetConfiguration } : {}),
              }
            : {}),
          materialAssignmentId: material?.id === -1 ? undefined : material?.id,
          ownership: {
            effectiveEndDate: ownership.currentlyOwned
              ? null
              : ownership.effectiveEndDate || null,
            effectiveStartDate: ownership.startDateUnknown
              ? null
              : ownership.effectiveStartDate,
            entryReason: ownership.entryReason,
            exitReason: ownership.currentlyOwned
              ? null
              : ownership.exitReason || null,
            periodId: ownership.periodId,
          },
          reason,
          serialNumber,
        };
      }
      dispatch({
        type: "saveRequested",
        request: {
          data,
          mode,
          files: value.images,
          itemId: item.collectionItemId,
          itemName: item.displayName,
          collectionId: value.collectionId,
          reason,
        },
      });
    },
  });
  const {
    images,
    existingImages,
    collectionId,
    displayName,
    description,
    bearing,
    serialNumber,
    ownership,
    installedPenPartIds,
    installedRefillProductId,
    installedRefillOfferingId,
    material,
    finish,
    customFinish,
    magnetConfiguration,
    button,
    buttonMaterial,
    buttonFinish,
    buttonCustomFinish,
    plate,
    insert,
  } = useStore(form.store, (state) => state.values);

  const descriptionRef = React.useRef<MarkdownEditorHandle>(null);
  const task = React.useRef<{
    /** Descriptor whose mutation must not replay. */
    effect: CollectionEditEffect;
    /** Completion retained across suspended observers. */
    promise: Promise<CollectionEditResult>;
  } | null>(null);
  const [ui, dispatch] = useEffectReducer<
    CollectionEditState,
    CollectionEditEvent,
    CollectionEditEffect
  >(
    (state, event, exec) => {
      switch (event.type) {
        case "lookupOptionsChanged":
          return {
            ...state,
            options:
              typeof event.update === "function"
                ? event.update(state.options)
                : event.update,
          };
        case "descriptionLoadingChanged":
          return state.descriptionLoading === event.loading
            ? state
            : { ...state, descriptionLoading: event.loading };
        case "magnetConfigurationEdited":
          return { ...state, magnetConfigurationDirty: true };
        case "magnetLayoutChanged":
          return {
            ...state,
            magnetConfigurationDirty: true,
            magnetConfigurationNotice: true,
          };
        case "saveRequested":
          if (state.save) return state;
          return { ...state, save: exec({ type: "save", ...event.request }) };
        case "saveFinished":
          exec.stop(state.save);
          return { ...state, save: undefined };
      }
    },
    {
      options: initialOptions,
      descriptionLoading: true,
      magnetConfigurationDirty: false,
      magnetConfigurationNotice: false,
      save: undefined,
    },
    {
      /**
       * Observes image-first editing once across lifecycle resumption.
       * @param _state - Current edit controls.
       * @param effect - Captured immutable edit request.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current observer lifetime.
       */
      save: (_state, effect, dispatch, { signal }) => {
        if (task.current?.effect !== effect)
          task.current = { effect, promise: performEdit(effect) };
        void task.current.promise.then((result) => {
          if (signal.aborted) return;
          dispatch({ type: "saveFinished" });
          form.setFieldValue("images", (current) =>
            current.filter(
              (file) =>
                !effect.files.includes(file) || result.files.includes(file),
            ),
          );
          if (result.error) form.setErrorMap({ onSubmit: result.error });
          else
            void navigate({
              params: { collectionId: effect.collectionId },
              to: "/user/collections/$collectionId",
            });
        });
      },
    },
  );
  const { options, descriptionLoading, magnetConfigurationNotice } = ui;
  const feedback = useStore(form.store, (state) => state.errorMap.onSubmit);
  const submissionMode = useStore(form.store, (state) =>
    draftMode(state.values),
  );
  /**
   * Accepts the existing shared lookup contract.
   * @param update - Pure options replacement or updater.
   */
  const receiveOptions = (update: React.SetStateAction<CatalogOptions>) => {
    dispatch({ type: "lookupOptionsChanged", update });
  };
  /**
   * Reports committed Markdown readiness through a stable callback.
   * @param loading - Whether initialization is pending.
   */
  const receiveDescriptionLoading = React.useCallback(
    (loading: boolean) => {
      dispatch({ type: "descriptionLoadingChanged", loading });
    },
    [dispatch],
  );
  /**
   * Uploads selected images before applying edits in the existing mutation order.
   * @param request - Captured edit and upload inputs.
   * @returns Retained files and existing localized failure feedback.
   */
  async function performEdit(
    request: CollectionEditEffect,
  ): Promise<CollectionEditResult> {
    let files = request.files;
    try {
      if (files.length) {
        const uploaded = await uploadImages({
          locale,
          files,
          getToken,
          reason: request.reason,
          targetId: request.itemId,
          targetType: "collection_item",
          /**
           * Offers the existing restore choice for an owner-deleted duplicate image.
           * @param imageId - Duplicate image identifier.
           * @returns Whether the duplicate was restored.
           */
          onOwnerDeletedDuplicate: async (imageId) => {
            if (
              !window.confirm(
                t("web.resources.trash.restoreConfirmationDescription", {
                  name: request.itemName,
                }),
              )
            )
              return false;
            await restoreCatalogImage({
              data: {
                imageId,
                reason: request.reason,
                targetType: "collection_item",
              },
            });
            return true;
          },
        });
        files = uploaded.failed;
        if (files.length)
          return {
            files,
            error: { message: "web.resources.upload.sessionFailure" },
          };
      }
      if (request.mode === "upload") return { files };
      const result = await updateCollectionItem({ data: request.data });
      if (result.ok) return { files };
      return {
        files,
        error: {
          message: result.formError,
          detail:
            "formErrorDetail" in result &&
            typeof result.formErrorDetail === "string"
              ? {
                  key: result.formErrorDetail,
                  values:
                    "formErrorValues" in result &&
                    typeof result.formErrorValues === "object" &&
                    result.formErrorValues !== null
                      ? (result.formErrorValues as Readonly<
                          Record<string, unknown>
                        >)
                      : undefined,
                }
              : undefined,
        },
      };
    } catch (error) {
      return {
        files,
        error: { message: (error as ImageUploadError).key ?? "error.generic" },
      };
    }
  }
  const selectedButton = ownedButtons.find(
    ({ collectionItemId }) => collectionItemId === button?.id,
  );
  const selectedButtonProduct = buttonProducts.find(
    ({ id }) => id === selectedButton?.productId,
  );

  const selectedPlate = ownedSliderComponents.find(
    ({ collectionItemId }) => collectionItemId === plate?.id,
  );
  const selectedInsert = ownedSliderComponents.find(
    ({ collectionItemId }) => collectionItemId === insert?.id,
  );
  const selectedInsertProduct = options.relationshipProducts.find(
    ({ id }) => id === selectedInsert?.productId,
  );
  const effectiveMagnetLayout =
    selectedInsertProduct?.magnetLayout ?? product.magnetLayout;

  return (
    <AppShell
      breadcrumbItems={[
        { label: t("web.navigation.collections"), to: "/collections" },
      ]}
      title={item.displayName}
    >
      <main className="grid w-full max-w-6xl min-w-0 gap-5 rounded-xl border border-border bg-card p-6 lg:grid-cols-2">
        <div className="grid min-w-0 content-start gap-5">
          <Field label={displayNameLabel}>
            <Input
              aria-label={displayNameLabel}
              onChange={(event) =>
                form.setFieldValue("displayName", event.target.value)
              }
              required
              value={displayName}
            />
          </Field>
          <CatalogMarkdownEditor
            defaultValue={description}
            help={t("web.catalog.help.collectionDescriptionOverride")}
            id="collection-item-override"
            label={t("web.catalog.field.description")}
            onChange={(value) => form.setFieldValue("description", value)}
            onLoadingChange={receiveDescriptionLoading}
            ref={descriptionRef}
          />
          {item.productTypeSlug === "spinner" ? (
            <Field label={t("web.catalog.field.bearing")}>
              <Input
                aria-label={t("web.catalog.field.bearing")}
                maxLength={200}
                onChange={(event) =>
                  form.setFieldValue("bearing", event.target.value)
                }
                value={bearing}
              />
            </Field>
          ) : null}
          {collectionProductTypeSupportsSerial(item.productTypeSlug) ? (
            <SerialNumberFields
              onChange={(value) => form.setFieldValue("serialNumber", value)}
              t={t}
              value={serialNumber}
            />
          ) : null}
          <OwnershipLifecycleFields
            allowDeparture
            onChange={(value) => form.setFieldValue("ownership", value)}
            onPeriodChange={(periodId) =>
              form.setFieldValue(
                "ownership",
                ownershipEditorValue(
                  ownershipPeriods.find(({ id }) => id === periodId),
                ),
              )
            }
            periods={ownershipPeriods}
            value={ownership}
          />
          <CollectionSelector
            addLabel={t("web.collections.select.addNew")}
            collections={collections}
            label={t("web.collections.field.collection")}
            onChange={(nextCollectionId) => {
              if (nextCollectionId)
                form.setFieldValue("collectionId", nextCollectionId);
            }}
            placeholder={t("web.collections.select.placeholder")}
            selectedId={collectionId}
          />
          <CollectionProductFields
            currentFinish={item.finishOption}
            customFinish={customFinish}
            finish={finish}
            material={material}
            onCustomFinishChange={(value) =>
              form.setFieldValue("customFinish", value)
            }
            onFinishChange={(value) => form.setFieldValue("finish", value)}
            onMaterialChange={(value) => form.setFieldValue("material", value)}
            onOptionsChange={receiveOptions}
            options={options}
            product={product}
            t={t}
          />
          {item.productTypeSlug === "pen" ? (
            <PenCollectionFields
              allProducts={catalogProducts}
              currentCollectionItemId={item.collectionItemId}
              onRefillOfferingChange={(value) =>
                form.setFieldValue("installedRefillOfferingId", value)
              }
              onRefillProductChange={(value) =>
                form.setFieldValue("installedRefillProductId", value)
              }
              onInstalledPartIdsChange={(value) =>
                form.setFieldValue("installedPenPartIds", value)
              }
              ownedItems={ownedItems}
              product={product}
              refillOfferingId={installedRefillOfferingId}
              refillProductId={installedRefillProductId}
              installedPartIds={installedPenPartIds}
              t={t}
            />
          ) : null}
          {item.productTypeSlug === "spinner" ? (
            <Field label={t("web.catalog.field.button")}>
              <CatalogCombobox
                ariaLabel={t("web.catalog.field.button")}
                items={[
                  { id: "default", name: t("web.catalog.defaultButton") },
                  ...ownedButtons
                    .filter(
                      (candidate) =>
                        candidate.collectionId === collectionId ||
                        candidate.collectionItemId === item.installedButtonId,
                    )
                    .map(({ collectionItemId, displayName }) => ({
                      id: collectionItemId,
                      name: displayName,
                    })),
                ]}
                onValueChange={(value) => {
                  form.setFieldValue("button", value);
                  const selected = ownedButtons.find(
                    ({ collectionItemId }) => collectionItemId === value?.id,
                  );
                  form.setFieldValue(
                    "buttonMaterial",
                    collectionMaterialChoice(
                      buttonProducts.find(
                        ({ id }) => id === selected?.productId,
                      ),
                      selected?.materials,
                    ),
                  );
                  form.setFieldValue(
                    "buttonFinish",
                    selected?.finishOption
                      ? {
                          id: "current",
                          name: localizedFinishLabel(selected.finishOption, t),
                        }
                      : null,
                  );
                  form.setFieldValue("buttonCustomFinish", emptyFinishOption());
                }}
                placeholder={t("web.catalog.defaultButton")}
                removeLabel={t("web.action.close")}
                showSelectedPill
                value={button}
              />
            </Field>
          ) : null}
          {item.productTypeSlug === "slider" ? (
            <>
              <Field label={t("web.slider.component.installedPlate")}>
                <CatalogCombobox
                  ariaLabel={t("web.slider.component.installedPlate")}
                  items={[
                    {
                      id: "default",
                      name: t("web.slider.component.noPlate"),
                    },
                    ...ownedSliderComponents
                      .filter(
                        (candidate) =>
                          candidate.productTypeSlug === "slider-plate" &&
                          (candidate.installedOnSliderId === null ||
                            candidate.installedOnSliderId ===
                              item.collectionItemId),
                      )
                      .map(({ collectionItemId, displayName }) => ({
                        id: collectionItemId,
                        name: displayName,
                      })),
                  ]}
                  onValueChange={(value) => form.setFieldValue("plate", value)}
                  placeholder={t("web.slider.component.noPlate")}
                  removeLabel={t("web.action.close")}
                  showSelectedPill
                  value={plate}
                />
              </Field>
              {product.usesInserts ? (
                <Field label={t("web.slider.component.installedInsert")}>
                  <CatalogCombobox
                    ariaLabel={t("web.slider.component.installedInsert")}
                    items={[
                      {
                        id: "default",
                        name: t("web.slider.component.noInsert"),
                      },
                      ...ownedSliderComponents
                        .filter(
                          (candidate) =>
                            candidate.productTypeSlug === "slider-insert" &&
                            (candidate.installedOnSliderId === null ||
                              candidate.installedOnSliderId ===
                                item.collectionItemId),
                        )
                        .map(({ collectionItemId, displayName }) => ({
                          id: collectionItemId,
                          name: displayName,
                        })),
                    ]}
                    onValueChange={(value) => {
                      const nextInsert = ownedSliderComponents.find(
                        ({ collectionItemId }) =>
                          collectionItemId === value?.id,
                      );
                      const nextLayout =
                        options.relationshipProducts.find(
                          ({ id }) => id === nextInsert?.productId,
                        )?.magnetLayout ?? product.magnetLayout;
                      if (
                        effectiveMagnetLayout !== nextLayout &&
                        magnetConfiguration !== null
                      ) {
                        form.setFieldValue("magnetConfiguration", null);
                        dispatch({ type: "magnetLayoutChanged" });
                      }
                      form.setFieldValue("insert", value);
                    }}
                    placeholder={t("web.slider.component.noInsert")}
                    removeLabel={t("web.action.close")}
                    showSelectedPill
                    value={insert}
                  />
                </Field>
              ) : null}
              {effectiveMagnetLayout ? (
                <SliderMagnetConfigurationEditor
                  layout={effectiveMagnetLayout}
                  onChange={(value) => {
                    form.setFieldValue("magnetConfiguration", value);
                    dispatch({ type: "magnetConfigurationEdited" });
                  }}
                  presets={options.magnetPresets}
                  t={t}
                  value={magnetConfiguration}
                />
              ) : null}
              {magnetConfigurationNotice ? (
                <Notice>{t("web.slider.magnet.layoutChanged")}</Notice>
              ) : null}
              {collectionId !== item.collectionId ||
              selectedPlate?.collectionId !== collectionId ||
              selectedInsert?.collectionId !== collectionId ? (
                <Notice>
                  {t("web.slider.component.moveAssemblySummary", {
                    count:
                      1 +
                      Number(Boolean(selectedPlate)) +
                      Number(Boolean(selectedInsert)),
                  })}
                </Notice>
              ) : null}
              <Notice>
                <ul className="grid gap-1">
                  <li>
                    {t("web.slider.component.installedPlate")}:{" "}
                    {selectedPlate?.displayName ??
                      t("web.slider.component.noPlate")}
                  </li>
                  {product.usesInserts ? (
                    <li>
                      {t("web.slider.component.installedInsert")}:{" "}
                      {selectedInsert?.displayName ??
                        t("web.slider.component.noInsert")}
                    </li>
                  ) : null}
                </ul>
              </Notice>
            </>
          ) : null}
          {item.installedOnSliderId !== null &&
          collectionId !== item.collectionId ? (
            <Notice>
              {t("web.slider.component.moveAssemblySummary", {
                count: assemblyMoveItemCount,
              })}
            </Notice>
          ) : null}
          {selectedButton && selectedButtonProduct ? (
            <CollectionProductFields
              currentFinish={selectedButton.finishOption}
              customFinish={buttonCustomFinish}
              finish={buttonFinish}
              material={buttonMaterial}
              onCustomFinishChange={(value) =>
                form.setFieldValue("buttonCustomFinish", value)
              }
              onFinishChange={(value) =>
                form.setFieldValue("buttonFinish", value)
              }
              onMaterialChange={(value) =>
                form.setFieldValue("buttonMaterial", value)
              }
              onOptionsChange={receiveOptions}
              options={options}
              product={selectedButtonProduct}
              t={t}
            />
          ) : null}
          {feedback ? (
            <Notice>
              {t(feedback.message)}
              {feedback.detail
                ? ` ${t(feedback.detail.key, feedback.detail.values)}`
                : null}
            </Notice>
          ) : null}
          {item.canEdit ? (
            <PermanentDeletionControls
              key={item.collectionItemId}
              name={item.displayName}
              targetType="collection_item"
              reasonRequired={Boolean(item.canAdminister && !item.isOwner)}
              onDelete={async (reason) => {
                const result = await deleteCollectionItem({
                  data: {
                    collectionItemId: item.collectionItemId,
                    confirmed: true,
                    reason,
                  },
                });
                if (!result.ok) throw new Error(result.formError);
              }}
              onDeleted={() =>
                navigate({
                  params: { collectionId: item.collectionId },
                  to: "/user/collections/$collectionId",
                })
              }
            />
          ) : null}
        </div>
        <div className="grid min-w-0 content-start gap-5">
          <FileDropInput
            accept=".avif,.jpeg,.jpg,.png,.webp"
            disabled={Boolean(ui.save)}
            aspectRatio={4 / 3}
            aspectRatioHelpHref="/help/image-size-and-resolution-guide"
            aspectRatioHelpLabel={imageGuidance.helpLabel}
            aspectRatioWarning={imageGuidance.warning}
            browseLabel={t("web.resources.upload.browseFiles")}
            description={t("web.resources.upload.imagesHelp", {
              maxFileSize: formatMiB(maxImageBytes, locale),
              maxImages: maxImageSessionFiles,
              maxSessionSize: formatMiB(maxImageSessionBytes, locale),
            })}
            fileTypes={t("web.resources.upload.imageTypes")}
            files={images}
            id="collection-edit-images"
            label={t("web.resources.upload.imagesLabel")}
            multiple
            onFilesChange={(additions) =>
              form.setFieldValue("images", (current) => [
                ...current,
                ...additions,
              ])
            }
            onRemove={(index) =>
              form.setFieldValue("images", (current) =>
                current.filter((_, candidate) => candidate !== index),
              )
            }
            removeFileLabel={t("web.action.close")}
          />
          <CatalogImageEditor
            getReason={
              item.canAdminister && !item.isOwner
                ? () =>
                    window
                      .prompt(t("web.resources.moderation.reasonLabel"))
                      ?.trim()
                : undefined
            }
            images={existingImages}
            onChange={(value) => form.setFieldValue("existingImages", value)}
            t={t}
            targetType="collection_item"
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2 lg:col-span-2">
          <Button
            onClick={() =>
              void navigate({
                params: { collectionId },
                to: "/user/collections/$collectionId",
              })
            }
            type="button"
            variant="outline"
          >
            {t("action.cancel")}
          </Button>
          <Button
            disabled={
              descriptionLoading ||
              Boolean(ui.save) ||
              submissionMode === "disabled"
            }
            onClick={() => {
              if (descriptionRef.current?.isLoading() || ui.save) return;
              form.setFieldValue(
                "description",
                descriptionRef.current?.getValue() ??
                  form.state.values.description,
              );
              form.setErrorMap({ onSubmit: undefined });
              void form.handleSubmit();
            }}
            type="button"
          >
            {t("action.save")}
          </Button>
        </div>
      </main>
    </AppShell>
  );
}

/**
 * Selects whether a collection-item edit can save details or only upload images.
 *
 * @param detailsAreValid - Whether all detail fields can be saved.
 * @param pendingImageCount - Number of images waiting to upload.
 * @returns The permitted submission mode.
 */
export function collectionEditSubmissionMode(
  detailsAreValid: boolean,
  pendingImageCount: number,
): "disabled" | "save" | "upload" {
  if (detailsAreValid) return "save";
  return pendingImageCount > 0 ? "upload" : "disabled";
}

/**
 * Renders one labeled catalog form field.
 *
 * @param root0 - Field label and content.
 * @returns The labeled field.
 */
function Field({
  children,
  label,
}: {
  /** Field control and supporting content. */
  children: React.ReactNode;
  /** Localized field label. */
  label: string;
}) {
  return (
    <div className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </div>
  );
}

/**
 * Renders archive and restore controls for catalog images.
 *
 * @param root0 - Catalog image editor properties.
 * @returns The image controls, or nothing when no images exist.
 */
function CatalogImageEditor({
  getReason,
  images,
  onChange,
  t,
  targetType,
}: {
  /**
   * Collects a moderation reason when required.
   *
   * @returns The moderation reason, or undefined when canceled.
   */
  getReason?(): string | undefined;
  /** Images available for archive or restore. */
  images: CatalogImage[];
  /**
   * Receives the updated image list.
   *
   * @param images - Updated catalog images.
   */
  onChange(images: CatalogImage[]): void;
  /** Localized catalog message formatter. */
  t: ReturnType<typeof useCatalogCopy>;
  /** Catalog record type that owns the images. */
  targetType: "collection_item" | "product";
}) {
  if (!images.length) return null;
  return (
    <section
      aria-label={t("web.resources.upload.imagesLabel")}
      className="grid min-w-0 gap-3"
    >
      {images.map((image) => (
        <div
          className="flex min-w-0 items-center gap-3 rounded-lg border border-border p-3"
          key={image.id}
        >
          <img
            alt={t("web.resources.detail.imageAlt", { name: image.fileName })}
            className="size-16 shrink-0 rounded-md object-cover"
            src={image.url}
          />
          <span className="min-w-0 flex-1 truncate text-sm">
            {image.fileName}
          </span>
          <Button
            aria-label={`${t(image.deletedAt ? "web.resources.action.restore" : "web.resources.action.delete")} ${image.fileName}`}
            className="shrink-0"
            onClick={async () => {
              const reason = getReason?.();
              if (getReason && !reason) return;
              if (image.deletedAt) {
                await restoreCatalogImage({
                  data: { imageId: image.id, reason, targetType },
                });
                onChange(
                  images.map((candidate) =>
                    candidate.id === image.id
                      ? {
                          ...candidate,
                          deletedAt: null,
                          deletedByClerkId: null,
                          deletedByRole: null,
                        }
                      : candidate,
                  ),
                );
              } else {
                await softDeleteCatalogImage({
                  data: { imageId: image.id, reason, targetType },
                });
                onChange(
                  images.map((candidate) =>
                    candidate.id === image.id
                      ? {
                          ...candidate,
                          deletedAt: new Date(),
                          deletedByRole: "owner",
                        }
                      : candidate,
                  ),
                );
              }
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <FontAwesomeIcon
              aria-hidden="true"
              icon={image.deletedAt ? faArrowRotateLeft : faTrash}
            />
            {t(
              image.deletedAt
                ? "web.resources.action.restore"
                : "web.resources.action.delete",
            )}
          </Button>
        </div>
      ))}
    </section>
  );
}

/**
 * Renders one localized field error.
 *
 * @param root0 - Field error properties.
 * @returns The localized error, or nothing without an error.
 */
function FieldError({
  error,
  t,
}: {
  /** Translation key for the field error. */
  error?: string;
  /** Localized catalog message formatter. */
  t: ReturnType<typeof useCatalogCopy>;
}) {
  return error ? (
    <span className="text-sm text-destructive" role="alert">
      {t(error)}
    </span>
  ) : null;
}

/**
 * Renders a catalog form status notice.
 *
 * @param root0 - Notice content.
 * @param root0.children - Notice content.
 * @returns The status notice.
 */
function Notice({
  children,
}: {
  /** Notice content. */
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg border border-border bg-secondary p-4 text-secondary-foreground"
      role="status"
    >
      {children}
    </div>
  );
}
