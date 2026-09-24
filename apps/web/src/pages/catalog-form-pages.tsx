import { useAuth } from "@clerk/tanstack-react-start";
import type {
  CatalogColor,
  CatalogFinishOption,
  CatalogImage,
  CatalogLookup,
  CatalogProduct,
  CatalogProductType,
  UserCollectionItem,
  UserCollectionSummary,
} from "@package/services";
import type { TranslationKey } from "@pocket-trash/localizations";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { RotateCcw, Trash2 } from "lucide-react";
import * as React from "react";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import {
  CollectionCoverManager,
  CollectionForm,
  type CollectionFormValue,
} from "@/components/collection-form";
import { CollectionSelector } from "@/components/collection-selector";
import { FileDropInput } from "@/components/resource-file-input";
import { Button } from "@/components/ui/button";
import {
  CatalogCombobox,
  CatalogMultiCombobox,
  type ComboboxOption,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { filterButtonsByDiameter, finishOptionLabel } from "@/lib/catalog";
import {
  addCollectionProduct,
  type CatalogOptions,
  createCatalogColor,
  createCatalogFinish,
  createCatalogMaker,
  createCatalogMaterial,
  finishOptionSchema,
  type ProductFormInput,
  productFormSchema,
  productSlugPreview,
  productTypeIsSupported,
  restoreCatalogImage,
  saveCatalogProduct,
  saveCollection,
  selectCollectionCover,
  softDeleteCatalogImage,
  updateCollectionItem,
} from "@/lib/catalog-api";
import { useCatalogCopy } from "@/lib/catalog-copy";
import { getImageUploadGuidance } from "@/lib/help-content";
import {
  deleteCollectionCover,
  type ImageUploadError,
  uploadImages,
  validateImages,
} from "@/lib/upload-sessions";
import { useLocale } from "@/providers/locale-provider";

export function ProductFormPage({
  initialProduct,
  options: initialOptions,
}: {
  initialProduct?: CatalogProduct;
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
      <main className="grid max-w-3xl gap-6 p-6">
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

function ProductEditor({
  initialProduct,
  options: initialOptions,
  productTypeSlug,
}: {
  initialProduct?: CatalogProduct;
  options: CatalogOptions;
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
  const form = useForm({
    defaultValues: {
      buttonDiameterMm: initialProduct?.buttonDiameterMm ?? null,
      compatibleButtonId: initialProduct?.compatibleButtonId ?? null,
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
          }))
        : [
            {
              colorEffectId: null,
              colorEffectSlug: null,
              colorIds: [],
              finishIds: [],
            },
          ],
      lengthMm: initialProduct?.lengthMm ?? null,
      makerId: initialProduct?.makerId ?? 0,
      materialIds: initialProduct?.materials.map(({ id }) => id) ?? [],
      name: initialProduct?.name ?? "",
      productId: initialProduct?.id ?? null,
      productTypeSlug,
      thicknessMm: initialProduct?.thicknessMm ?? null,
      thicknessWithButtonMm: initialProduct?.thicknessWithButtonMm ?? null,
      weightG: initialProduct?.weightG ?? null,
      widthMm: initialProduct?.widthMm ?? null,
    },
    onSubmit: async ({ value }) => {
      const clientResult = productFormSchema.safeParse(value);
      if (!clientResult.success) {
        setServerErrors(z.flattenError(clientResult.error).fieldErrors);
        setFormError("web.catalog.error.form");
        return;
      }
      const imageError = validateImages(images);
      if (imageError) {
        setFormError(imageError.key);
        return;
      }
      const result = await saveCatalogProduct({
        data: { ...value, productId: savedProductId ?? value.productId },
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
            files: images,
            getToken,
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
                data: { imageId, targetType: "product" },
              });
              return true;
            },
            targetId: result.product.id,
            targetType: "product",
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
      className="grid gap-5 rounded-xl border border-border bg-card p-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
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
          ] as const)
        : (["weightG", "diameterMm", "thicknessMm"] as const)
      ).map((name) => {
        const labels = {
          buttonDiameterMm: "web.catalog.field.buttonDiameter",
          diameterMm: "web.archive.spec.diameter",
          lengthMm: "web.archive.spec.length",
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

      {formError ? <Notice>{t(formError)}</Notice> : null}
      <FileDropInput
        accept=".jpeg,.jpg,.png,.webp"
        aspectRatio={4 / 3}
        aspectRatioHelpHref="/help/image-size-and-resolution-guide"
        aspectRatioHelpLabel={imageGuidance.helpLabel}
        aspectRatioWarning={imageGuidance.warning}
        browseLabel={t("web.resources.upload.browseFiles")}
        description={t("web.resources.upload.imagesHelp", {
          maxFileSize: "25 MiB",
          maxImages: 20,
          maxSessionSize: "200 MiB",
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
          images={existingImages}
          onChange={setExistingImages}
          t={t}
          targetType="product"
        />
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button disabled={isSubmitting} type="submit">
            {initialProduct ? t("action.save") : t("web.action.addProduct")}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

type FinishOptionFormValue = ProductFormInput["finishOptions"][number];

const emptyFinishOption = (): FinishOptionFormValue => ({
  colorEffectId: null,
  colorEffectSlug: null,
  colorIds: [],
  finishIds: [],
});

export function FinishOptionsEditor({
  onChange,
  onOptionsChange,
  options,
  singleOption = false,
  t,
  value,
}: {
  onChange: (value: FinishOptionFormValue[]) => void;
  onOptionsChange: React.Dispatch<React.SetStateAction<CatalogOptions>>;
  options: CatalogOptions;
  singleOption?: boolean;
  t: ReturnType<typeof useCatalogCopy>;
  value: FinishOptionFormValue[];
}) {
  const update = (index: number, option: FinishOptionFormValue) =>
    onChange(
      value.map((current, position) => (position === index ? option : current)),
    );
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
        {t("web.catalog.field.finishOptions")}
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
        const preview = finishOptionLabel({
          colorEffect: selectedEffect,
          colors: selectedColors,
          finishes: selectedFinishes,
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

type LookupDialogProps = (
  | {
      kind: "maker";
      onCreated: (value: {
        id: number;
        name: string;
        rootUrl: string | null;
      }) => void;
    }
  | { kind: "color"; onCreated: (value: CatalogColor) => void }
  | {
      kind: "finish" | "material";
      onCreated: (value: CatalogLookup) => void;
    }
) & { t: ReturnType<typeof useCatalogCopy> };

function LookupDialog(props: LookupDialogProps) {
  const { kind, t } = props;
  const ref = React.useRef<HTMLDialogElement>(null);
  const dialogId = React.useId();
  const titleId = React.useId();
  const [name, setName] = React.useState("");
  const [hex, setHex] = React.useState("#808080");
  const [rootUrl, setRootUrl] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[] | undefined>
  >({});
  const [error, setError] = React.useState<string | null>(null);
  const action = {
    color: "web.action.addColor",
    finish: "web.action.addFinish",
    maker: "web.action.addMaker",
    material: "web.action.addMaterial",
  }[kind] as TranslationKey;

  const create = async () => {
    if (props.kind === "maker") {
      const result = await createCatalogMaker({ data: { name, rootUrl } });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setError(result.formError);
        return;
      }
      props.onCreated(result.maker);
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
          ) : (
            <Field label={t("web.catalog.field.slug")}>
              <Input
                aria-label={t("web.catalog.field.slug")}
                readOnly
                value={productSlugPreview(name)}
              />
            </Field>
          )}
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

export function CollectionFormPage({
  collection,
}: {
  collection?: UserCollectionSummary;
}) {
  const t = useCatalogCopy();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [current, setCurrent] = React.useState(collection);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const copy = {
    browse: t("web.resources.upload.browseFiles"),
    cover: t("web.collections.field.cover"),
    description: t("web.collections.field.description"),
    descriptionPlaceholder: t("web.collections.placeholder.description"),
    imageHelp: t("web.resources.upload.imagesHelp", {
      maxFileSize: "25 MiB",
      maxImages: 1,
      maxSessionSize: "25 MiB",
    }),
    imageTypes: t("web.resources.upload.imageTypes"),
    name: t("web.collections.field.name"),
    namePlaceholder: t("web.collections.placeholder.name"),
    public: t("web.resources.visibility.public"),
    removeFile: t("web.resources.action.removeFile"),
    submit: t("action.save"),
  };

  async function submit(value: CollectionFormValue, cover: File | null) {
    setSaving(true);
    setError(null);
    const result = await saveCollection({
      data: {
        collectionId: current?.id ?? null,
        description: value.description,
        isPrivate: value.isPrivate,
        name: value.name,
      },
    });
    if (!result.ok) {
      setError(t(result.formError));
      setSaving(false);
      return;
    }
    setCurrent(result.collection);
    if (cover) {
      try {
        const upload = await uploadImages({
          files: [cover],
          getToken,
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

  async function updateCover(action: () => Promise<void>) {
    if (!current) return;
    setSaving(true);
    setError(null);
    try {
      await action();
      window.location.reload();
    } catch {
      setError(t("error.generic"));
      setSaving(false);
    }
  }

  return (
    <AppShell
      breadcrumbItems={[
        { label: t("web.navigation.collections"), to: "/user/collections" },
      ]}
      title={
        current
          ? t("web.collections.edit.title")
          : t("web.collections.add.title")
      }
    >
      <main className="grid gap-6 p-6">
        <CollectionForm
          copy={copy}
          disabled={saving}
          error={error}
          initialValue={
            current
              ? {
                  description: current.description ?? "",
                  isPrivate: current.isPrivate,
                  name: current.name,
                }
              : undefined
          }
          onSubmit={submit}
        />
        {current?.coverImages.length ? (
          <CollectionCoverManager
            collection={current}
            copy={{
              clear: t("web.action.clearCover"),
              clearConfirmation: t("web.collections.cover.clearConfirmation"),
              current: t("web.collections.cover.current"),
              delete: t("web.action.deleteCover"),
              deleteConfirmation: t("web.collections.cover.deleteConfirmation"),
              history: t("web.collections.cover.history"),
              select: t("web.action.selectCover"),
            }}
            disabled={saving}
            onClear={() =>
              updateCover(() =>
                selectCollectionCover({
                  data: { collectionId: current.id, imageId: null },
                }),
              )
            }
            onDelete={(image) =>
              updateCover(() =>
                deleteCollectionCover({
                  getToken,
                  imageId: image.id,
                }),
              )
            }
            onSelect={(image) =>
              updateCover(() =>
                selectCollectionCover({
                  data: { collectionId: current.id, imageId: image.id },
                }),
              )
            }
          />
        ) : null}
      </main>
    </AppShell>
  );
}

export function CollectionAddPage({
  collections,
  defaultCollectionName,
  initialProductId,
  syncIncomplete = false,
  options: initialOptions,
  products,
}: {
  collections: UserCollectionSummary[];
  defaultCollectionName: string | null;
  initialProductId?: number;
  options: CatalogOptions;
  products: CatalogProduct[];
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
          }
        : null,
    );
  const [collectionCover, setCollectionCover] = React.useState<File | null>(
    null,
  );
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
  const slug = options.productTypes.find(({ id }) => id === type?.id)?.slug;
  const matchingProducts = products.filter(
    ({ productTypeSlug }) => productTypeSlug === slug,
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
          updatedAt: new Date(0),
        },
      ]
    : collections;

  const submit = async (confirmed: boolean) => {
    setFormError(null);
    if (
      !product ||
      !displayName.trim() ||
      selectedCollectionId === null ||
      !material ||
      !finish ||
      (finish.id === "custom" && !customFinishIsValid) ||
      !productTypeIsSupported(product.productTypeSlug) ||
      (selectedButton &&
        (!buttonMaterial ||
          !buttonFinish ||
          (buttonFinish.id === "custom" && !buttonCustomFinishIsValid)))
    ) {
      return;
    }
    const imageError = validateImages(images);
    if (imageError) {
      setFormError(imageError.key);
      return;
    }
    if (savedItemId && savedCollectionId) {
      try {
        if (images.length) {
          const uploads = await uploadImages({
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
        if (collectionCover) {
          const coverUpload = await uploadImages({
            files: [collectionCover],
            getToken,
            targetId: savedCollectionId,
            targetType: "collection",
          });
          if (coverUpload.failed.length) {
            setFormError("web.collections.error.upload");
            return;
          }
          setCollectionCover(null);
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
        customFinish: finish.id === "custom" ? customFinish : null,
        displayName,
        finishOptionId: finish.id === "custom" ? null : Number(finish.id),
        materialId: material.id,
        newCollection:
          selectedCollectionId === -1 && newCollection
            ? {
                description: newCollection.description || null,
                isPrivate: newCollection.isPrivate,
                name: newCollection.name,
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
          files: images,
          getToken,
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
    if (collectionCover) {
      try {
        const upload = await uploadImages({
          files: [collectionCover],
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
            disabled={!product}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </Field>
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
              setCollectionCover(null);
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
                cover: t("web.collections.field.cover"),
                description: t("web.collections.field.description"),
                descriptionPlaceholder: t(
                  "web.collections.placeholder.description",
                ),
                imageHelp: t("web.resources.upload.imagesHelp", {
                  maxFileSize: "25 MiB",
                  maxImages: 1,
                  maxSessionSize: "25 MiB",
                }),
                imageTypes: t("web.resources.upload.imageTypes"),
                name: t("web.collections.field.name"),
                namePlaceholder: t("web.collections.placeholder.name"),
                public: t("web.resources.visibility.public"),
                removeFile: t("web.resources.action.removeFile"),
                submit: t("action.save"),
              }}
              onSubmit={(value, cover) => {
                setNewCollection(value);
                setCollectionCover(cover);
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
        <Field label={t("web.catalog.field.productType")}>
          <CatalogCombobox
            ariaLabel={t("web.catalog.field.productType")}
            items={options.productTypes}
            onValueChange={(value) => {
              setType(value);
              setProduct(null);
              setDisplayName("");
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
        <div className="grid grid-cols-1 gap-[18px] min-[481px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(max(240px,calc((100%_-_4_*_18px)_/_5)),1fr))]">
          {matchingProducts.map((candidate) => (
            <Button
              className="h-auto justify-start p-5 text-left"
              key={candidate.id}
              onClick={() => {
                setProduct(candidate);
                setDisplayName(candidate.name);
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
              variant={candidate.id === product?.id ? "default" : "outline"}
            >
              {candidate.name}
            </Button>
          ))}
        </div>
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
            accept=".jpeg,.jpg,.png,.webp"
            aspectRatio={4 / 3}
            aspectRatioHelpHref="/help/image-size-and-resolution-guide"
            aspectRatioHelpLabel={imageGuidance.helpLabel}
            aspectRatioWarning={imageGuidance.warning}
            browseLabel={t("web.resources.upload.browseFiles")}
            description={t("web.resources.upload.imagesHelp", {
              maxFileSize: "25 MiB",
              maxImages: 20,
              maxSessionSize: "200 MiB",
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
  currentFinish?: CatalogFinishOption | null;
  customFinish: FinishOptionFormValue;
  finish: ComboboxOption | null;
  material: CatalogLookup | null;
  onCustomFinishChange: (value: FinishOptionFormValue) => void;
  onFinishChange: (value: ComboboxOption | null) => void;
  onMaterialChange: (value: CatalogLookup | null) => void;
  onOptionsChange: React.Dispatch<React.SetStateAction<CatalogOptions>>;
  options: CatalogOptions;
  product: CatalogProduct;
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
    <fieldset className="grid gap-5 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-semibold">{product.name}</legend>
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

export function CollectionEditPage({
  buttonProducts,
  collections,
  item,
  options: initialOptions,
  ownedButtons,
  product,
}: {
  buttonProducts: CatalogProduct[];
  collections: UserCollectionSummary[];
  item: UserCollectionItem;
  options: CatalogOptions;
  ownedButtons: UserCollectionItem[];
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
  const [options, setOptions] = React.useState(initialOptions);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [material, setMaterial] = React.useState<CatalogLookup | null>(
    item.material,
  );
  const [finish, setFinish] = React.useState<ComboboxOption | null>(() =>
    item.finishOption
      ? { id: "current", name: localizedFinishLabel(item.finishOption, t) }
      : null,
  );
  const [customFinish, setCustomFinish] = React.useState(emptyFinishOption);
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
  const buttonSelectionIsValid =
    item.productTypeSlug !== "spinner" ||
    button?.id === "default" ||
    Boolean(
      selectedButton && selectedButtonProduct && buttonMaterial && buttonFinish,
    );
  const finishSelectionIsValid =
    Boolean(finish) &&
    (finish?.id !== "custom" ||
      finishOptionSchema.safeParse(customFinish).success);
  const buttonFinishSelectionIsValid =
    Boolean(buttonFinish) &&
    (buttonFinish?.id !== "custom" ||
      finishOptionSchema.safeParse(buttonCustomFinish).success);
  const detailsAreValid = Boolean(
    displayName.trim() &&
      material &&
      finish &&
      finishSelectionIsValid &&
      buttonSelectionIsValid &&
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
      <main className="grid max-w-xl gap-5 p-6">
        <Field label={displayNameLabel}>
          <Input
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </Field>
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
        <FileDropInput
          accept=".jpeg,.jpg,.png,.webp"
          aspectRatio={4 / 3}
          aspectRatioHelpHref="/help/image-size-and-resolution-guide"
          aspectRatioHelpLabel={imageGuidance.helpLabel}
          aspectRatioWarning={imageGuidance.warning}
          browseLabel={t("web.resources.upload.browseFiles")}
          description={t("web.resources.upload.imagesHelp", {
            maxFileSize: "25 MiB",
            maxImages: 20,
            maxSessionSize: "200 MiB",
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
          images={existingImages}
          onChange={setExistingImages}
          t={t}
          targetType="collection_item"
        />
        <Button
          disabled={submissionMode === "disabled"}
          onClick={async () => {
            if (submissionMode === "disabled") {
              return;
            }
            setFormError(null);
            const imageError = validateImages(images);
            if (imageError) {
              setFormError(imageError.key);
              return;
            }
            if (images.length) {
              try {
                const uploads = await uploadImages({
                  files: images,
                  getToken,
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
                      data: { imageId, targetType: "collection_item" },
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
                  collectionItemId: number;
                  customFinish: FinishOptionFormValue | null;
                  finishOptionId: number | null;
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
            const result = await updateCollectionItem({
              data: {
                collectionId,
                collectionItemId: item.collectionItemId,
                customFinish: finish.id === "custom" ? customFinish : null,
                displayName,
                finishOptionId:
                  finish.id === "current" || finish.id === "custom"
                    ? null
                    : Number(finish.id),
                ...(item.productTypeSlug === "spinner"
                  ? { installedButton }
                  : {}),
                materialId: material.id,
              },
            });
            if (result.ok) {
              await navigate({
                params: { collectionId },
                to: "/user/collections/$collectionId",
              });
            } else {
              setFormError(result.formError);
            }
          }}
          type="button"
        >
          {t("action.save")}
        </Button>
        {formError ? <Notice>{t(formError)}</Notice> : null}
      </main>
    </AppShell>
  );
}

export function collectionEditSubmissionMode(
  detailsAreValid: boolean,
  pendingImageCount: number,
): "disabled" | "save" | "upload" {
  if (detailsAreValid) return "save";
  return pendingImageCount > 0 ? "upload" : "disabled";
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </div>
  );
}

function CatalogImageEditor({
  images,
  onChange,
  t,
  targetType,
}: {
  images: CatalogImage[];
  onChange(images: CatalogImage[]): void;
  t: ReturnType<typeof useCatalogCopy>;
  targetType: "collection_item" | "product";
}) {
  if (!images.length) return null;
  return (
    <section
      aria-label={t("web.resources.upload.imagesLabel")}
      className="grid gap-3"
    >
      {images.map((image) => (
        <div
          className="flex items-center gap-3 rounded-lg border border-border p-3"
          key={image.id}
        >
          <img
            alt={t("web.resources.detail.imageAlt", { name: image.fileName })}
            className="size-16 rounded-md object-cover"
            src={image.url}
          />
          <span className="min-w-0 flex-1 truncate text-sm">
            {image.fileName}
          </span>
          <Button
            aria-label={`${t(image.deletedAt ? "web.resources.action.restore" : "web.resources.action.delete")} ${image.fileName}`}
            onClick={async () => {
              if (image.deletedAt) {
                await restoreCatalogImage({
                  data: { imageId: image.id, targetType },
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
                  data: { imageId: image.id, targetType },
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

function FieldError({
  error,
  t,
}: {
  error?: string;
  t: ReturnType<typeof useCatalogCopy>;
}) {
  return error ? (
    <span className="text-sm text-destructive" role="alert">
      {t(error)}
    </span>
  ) : null;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border border-border bg-secondary p-4 text-secondary-foreground"
      role="status"
    >
      {children}
    </div>
  );
}
