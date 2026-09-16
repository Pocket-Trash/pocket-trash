import type {
  CatalogLookup,
  CatalogProduct,
  CatalogProductType,
  UserCollectionItem,
} from "@package/services";
import {
  formatTranslation,
  type TranslationKey,
  translationKeys,
} from "@pocket-trash/localizations";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
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
  type ProductFormInput,
  productFormSchema,
  productSlugPreview,
  productTypeIsSupported,
  saveCatalogProduct,
  updateCollectionSpinner,
} from "@/lib/catalog-api";
import { useLocale } from "@/providers/locale-provider";

const translationKeySet: ReadonlySet<string> = new Set(translationKeys);

function isTranslationKey(key: string): key is TranslationKey {
  return translationKeySet.has(key);
}

function useCatalogCopy() {
  const { locale } = useLocale();
  return (key: string, values: Readonly<Record<string, unknown>> = {}) =>
    formatTranslation(
      isTranslationKey(key) ? key : "error.generic",
      values,
      locale,
    );
}

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
  const navigate = useNavigate();
  const [options, setOptions] = React.useState(initialOptions);
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
      const result = await saveCatalogProduct({ data: value });
      if (!result.ok) {
        setServerErrors(result.fieldErrors);
        setFormError(result.formError);
        return;
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

export function FinishOptionsEditor({
  onChange,
  onOptionsChange,
  options,
  t,
  value,
}: {
  onChange: (value: FinishOptionFormValue[]) => void;
  onOptionsChange: React.Dispatch<React.SetStateAction<CatalogOptions>>;
  options: CatalogOptions;
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
          </section>
        );
      })}
      <Button
        className="w-fit"
        onClick={() =>
          onChange([
            ...value,
            {
              colorEffectId: null,
              colorEffectSlug: null,
              colorIds: [],
              finishIds: [],
            },
          ])
        }
        type="button"
        variant="outline"
      >
        {t("web.action.addFinishOption")}
      </Button>
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
  | {
      kind: "color" | "finish" | "material";
      onCreated: (value: CatalogLookup) => void;
    }
) & { t: ReturnType<typeof useCatalogCopy> };

function LookupDialog(props: LookupDialogProps) {
  const { kind, t } = props;
  const ref = React.useRef<HTMLDialogElement>(null);
  const dialogId = React.useId();
  const titleId = React.useId();
  const [name, setName] = React.useState("");
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
      const result = await createCatalogColor({ data: { name } });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setError(result.formError);
        return;
      }
      props.onCreated(result.color);
    }
    setName("");
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

export function CollectionAddPage({
  options,
  products,
}: {
  options: CatalogOptions;
  products: CatalogProduct[];
}) {
  const t = useCatalogCopy();
  const navigate = useNavigate();
  const [type, setType] = React.useState<ComboboxOption | null>(null);
  const [product, setProduct] = React.useState<CatalogProduct | null>(null);
  const [button, setButton] = React.useState<ComboboxOption | null>(null);
  const [duplicateCounts, setDuplicateCounts] = React.useState<
    Record<number, number>
  >({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const slug = options.productTypes.find(({ id }) => id === type?.id)?.slug;
  const matchingProducts = products.filter(
    ({ productTypeSlug }) => productTypeSlug === slug,
  );

  const submit = async (confirmed: boolean) => {
    if (!product || !productTypeIsSupported(product.productTypeSlug)) return;
    const result = await addCollectionProduct({
      data: {
        buttonProductId:
          product.productTypeSlug === "spinner" && button?.id !== "default"
            ? Number(button?.id ?? 0) || null
            : null,
        confirmed,
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
    await navigate({ to: "/user/collections" });
  };

  return (
    <AppShell
      breadcrumbItems={[
        { label: t("web.navigation.collections"), to: "/collections" },
      ]}
      title={t("web.action.addToCollection")}
    >
      <main className="mx-auto grid max-w-5xl gap-6 p-6">
        <Field label={t("web.catalog.field.productType")}>
          <CatalogCombobox
            ariaLabel={t("web.catalog.field.productType")}
            items={options.productTypes}
            onValueChange={(value) => {
              setType(value);
              setProduct(null);
              setButton(null);
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
                setButton(null);
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
        {product?.productTypeSlug === "spinner" ? (
          <Field label={t("web.catalog.field.button")}>
            <CatalogCombobox
              ariaLabel={t("web.catalog.field.button")}
              items={[
                { id: "default", name: t("web.catalog.defaultButton") },
                ...options.spinnerButtons,
              ]}
              onValueChange={(value) => {
                setButton(value);
                setDuplicateCounts({});
              }}
              placeholder={t("web.catalog.defaultButton")}
              removeLabel={t("web.action.close")}
              showSelectedPill
              value={button}
            />
          </Field>
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
        {formError ? <Notice>{t(formError)}</Notice> : null}
        {product ? (
          <Button
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

export function CollectionEditPage({
  item,
  ownedButtons,
}: {
  item: UserCollectionItem;
  ownedButtons: UserCollectionItem[];
}) {
  const t = useCatalogCopy();
  const navigate = useNavigate();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [button, setButton] = React.useState<ComboboxOption | null>(() => {
    const selected = ownedButtons.find(
      ({ collectionItemId }) => collectionItemId === item.installedButtonId,
    );
    return selected
      ? { id: selected.collectionItemId, name: selected.name }
      : { id: "default", name: t("web.catalog.defaultButton") };
  });

  if (item.productTypeSlug === "spinner-button") {
    return (
      <AppShell
        breadcrumbItems={[
          { label: t("web.navigation.collections"), to: "/collections" },
        ]}
        title={item.name}
      >
        <main className="mx-auto max-w-xl p-6">
          <Notice>{t("web.collections.edit.noFields")}</Notice>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumbItems={[
        { label: t("web.navigation.collections"), to: "/collections" },
      ]}
      title={item.name}
    >
      <main className="mx-auto grid max-w-xl gap-5 p-6">
        <Field label={t("web.catalog.field.button")}>
          <CatalogCombobox
            ariaLabel={t("web.catalog.field.button")}
            items={[
              { id: "default", name: t("web.catalog.defaultButton") },
              ...ownedButtons.map(({ collectionItemId, name }) => ({
                id: collectionItemId,
                name,
              })),
            ]}
            onValueChange={setButton}
            placeholder={t("web.catalog.defaultButton")}
            removeLabel={t("web.action.close")}
            showSelectedPill
            value={button}
          />
        </Field>
        <Button
          onClick={async () => {
            const result = await updateCollectionSpinner({
              data: {
                collectionItemId: item.collectionItemId,
                installedButtonId:
                  button?.id === "default" ? null : Number(button?.id),
              },
            });
            if (result.ok) {
              await navigate({ to: "/user/collections" });
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
