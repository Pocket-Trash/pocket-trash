import { useAuth } from "@clerk/tanstack-react-start";
import type {
  CatalogColor,
  CatalogFinishOption,
  CatalogImage,
  CatalogLookup,
  CatalogMaker,
  CatalogProduct,
  CatalogProductType,
  CatalogTerminologyAlias,
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
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { RotateCcw, Trash2, X } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
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
import { UserPageShell } from "@/components/user-page-shell";
import { filterButtonsByDiameter, finishOptionLabel } from "@/lib/catalog";
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
  const [selectedType, setSelectedType] = React.useState<ComboboxOption | null>(
    () =>
      initialProduct
        ? {
            id: initialProduct.productTypeId,
            name: initialProduct.productTypeName,
          }
        : null,
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
              onValueChange={setSelectedType}
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
  "configuration-slot",
  "configuration-slot-required",
  "configuration-choice",
  "configuration-rule",
  "source-evidence",
  "refill-offering",
  "offering-market-status",
  "offering-identifier",
  "compatibility-evidence",
  "compatibility-membership",
  "compatibility-assertion",
  "refill-tip-style",
  "refill-ink-color",
  "market",
  "compatibility-group",
] as const;
/** One structured Pens administration action. */
type PensAdminAction = (typeof pensAdminActions)[number];

/**
 * Renders structured append-only Pens administration for an existing product.
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
  const [action, setAction] = React.useState<PensAdminAction>(
    product.productTypeSlug === "refill"
      ? "refill-offering"
      : "configuration-slot",
  );
  const [approved, setApproved] = React.useState(false);
  const [primaryId, setPrimaryId] = React.useState("");
  const [secondaryId, setSecondaryId] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [text, setText] = React.useState("");
  const [text2, setText2] = React.useState("");
  const [text3, setText3] = React.useState("");
  const [text4, setText4] = React.useState("");
  const [date, setDate] = React.useState("");
  const [choiceKind, setChoiceKind] = React.useState<
    "finish" | "material" | "part"
  >("material");
  const [evidenceKind, setEvidenceKind] = React.useState("physical-fit-test");
  const [outcome, setOutcome] = React.useState("compatible");
  const [targetKind, setTargetKind] = React.useState<"group" | "refill">(
    "refill",
  );
  const [message, setMessage] = React.useState<string | null>(null);
  if (!admin) return null;

  const slot = product.configurationSlots.find(
    ({ id }) => id === Number(primaryId),
  );
  const choices = product.configurationSlots.flatMap((candidate) =>
    candidate.choices.map((choice) => ({
      ...choice,
      slotLabel: candidate.labelFallback,
      slotPosition: candidate.position ?? 0,
    })),
  );
  const targetChoice = choices.find(({ id }) => id === Number(primaryId));
  const earlierChoices = targetChoice
    ? choices.filter(
        ({ id, slotPosition }) =>
          id !== targetChoice.id && slotPosition < targetChoice.slotPosition,
      )
    : [];
  const evidenceOptions = action.startsWith("compatibility-")
    ? admin.compatibilityEvidence
    : admin.sourceEvidence;
  const partType = slot?.slotKindSlug
    ? (`pen-${slot.slotKindSlug}` as CatalogProductType)
    : "pen-tip";
  const carriers =
    choiceKind === "material"
      ? product.materials.map((material) => ({
          id: material.assignmentId,
          name: material.specific?.name ?? material.name,
        }))
      : choiceKind === "finish"
        ? product.finishOptions.map((finish) => ({
            id: finish.id,
            name: finishOptionLabel(finish),
          }))
        : options.relationshipProducts
            .filter(
              (candidate) =>
                candidate.id !== product.id &&
                candidate.productTypeSlug === partType,
            )
            .map(({ id, name }) => ({ id, name }));

  /**
   * Renders a labeled single-value select.
   *
   * @param label - Accessible field label.
   * @param value - Selected value.
   * @param onChange - Selection callback.
   * @param items - Available values.
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
  ) => (
    <Field label={label}>
      <select
        aria-label={label}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        onChange={(event) => onChange(event.target.value)}
        required
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

  /** Evidence multi-select shared by approval-gated actions. */
  const evidencePicker = (
    <Field label={t("web.pens.admin.evidence" as TranslationKey)}>
      <select
        aria-label={t("web.pens.admin.evidence" as TranslationKey)}
        className="min-h-24 rounded-md border border-input bg-background px-3 text-sm"
        multiple
        onChange={(event) =>
          setSelectedIds(
            [...event.currentTarget.selectedOptions].map(({ value }) => value),
          )
        }
        value={selectedIds}
      >
        {evidenceOptions.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </Field>
  );

  /**
   * Validates and submits the selected structured mutation.
   *
   * @returns A promise that resolves after the response is handled.
   */
  const submit = async () => {
    const id = Number(primaryId);
    const id2 = Number(secondaryId);
    const evidence = selectedIds.map((evidenceId) => ({
      evidenceId: Number(evidenceId),
      stance: "supports" as const,
    }));
    const data: unknown =
      action === "configuration-slot"
        ? {
            kind: action,
            productId: product.id,
            required: false,
            slotKindId: id,
          }
        : action === "configuration-slot-required"
          ? {
              kind: action,
              productId: product.id,
              required: approved,
              slotId: id,
            }
          : action === "configuration-choice"
            ? {
                finishOptionId: choiceKind === "finish" ? id2 : null,
                kind: action,
                partProductId: choiceKind === "part" ? id2 : null,
                productId: product.id,
                productMaterialId: choiceKind === "material" ? id2 : null,
                slotId: id,
              }
            : action === "configuration-rule"
              ? {
                  kind: action,
                  productId: product.id,
                  requiredChoiceIds: selectedIds.map(Number),
                  targetChoiceId: id,
                }
              : action === "source-evidence"
                ? {
                    captureDate: date,
                    claim: text4,
                    kind: action,
                    marketId: id || null,
                    originalUrl: text3,
                    publisher: text,
                    sourceKind: text2,
                  }
                : action === "refill-offering"
                  ? {
                      approved,
                      evidence,
                      inkColorId: id2,
                      kind: action,
                      refillProductId: product.id,
                      tipSize: text,
                      tipStyleId: id,
                    }
                  : action === "offering-market-status"
                    ? {
                        approved,
                        effectiveDate: date || null,
                        evidence,
                        kind: action,
                        lifecycle: text,
                        marketId: id2,
                        offeringId: id,
                      }
                    : action === "offering-identifier"
                      ? {
                          approved,
                          effectiveDate: date || null,
                          evidence,
                          identifierKind: text2,
                          kind: action,
                          makerId: product.makerId,
                          marketId: id2,
                          offeringId: id,
                          sourceValue: text,
                        }
                      : action === "compatibility-evidence"
                        ? evidenceKind === "physical-fit-test"
                          ? {
                              evidenceKind,
                              kind: action,
                              penProductId:
                                product.productTypeSlug === "pen"
                                  ? product.id
                                  : id,
                              procedure: text3,
                              refillProductId:
                                product.productTypeSlug === "refill"
                                  ? product.id
                                  : id2,
                              result: text2,
                              summary: text,
                              testDate: date,
                            }
                          : evidenceKind === "dimensional-comparison"
                            ? {
                                evidenceKind,
                                firstMeasuredFormatLabel: text2,
                                firstSourceUrl: text3,
                                kind: action,
                                secondMeasuredFormatLabel: text4,
                                secondSourceUrl: secondaryId,
                                summary: text,
                              }
                            : {
                                catalogEdition: text4 || null,
                                evidenceKind,
                                kind: action,
                                sourceDate: date || null,
                                sourceUrl: text3,
                                summary: text,
                              }
                        : action === "compatibility-membership"
                          ? {
                              approved,
                              evidence,
                              groupId: id,
                              kind: action,
                              refillProductId: product.id,
                            }
                          : action === "compatibility-assertion"
                            ? {
                                approved,
                                evidence,
                                explanation: text || null,
                                kind: action,
                                outcome,
                                penProductId: product.id,
                                remedy: text2 || null,
                                targetGroupId:
                                  targetKind === "group" ? id : null,
                                targetRefillProductId:
                                  targetKind === "refill" ? id : null,
                                warning: text3 || null,
                              }
                            : action === "market"
                              ? {
                                  code: text2,
                                  displayName: text,
                                  displayNameKey: text3,
                                  kind: action,
                                  marketKind: text4 || "country",
                                }
                              : action === "compatibility-group"
                                ? { conceptId: id, kind: action }
                                : {
                                    kind: action,
                                    name: text,
                                    slug: text2,
                                  };
    const result = await authorCatalogPensData({ data });
    if (!result.ok) {
      setMessage(result.formError);
      return;
    }
    window.location.reload();
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
          setAction(value as PensAdminAction);
          setPrimaryId("");
          setSecondaryId("");
          setSelectedIds([]);
          setMessage(null);
        },
        pensAdminActions.map((id) => ({ id, name: copy(`action.${id}`) })),
      )}
      {action === "configuration-slot"
        ? select(copy("slotKind"), primaryId, setPrimaryId, admin.slotKinds)
        : null}
      {action === "configuration-slot-required"
        ? select(
            copy("slot"),
            primaryId,
            setPrimaryId,
            product.configurationSlots.map(({ id, labelFallback }) => ({
              id,
              name: labelFallback,
            })),
          )
        : null}
      {action === "configuration-choice" ? (
        <>
          {select(
            copy("slot"),
            primaryId,
            (value) => {
              setPrimaryId(value);
              const selected = product.configurationSlots.find(
                ({ id }) => id === Number(value),
              );
              setChoiceKind(
                selected?.slotKindSlug === "material"
                  ? "material"
                  : selected?.slotKindSlug === "appearance"
                    ? "finish"
                    : "part",
              );
            },
            product.configurationSlots.map(({ id, labelFallback }) => ({
              id,
              name: labelFallback,
            })),
          )}
          {select(copy("choice"), secondaryId, setSecondaryId, carriers)}
        </>
      ) : null}
      {action === "configuration-rule" ? (
        <>
          {select(
            copy("targetChoice"),
            primaryId,
            setPrimaryId,
            choices.map(({ id, label, slotLabel }) => ({
              id,
              name: `${slotLabel}: ${label ?? id}`,
            })),
          )}
          <Field label={copy("availableWhenAnd")}>
            <select
              aria-label={copy("availableWhenAnd")}
              className="min-h-24 rounded-md border border-input bg-background px-3 text-sm"
              multiple
              onChange={(event) =>
                setSelectedIds(
                  [...event.currentTarget.selectedOptions].map(
                    ({ value }) => value,
                  ),
                )
              }
              value={selectedIds}
            >
              {earlierChoices.map(({ id, label, slotLabel }) => (
                <option key={id} value={id}>
                  {slotLabel}: {label ?? id}
                </option>
              ))}
            </select>
            {selectedIds.length ? (
              <p className="text-sm text-muted-foreground">
                {copy("availableWhen")}{" "}
                {selectedIds
                  .map((id) => {
                    const choice = earlierChoices.find(
                      (candidate) => candidate.id === Number(id),
                    );
                    return choice
                      ? `${choice.slotLabel}: ${choice.label ?? choice.id}`
                      : id;
                  })
                  .join(` ${copy("and")} `)}
              </p>
            ) : null}
          </Field>
        </>
      ) : null}
      {action === "source-evidence" ? (
        <>
          {input(copy("publisher"), text, setText)}
          {input(copy("sourceKind"), text2, setText2)}
          {input(copy("originalUrl"), text3, setText3, "url")}
          {input(copy("captureDate"), date, setDate, "date")}
          {input(copy("claim"), text4, setText4)}
          {select(copy("market"), primaryId, setPrimaryId, admin.markets)}
        </>
      ) : null}
      {action === "refill-offering" ? (
        <>
          {select(copy("tipStyle"), primaryId, setPrimaryId, admin.tipStyles)}
          {select(
            copy("inkColor"),
            secondaryId,
            setSecondaryId,
            admin.inkColors,
          )}
          {input(copy("tipSize"), text, setText)}
          {evidencePicker}
        </>
      ) : null}
      {action === "offering-market-status" ||
      action === "offering-identifier" ? (
        <>
          {select(copy("offering"), primaryId, setPrimaryId, admin.offerings)}
          {select(copy("market"), secondaryId, setSecondaryId, admin.markets)}
          {action === "offering-market-status" ? (
            select(copy("lifecycleLabel"), text, setText, [
              { id: "current", name: copy("lifecycle.current") },
              { id: "discontinued", name: copy("lifecycle.discontinued") },
              { id: "historical", name: copy("lifecycle.historical") },
            ])
          ) : (
            <>
              {input(copy("identifier"), text, setText)}
              {select(copy("identifierKindLabel"), text2, setText2, [
                { id: "maker-code", name: copy("identifierKind.makerCode") },
                { id: "sku", name: copy("identifierKind.sku") },
              ])}
            </>
          )}
          {input(copy("effectiveDate"), date, setDate, "date")}
          {evidencePicker}
        </>
      ) : null}
      {action === "compatibility-evidence" ? (
        <>
          {select(copy("evidenceKindLabel"), evidenceKind, setEvidenceKind, [
            {
              id: "manufacturer-statement",
              name: copy("evidenceKind.manufacturerStatement"),
            },
            {
              id: "dimensional-comparison",
              name: copy("evidenceKind.dimensionalComparison"),
            },
            {
              id: "physical-fit-test",
              name: copy("evidenceKind.physicalFitTest"),
            },
            {
              id: "curated-observation",
              name: copy("evidenceKind.curatedObservation"),
            },
          ])}
          {input(copy("summary"), text, setText)}
          {evidenceKind === "physical-fit-test" ? (
            <>
              {select(
                copy("pen"),
                product.productTypeSlug === "pen"
                  ? String(product.id)
                  : primaryId,
                setPrimaryId,
                options.relationshipProducts.filter(
                  ({ productTypeSlug }) => productTypeSlug === "pen",
                ),
              )}
              {select(
                copy("refill"),
                product.productTypeSlug === "refill"
                  ? String(product.id)
                  : secondaryId,
                setSecondaryId,
                options.relationshipProducts.filter(
                  ({ productTypeSlug }) => productTypeSlug === "refill",
                ),
              )}
              {input(copy("testDate"), date, setDate, "date")}
              {input(copy("result"), text2, setText2)}
              {input(copy("procedure"), text3, setText3)}
            </>
          ) : evidenceKind === "dimensional-comparison" ? (
            <>
              {input(copy("firstFormat"), text2, setText2)}
              {input(copy("firstSourceUrl"), text3, setText3, "url")}
              {input(copy("secondFormat"), text4, setText4)}
              {input(
                copy("secondSourceUrl"),
                secondaryId,
                setSecondaryId,
                "url",
              )}
            </>
          ) : (
            <>
              {input(copy("sourceUrl"), text3, setText3, "url")}
              {input(copy("sourceDate"), date, setDate, "date")}
              {input(copy("catalogEdition"), text4, setText4)}
            </>
          )}
        </>
      ) : null}
      {action === "compatibility-membership" ? (
        <>
          {select(
            copy("compatibilityGroup"),
            primaryId,
            setPrimaryId,
            admin.compatibilityGroups,
          )}
          {evidencePicker}
        </>
      ) : null}
      {action === "compatibility-assertion" ? (
        <>
          {select(copy("outcomeLabel"), outcome, setOutcome, [
            { id: "compatible", name: copy("outcome.compatible") },
            { id: "incompatible", name: copy("outcome.incompatible") },
            { id: "conditional", name: copy("outcome.conditional") },
            { id: "variable", name: copy("outcome.variable") },
          ])}
          {select(
            copy("targetTypeLabel"),
            targetKind,
            (value) => setTargetKind(value as "group" | "refill"),
            [
              { id: "refill", name: copy("targetType.refill") },
              { id: "group", name: copy("targetType.group") },
            ],
          )}
          {select(
            copy("target"),
            primaryId,
            setPrimaryId,
            targetKind === "group"
              ? admin.compatibilityGroups
              : options.relationshipProducts.filter(
                  ({ productTypeSlug }) => productTypeSlug === "refill",
                ),
          )}
          {input(copy("explanation"), text, setText)}
          {input(copy("remedy"), text2, setText2)}
          {input(copy("warning"), text3, setText3)}
          {evidencePicker}
        </>
      ) : null}
      {action === "refill-tip-style" || action === "refill-ink-color" ? (
        <>
          {input(copy("name"), text, setText)}
          {input(copy("slug"), text2, setText2)}
        </>
      ) : null}
      {action === "market" ? (
        <>
          {input(copy("displayName"), text, setText)}
          {input(copy("code"), text2, setText2)}
          {input(copy("localizationKey"), text3, setText3)}
          {select(copy("marketKindLabel"), text4, setText4, [
            { id: "country", name: copy("marketKind.country") },
            { id: "region", name: copy("marketKind.region") },
          ])}
        </>
      ) : null}
      {action === "compatibility-group"
        ? select(
            copy("registeredGroup"),
            primaryId,
            setPrimaryId,
            admin.compatibilityGroupConcepts,
          )
        : null}
      {[
        "refill-offering",
        "offering-market-status",
        "offering-identifier",
        "compatibility-membership",
        "compatibility-assertion",
        "configuration-slot-required",
      ].includes(action) ? (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            checked={approved}
            onChange={(event) => setApproved(event.target.checked)}
            type="checkbox"
          />
          {action === "configuration-slot-required"
            ? copy("required")
            : copy("approved")}
        </label>
      ) : null}
      {message ? <Notice>{t(message as TranslationKey)}</Notice> : null}
      <Button onClick={() => void submit()} type="button">
        {t("web.action.save")}
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

/** Controlled editor value keeps text inputs as strings before schema parsing. */
type ProductEditorValue = Omit<
  ProductFormValue,
  | "bearing"
  | "buttonDiameter"
  | "description"
  | "diameter"
  | "length"
  | "makerProductUrl"
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
  /** Maker URL before blank normalization. */
  makerProductUrl: string;
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
  const [options, setOptions] = React.useState(initialOptions);
  const [images, setImages] = React.useState<File[]>([]);
  const [existingImages, setExistingImages] = React.useState(
    initialProduct?.images ?? [],
  );
  const [savedProductId, setSavedProductId] = React.useState<number | null>(
    initialProduct?.id ?? null,
  );
  const [serverErrors, setServerErrors] = React.useState<
    Record<string, string[] | undefined>
  >({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [magnetConfigurationNotice, setMagnetConfigurationNotice] =
    React.useState(false);
  const descriptionRef = React.useRef<MarkdownEditorHandle>(null);
  const plateDialog = React.useRef<HTMLDialogElement>(null);
  const plateTrigger = React.useRef<HTMLButtonElement>(null);
  const plateDialogTitleId = React.useId();
  const insertDialog = React.useRef<HTMLDialogElement>(null);
  const insertTrigger = React.useRef<HTMLButtonElement>(null);
  const insertDialogTitleId = React.useId();
  const [descriptionLoading, setDescriptionLoading] = React.useState(true);
  const defaultValues: ProductEditorValue = {
    aliases: initialProduct?.aliases ?? [],
    bearing: initialProduct?.bearing ?? "",
    buttonDiameter: initialProduct?.buttonDiameter ?? { unit: "mm", value: "" },
    compatibleButtonId: initialProduct?.compatibleButtonId ?? null,
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
    makerProductUrl: initialProduct?.makerProductUrl ?? "",
    magnetConfiguration: initialProduct?.magnetConfiguration ?? null,
    magnetLayout:
      productTypeSlug === "slider-insert"
        ? (initialProduct?.magnetLayout ?? "2x4")
        : productTypeSlug === "slider" && !initialProduct?.includedInsert
          ? (initialProduct?.magnetLayout ?? "2x4")
          : null,
    mechanismId: initialProduct?.mechanismId ?? null,
    materialAssignments:
      initialProduct?.materials.map(({ id, specific }) => ({
        materialId: id,
        materialSpecificId: specific?.id ?? null,
      })) ??
      (productTypeSlug === "refill"
        ? []
        : [{ materialId: 0, materialSpecificId: null }]),
    name: initialProduct?.name ?? "",
    productId: initialProduct?.id ?? null,
    productTypeSlug,
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
    /**
     * Saves the current product editor values.
     *
     * @param root0 - Form submission state.
     * @param root0.value - Current product field values.
     * @returns A promise that resolves after the save flow completes.
     */
    onSubmit: async ({ value }) => {
      if (descriptionRef.current?.isLoading()) return;
      const currentValue = {
        ...value,
        description: descriptionRef.current?.getValue() ?? value.description,
      };
      const moderating = Boolean(
        initialProduct?.canAdminister && !initialProduct.isOwner,
      );
      const reason = moderating
        ? window.prompt(t("web.resources.moderation.reasonLabel"))?.trim()
        : undefined;
      if (moderating && !reason) return;
      const clientResult = productFormSchema.safeParse(currentValue);
      if (!clientResult.success) {
        setServerErrors(z.flattenError(clientResult.error).fieldErrors);
        setFormError("web.catalog.error.form");
        return;
      }
      const imageError = validateImages(images, locale);
      if (imageError) {
        setFormError(imageError.key);
        return;
      }
      const result = await saveCatalogProduct({
        data: {
          ...currentValue,
          productId: savedProductId ?? value.productId,
          reason,
        },
      });
      if (!result.ok) {
        setServerErrors(result.fieldErrors);
        setFormError(result.formError);
        return;
      }
      setSavedProductId(result.product.id);
      if (quickCreate) {
        onCreated?.(result.product);
        return;
      }
      if (images.length) {
        try {
          const uploads = await uploadImages({
            locale,
            files: images,
            getToken,
            /**
             * Offers to restore an owner-deleted duplicate image.
             *
             * @param imageId - Duplicate image identifier.
             * @returns Whether the duplicate was restored.
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
                data: { imageId, reason, targetType: "product" },
              });
              return true;
            },
            targetId: result.product.id,
            targetType: "product",
            reason,
          });
          setImages(uploads.failed);
          if (uploads.failed.length) {
            setFormError("web.resources.upload.sessionFailure");
            return;
          }
        } catch (error) {
          setFormError((error as ImageUploadError).key ?? "error.generic");
          return;
        }
      }
      await navigate({
        params: {
          productSlug: result.product.slug,
          productTypeSlug: result.product.productTypeSlug,
        },
        to: "/products/$productTypeSlug/$productSlug",
      });
    },
  });

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
      setMagnetConfigurationNotice(true);
    }
    form.setFieldValue("magnetLayout", layout);
  };

  return (
    <form
      className="grid min-w-0 gap-5 rounded-xl border border-border bg-card p-6 lg:grid-cols-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
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
              <FieldError error={serverErrors.name?.[0]} t={t} />
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
                    setOptions((current) => ({
                      ...current,
                      makers: [...current.makers, maker].sort((a, b) =>
                        a.name.localeCompare(b.name),
                      ),
                    }));
                    field.handleChange(maker.id);
                  }}
                  t={t}
                />
                <FieldError error={serverErrors.makerId?.[0]} t={t} />
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
                      setOptions((current) => ({
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
          <form.Field name="makerProductUrl">
            {(field) => (
              <Field label={t("web.catalog.field.makerProductUrl")}>
                <Input
                  aria-label={t("web.catalog.field.makerProductUrl")}
                  aria-describedby="maker-product-url-help"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  type="url"
                  value={field.state.value}
                />
                <p
                  className="text-xs text-muted-foreground"
                  id="maker-product-url-help"
                >
                  {t("web.catalog.help.makerProductUrl")}
                </p>
                <FieldError error={serverErrors.makerProductUrl?.[0]} t={t} />
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
                <FieldError error={serverErrors.aliases?.[0]} t={t} />
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
                <FieldError error={serverErrors.mechanismId?.[0]} t={t} />
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
                <FieldError error={serverErrors.refillModel?.[0]} t={t} />
              </Field>
            )}
          </form.Field>
        ) : null}
        {productTypeSlug !== "refill" ? (
          <form.Field name="materialAssignments">
            {(field) => (
              <Field label={t("web.catalog.field.materials")}>
                {field.state.value.map((selection, index) => (
                  <div
                    className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                    key={index}
                  >
                    <CatalogCombobox
                      ariaLabel={t("web.catalog.field.materials")}
                      items={options.materials}
                      value={
                        options.materials.find(
                          ({ id }) => id === selection.materialId,
                        ) ?? null
                      }
                      placeholder={t("web.catalog.selectMaterial")}
                      onValueChange={(value) =>
                        field.handleChange(
                          field.state.value.map((row, i) =>
                            i === index
                              ? {
                                  materialId: Number(value?.id ?? 0),
                                  materialSpecificId: null,
                                }
                              : row,
                          ),
                        )
                      }
                    />
                    <CatalogCombobox
                      ariaLabel={t("web.materials.specific.optional")}
                      items={(options.materialSpecifics ?? []).filter(
                        ({ materialId }) => materialId === selection.materialId,
                      )}
                      value={
                        (options.materialSpecifics ?? []).find(
                          ({ id }) => id === selection.materialSpecificId,
                        ) ?? null
                      }
                      placeholder={t("web.materials.specific.general")}
                      removeLabel={t("web.action.close")}
                      showSelectedPill
                      onValueChange={(value) =>
                        field.handleChange(
                          field.state.value.map((row, i) =>
                            i === index
                              ? {
                                  ...row,
                                  materialSpecificId: value
                                    ? Number(value.id)
                                    : null,
                                }
                              : row,
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={t("web.action.close")}
                      onClick={() =>
                        field.handleChange(
                          field.state.value.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <X />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    productTypeSlug === "slider-insert" &&
                    field.state.value.length > 0
                  }
                  onClick={() =>
                    field.handleChange([
                      ...field.state.value,
                      { materialId: 0, materialSpecificId: null },
                    ])
                  }
                >
                  {t("web.catalog.selectMaterial")}
                </Button>
                <LookupDialog
                  kind="material"
                  t={t}
                  onCreated={(material) => {
                    setOptions((current) => ({
                      ...current,
                      materials: [...current.materials, material].sort((a, b) =>
                        a.name.localeCompare(b.name),
                      ),
                    }));
                    const selection = {
                      materialId: material.id,
                      materialSpecificId: null,
                    };
                    field.handleChange(
                      productTypeSlug === "slider-insert"
                        ? [selection]
                        : [
                            ...field.state.value.filter(
                              ({ materialId }) => materialId !== 0,
                            ),
                            selection,
                          ],
                    );
                  }}
                />
                <FieldError
                  error={serverErrors.materialAssignments?.[0]}
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
                  onOptionsChange={setOptions}
                  options={options}
                  t={t}
                  value={field.state.value}
                />
              )}
            </form.Field>
            <FieldError error={serverErrors.finishOptions?.[0]} t={t} />
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
            weight: "web.archive.spec.weight",
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
                  <FieldError error={serverErrors[name]?.[0]} t={t} />
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
                    error={serverErrors.includedPlateProductId?.[0]}
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
                <FieldError error={serverErrors.usesInserts?.[0]} t={t} />
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
                              setMagnetConfigurationNotice(true);
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
                          error={serverErrors.includedInsertProductId?.[0]}
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
                          error={serverErrors.magnetLayout?.[0]}
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
                <FieldError error={serverErrors.bearing?.[0]} t={t} />
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
                        error={serverErrors.compatibleButtonId?.[0]}
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
                serverErrors.description?.[0]
                  ? t(serverErrors.description[0])
                  : undefined
              }
              help={t("web.catalog.help.markdownDescription")}
              id="product-description"
              label={t("web.catalog.field.description")}
              onChange={field.handleChange}
              onLoadingChange={setDescriptionLoading}
              ref={descriptionRef}
            />
          )}
        </form.Field>
        {!quickCreate ? (
          <FileDropInput
            accept=".avif,.jpeg,.jpg,.png,.webp"
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
              setImages((current) => [...current, ...additions])
            }
            onRemove={(index) =>
              setImages((current) =>
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
            onChange={setExistingImages}
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
          <Notice>{t(formError)}</Notice>
        </div>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2 lg:col-span-2">
        <Button
          onClick={() => {
            if (quickCreate) {
              onCancel?.();
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
                    setOptions((current) => ({
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
                    setOptions((current) => ({
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
  const [name, setName] = React.useState("");
  const [hex, setHex] = React.useState("#808080");
  const [rootUrl, setRootUrl] = React.useState("");
  const [isPreferred, setIsPreferred] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[] | undefined>
  >({});
  const [error, setError] = React.useState<string | null>(null);
  const action = {
    color: "web.action.addColor",
    finish: "web.action.addFinish",
    maker: "web.action.addMaker",
    material: "web.action.addMaterial",
    pattern: "web.slider.appearance.pattern",
    terminologyAlias: "web.slider.alias.add",
  }[kind] as TranslationKey;

  /**
   * Creates the configured lookup and closes the dialog on success.
   *
   * @returns A promise that resolves after creation is attempted.
   */
  const create = async () => {
    if (props.kind === "maker") {
      const result = await createCatalogMaker({ data: { name, rootUrl } });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setError(result.formError);
        return;
      }
      props.onCreated(result.maker);
    } else if (props.kind === "terminologyAlias") {
      const result = await createCatalogTerminologyAlias({
        data: {
          canonicalKey: props.canonicalKey,
          canonicalNamespace: "product-type",
          isPreferred,
          label: name,
          makerId: props.makerId,
        },
      });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setError(result.formError);
        return;
      }
      props.onCreated(result.terminologyAlias);
    } else if (props.kind === "material") {
      const result = await createCatalogMaterial({ data: { name } });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setError(result.formError);
        return;
      }
      props.onCreated(result.material);
    } else if (props.kind === "finish") {
      const result = await createCatalogFinish({ data: { name } });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setError(result.formError);
        return;
      }
      props.onCreated(result.finish);
    } else if (props.kind === "pattern") {
      const result = await createCatalogPattern({ data: { name } });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setError(result.formError);
        return;
      }
      props.onCreated(result.pattern);
    } else {
      const result = await createCatalogColor({ data: { hex, name } });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setError(result.formError);
        return;
      }
      props.onCreated(result.color);
    }
    setName("");
    setHex("#808080");
    setRootUrl("");
    setIsPreferred(false);
    setFieldErrors({});
    setError(null);
    ref.current?.close();
  };

  return (
    <>
      <Button
        aria-controls={dialogId}
        aria-haspopup="dialog"
        onClick={() => {
          setFieldErrors({});
          setError(null);
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
      >
        <div className="grid gap-4 p-6">
          <h2 className="text-lg font-semibold" id={titleId}>
            {t(action)}
          </h2>
          <Field label={t("web.catalog.field.name")}>
            <Input
              aria-label={t("web.catalog.field.name")}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
            <FieldError error={fieldErrors.name?.[0]} t={t} />
          </Field>
          {kind === "maker" ? (
            <Field label={t("web.catalog.field.rootUrl")}>
              <Input
                aria-label={t("web.catalog.field.rootUrl")}
                onChange={(event) => setRootUrl(event.target.value)}
                type="url"
                value={rootUrl}
              />
              <FieldError error={fieldErrors.rootUrl?.[0]} t={t} />
            </Field>
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
                onChange={(event) => setIsPreferred(event.target.checked)}
                type="checkbox"
              />
              {t("web.slider.alias.preferred")}
            </label>
          ) : null}
          {kind === "color" ? (
            <Field label={t("web.catalog.field.colors")}>
              <Input
                aria-label={t("web.catalog.field.colors")}
                onChange={(event) => setHex(event.target.value.toUpperCase())}
                required
                type="color"
                value={hex}
              />
            </Field>
          ) : null}
          {error ? <Notice>{t(error)}</Notice> : null}
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => ref.current?.close()}
              type="button"
              variant="outline"
            >
              {t("action.cancel")}
            </Button>
            <Button onClick={() => void create()} type="button">
              {t(action)}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

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
  const [current, setCurrent] = React.useState(collection);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
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
   * Saves the collection and uploads its initial images.
   *
   * @param value - Collection form values.
   * @param images - Initial collection images.
   * @returns A promise that resolves after the save flow completes.
   */
  async function submit(value: CollectionFormValue, images: File[]) {
    setSaving(true);
    setError(null);
    const moderating = Boolean(current?.canAdminister && !current.isOwner);
    const reason = moderating
      ? window.prompt(t("web.resources.moderation.reasonLabel"))?.trim()
      : undefined;
    if (moderating && !reason) {
      setSaving(false);
      return;
    }
    const result = await saveCollection({
      data: {
        collectionId: current?.id ?? null,
        description: value.description,
        isPrivate: value.isPrivate,
        name: value.name,
        reason,
        summary: value.summary,
      },
    });
    if (!result.ok) {
      setError(t(result.formError));
      setSaving(false);
      return;
    }
    setCurrent(result.collection);
    if (images.length) {
      try {
        const upload = await uploadImages({
          locale,
          files: images,
          getToken,
          reason,
          targetId: result.collection.id,
          targetType: "collection",
        });
        if (upload.failed.length) {
          setError(t("web.collections.error.upload"));
          setSaving(false);
          return;
        }
      } catch {
        setError(t("web.collections.error.upload"));
        setSaving(false);
        return;
      }
    }
    await navigate({
      params: { collectionId: result.collection.id },
      to: "/user/collections/$collectionId",
    });
  }

  /**
   * Runs a collection cover action with any required moderation reason.
   *
   * @param action - Cover action to perform.
   * @returns A promise that resolves after the action completes.
   */
  async function updateCover(action: CollectionCoverAction) {
    if (!current) return;
    const moderating = Boolean(current.canAdminister && !current.isOwner);
    const reason = moderating
      ? window.prompt(t("web.resources.moderation.reasonLabel"))?.trim()
      : undefined;
    if (moderating && !reason) return;
    setSaving(true);
    setError(null);
    try {
      await action(reason);
      window.location.reload();
    } catch {
      setError(t("error.generic"));
      setSaving(false);
    }
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
                  onUpload={async (files) => {
                    setSaving(true);
                    setUploadError(null);
                    try {
                      const upload = await uploadImages({
                        locale,
                        files,
                        getToken,
                        targetId: current.id,
                        targetType: "collection",
                      });
                      if (upload.failed.length) {
                        setUploadError(t("web.collections.error.upload"));
                        setSaving(false);
                        return false;
                      }
                      window.location.reload();
                      return true;
                    } catch (uploadFailure) {
                      const failure = uploadFailure as ImageUploadError;
                      setUploadError(
                        t(failure.key ?? "error.generic", failure.params),
                      );
                      setSaving(false);
                      return false;
                    }
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
  const [choice, setChoice] = React.useState<"archive" | "delete" | "move">(
    "archive",
  );
  const [confirmed, setConfirmed] = React.useState(false);
  const [destinationId, setDestinationId] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const reasonId = React.useId();
  const titleId = React.useId();
  const moderating = Boolean(collection.canAdminister && !collection.isOwner);
  const destination = destinations.find(({ id }) => id === destinationId);
  const destructive = choice !== "archive";

  return (
    <section className="border-t border-border pt-6">
      <Button
        onClick={() => dialog.current?.showModal()}
        type="button"
        variant="destructive"
      >
        <Trash2 />
        {t("web.collections.deletion.open")}
      </Button>
      <dialog
        aria-labelledby={titleId}
        className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-lg border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
        onClose={() => {
          setChoice("archive");
          setConfirmed(false);
          setDestinationId(null);
          setFailed(false);
          setReason("");
        }}
        onCancel={(event) => {
          if (submitting) event.preventDefault();
        }}
        ref={dialog}
      >
        <form
          className="grid gap-5 p-6"
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              submitting ||
              (destructive && !confirmed) ||
              (choice === "move" && destinationId === null) ||
              (moderating && !reason.trim())
            ) {
              return;
            }
            setFailed(false);
            setSubmitting(true);
            try {
              await onSubmit(
                choice,
                destinationId,
                moderating ? reason.trim() : undefined,
              );
              dialog.current?.close();
            } catch {
              setFailed(true);
            } finally {
              setSubmitting(false);
            }
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
                    setChoice(value);
                    setConfirmed(false);
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
                  onChange={setDestinationId}
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
                onChange={(event) => setConfirmed(event.target.checked)}
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
                onChange={(event) => setReason(event.target.value)}
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
              disabled={
                submitting ||
                (destructive && !confirmed) ||
                (choice === "move" && destinationId === null) ||
                (moderating && !reason.trim())
              }
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
  const [images, setImages] = React.useState<File[]>([]);
  const collectionDialog = React.useRef<HTMLDialogElement>(null);
  const [newCollection, setNewCollection] =
    React.useState<CollectionFormValue | null>(() =>
      collections.length === 0 && defaultCollectionName
        ? {
            description: "",
            isPrivate: true,
            name: defaultCollectionName,
            summary: "",
          }
        : null,
    );
  const [collectionImages, setCollectionImages] = React.useState<File[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = React.useState<
    number | null
  >(() =>
    collections.length === 1
      ? (collections[0]?.id ?? null)
      : newCollection
        ? -1
        : null,
  );
  const [savedItemId, setSavedItemId] = React.useState<number | null>(null);
  const [savedCollectionId, setSavedCollectionId] = React.useState<
    number | null
  >(null);
  const [options, setOptions] = React.useState(initialOptions);
  const initialProduct = products.find(({ id }) => id === initialProductId);
  const [type, setType] = React.useState<ComboboxOption | null>(() =>
    initialProduct
      ? (initialOptions.productTypes.find(
          ({ slug }) => slug === initialProduct.productTypeSlug,
        ) ?? null)
      : null,
  );
  const [product, setProduct] = React.useState<CatalogProduct | null>(
    initialProduct ?? null,
  );
  const [displayName, setDisplayName] = React.useState(
    initialProduct?.name ?? "",
  );
  const [description, setDescription] = React.useState("");
  const descriptionRef = React.useRef<MarkdownEditorHandle>(null);
  const [descriptionLoading, setDescriptionLoading] = React.useState(true);
  const [bearing, setBearing] = React.useState("");
  const [serialNumber, setSerialNumber] = React.useState<string | null>(null);
  const [configurationSelections, setConfigurationSelections] = React.useState<
    Record<number, OwnedConfigurationSelection>
  >({});
  const [installedRefillProductId, setInstalledRefillProductId] =
    React.useState<number | null>(null);
  const [installedRefillOfferingId, setInstalledRefillOfferingId] =
    React.useState<number | null>(null);
  const [material, setMaterial] = React.useState<CatalogLookup | null>(null);
  const [finish, setFinish] = React.useState<ComboboxOption | null>(null);
  const [customFinish, setCustomFinish] = React.useState(emptyFinishOption);
  const [button, setButton] = React.useState<
    CatalogProduct | ComboboxOption | null
  >(null);
  const [buttonMaterial, setButtonMaterial] =
    React.useState<CatalogLookup | null>(null);
  const [buttonFinish, setButtonFinish] = React.useState<ComboboxOption | null>(
    null,
  );
  const [buttonCustomFinish, setButtonCustomFinish] =
    React.useState(emptyFinishOption);
  const [duplicateCounts, setDuplicateCounts] = React.useState<
    Record<number, number>
  >({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [productQuery, setProductQuery] = React.useState("");
  const [productPage, setProductPage] = React.useState(0);
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
  const customFinishIsValid =
    finishOptionSchema.safeParse(customFinish).success;
  const buttonCustomFinishIsValid =
    finishOptionSchema.safeParse(buttonCustomFinish).success;
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
  const selectedConfigurationChoices = product
    ? product.configurationSlots.flatMap((slot) => {
        const selection = configurationSelections[slot.id];
        return selection
          ? slot.choices.filter(({ id }) => id === selection.choiceId)
          : [];
      })
    : [];
  const configurationMaterialId =
    selectedConfigurationChoices.find(
      ({ productMaterialId }) => productMaterialId !== null,
    )?.productMaterialId ?? null;
  const configurationFinishId =
    selectedConfigurationChoices.find(
      ({ finishOptionId }) => finishOptionId !== null,
    )?.finishOptionId ?? null;
  const configurationIsValid = Boolean(
    !product ||
      product.configurationSlots.every(
        (slot) => !slot.required || configurationSelections[slot.id],
      ),
  );
  const serialNumberIsValid =
    serialNumber === null || serialNumber.trim().length > 0;

  /**
   * Saves the current collection-item fields.
   *
   * @param confirmed - Whether duplicate items were confirmed.
   * @returns A promise that resolves after the save flow completes.
   */
  const submit = async (confirmed: boolean) => {
    const currentDescription =
      descriptionRef.current?.getValue() ?? description;
    setFormError(null);
    if (
      descriptionRef.current?.isLoading() ||
      currentDescription.length > 5000 ||
      !product ||
      !displayName.trim() ||
      selectedCollectionId === null ||
      (!product.configurationSlots.length && !material) ||
      !configurationIsValid ||
      !serialNumberIsValid ||
      (!product.configurationSlots.length &&
        finish?.id === "custom" &&
        !customFinishIsValid) ||
      !collectionProductTypeIsSupported(product.productTypeSlug) ||
      (selectedButton &&
        (!buttonMaterial ||
          (buttonFinish?.id === "custom" && !buttonCustomFinishIsValid)))
    ) {
      return;
    }
    const imageError = validateImages(images, locale);
    if (imageError) {
      setFormError(imageError.key);
      return;
    }
    if (savedItemId && savedCollectionId) {
      try {
        if (images.length) {
          const uploads = await uploadImages({
            locale,
            files: images,
            getToken,
            targetId: savedItemId,
            targetType: "collection_item",
          });
          setImages(uploads.failed);
          if (uploads.failed.length) {
            setFormError("web.resources.upload.sessionFailure");
            return;
          }
        }
        if (collectionImages.length) {
          const coverUpload = await uploadImages({
            locale,
            files: collectionImages,
            getToken,
            targetId: savedCollectionId,
            targetType: "collection",
          });
          if (coverUpload.failed.length) {
            setFormError("web.collections.error.upload");
            return;
          }
          setCollectionImages([]);
        }
        await navigate({
          params: { collectionId: savedCollectionId },
          to: "/user/collections/$collectionId",
        });
      } catch (error) {
        setFormError((error as ImageUploadError).key ?? "error.generic");
      }
      return;
    }
    const result = await addCollectionProduct({
      data: {
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
        configurationSelections: Object.values(configurationSelections),
        customFinish:
          !product.configurationSlots.length && finish?.id === "custom"
            ? customFinish
            : null,
        displayName,
        description: currentDescription,
        finishOptionId: product.configurationSlots.length
          ? configurationFinishId
          : finish?.id === "custom"
            ? null
            : finish
              ? Number(finish.id)
              : null,
        installedRefillOfferingId,
        installedRefillProductId,
        materialAssignmentId: product.configurationSlots.length
          ? configurationMaterialId
          : material?.id === -1
            ? null
            : (material?.id ?? null),
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
        serialNumber,
      },
    });
    if (!result.ok && result.requiresConfirmation) {
      setDuplicateCounts(result.duplicateCounts);
      return;
    }
    if (!result.ok) {
      setFormError(result.formError);
      return;
    }
    setSavedItemId(result.collectionItemId);
    setSavedCollectionId(result.collectionId);
    if (images.length) {
      try {
        const uploads = await uploadImages({
          locale,
          files: images,
          getToken,
          /**
           * Offers to restore an owner-deleted duplicate image.
           *
           * @param imageId - Duplicate image identifier.
           * @returns Whether the duplicate was restored.
           */
          onOwnerDeletedDuplicate: async (imageId) => {
            if (
              !window.confirm(
                t("web.resources.trash.restoreConfirmationDescription", {
                  name: product.name,
                }),
              )
            )
              return false;
            await restoreCatalogImage({
              data: { imageId, targetType: "collection_item" },
            });
            return true;
          },
          targetId: result.collectionItemId,
          targetType: "collection_item",
        });
        setImages(uploads.failed);
        if (uploads.failed.length) {
          setFormError("web.resources.upload.sessionFailure");
          return;
        }
      } catch (error) {
        setFormError((error as ImageUploadError).key ?? "error.generic");
        return;
      }
    }
    if (collectionImages.length) {
      try {
        const upload = await uploadImages({
          locale,
          files: collectionImages,
          getToken,
          targetId: result.collectionId,
          targetType: "collection",
        });
        if (upload.failed.length) {
          setFormError("web.collections.error.upload");
          return;
        }
      } catch {
        setFormError("web.collections.error.upload");
        return;
      }
    }
    await navigate({
      params: { collectionId: result.collectionId },
      to: "/user/collections/$collectionId",
    });
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
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </Field>
        <CatalogMarkdownEditor
          defaultValue={description}
          disabled={!product}
          help={t("web.catalog.help.markdownDescription")}
          id="collection-item-description"
          label={t("web.catalog.field.description")}
          onChange={setDescription}
          onLoadingChange={setDescriptionLoading}
          ref={descriptionRef}
        />
        {product?.productTypeSlug === "spinner" ? (
          <Field label={t("web.catalog.field.bearing")}>
            <Input
              aria-label={t("web.catalog.field.bearing")}
              maxLength={200}
              onChange={(event) => setBearing(event.target.value)}
              value={bearing}
            />
          </Field>
        ) : null}
        {product &&
        collectionProductTypeSupportsSerial(product.productTypeSlug) ? (
          <SerialNumberFields
            onChange={setSerialNumber}
            t={t}
            value={serialNumber}
          />
        ) : null}
        {syncIncomplete ? (
          <Notice>{t("web.collections.error.syncIncomplete")}</Notice>
        ) : null}
        <CollectionSelector
          addLabel={t("web.collections.select.addNew")}
          collections={collectionChoices}
          label={t("web.collections.field.collection")}
          onAdd={() => collectionDialog.current?.showModal()}
          onChange={(collectionId) => {
            setSelectedCollectionId(collectionId);
            if (collectionId !== -1) {
              setNewCollection(null);
              setCollectionImages([]);
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
                setNewCollection(value);
                setCollectionImages(collectionImages);
                setSelectedCollectionId(-1);
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
        <details open={!initialProduct}>
          <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {t("web.navigation.products")}
          </summary>
          <div className="mt-4 grid gap-4">
            <Field label={t("web.catalog.field.productType")}>
              <CatalogCombobox
                ariaLabel={t("web.catalog.field.productType")}
                items={options.productTypes}
                onValueChange={(value) => {
                  setType(value);
                  setProductPage(0);
                  setProductQuery("");
                  setProduct(null);
                  setDisplayName("");
                  setDescription("");
                  setBearing("");
                  setSerialNumber(null);
                  setConfigurationSelections({});
                  setInstalledRefillProductId(null);
                  setInstalledRefillOfferingId(null);
                  setMaterial(null);
                  setFinish(null);
                  setCustomFinish(emptyFinishOption());
                  setButton(null);
                  setButtonMaterial(null);
                  setButtonFinish(null);
                  setButtonCustomFinish(emptyFinishOption());
                  setDuplicateCounts({});
                  setFormError(null);
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
                setProductQuery(event.target.value);
                setProductPage(0);
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
                      setProduct(candidate);
                      setDisplayName(candidate.name);
                      setDescription("");
                      setBearing("");
                      setSerialNumber(null);
                      setConfigurationSelections({});
                      setInstalledRefillProductId(null);
                      setInstalledRefillOfferingId(null);
                      setMaterial(null);
                      setFinish(null);
                      setCustomFinish(emptyFinishOption());
                      setButton(null);
                      setButtonMaterial(null);
                      setButtonFinish(null);
                      setButtonCustomFinish(emptyFinishOption());
                      setDuplicateCounts({});
                      setFormError(null);
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
                onClick={() => setProductPage(currentProductPage - 1)}
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
                onClick={() => setProductPage(currentProductPage + 1)}
                type="button"
                variant="outline"
              >
                {t("web.collections.gallery.nextPage")}
              </Button>
            </div>
          </div>
        </details>
        {product && !product.configurationSlots.length ? (
          <CollectionProductFields
            customFinish={customFinish}
            finish={finish}
            material={material}
            onCustomFinishChange={setCustomFinish}
            onFinishChange={setFinish}
            onMaterialChange={setMaterial}
            onOptionsChange={setOptions}
            options={options}
            product={product}
            t={t}
          />
        ) : null}
        {product?.productTypeSlug === "pen" ? (
          <PenCollectionFields
            allProducts={products}
            onRefillOfferingChange={setInstalledRefillOfferingId}
            onRefillProductChange={setInstalledRefillProductId}
            onSelectionsChange={setConfigurationSelections}
            ownedItems={ownedItems}
            product={product}
            refillOfferingId={installedRefillOfferingId}
            refillProductId={installedRefillProductId}
            selections={configurationSelections}
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
                setButton(
                  typeof value?.id === "number"
                    ? (options.spinnerButtons.find(
                        ({ id }) => id === value.id,
                      ) ?? null)
                    : value,
                );
                setButtonMaterial(null);
                setButtonFinish(null);
                setButtonCustomFinish(emptyFinishOption());
                setDuplicateCounts({});
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
            onCustomFinishChange={setButtonCustomFinish}
            onFinishChange={setButtonFinish}
            onMaterialChange={setButtonMaterial}
            onOptionsChange={setOptions}
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
              setImages((current) => [...current, ...additions])
            }
            onRemove={(index) =>
              setImages((current) =>
                current.filter((_, candidate) => candidate !== index),
              )
            }
            removeFileLabel={t("web.action.close")}
          />
        ) : null}
        {formError ? <Notice>{t(formError)}</Notice> : null}
        {product ? (
          <Button
            disabled={Boolean(
              (!product.configurationSlots.length && !material) ||
                descriptionLoading ||
                description.length > 5000 ||
                !displayName.trim() ||
                !configurationIsValid ||
                !serialNumberIsValid ||
                (!product.configurationSlots.length &&
                  (!finish ||
                    (finish.id === "custom" && !customFinishIsValid))) ||
                (selectedButton &&
                  (!buttonMaterial ||
                    !buttonFinish ||
                    (buttonFinish.id === "custom" &&
                      !buttonCustomFinishIsValid))),
            )}
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

/** Selected virtual choice and optional physical part for one owned configuration slot. */
type OwnedConfigurationSelection = {
  /** Selected catalog choice. */
  choiceId: number;
  /** Same-owner physical part installed for the choice. */
  installedPartCollectionItemId: number | null;
  /** Product configuration slot. */
  slotId: number;
};

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
 * Evaluates positive availability rules against the currently selected choices.
 *
 * @param availableWhen - Alternative requirement sets; each inner list is an AND branch.
 * @param selectedChoiceIds - Choices selected in the current owned configuration.
 * @returns Whether the choice is currently maker-supported.
 */
export function configurationChoiceIsAvailable(
  availableWhen: number[][],
  selectedChoiceIds: ReadonlySet<number>,
): boolean {
  return (
    availableWhen.length === 0 ||
    availableWhen.some((requirements) =>
      requirements.every((choiceId) => selectedChoiceIds.has(choiceId)),
    )
  );
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
 * Renders owned-Pen configuration and installed-refill selectors.
 *
 * @param props - Catalog, owned parts, controlled selections, and translator.
 * @returns Pen configuration fields with non-blocking availability warnings.
 */
function PenCollectionFields({
  allProducts,
  currentCollectionItemId,
  onRefillOfferingChange,
  onRefillProductChange,
  onSelectionsChange,
  ownedItems,
  product,
  refillOfferingId,
  refillProductId,
  selections,
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
  /** Updates configuration selections by slot. */
  onSelectionsChange: React.Dispatch<
    React.SetStateAction<Record<number, OwnedConfigurationSelection>>
  >;
  /** Current owner's physical collection items. */
  ownedItems: UserCollectionItem[];
  /** Configurable Pen product. */
  product: CatalogProduct;
  /** Selected offering identifier. */
  refillOfferingId: number | null;
  /** Selected refill product identifier. */
  refillProductId: number | null;
  /** Current configuration selections keyed by slot. */
  selections: Record<number, OwnedConfigurationSelection>;
  /** Catalog translator. */
  t: ReturnType<typeof useCatalogCopy>;
}) {
  const selectedChoiceIds = new Set(
    Object.values(selections).map(({ choiceId }) => choiceId),
  );
  const selectedChoices = product.configurationSlots.flatMap((slot) =>
    slot.choices.filter(({ id }) => selectedChoiceIds.has(id)),
  );
  const selectedPartProductIds = new Set(
    selectedChoices.flatMap(({ partProductId }) =>
      partProductId == null ? [] : [partProductId],
    ),
  );
  const warning = t("web.pens.collection.notSupported" as TranslationKey);
  const refills = allProducts
    .filter(({ productTypeSlug }) => productTypeSlug === "refill")
    .map((refill) => ({
      compatible: refill.compatiblePens.some(
        (pen) =>
          pen.id === product.id &&
          (pen.requiredTipProductId == null ||
            selectedPartProductIds.has(pen.requiredTipProductId)),
      ),
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
      {product.configurationSlots.map((slot) => {
        const current = selections[slot.id];
        const options = slot.choices
          .flatMap((choice) => {
            const available = configurationChoiceIsAvailable(
              choice.availableWhen,
              selectedChoiceIds,
            );
            const virtual = {
              id: `${choice.id}:virtual`,
              name: choice.label ?? slot.labelFallback,
              warning: available ? undefined : warning,
            };
            const physical = choice.partProductId
              ? ownedItems
                  .filter(
                    (item) =>
                      item.productId === choice.partProductId &&
                      (item.privacyInheritedFromItemId === null ||
                        item.privacyInheritedFromItemId ===
                          currentCollectionItemId),
                  )
                  .map((item) => ({
                    id: `${choice.id}:${item.collectionItemId}`,
                    name: `${choice.label ?? slot.labelFallback} — ${item.displayName}`,
                    warning: available ? undefined : warning,
                  }))
              : [];
            return [virtual, ...physical];
          })
          .sort(
            (left, right) =>
              Number(Boolean(left.warning)) - Number(Boolean(right.warning)),
          );
        const value = current
          ? (options.find(
              ({ id }) =>
                id ===
                `${current.choiceId}:${current.installedPartCollectionItemId ?? "virtual"}`,
            ) ?? null)
          : null;
        const label = t(slot.labelKey as TranslationKey);
        return (
          <Field key={slot.id} label={label}>
            <CatalogCombobox
              ariaLabel={label}
              items={options}
              onValueChange={(next) => {
                onSelectionsChange((currentSelections) => {
                  if (!next) {
                    const remaining = { ...currentSelections };
                    delete remaining[slot.id];
                    return remaining;
                  }
                  const [choiceId, installedPartId] = String(next.id).split(
                    ":",
                  );
                  return {
                    ...currentSelections,
                    [slot.id]: {
                      choiceId: Number(choiceId),
                      installedPartCollectionItemId:
                        installedPartId === "virtual"
                          ? null
                          : Number(installedPartId),
                      slotId: slot.id,
                    },
                  };
                });
              }}
              placeholder={label}
              removeLabel={t("web.action.close")}
              showSelectedPill
              value={value}
            />
            {value?.warning ? (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-destructive"
                />
                {value.warning}
              </p>
            ) : null}
          </Field>
        );
      })}
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
 * @param material - Item's stored canonical general and optional specific.
 * @returns Current assignment choice, retained choice, or null for no material.
 */
function collectionMaterialChoice(
  product: CatalogProduct | undefined,
  material: UserCollectionItem["material"] | undefined,
): CatalogLookup | null {
  if (!material) return null;
  const assignment = product?.materials.find(
    ({ id, specific }) =>
      id === material.id &&
      (specific?.id ?? null) === (material.specific?.id ?? null),
  );
  return {
    id: assignment?.assignmentId ?? -1,
    slug: material.slug,
    name: material.specific
      ? `${material.name}: ${material.specific.name}`
      : material.name,
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
              slug: assignment.slug,
              name: assignment.specific
                ? `${assignment.name}: ${assignment.specific.name}`
                : assignment.name,
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
                      )?.slug ??
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
  const [images, setImages] = React.useState<File[]>([]);
  const [existingImages, setExistingImages] = React.useState(item.images);
  const [collectionId, setCollectionId] = React.useState(item.collectionId);
  const [displayName, setDisplayName] = React.useState(item.displayName);
  const [description, setDescription] = React.useState(
    item.descriptionOverride ?? "",
  );
  const descriptionRef = React.useRef<MarkdownEditorHandle>(null);
  const [descriptionLoading, setDescriptionLoading] = React.useState(true);
  const [bearing, setBearing] = React.useState(item.bearingOverride ?? "");
  const [serialNumber, setSerialNumber] = React.useState<string | null>(
    item.serialNumber ?? null,
  );
  const [configurationSelections, setConfigurationSelections] = React.useState<
    Record<number, OwnedConfigurationSelection>
  >(() =>
    Object.fromEntries(
      (item.configurationSelections ?? []).map((selection) => [
        selection.slotId,
        selection,
      ]),
    ),
  );
  const [installedRefillProductId, setInstalledRefillProductId] =
    React.useState(item.installedRefillProductId ?? null);
  const [installedRefillOfferingId, setInstalledRefillOfferingId] =
    React.useState(item.installedRefillOfferingId ?? null);
  const [options, setOptions] = React.useState(initialOptions);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formErrorDetail, setFormErrorDetail] = React.useState<{
    /** Secondary localized error key. */
    key: string;
    /** Interpolation values for the secondary error. */
    values?: Readonly<Record<string, unknown>>;
  } | null>(null);
  const [material, setMaterial] = React.useState<CatalogLookup | null>(
    collectionMaterialChoice(product, item.material),
  );
  const [finish, setFinish] = React.useState<ComboboxOption | null>(() =>
    item.finishOption
      ? { id: "current", name: localizedFinishLabel(item.finishOption, t) }
      : null,
  );
  const [customFinish, setCustomFinish] = React.useState(emptyFinishOption);
  const [magnetConfiguration, setMagnetConfiguration] =
    React.useState<SliderMagnetConfiguration | null>(
      item.magnetConfiguration ??
        item.effectiveSliderSetup?.configuration ??
        null,
    );
  const [magnetConfigurationDirty, setMagnetConfigurationDirty] =
    React.useState(false);
  const [magnetConfigurationNotice, setMagnetConfigurationNotice] =
    React.useState(false);
  const initialButton = ownedButtons.find(
    ({ collectionItemId }) => collectionItemId === item.installedButtonId,
  );
  const [button, setButton] = React.useState<ComboboxOption | null>(() => {
    return initialButton
      ? { id: initialButton.collectionItemId, name: initialButton.displayName }
      : { id: "default", name: t("web.catalog.defaultButton") };
  });
  const [buttonMaterial, setButtonMaterial] =
    React.useState<CatalogLookup | null>(
      collectionMaterialChoice(
        buttonProducts.find(({ id }) => id === initialButton?.productId),
        initialButton?.material,
      ),
    );
  const [buttonFinish, setButtonFinish] = React.useState<ComboboxOption | null>(
    () =>
      initialButton?.finishOption
        ? {
            id: "current",
            name: localizedFinishLabel(initialButton.finishOption, t),
          }
        : null,
  );
  const [buttonCustomFinish, setButtonCustomFinish] =
    React.useState(emptyFinishOption);
  const selectedButton = ownedButtons.find(
    ({ collectionItemId }) => collectionItemId === button?.id,
  );
  const selectedButtonProduct = buttonProducts.find(
    ({ id }) => id === selectedButton?.productId,
  );
  const initialPlate = ownedSliderComponents.find(
    ({ collectionItemId }) => collectionItemId === item.installedPlateId,
  );
  const initialInsert = ownedSliderComponents.find(
    ({ collectionItemId }) => collectionItemId === item.installedInsertId,
  );
  const [plate, setPlate] = React.useState<ComboboxOption | null>(() =>
    initialPlate
      ? { id: initialPlate.collectionItemId, name: initialPlate.displayName }
      : { id: "default", name: t("web.slider.component.noPlate") },
  );
  const [insert, setInsert] = React.useState<ComboboxOption | null>(() =>
    initialInsert
      ? { id: initialInsert.collectionItemId, name: initialInsert.displayName }
      : { id: "default", name: t("web.slider.component.noInsert") },
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
  const sliderComponentSelectionIsValid =
    item.productTypeSlug !== "slider" ||
    ((plate?.id === "default" || Boolean(selectedPlate)) &&
      (!product.usesInserts ||
        insert?.id === "default" ||
        Boolean(selectedInsert)));
  const buttonSelectionIsValid =
    item.productTypeSlug !== "spinner" ||
    button?.id === "default" ||
    Boolean(selectedButton && selectedButtonProduct && buttonMaterial);
  const finishSelectionIsValid =
    finish?.id !== "custom" ||
    finishOptionSchema.safeParse(customFinish).success;
  const buttonFinishSelectionIsValid =
    buttonFinish?.id !== "custom" ||
    finishOptionSchema.safeParse(buttonCustomFinish).success;
  const selectedConfigurationChoices = product.configurationSlots.flatMap(
    (slot) => {
      const selection = configurationSelections[slot.id];
      return selection
        ? slot.choices.filter(({ id }) => id === selection.choiceId)
        : [];
    },
  );
  const configurationMaterialId =
    selectedConfigurationChoices.find(
      ({ productMaterialId }) => productMaterialId !== null,
    )?.productMaterialId ?? null;
  const configurationFinishId =
    selectedConfigurationChoices.find(
      ({ finishOptionId }) => finishOptionId !== null,
    )?.finishOptionId ?? null;
  const configurationIsValid = product.configurationSlots.every(
    (slot) => !slot.required || configurationSelections[slot.id],
  );
  const serialNumberIsValid =
    serialNumber === null || serialNumber.trim().length > 0;
  const detailsAreValid = Boolean(
    displayName.trim() &&
      description.length <= 5000 &&
      (product.configurationSlots.length || material) &&
      configurationIsValid &&
      serialNumberIsValid &&
      finishSelectionIsValid &&
      buttonSelectionIsValid &&
      sliderComponentSelectionIsValid &&
      (!selectedButton || buttonFinishSelectionIsValid),
  );
  const submissionMode = collectionEditSubmissionMode(
    detailsAreValid,
    images.length,
  );

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
              onChange={(event) => setDisplayName(event.target.value)}
              required
              value={displayName}
            />
          </Field>
          <CatalogMarkdownEditor
            defaultValue={description}
            help={t("web.catalog.help.collectionDescriptionOverride")}
            id="collection-item-override"
            label={t("web.catalog.field.description")}
            onChange={setDescription}
            onLoadingChange={setDescriptionLoading}
            ref={descriptionRef}
          />
          {item.productTypeSlug === "spinner" ? (
            <Field label={t("web.catalog.field.bearing")}>
              <Input
                aria-label={t("web.catalog.field.bearing")}
                maxLength={200}
                onChange={(event) => setBearing(event.target.value)}
                value={bearing}
              />
            </Field>
          ) : null}
          {collectionProductTypeSupportsSerial(item.productTypeSlug) ? (
            <SerialNumberFields
              onChange={setSerialNumber}
              t={t}
              value={serialNumber}
            />
          ) : null}
          <CollectionSelector
            addLabel={t("web.collections.select.addNew")}
            collections={collections}
            label={t("web.collections.field.collection")}
            onChange={(nextCollectionId) => {
              if (nextCollectionId) setCollectionId(nextCollectionId);
            }}
            placeholder={t("web.collections.select.placeholder")}
            selectedId={collectionId}
          />
          {!product.configurationSlots.length ? (
            <CollectionProductFields
              currentFinish={item.finishOption}
              customFinish={customFinish}
              finish={finish}
              material={material}
              onCustomFinishChange={setCustomFinish}
              onFinishChange={setFinish}
              onMaterialChange={setMaterial}
              onOptionsChange={setOptions}
              options={options}
              product={product}
              t={t}
            />
          ) : null}
          {item.productTypeSlug === "pen" ? (
            <PenCollectionFields
              allProducts={catalogProducts}
              currentCollectionItemId={item.collectionItemId}
              onRefillOfferingChange={setInstalledRefillOfferingId}
              onRefillProductChange={setInstalledRefillProductId}
              onSelectionsChange={setConfigurationSelections}
              ownedItems={ownedItems}
              product={product}
              refillOfferingId={installedRefillOfferingId}
              refillProductId={installedRefillProductId}
              selections={configurationSelections}
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
                  setButton(value);
                  const selected = ownedButtons.find(
                    ({ collectionItemId }) => collectionItemId === value?.id,
                  );
                  setButtonMaterial(
                    collectionMaterialChoice(
                      buttonProducts.find(
                        ({ id }) => id === selected?.productId,
                      ),
                      selected?.material,
                    ),
                  );
                  setButtonFinish(
                    selected?.finishOption
                      ? {
                          id: "current",
                          name: localizedFinishLabel(selected.finishOption, t),
                        }
                      : null,
                  );
                  setButtonCustomFinish(emptyFinishOption());
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
                  onValueChange={setPlate}
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
                        setMagnetConfiguration(null);
                        setMagnetConfigurationDirty(true);
                        setMagnetConfigurationNotice(true);
                      }
                      setInsert(value);
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
                    setMagnetConfiguration(value);
                    setMagnetConfigurationDirty(true);
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
              onCustomFinishChange={setButtonCustomFinish}
              onFinishChange={setButtonFinish}
              onMaterialChange={setButtonMaterial}
              onOptionsChange={setOptions}
              options={options}
              product={selectedButtonProduct}
              t={t}
            />
          ) : null}
          {formError ? (
            <Notice>
              {t(formError)}
              {formErrorDetail
                ? ` ${t(formErrorDetail.key, formErrorDetail.values)}`
                : null}
            </Notice>
          ) : null}
          {item.canEdit ? (
            <PermanentDeletionControls
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
                await navigate({
                  params: { collectionId: item.collectionId },
                  to: "/user/collections/$collectionId",
                });
              }}
            />
          ) : null}
        </div>
        <div className="grid min-w-0 content-start gap-5">
          <FileDropInput
            accept=".avif,.jpeg,.jpg,.png,.webp"
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
              setImages((current) => [...current, ...additions])
            }
            onRemove={(index) =>
              setImages((current) =>
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
            onChange={setExistingImages}
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
            disabled={descriptionLoading || submissionMode === "disabled"}
            onClick={async () => {
              const currentDescription =
                descriptionRef.current?.getValue() ?? description;
              if (
                descriptionRef.current?.isLoading() ||
                currentDescription.length > 5000 ||
                submissionMode === "disabled"
              ) {
                return;
              }
              const moderating = item.canAdminister && !item.isOwner;
              const reason = moderating
                ? window
                    .prompt(t("web.resources.moderation.reasonLabel"))
                    ?.trim()
                : undefined;
              if (moderating && !reason) return;
              setFormError(null);
              setFormErrorDetail(null);
              const imageError = validateImages(images, locale);
              if (imageError) {
                setFormError(imageError.key);
                return;
              }
              if (images.length) {
                try {
                  const uploads = await uploadImages({
                    locale,
                    files: images,
                    getToken,
                    reason,
                    /**
                     * Offers to restore an owner-deleted duplicate image.
                     *
                     * @param imageId - Duplicate image identifier.
                     * @returns Whether the duplicate was restored.
                     */
                    onOwnerDeletedDuplicate: async (imageId) => {
                      if (
                        !window.confirm(
                          t(
                            "web.resources.trash.restoreConfirmationDescription",
                            { name: item.displayName },
                          ),
                        )
                      )
                        return false;
                      await restoreCatalogImage({
                        data: {
                          imageId,
                          reason,
                          targetType: "collection_item",
                        },
                      });
                      return true;
                    },
                    targetId: item.collectionItemId,
                    targetType: "collection_item",
                  });
                  setImages(uploads.failed);
                  if (uploads.failed.length) {
                    setFormError("web.resources.upload.sessionFailure");
                    return;
                  }
                } catch (error) {
                  setFormError(
                    (error as ImageUploadError).key ?? "error.generic",
                  );
                  return;
                }
              }
              if (submissionMode === "upload") {
                await navigate({
                  params: { collectionId },
                  to: "/user/collections/$collectionId",
                });
                return;
              }
              if (
                (!product.configurationSlots.length &&
                  (!material || !finish)) ||
                !configurationIsValid
              )
                return;
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
                      buttonFinish.id === "current" ||
                      buttonFinish.id === "custom"
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
              const result = await updateCollectionItem({
                data: {
                  bearing,
                  collectionId,
                  collectionItemId: item.collectionItemId,
                  configurationSelections: Object.values(
                    configurationSelections,
                  ),
                  customFinish:
                    !product.configurationSlots.length &&
                    finish?.id === "custom"
                      ? customFinish
                      : null,
                  displayName,
                  description: currentDescription,
                  finishOptionId: product.configurationSlots.length
                    ? configurationFinishId
                    : finish?.id === "current" || finish?.id === "custom"
                      ? null
                      : Number(finish?.id),
                  ...(item.productTypeSlug === "pen"
                    ? {
                        installedRefillOfferingId,
                        installedRefillProductId,
                      }
                    : {}),
                  ...(item.productTypeSlug === "spinner"
                    ? { installedButton }
                    : {}),
                  ...(item.productTypeSlug === "slider"
                    ? {
                        installedInsert,
                        installedPlate,
                        ...(magnetConfigurationDirty
                          ? { magnetConfiguration }
                          : {}),
                      }
                    : {}),
                  materialAssignmentId: product.configurationSlots.length
                    ? configurationMaterialId
                    : material?.id === -1
                      ? undefined
                      : material?.id,
                  reason,
                  serialNumber,
                },
              });
              if (result.ok) {
                await navigate({
                  params: { collectionId },
                  to: "/user/collections/$collectionId",
                });
              } else {
                setFormError(result.formError);
                setFormErrorDetail(
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
                    : null,
                );
              }
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
            {image.deletedAt ? <RotateCcw /> : <Trash2 />}
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
