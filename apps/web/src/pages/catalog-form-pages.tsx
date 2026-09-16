import type {
  CatalogProduct,
  CatalogProductType,
  UserCollectionItem,
} from "@package/services";
import {
  formatTranslation,
  type TranslationKey,
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
import { filterButtonsByDiameter } from "@/lib/catalog";
import {
  addCollectionProduct,
  type CatalogOptions,
  createCatalogMaker,
  createCatalogMaterial,
  productFormSchema,
  productSlugPreview,
  productTypeIsSupported,
  saveCatalogProduct,
  updateCollectionSpinner,
} from "@/lib/catalog-api";
import { useLocale } from "@/providers/locale-provider";

function useCatalogCopy() {
  const { locale } = useLocale();
  return (key: string, values: Readonly<Record<string, unknown>> = {}) =>
    formatTranslation(key as TranslationKey, values, locale);
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
      sidebarContent={null}
      title={initialProduct ? initialProduct.name : t("web.action.addProduct")}
    >
      <main className="mx-auto grid max-w-3xl gap-6 p-6">
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
  const [compatibleButton, setCompatibleButton] =
    React.useState<ComboboxOption | null>(null);

  const form = useForm({
    defaultValues: {
      buttonDiameterMm: initialProduct?.buttonDiameterMm ?? null,
      diameterMm: initialProduct?.diameterMm ?? null,
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
              />
              <FieldError error={serverErrors.materialIds?.[0]} t={t} />
            </Field>
          );
        }}
      </form.Field>

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
                  min="0.01"
                  onBlur={field.handleBlur}
                  onChange={(event) =>
                    field.handleChange(event.target.value || null)
                  }
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
            <Field label={t("web.catalog.field.button")}>
              <CatalogCombobox
                ariaLabel={t("web.catalog.field.button")}
                items={[
                  { id: "default", name: t("web.catalog.defaultButton") },
                  ...filterButtonsByDiameter(options.spinnerButtons, diameter),
                ]}
                onValueChange={setCompatibleButton}
                placeholder={t("web.catalog.defaultButton")}
                value={compatibleButton}
              />
            </Field>
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

type LookupDialogProps =
  | {
      kind: "maker";
      onCreated: (value: {
        id: number;
        name: string;
        rootUrl: string | null;
      }) => void;
    }
  | {
      kind: "material";
      onCreated: (value: { id: number; name: string; slug: string }) => void;
    };

function LookupDialog(props: LookupDialogProps) {
  const { kind } = props;
  const t = useCatalogCopy();
  const ref = React.useRef<HTMLDialogElement>(null);
  const dialogId = React.useId();
  const titleId = React.useId();
  const [name, setName] = React.useState("");
  const [rootUrl, setRootUrl] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const action =
    kind === "maker" ? "web.action.addMaker" : "web.action.addMaterial";

  const create = async () => {
    if (props.kind === "maker") {
      const result = await createCatalogMaker({ data: { name, rootUrl } });
      if (!result.ok) {
        setError(result.formError);
        return;
      }
      props.onCreated(result.maker);
    } else {
      const result = await createCatalogMaterial({ data: { name } });
      if (!result.ok) {
        setError(result.formError);
        return;
      }
      props.onCreated(result.material);
    }
    setName("");
    setRootUrl("");
    ref.current?.close();
  };

  return (
    <>
      <Button
        aria-controls={dialogId}
        aria-haspopup="dialog"
        onClick={() => ref.current?.showModal()}
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
        <form
          className="grid gap-4 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
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
          </Field>
          {kind === "maker" ? (
            <Field label={t("web.catalog.field.rootUrl")}>
              <Input
                aria-label={t("web.catalog.field.rootUrl")}
                onChange={(event) => setRootUrl(event.target.value)}
                type="url"
                value={rootUrl}
              />
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
            <Button type="submit">{t(action)}</Button>
          </div>
        </form>
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
  const [duplicateCount, setDuplicateCount] = React.useState(0);
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
      setDuplicateCount(
        Object.values(result.duplicateCounts).reduce(
          (sum, count) => sum + count,
          0,
        ),
      );
      return;
    }
    if (!result.ok) {
      setFormError(result.formError);
      return;
    }
    await navigate({ to: "/user/collections" });
  };

  return (
    <AppShell sidebarContent={null} title={t("web.action.addToCollection")}>
      <main className="mx-auto grid max-w-5xl gap-6 p-6">
        <Field label={t("web.catalog.field.productType")}>
          <CatalogCombobox
            ariaLabel={t("web.catalog.field.productType")}
            items={options.productTypes}
            onValueChange={(value) => {
              setType(value);
              setProduct(null);
              setButton(null);
              setDuplicateCount(0);
              setFormError(null);
            }}
            placeholder={t("web.catalog.selectProductType")}
            value={type}
          />
        </Field>
        {slug && !productTypeIsSupported(slug) ? (
          <Notice>{t("web.catalog.notImplemented")}</Notice>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matchingProducts.map((candidate) => (
            <Button
              className="h-auto justify-start p-5 text-left"
              key={candidate.id}
              onClick={() => {
                setProduct(candidate);
                setButton(null);
                setDuplicateCount(0);
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
              onValueChange={setButton}
              placeholder={t("web.catalog.defaultButton")}
              value={button}
            />
          </Field>
        ) : null}
        {duplicateCount ? (
          <Notice>
            {t("web.collections.duplicateWarning", { count: duplicateCount })}
          </Notice>
        ) : null}
        {formError ? <Notice>{t(formError)}</Notice> : null}
        {product ? (
          <Button
            onClick={() => void submit(Boolean(duplicateCount))}
            type="button"
          >
            {duplicateCount
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
      <AppShell sidebarContent={null} title={item.name}>
        <main className="mx-auto max-w-xl p-6">
          <Notice>{t("web.collections.edit.noFields")}</Notice>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell sidebarContent={null} title={item.name}>
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
