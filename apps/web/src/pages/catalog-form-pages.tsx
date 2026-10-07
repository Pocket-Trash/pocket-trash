import { useAuth } from "@clerk/tanstack-react-start";
import type {
  CatalogBodyHostedMagnetSetup,
  CatalogColor,
  CatalogCompatibilityFamily,
  CatalogFinishOption,
  CatalogImage,
  CatalogLookup,
  CatalogMagnetConfiguration,
  CatalogMaker,
  CatalogProduct,
  CatalogProductType,
  CatalogTerminologyAlias,
  OwnedMagnetConfiguration,
  UserCollectionItem,
  UserCollectionSummary,
} from "@package/services";
import {
  maxImageBytes,
  maxImageSessionBytes,
  maxImageSessionFiles,
} from "@package/services/constants";
import type { TranslationKey } from "@pocket-trash/localizations";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { RotateCcw, Trash2 } from "lucide-react";
import * as React from "react";
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
import { PermanentDeletionControls } from "@/components/permanent-deletion-controls";
import { FileDropInput } from "@/components/resource-file-input";
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
  type CatalogOptions,
  collectionProductTypeIsSupported,
  createCatalogColor,
  createCatalogCompatibilityFamily,
  createCatalogFinish,
  createCatalogMaker,
  createCatalogMaterial,
  createCatalogPattern,
  createCatalogTerminologyAlias,
  deleteCollectionItem,
  deleteUserCollection,
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
          <ProductEditor
            initialProduct={initialProduct}
            key={`${productType}-${initialProduct?.id ?? "new"}`}
            options={initialOptions}
            productTypeSlug={productType}
          />
        ) : productType ? (
          <Notice>{t("web.catalog.notImplemented")}</Notice>
        ) : null}
      </main>
    </AppShell>
  );
}

/** Controlled editor value keeps text inputs as strings before schema parsing. */
type ProductEditorValue = Omit<
  ProductFormValue,
  "bearing" | "description" | "makerProductUrl"
> & {
  /** Bearing text before blank normalization. */
  bearing: string;
  /** Markdown description before blank normalization. */
  description: string;
  /** Maker URL before blank normalization. */
  makerProductUrl: string;
};

/**
 * Renders the product fields shared by add and edit flows.
 *
 * @param props - Product type, catalog options, and optional existing product.
 * @param props.initialProduct - Existing product being edited.
 * @param props.options - Catalog lookup options.
 * @param props.productTypeSlug - Product type being edited.
 * @returns The product editor form.
 */
export function ProductEditor({
  initialProduct,
  options: initialOptions,
  productTypeSlug,
}: {
  /** Existing product being edited. */
  initialProduct?: CatalogProduct;
  /** Catalog lookup options. */
  options: CatalogOptions;
  /** Product type being edited. */
  productTypeSlug: CatalogProductType;
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
  const descriptionRef = React.useRef<MarkdownEditorHandle>(null);
  const [descriptionLoading, setDescriptionLoading] = React.useState(true);
  const defaultValues: ProductEditorValue = {
    advertisedInsertOffers:
      initialProduct?.advertisedInsertOffers.map(
        ({ id, isSliderAdvertisedDefault }) => ({
          isAdvertisedDefault: isSliderAdvertisedDefault,
          offerId: id,
        }),
      ) ?? [],
    bearing: initialProduct?.bearing ?? "",
    bodyHostedMagnetSetup:
      initialProduct?.bodyHostedMagnetSetup ??
      (initialProduct?.magnetSystem === "body-hosted"
        ? { clickCount: null, configuration: null, sourceNote: null }
        : null),
    buttonDiameterMm: initialProduct?.buttonDiameterMm ?? null,
    compatibleButtonId: initialProduct?.compatibleButtonId ?? null,
    compatibilityAdvisories:
      initialProduct?.compatibilityAdvisories.map(
        ({ relatedProductId, text }) => ({ relatedProductId, text }),
      ) ?? [],
    compatibilityFamilyIds:
      initialProduct?.compatibilityFamilies.map(({ id }) => id) ?? [],
    description: initialProduct?.description ?? "",
    diameterMm: initialProduct?.diameterMm ?? null,
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
    includedComponentIds:
      initialProduct?.includedComponents.map(({ id }) => id) ?? [],
    insertHostedMagnetOptions:
      productTypeSlug === "slider-insert"
        ? {
            clickCounts:
              initialProduct?.insertClickOptions.map(
                ({ clickCount }) => clickCount,
              ) ?? [],
            offers:
              initialProduct?.insertMagnetOffers.map((offer) => ({
                clickCount: offer.clickCount,
                configuration: offer.configuration,
                copiedFromTemplateId: offer.copiedFromTemplateId,
                id: offer.id,
                isAdvertisedDefault: offer.isAdvertisedDefault,
              })) ?? [],
          }
        : null,
    lengthMm: initialProduct?.lengthMm ?? null,
    makerId: initialProduct?.makerId ?? 0,
    makerProductUrl: initialProduct?.makerProductUrl ?? "",
    magnetSystem: initialProduct?.magnetSystem ?? null,
    materialIds: initialProduct?.materials.map(({ id }) => id) ?? [],
    name: initialProduct?.name ?? "",
    productId: initialProduct?.id ?? null,
    productTypeSlug,
    spinDiameterMm: initialProduct?.spinDiameterMm ?? null,
    thicknessMm: initialProduct?.thicknessMm ?? null,
    thicknessWithButtonMm: initialProduct?.thicknessWithButtonMm ?? null,
    weightG: initialProduct?.weightG ?? null,
    weightBasis: initialProduct?.weightBasis ?? null,
    widthMm: initialProduct?.widthMm ?? null,
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
        <form.Field name="materialIds">
          {(field) => {
            const selected = options.materials.filter(({ id }) =>
              field.state.value.includes(id),
            );
            return (
              <Field label={t("web.catalog.field.materials")}>
                <CatalogMultiCombobox
                  ariaLabel={t("web.catalog.field.materials")}
                  items={options.materials}
                  onValueChange={(values) =>
                    field.handleChange(values.map(({ id }) => Number(id)))
                  }
                  placeholder={t("web.catalog.selectMaterials")}
                  removeLabel={t("web.action.close")}
                  value={selected}
                />
                <LookupDialog
                  kind="material"
                  onCreated={(material) => {
                    setOptions((current) => ({
                      ...current,
                      materials: [...current.materials, material].sort((a, b) =>
                        a.name.localeCompare(b.name),
                      ),
                    }));
                    field.handleChange([...field.state.value, material.id]);
                  }}
                  t={t}
                />
                <FieldError error={serverErrors.materialIds?.[0]} t={t} />
              </Field>
            );
          }}
        </form.Field>

        <form.Subscribe selector={(state) => state.values.makerId}>
          {(makerId) => (
            <form.Field name="compatibilityFamilyIds">
              {(field) => {
                const families = options.compatibilityFamilies.filter(
                  (family) => family.makerId === makerId,
                );
                const selected = families.filter(({ id }) =>
                  field.state.value.includes(id),
                );
                return (
                  <Field
                    label={t("web.slider.relationship.compatibilityFamilies")}
                  >
                    <CatalogMultiCombobox
                      ariaLabel={t(
                        "web.slider.relationship.compatibilityFamilies",
                      )}
                      items={families}
                      onValueChange={(values) =>
                        field.handleChange(values.map(({ id }) => Number(id)))
                      }
                      placeholder={t(
                        "web.slider.relationship.compatibilityFamilies",
                      )}
                      removeLabel={t("web.action.close")}
                      value={selected}
                    />
                    {makerId > 0 ? (
                      <LookupDialog
                        kind="compatibilityFamily"
                        makerId={makerId}
                        onCreated={(family) => {
                          setOptions((current) => ({
                            ...current,
                            compatibilityFamilies: [
                              ...current.compatibilityFamilies,
                              family,
                            ].sort((a, b) => a.name.localeCompare(b.name)),
                          }));
                          field.handleChange([...field.state.value, family.id]);
                        }}
                        t={t}
                      />
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {t("web.slider.relationship.compatibilityHelp")}
                    </p>
                    <FieldError
                      error={serverErrors.compatibilityFamilyIds?.[0]}
                      t={t}
                    />
                  </Field>
                );
              }}
            </form.Field>
          )}
        </form.Subscribe>

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

        {(productTypeSlug === "spinner"
          ? ([
              "weightG",
              "lengthMm",
              "widthMm",
              "thicknessMm",
              "thicknessWithButtonMm",
              "buttonDiameterMm",
              "spinDiameterMm",
            ] as const)
          : productTypeSlug === "spinner-button"
            ? (["weightG", "diameterMm", "thicknessMm"] as const)
            : (["weightG", "lengthMm", "widthMm", "thicknessMm"] as const)
        ).map((name) => {
          const labels = {
            buttonDiameterMm: "web.catalog.field.buttonDiameter",
            diameterMm: "web.archive.spec.diameter",
            lengthMm: "web.archive.spec.length",
            spinDiameterMm: "web.catalog.field.spinDiameter",
            thicknessMm: "web.catalog.field.thickness",
            thicknessWithButtonMm: "web.catalog.field.thicknessWithButton",
            weightG: "web.archive.spec.weight",
            widthMm: "web.catalog.field.width",
          } as const;
          return (
            <form.Field key={name} name={name}>
              {(field) => (
                <Field label={t(labels[name])}>
                  <Input
                    aria-label={t(labels[name])}
                    min="0"
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.target.value || null);
                      if (name === "buttonDiameterMm") {
                        form.setFieldValue("compatibleButtonId", null);
                      }
                    }}
                    step="any"
                    type="number"
                    value={field.state.value ?? ""}
                  />
                  <FieldError error={serverErrors[name]?.[0]} t={t} />
                </Field>
              )}
            </form.Field>
          );
        })}
        {productTypeSlug === "slider" ? (
          <form.Field name="magnetSystem">
            {(field) => {
              const items = [
                {
                  id: "body-hosted",
                  name: t("web.slider.capability.bodyHosted"),
                },
                {
                  id: "insert-driven",
                  name: t("web.slider.capability.insertDriven"),
                },
              ];
              return (
                <Field label={t("web.slider.capability.label")}>
                  <CatalogCombobox
                    ariaLabel={t("web.slider.capability.label")}
                    items={items}
                    onValueChange={(value) =>
                      (() => {
                        const magnetSystem =
                          value?.id === "body-hosted" ||
                          value?.id === "insert-driven"
                            ? value.id
                            : null;
                        field.handleChange(magnetSystem);
                        form.setFieldValue(
                          "bodyHostedMagnetSetup",
                          magnetSystem === "body-hosted"
                            ? (form.state.values.bodyHostedMagnetSetup ?? {
                                clickCount: null,
                                configuration: null,
                                sourceNote: null,
                              })
                            : null,
                        );
                      })()
                    }
                    placeholder={t("web.slider.capability.label")}
                    value={
                      items.find(({ id }) => id === field.state.value) ?? null
                    }
                  />
                  <FieldError error={serverErrors.magnetSystem?.[0]} t={t} />
                </Field>
              );
            }}
          </form.Field>
        ) : null}
        {productTypeSlug === "slider" ? (
          <form.Field name="weightBasis">
            {(field) => {
              const items = [
                {
                  id: "body-only",
                  name: t("web.slider.measurement.bodyOnly"),
                },
                {
                  id: "complete-build",
                  name: t("web.slider.measurement.completeBuild"),
                },
              ];
              return (
                <Field label={t("web.slider.measurement.weightBasis")}>
                  <CatalogCombobox
                    ariaLabel={t("web.slider.measurement.weightBasis")}
                    items={items}
                    onValueChange={(value) =>
                      field.handleChange(
                        value?.id === "body-only" ||
                          value?.id === "complete-build"
                          ? value.id
                          : null,
                      )
                    }
                    placeholder={t("web.slider.measurement.weightBasis")}
                    removeLabel={t("web.action.close")}
                    value={
                      items.find(({ id }) => id === field.state.value) ?? null
                    }
                  />
                  <FieldError error={serverErrors.weightBasis?.[0]} t={t} />
                </Field>
              );
            }}
          </form.Field>
        ) : null}
        {productTypeSlug === "slider" ? (
          <form.Subscribe selector={(state) => state.values.magnetSystem}>
            {(magnetSystem) =>
              magnetSystem === "body-hosted" ? (
                <form.Field name="bodyHostedMagnetSetup">
                  {(field) =>
                    field.state.value ? (
                      <BodyHostedMagnetSetupEditor
                        onChange={(setup) =>
                          field.handleChange(
                            setup as CatalogBodyHostedMagnetSetup,
                          )
                        }
                        t={t}
                        value={field.state.value}
                      />
                    ) : null
                  }
                </form.Field>
              ) : null
            }
          </form.Subscribe>
        ) : null}
        {productTypeSlug === "slider-insert" ? (
          <form.Field name="insertHostedMagnetOptions">
            {(field) =>
              field.state.value ? (
                <InsertHostedMagnetOptionsEditor
                  onChange={field.handleChange}
                  t={t}
                  templates={options.magnetConfigurationTemplates ?? []}
                  value={field.state.value}
                />
              ) : null
            }
          </form.Field>
        ) : null}
        {productTypeSlug === "slider" ? (
          <form.Subscribe selector={(state) => state.values.magnetSystem}>
            {(magnetSystem) =>
              magnetSystem === "insert-driven" ? (
                <form.Field name="advertisedInsertOffers">
                  {(field) => (
                    <SliderInsertOfferEditor
                      onChange={field.handleChange}
                      offers={options.relationshipProducts.flatMap((product) =>
                        product.productTypeSlug === "slider-insert"
                          ? product.insertMagnetOffers.map((offer) => ({
                              ...offer,
                              insertProductName: product.name,
                            }))
                          : [],
                      )}
                      t={t}
                      value={field.state.value}
                    />
                  )}
                </form.Field>
              ) : null
            }
          </form.Subscribe>
        ) : null}
        {productTypeSlug === "slider-plate" ||
        productTypeSlug === "slider-insert" ? (
          <p className="text-xs text-muted-foreground">
            {t("web.slider.measurement.setLevelHelp")}
          </p>
        ) : null}
        {productTypeSlug === "slider" ? (
          <form.Field name="includedComponentIds">
            {(field) => {
              const items = options.relationshipProducts.filter(
                (candidate) =>
                  candidate.id !== initialProduct?.id &&
                  (candidate.productTypeSlug === "slider-plate" ||
                    candidate.productTypeSlug === "slider-insert"),
              );
              const selected = items.filter(({ id }) =>
                field.state.value.includes(id),
              );
              return (
                <Field label={t("web.slider.relationship.includedComponents")}>
                  <CatalogMultiCombobox
                    ariaLabel={t("web.slider.relationship.includedComponents")}
                    items={items}
                    onValueChange={(values) =>
                      field.handleChange(values.map(({ id }) => Number(id)))
                    }
                    placeholder={t(
                      "web.slider.relationship.includedComponents",
                    )}
                    removeLabel={t("web.action.close")}
                    value={selected}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("web.slider.relationship.includedHelp")}
                  </p>
                  <FieldError
                    error={serverErrors.includedComponentIds?.[0]}
                    t={t}
                  />
                </Field>
              );
            }}
          </form.Field>
        ) : null}
        <form.Field mode="array" name="compatibilityAdvisories">
          {(field) => (
            <fieldset className="grid gap-3 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-medium">
                {t("web.slider.relationship.reviewedAdvisory")}
              </legend>
              {field.state.value.map((advisory, index) => {
                const selected =
                  options.relationshipProducts.find(
                    ({ id }) => id === advisory.relatedProductId,
                  ) ?? null;
                return (
                  <section
                    className="grid gap-3 rounded-lg border border-border bg-background p-3"
                    key={`${advisory.relatedProductId}-${index}`}
                  >
                    <CatalogCombobox
                      ariaLabel={t("web.slider.relationship.reviewedAdvisory")}
                      items={options.relationshipProducts.filter(
                        ({ id }) => id !== initialProduct?.id,
                      )}
                      onValueChange={(value) =>
                        field.handleChange(
                          field.state.value.map((current, position) =>
                            position === index
                              ? {
                                  ...current,
                                  relatedProductId: Number(value?.id ?? 0),
                                }
                              : current,
                          ),
                        )
                      }
                      placeholder={t(
                        "web.slider.relationship.reviewedAdvisory",
                      )}
                      value={selected}
                    />
                    <textarea
                      aria-label={t("web.slider.relationship.reviewedAdvisory")}
                      className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      maxLength={1000}
                      onChange={(event) =>
                        field.handleChange(
                          field.state.value.map((current, position) =>
                            position === index
                              ? { ...current, text: event.target.value }
                              : current,
                          ),
                        )
                      }
                      value={advisory.text}
                    />
                    <Button
                      className="w-fit"
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
                      {t("web.action.removeCompatibilityAdvisory")}
                    </Button>
                  </section>
                );
              })}
              <Button
                className="w-fit"
                onClick={() =>
                  field.handleChange([
                    ...field.state.value,
                    { relatedProductId: 0, text: "" },
                  ])
                }
                type="button"
                variant="outline"
              >
                {t("web.action.addCompatibilityAdvisory")}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("web.slider.relationship.advisoryHelp")}
              </p>
              <FieldError
                error={serverErrors.compatibilityAdvisories?.[0]}
                t={t}
              />
            </fieldset>
          )}
        </form.Field>
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
          <form.Subscribe selector={(state) => state.values.buttonDiameterMm}>
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
        {!initialProduct ? (
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
    </form>
  );
}

/** Insert-hosted authoring form value. */
type InsertHostedMagnetOptionsValue = NonNullable<
  ProductFormValue["insertHostedMagnetOptions"]
>;

/** Slider offer-association form value. */
type SliderInsertOfferValue = ProductFormValue["advertisedInsertOffers"];

/**
 * Edits insertion-ordered click counts and exact offers for one insert product.
 *
 * @param props - Current options and replacement callback.
 * @returns Insert option and offer authoring controls.
 */
function InsertHostedMagnetOptionsEditor({
  onChange,
  t,
  templates,
  value,
}: {
  /**
   * Replaces all insert-hosted options.
   *
   * @param value - Next insert-hosted options.
   */
  onChange(value: InsertHostedMagnetOptionsValue): void;
  /** Localized catalog message formatter. */
  t: ReturnType<typeof useCatalogCopy>;
  /** Catalog-manager-only reusable authoring templates. */
  templates: Array<{
    /** Complete configuration copied into an offer snapshot. */
    configuration: InsertHostedMagnetOptionsValue["offers"][number]["configuration"];
    /** Template identifier retained as authoring provenance. */
    id: number;
    /** Manager-facing template name. */
    name: string;
  }>;
  /** Current insert-hosted options. */
  value: InsertHostedMagnetOptionsValue;
}) {
  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-medium">
        {t("web.slider.setup.availableOffers")}
      </legend>
      <fieldset className="grid gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">
          {t("web.slider.setup.clickCount")}
        </legend>
        {value.clickCounts.map((clickCount, index) => (
          <div className="flex items-end gap-2" key={`${clickCount}-${index}`}>
            <Field label={t("web.slider.setup.clickCount")}>
              <Input
                aria-label={t("web.slider.setup.clickCount")}
                min="1"
                onChange={(event) =>
                  onChange({
                    ...value,
                    clickCounts: value.clickCounts.map((current, position) =>
                      position === index ? Number(event.target.value) : current,
                    ),
                  })
                }
                step="1"
                type="number"
                value={clickCount || ""}
              />
            </Field>
            <Button
              onClick={() =>
                onChange({
                  clickCounts: value.clickCounts.filter(
                    (_, position) => position !== index,
                  ),
                  offers: value.offers.map((offer) =>
                    offer.clickCount === clickCount
                      ? { ...offer, clickCount: null }
                      : offer,
                  ),
                })
              }
              type="button"
              variant="outline"
            >
              {t("web.action.removeSelection", { name: String(clickCount) })}
            </Button>
          </div>
        ))}
        <Button
          className="w-fit"
          onClick={() =>
            onChange({ ...value, clickCounts: [...value.clickCounts, 0] })
          }
          type="button"
          variant="outline"
        >
          {t("web.action.confirmAdd")} {t("web.slider.setup.clickCount")}
        </Button>
      </fieldset>
      {value.offers.map((offer, index) => (
        <section
          className="grid gap-3 rounded-md border border-border p-3"
          key={offer.id ?? `new-${index}`}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("web.slider.setup.clickCount")}>
              <select
                aria-label={t("web.slider.setup.clickCount")}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) =>
                  onChange({
                    ...value,
                    offers: value.offers.map((current, position) =>
                      position === index
                        ? {
                            ...current,
                            clickCount: event.target.value
                              ? Number(event.target.value)
                              : null,
                          }
                        : current,
                    ),
                  })
                }
                value={offer.clickCount ?? ""}
              >
                <option value="">{t("web.slider.setup.notRecorded")}</option>
                {value.clickCounts
                  .filter((count) => count > 0)
                  .map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                checked={offer.isAdvertisedDefault}
                onChange={(event) =>
                  onChange({
                    ...value,
                    offers: value.offers.map((current, position) => ({
                      ...current,
                      isAdvertisedDefault:
                        position === index ? event.target.checked : false,
                    })),
                  })
                }
                type="checkbox"
              />
              {t("web.slider.setup.advertisedDefault")}
            </label>
          </div>
          {templates.length ? (
            <Field label={t("web.slider.setup.copyAndCustomize")}>
              <select
                aria-label={t("web.slider.setup.copyAndCustomize")}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) => {
                  const template = templates.find(
                    ({ id }) => id === Number(event.target.value),
                  );
                  if (!template) return;
                  onChange({
                    ...value,
                    offers: value.offers.map((current, position) =>
                      position === index
                        ? {
                            ...current,
                            configuration: template.configuration,
                            copiedFromTemplateId: template.id,
                          }
                        : current,
                    ),
                  });
                }}
                value={offer.copiedFromTemplateId ?? ""}
              >
                <option value="">{t("web.slider.setup.selectOffer")}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <BodyHostedMagnetSetupEditor
            legend={t("web.slider.setup.offer")}
            onChange={(setup) => {
              const configuration =
                setup.configuration as CatalogMagnetConfiguration | null;
              if (!configuration) return;
              onChange({
                ...value,
                offers: value.offers.map((current, position) =>
                  position === index ? { ...current, configuration } : current,
                ),
              });
            }}
            showClickCount={false}
            showSourceNote={false}
            t={t}
            value={{
              clickCount: offer.clickCount,
              configuration: offer.configuration as CatalogMagnetConfiguration,
              sourceNote: null,
            }}
          />
          <Button
            className="w-fit"
            onClick={() =>
              onChange({
                ...value,
                offers: value.offers.filter(
                  (_, position) => position !== index,
                ),
              })
            }
            type="button"
            variant="outline"
          >
            {t("web.action.removeSelection", {
              name: offer.configuration.label || t("web.slider.setup.offer"),
            })}
          </Button>
        </section>
      ))}
      <Button
        className="w-fit"
        onClick={() =>
          onChange({
            ...value,
            offers: [
              ...value.offers,
              {
                clickCount: null,
                configuration: {
                  groups: [],
                  label: "",
                  slots: [
                    {
                      documentedColumn: null,
                      documentedRow: null,
                      groupKey: null,
                      half: "half-a",
                      key: "A1",
                      state: "empty",
                    },
                  ],
                  sourceLabel: null,
                  sourceNotes: null,
                },
                copiedFromTemplateId: null,
                id: null,
                isAdvertisedDefault: false,
              },
            ],
          })
        }
        type="button"
        variant="outline"
      >
        {t("web.action.confirmAdd")} {t("web.slider.setup.offer")}
      </Button>
    </fieldset>
  );
}

/**
 * Selects exact insert offers merchandised for one insert-driven slider.
 *
 * @param props - Available offers, selected associations, and replacement callback.
 * @returns Exact-offer selection with one required slider default.
 */
function SliderInsertOfferEditor({
  offers,
  onChange,
  t,
  value,
}: {
  /** Exact offers from visible insert products. */
  offers: Array<{
    /** Exact insert offer identifier. */
    id: number;
    /** Exact host insert product name. */
    insertProductName: string;
    /** Minimal configuration facts used by the selector label. */
    configuration: {
      /** Global configuration vocabulary label. */
      label: string;
    };
  }>;
  /**
   * Replaces the exact associations.
   *
   * @param value - Next slider-to-offer associations.
   */
  onChange(value: SliderInsertOfferValue): void;
  /** Localized catalog message formatter. */
  t: ReturnType<typeof useCatalogCopy>;
  /** Current slider associations. */
  value: SliderInsertOfferValue;
}) {
  return (
    <fieldset className="grid gap-3 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-medium">
        {t("web.slider.setup.availableOffers")}
      </legend>
      {offers.length ? (
        offers.map((offer) => {
          const selected = value.find(({ offerId }) => offerId === offer.id);
          return (
            <div
              className="flex flex-wrap items-center gap-4 rounded-md border border-border p-3"
              key={offer.id}
            >
              <label className="flex flex-1 items-center gap-2 text-sm">
                <input
                  checked={Boolean(selected)}
                  onChange={(event) => {
                    if (event.target.checked) {
                      onChange([
                        ...value,
                        {
                          isAdvertisedDefault: value.length === 0,
                          offerId: offer.id,
                        },
                      ]);
                      return;
                    }
                    const remaining = value.filter(
                      ({ offerId }) => offerId !== offer.id,
                    );
                    onChange(
                      selected?.isAdvertisedDefault && remaining.length
                        ? remaining.map((current, index) => ({
                            ...current,
                            isAdvertisedDefault: index === 0,
                          }))
                        : remaining,
                    );
                  }}
                  type="checkbox"
                />
                {offer.insertProductName} · {offer.configuration.label}
              </label>
              {selected ? (
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    checked={selected.isAdvertisedDefault}
                    name="slider-advertised-default"
                    onChange={() =>
                      onChange(
                        value.map((current) => ({
                          ...current,
                          isAdvertisedDefault: current.offerId === offer.id,
                        })),
                      )
                    }
                    type="radio"
                  />
                  {t("web.slider.setup.advertisedDefault")}
                </label>
              ) : null}
            </div>
          );
        })
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("web.slider.empty.noOffers")}
        </p>
      )}
    </fieldset>
  );
}

/** Setup shape shared by catalog and owner-recorded layout editors. */
type EditableMagnetSetup = Omit<
  CatalogBodyHostedMagnetSetup,
  "configuration"
> & {
  /** Catalog-complete or owner-recorded layout. */
  configuration: OwnedMagnetConfiguration | null;
};

/**
 * Edits one catalog-complete or owner-recorded magnet setup.
 *
 * @param props - Current setup and replacement callback.
 * @returns Structured setup authoring fields.
 */
function BodyHostedMagnetSetupEditor({
  allowUnknown = false,
  legend,
  onChange,
  showClickCount = true,
  showSourceNote = true,
  t,
  value,
}: {
  /** Whether owner-recorded positions may use the unknown state. */
  allowUnknown?: boolean;
  /** Optional fieldset legend override. */
  legend?: string;
  /**
   * Replaces the complete form value.
   *
   * @param value - Next complete body-hosted setup.
   */
  onChange(value: EditableMagnetSetup): void;
  /** Whether to show the body-level click count field. */
  showClickCount?: boolean;
  /** Whether to show the incomplete-layout note field. */
  showSourceNote?: boolean;
  /** Localized catalog message formatter. */
  t: ReturnType<typeof useCatalogCopy>;
  /** Current inherent setup. */
  value: EditableMagnetSetup;
}) {
  const configuration = value.configuration;
  /**
   * Replaces or clears the single structured configuration.
   *
   * @param next - Next complete configuration, or `null` when undocumented.
   * @returns Nothing.
   */
  const replaceConfiguration = (
    next: NonNullable<typeof value.configuration> | null,
  ) => onChange({ ...value, configuration: next });
  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-medium">
        {legend ?? t("web.slider.setup.title")}
      </legend>
      {showClickCount ? (
        <Field label={t("web.slider.setup.clickCount")}>
          <Input
            aria-label={t("web.slider.setup.clickCount")}
            min="1"
            onChange={(event) =>
              onChange({
                ...value,
                clickCount: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
            step="1"
            type="number"
            value={value.clickCount ?? ""}
          />
        </Field>
      ) : null}
      {showSourceNote ? (
        <Field label={t("web.slider.setup.sourceNote")}>
          <textarea
            aria-label={t("web.slider.setup.sourceNote")}
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            maxLength={5000}
            onChange={(event) =>
              onChange({ ...value, sourceNote: event.target.value })
            }
            placeholder={t("web.slider.setup.incompleteSourceNote")}
            value={value.sourceNote ?? ""}
          />
        </Field>
      ) : null}
      {configuration ? (
        <section className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("web.slider.magnet.vocabularyLabel")}>
              <Input
                aria-label={t("web.slider.magnet.vocabularyLabel")}
                maxLength={100}
                onChange={(event) =>
                  replaceConfiguration({
                    ...configuration,
                    label: event.target.value,
                  })
                }
                value={configuration.label}
              />
            </Field>
            <Field label={t("web.slider.setup.default")}>
              <Input
                aria-label={t("web.slider.setup.default")}
                maxLength={200}
                onChange={(event) =>
                  replaceConfiguration({
                    ...configuration,
                    sourceLabel: event.target.value,
                  })
                }
                value={configuration.sourceLabel ?? ""}
              />
            </Field>
          </div>
          <Field label={t("web.slider.setup.sourceNote")}>
            <textarea
              aria-label={t("web.slider.setup.sourceNote")}
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              maxLength={5000}
              onChange={(event) =>
                replaceConfiguration({
                  ...configuration,
                  sourceNotes: event.target.value,
                })
              }
              value={configuration.sourceNotes ?? ""}
            />
          </Field>
          <fieldset className="grid gap-3 rounded-md border border-border p-3">
            <legend className="px-1 text-sm font-medium">
              {t("web.slider.magnet.groups")}
            </legend>
            {configuration.groups.map((group, index) => (
              <section
                className="grid gap-2 rounded-md border border-border bg-background p-3 md:grid-cols-3"
                key={`${group.key}-${index}`}
              >
                <Field label={t("web.slider.magnet.group")}>
                  <Input
                    aria-label={t("web.slider.magnet.group")}
                    onChange={(event) => {
                      const oldKey = group.key;
                      const key = event.target.value;
                      replaceConfiguration({
                        ...configuration,
                        groups: configuration.groups.map((current, position) =>
                          position === index ? { ...current, key } : current,
                        ),
                        slots: configuration.slots.map((slot) =>
                          slot.groupKey === oldKey
                            ? { ...slot, groupKey: key }
                            : slot,
                        ),
                      });
                    }}
                    placeholder="group-key"
                    value={group.key}
                  />
                  <Input
                    aria-label={t("web.slider.magnet.vocabularyLabel")}
                    onChange={(event) =>
                      replaceConfiguration({
                        ...configuration,
                        groups: configuration.groups.map((current, position) =>
                          position === index
                            ? { ...current, label: event.target.value }
                            : current,
                        ),
                      })
                    }
                    placeholder={t("web.slider.magnet.vocabularyLabel")}
                    value={group.label}
                  />
                </Field>
                <Field label={t("web.slider.magnet.size")}>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      aria-label={t("web.archive.spec.diameter")}
                      min="0"
                      onChange={(event) =>
                        replaceConfiguration({
                          ...configuration,
                          groups: configuration.groups.map(
                            (current, position) =>
                              position === index
                                ? {
                                    ...current,
                                    diameterMm: event.target.value,
                                  }
                                : current,
                          ),
                        })
                      }
                      placeholder={t("web.archive.spec.diameter")}
                      step="any"
                      type="number"
                      value={group.diameterMm ?? ""}
                    />
                    <Input
                      aria-label={t("web.catalog.field.thickness")}
                      min="0"
                      onChange={(event) =>
                        replaceConfiguration({
                          ...configuration,
                          groups: configuration.groups.map(
                            (current, position) =>
                              position === index
                                ? {
                                    ...current,
                                    thicknessMm: event.target.value,
                                  }
                                : current,
                          ),
                        })
                      }
                      placeholder={t("web.catalog.field.thickness")}
                      step="any"
                      type="number"
                      value={group.thicknessMm ?? ""}
                    />
                  </div>
                </Field>
                <Field label={t("web.slider.magnet.grade")}>
                  <Input
                    aria-label={t("web.slider.magnet.grade")}
                    maxLength={20}
                    onChange={(event) =>
                      replaceConfiguration({
                        ...configuration,
                        groups: configuration.groups.map((current, position) =>
                          position === index
                            ? { ...current, grade: event.target.value }
                            : current,
                        ),
                      })
                    }
                    value={group.grade}
                  />
                  <Button
                    onClick={() => {
                      const groups = configuration.groups.filter(
                        (_, position) => position !== index,
                      );
                      replaceConfiguration({
                        ...configuration,
                        groups,
                        slots: configuration.slots.map((slot) =>
                          slot.groupKey === group.key
                            ? { ...slot, groupKey: null, state: "empty" }
                            : slot,
                        ),
                      });
                    }}
                    type="button"
                    variant="outline"
                  >
                    {t("web.action.removeSelection", {
                      name: group.label || group.key,
                    })}
                  </Button>
                </Field>
              </section>
            ))}
            <Button
              className="w-fit"
              onClick={() => {
                const key = `group-${configuration.groups.length + 1}`;
                replaceConfiguration({
                  ...configuration,
                  groups: [
                    ...configuration.groups,
                    {
                      diameterMm: "",
                      grade: "",
                      key,
                      label: "",
                      thicknessMm: "",
                    },
                  ],
                });
              }}
              type="button"
              variant="outline"
            >
              {t("web.action.confirmAdd")} {t("web.slider.magnet.group")}
            </Button>
          </fieldset>
          <fieldset className="grid gap-3 rounded-md border border-border p-3">
            <legend className="px-1 text-sm font-medium">
              {t("web.slider.magnet.slots")}
            </legend>
            {configuration.slots.map((slot, index) => (
              <section
                className="grid gap-2 rounded-md border border-border bg-background p-3 md:grid-cols-4"
                key={`${slot.half}-${slot.key}-${index}`}
              >
                <Field label={t("web.slider.magnet.slot")}>
                  <Input
                    aria-label={t("web.slider.magnet.slot")}
                    onChange={(event) =>
                      replaceConfiguration({
                        ...configuration,
                        slots: configuration.slots.map((current, position) =>
                          position === index
                            ? { ...current, key: event.target.value }
                            : current,
                        ),
                      })
                    }
                    value={slot.key}
                  />
                </Field>
                <Field label={t("web.slider.magnet.halfA")}>
                  <select
                    aria-label={t("web.slider.magnet.halfA")}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    onChange={(event) =>
                      replaceConfiguration({
                        ...configuration,
                        slots: configuration.slots.map((current, position) =>
                          position === index
                            ? {
                                ...current,
                                half: event.target.value as "half-a" | "half-b",
                              }
                            : current,
                        ),
                      })
                    }
                    value={slot.half}
                  >
                    <option value="half-a">
                      {t("web.slider.magnet.halfA")}
                    </option>
                    <option value="half-b">
                      {t("web.slider.magnet.halfB")}
                    </option>
                  </select>
                </Field>
                <Field label={t(`web.slider.magnet.state.${slot.state}`)}>
                  <select
                    aria-label={t(`web.slider.magnet.state.${slot.state}`)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    onChange={(event) => {
                      const state = event.target.value as
                        | "occupied"
                        | "empty"
                        | "unknown";
                      replaceConfiguration({
                        ...configuration,
                        slots: configuration.slots.map((current, position) =>
                          position === index
                            ? {
                                ...current,
                                groupKey:
                                  state === "occupied"
                                    ? current.groupKey
                                    : null,
                                state,
                              }
                            : current,
                        ),
                      });
                    }}
                    value={slot.state}
                  >
                    <option value="occupied">
                      {t("web.slider.magnet.state.occupied")}
                    </option>
                    <option value="empty">
                      {t("web.slider.magnet.state.empty")}
                    </option>
                    {allowUnknown ? (
                      <option value="unknown">
                        {t("web.slider.magnet.state.unknown")}
                      </option>
                    ) : null}
                  </select>
                </Field>
                <Field label={t("web.slider.magnet.group")}>
                  <select
                    aria-label={t("web.slider.magnet.group")}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    disabled={slot.state !== "occupied"}
                    onChange={(event) =>
                      replaceConfiguration({
                        ...configuration,
                        slots: configuration.slots.map((current, position) =>
                          position === index
                            ? {
                                ...current,
                                groupKey: event.target.value || null,
                              }
                            : current,
                        ),
                      })
                    }
                    value={slot.groupKey ?? ""}
                  >
                    <option value="">
                      {t("web.slider.setup.notRecorded")}
                    </option>
                    {configuration.groups.map((group) => (
                      <option key={group.key} value={group.key}>
                        {group.label || group.key}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("web.slider.magnet.row")}>
                  <Input
                    aria-label={t("web.slider.magnet.row")}
                    min="1"
                    onChange={(event) =>
                      replaceConfiguration({
                        ...configuration,
                        slots: configuration.slots.map((current, position) =>
                          position === index
                            ? {
                                ...current,
                                documentedRow: event.target.value
                                  ? Number(event.target.value)
                                  : null,
                              }
                            : current,
                        ),
                      })
                    }
                    step="1"
                    type="number"
                    value={slot.documentedRow ?? ""}
                  />
                </Field>
                <Field label={t("web.slider.magnet.column")}>
                  <Input
                    aria-label={t("web.slider.magnet.column")}
                    min="1"
                    onChange={(event) =>
                      replaceConfiguration({
                        ...configuration,
                        slots: configuration.slots.map((current, position) =>
                          position === index
                            ? {
                                ...current,
                                documentedColumn: event.target.value
                                  ? Number(event.target.value)
                                  : null,
                              }
                            : current,
                        ),
                      })
                    }
                    step="1"
                    type="number"
                    value={slot.documentedColumn ?? ""}
                  />
                </Field>
                <Button
                  className="w-fit self-end"
                  onClick={() =>
                    replaceConfiguration({
                      ...configuration,
                      slots: configuration.slots.filter(
                        (_, position) => position !== index,
                      ),
                    })
                  }
                  type="button"
                  variant="outline"
                >
                  {t("web.action.removeSelection", { name: slot.key })}
                </Button>
              </section>
            ))}
            <Button
              className="w-fit"
              onClick={() =>
                replaceConfiguration({
                  ...configuration,
                  slots: [
                    ...configuration.slots,
                    {
                      documentedColumn: null,
                      documentedRow: null,
                      groupKey: null,
                      half: "half-a",
                      key: `A${configuration.slots.length + 1}`,
                      state: "empty",
                    },
                  ],
                })
              }
              type="button"
              variant="outline"
            >
              {t("web.action.confirmAdd")} {t("web.slider.magnet.slot")}
            </Button>
          </fieldset>
          <Button
            className="w-fit"
            onClick={() => replaceConfiguration(null)}
            type="button"
            variant="outline"
          >
            {t("web.action.removeSelection", {
              name: t("web.slider.magnet.configuration"),
            })}
          </Button>
        </section>
      ) : (
        <Button
          className="w-fit"
          onClick={() =>
            replaceConfiguration({
              groups: [],
              label: "",
              slots: [],
              sourceLabel: null,
              sourceNotes: null,
            })
          }
          type="button"
          variant="outline"
        >
          {t("web.action.confirmAdd")} {t("web.slider.magnet.configuration")}
        </Button>
      )}
    </fieldset>
  );
}

/**
 * Edits the durable setup snapshot for one owned slider insert.
 *
 * @param props - Exact insert product, setup draft, copy, and replacement callback.
 * @returns Default, copied-offer, and custom setup controls.
 */
function OwnedInsertSetupEditor({
  onChange,
  product,
  t,
  value,
}: {
  /**
   * Replaces the snapshot draft, or clears it for live catalog defaults.
   *
   * @param value - Next owner setup draft, or `null` for live defaults.
   * @param layoutChanged - Whether a layout edit must clear the click link.
   * @returns Nothing.
   */
  onChange(value: OwnedInsertSetupDraft | null, layoutChanged?: boolean): void;
  /** Exact insert product owning every selectable option. */
  product: CatalogProduct;
  /** Localized catalog message formatter. */
  t: ReturnType<typeof useCatalogCopy>;
  /** Current durable snapshot draft, or `null` for live defaults. */
  value: OwnedInsertSetupDraft | null;
}) {
  const clickOptions = [...product.insertClickOptions].sort(
    (left, right) => left.insertionPosition - right.insertionPosition,
  );
  const earliestClickOption = clickOptions[0] ?? null;
  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-medium">
        {t("web.slider.setup.title")}
      </legend>
      <label className="grid gap-1 rounded-md border border-border p-3 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <input
            checked={value === null}
            name="owned-insert-setup-mode"
            onChange={() => onChange(null)}
            type="radio"
          />
          {t("web.slider.setup.default")}
        </span>
        <span className="text-muted-foreground">
          {t("web.slider.setup.defaultDescription")}
        </span>
      </label>
      {product.insertMagnetOffers.length ? (
        <Field label={t("web.slider.setup.selectOffer")}>
          <select
            aria-label={t("web.slider.setup.selectOffer")}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) => {
              const offer = product.insertMagnetOffers.find(
                ({ id }) => id === Number(event.target.value),
              );
              if (!offer) return;
              onChange({
                clickOptionId:
                  offer.clickOptionId ?? earliestClickOption?.id ?? null,
                configuration: offer.configuration,
                sourceOfferId: offer.id,
              });
            }}
            value={value?.sourceOfferId ?? ""}
          >
            <option value="">{t("web.slider.setup.selectOffer")}</option>
            {product.insertMagnetOffers.map((offer) => (
              <option key={offer.id} value={offer.id}>
                {offer.configuration.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Button
        className="w-fit"
        onClick={() =>
          onChange({
            clickOptionId: earliestClickOption?.id ?? null,
            configuration: {
              groups: [],
              label: "",
              slots: [
                {
                  documentedColumn: null,
                  documentedRow: null,
                  groupKey: null,
                  half: "half-a",
                  key: "A1",
                  state: "unknown",
                },
              ],
              sourceLabel: null,
              sourceNotes: null,
            },
            sourceOfferId: null,
          })
        }
        type="button"
        variant="outline"
      >
        {t("web.slider.setup.fromScratch")}
      </Button>
      {value ? (
        <>
          <Field label={t("web.slider.setup.clickCount")}>
            <select
              aria-label={t("web.slider.setup.clickCount")}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              onChange={(event) =>
                onChange({
                  ...value,
                  clickOptionId: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              value={value.clickOptionId ?? ""}
            >
              <option value="">{t("web.slider.setup.notRecorded")}</option>
              {clickOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.clickCount}
                </option>
              ))}
            </select>
          </Field>
          <BodyHostedMagnetSetupEditor
            allowUnknown
            legend={t("web.slider.setup.custom")}
            onChange={(setup) =>
              onChange(
                ownedInsertSetupAfterLayoutChange(value, setup.configuration),
                true,
              )
            }
            showClickCount={false}
            showSourceNote={false}
            t={t}
            value={{
              clickCount: null,
              configuration: value.configuration,
              sourceNote: null,
            }}
          />
        </>
      ) : null}
    </fieldset>
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
      /** Lookup kind created by this dialog. */
      kind: "compatibilityFamily";
      /** Maker that defines the compatibility family. */
      makerId: number;
      /**
       * Receives a newly created compatibility family.
       *
       * @param value - Created compatibility-family value.
       */
      onCreated: (value: CatalogCompatibilityFamily) => void;
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
    compatibilityFamily: "web.action.addCompatibilityFamily",
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
    } else if (props.kind === "compatibilityFamily") {
      const result = await createCatalogCompatibilityFamily({
        data: { makerId: props.makerId, name },
      });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setError(result.formError);
        return;
      }
      props.onCreated(result.compatibilityFamily);
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
      !material ||
      (finish?.id === "custom" && !customFinishIsValid) ||
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
        buttonMaterialId: selectedButton ? (buttonMaterial?.id ?? null) : null,
        buttonProductId: selectedButton?.id ?? null,
        collectionId: selectedCollectionId === -1 ? null : selectedCollectionId,
        confirmed,
        customFinish: finish?.id === "custom" ? customFinish : null,
        displayName,
        description: currentDescription,
        finishOptionId:
          finish?.id === "custom" ? null : finish ? Number(finish.id) : null,
        materialId: material.id,
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
            {slug && !productTypeIsSupported(slug) ? (
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
        {product ? (
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
        {product?.productTypeSlug === "slider" &&
        product.includedComponents.length ? (
          <Notice>
            <p>{t("web.slider.relationship.inclusionHelp")}</p>
            <ul className="mt-2 grid list-disc gap-1 pl-5">
              {product.includedComponents.map((component) => (
                <li key={component.id}>{component.name}</li>
              ))}
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
              !material ||
                descriptionLoading ||
                description.length > 5000 ||
                !displayName.trim() ||
                !finish ||
                (finish.id === "custom" && !customFinishIsValid) ||
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
          items={product.materials}
          onValueChange={(value) =>
            onMaterialChange(
              product.materials.find(({ id }) => id === value?.id) ?? null,
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

/** Editable owned-insert setup sent to the collection service. */
type OwnedInsertSetupDraft = {
  /** Current exact-product click option selected by the owner. */
  clickOptionId: number | null;
  /** Owner-recorded layout snapshot. */
  configuration: OwnedMagnetConfiguration | null;
  /** Current exact-product offer copied as the authoring source. */
  sourceOfferId: number | null;
};

/**
 * Applies an owned layout edit and clears the linked click selection.
 *
 * @param current - Existing setup draft.
 * @param configuration - Replacement owner-recorded layout.
 * @returns Updated setup draft with no selected click option.
 */
export function ownedInsertSetupAfterLayoutChange(
  current: OwnedInsertSetupDraft,
  configuration: OwnedMagnetConfiguration | null,
): OwnedInsertSetupDraft {
  return { ...current, clickOptionId: null, configuration };
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
  collections,
  item,
  options: initialOptions,
  ownedButtons,
  ownedSliderComponents = [],
  product,
}: {
  /** Connected assembly members moved with this item. */
  assemblyMoveItemCount?: number;
  /** Catalog products for owned spinner buttons. */
  buttonProducts: CatalogProduct[];
  /** Collections available as destinations. */
  collections: UserCollectionSummary[];
  /** Collection item being edited. */
  item: UserCollectionItem;
  /** Catalog lookup options. */
  options: CatalogOptions;
  /** Owned spinner buttons available to install. */
  ownedButtons: UserCollectionItem[];
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
  const [options, setOptions] = React.useState(initialOptions);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formErrorDetail, setFormErrorDetail] = React.useState<{
    /** Secondary localized error key. */
    key: string;
    /** Interpolation values for the secondary error. */
    values?: Readonly<Record<string, unknown>>;
  } | null>(null);
  const [material, setMaterial] = React.useState<CatalogLookup | null>(
    item.material,
  );
  const [finish, setFinish] = React.useState<ComboboxOption | null>(() =>
    item.finishOption
      ? { id: "current", name: localizedFinishLabel(item.finishOption, t) }
      : null,
  );
  const [customFinish, setCustomFinish] = React.useState(emptyFinishOption);
  const [insertSetup, setInsertSetup] =
    React.useState<OwnedInsertSetupDraft | null>(() => {
      if (!item.ownedInsertSetup) return null;
      return {
        clickOptionId:
          product.insertClickOptions.find(
            ({ clickCount }) =>
              clickCount === item.ownedInsertSetup?.clickCount,
          )?.id ?? null,
        configuration: item.ownedInsertSetup.configuration,
        sourceOfferId: product.insertMagnetOffers.some(
          ({ id }) => id === item.ownedInsertSetup?.sourceOfferId,
        )
          ? item.ownedInsertSetup.sourceOfferId
          : null,
      };
    });
  const [insertSetupDirty, setInsertSetupDirty] = React.useState(false);
  const [insertSetupClickCleared, setInsertSetupClickCleared] =
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
    React.useState<CatalogLookup | null>(initialButton?.material ?? null);
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
  const sliderComponentSelectionIsValid =
    item.productTypeSlug !== "slider" ||
    ((plate?.id === "default" || Boolean(selectedPlate)) &&
      (product.magnetSystem !== "insert-driven" ||
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
  const detailsAreValid = Boolean(
    displayName.trim() &&
      description.length <= 5000 &&
      material &&
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
          {item.productTypeSlug === "slider-insert" ? (
            <>
              <OwnedInsertSetupEditor
                onChange={(next, layoutChanged = false) => {
                  if (layoutChanged && insertSetup?.clickOptionId !== null) {
                    setInsertSetupClickCleared(true);
                  } else if (!layoutChanged) {
                    setInsertSetupClickCleared(false);
                  }
                  setInsertSetup(next);
                  setInsertSetupDirty(true);
                }}
                product={product}
                t={t}
                value={insertSetup}
              />
              {insertSetupClickCleared ? (
                <Notice>{t("web.slider.setup.clickCountCleared")}</Notice>
              ) : null}
            </>
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
                  setButtonMaterial(selected?.material ?? null);
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
              {product.magnetSystem === "insert-driven" ? (
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
                    onValueChange={setInsert}
                    placeholder={t("web.slider.component.noInsert")}
                    removeLabel={t("web.action.close")}
                    showSelectedPill
                    value={insert}
                  />
                </Field>
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
                  {product.magnetSystem === "insert-driven" ? (
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
              if (!material || !finish) return;
              let installedButton:
                | {
                    /** Installed collection item identifier. */
                    collectionItemId: number;
                    /** Custom finish applied to the installed button. */
                    customFinish: FinishOptionFormValue | null;
                    /** Catalog finish option applied to the installed button. */
                    finishOptionId: number | null;
                    /** Material applied to the installed button. */
                    materialId: number;
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
                    materialId: buttonMaterial.id,
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
                item.productTypeSlug === "slider" &&
                product.magnetSystem === "insert-driven"
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
                  customFinish: finish.id === "custom" ? customFinish : null,
                  displayName,
                  description: currentDescription,
                  finishOptionId:
                    finish.id === "current" || finish.id === "custom"
                      ? null
                      : Number(finish.id),
                  ...(item.productTypeSlug === "spinner"
                    ? { installedButton }
                    : {}),
                  ...(item.productTypeSlug === "slider"
                    ? { installedInsert, installedPlate }
                    : {}),
                  ...(item.productTypeSlug === "slider-insert" &&
                  insertSetupDirty
                    ? { insertSetup }
                    : {}),
                  materialId: material.id,
                  reason,
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
