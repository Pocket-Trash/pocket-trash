import { useAuth } from "@clerk/tanstack-react-start";
import type { CatalogImage, CatalogMaker } from "@package/services";
import {
  maxImageBytes,
  maxImageSessionBytes,
  maxImageSessionFiles,
} from "@package/services/constants";
import {
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link, useNavigate } from "@tanstack/react-router";
import { Factory, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { AdminPageShell } from "@/components/admin-page-shell";
import { CatalogMarkdownEditor } from "@/components/catalog-markdown-editor";
import { FileDropInput } from "@/components/resource-file-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  makerProfileSchema,
  productSlugPreview,
  restoreCatalogImage,
  saveAdminMaker,
  softDeleteCatalogImage,
} from "@/lib/catalog-api";
import { getImageUploadGuidance } from "@/lib/help-content";
import { formatMiB, uploadImages } from "@/lib/upload-sessions";
import { cn } from "@/lib/utils";
import { useLocale } from "@/providers/locale-provider";

/** Maker directory page properties. */
interface AdminMakersPageProperties {
  /** Name-sorted maker profiles available to the administrator. */
  makers: CatalogMaker[];
}

/** Maker form page properties. */
interface AdminMakerFormPageProperties {
  /** Existing maker profile, or `undefined` for creation. */
  maker?: CatalogMaker;
}

/**
 * Renders the maker administration directory.
 *
 * @param props - Maker directory properties.
 * @param props.makers - Name-sorted maker profiles available to the administrator.
 * @returns The maker administration page.
 */
export function AdminMakersPage({ makers }: AdminMakersPageProperties) {
  const { locale } = useLocale();
  /**
   * Formats maker-administration copy for the active locale.
   *
   * @param key - Localization key.
   * @param values - Translation interpolation values.
   * @returns Localized maker-administration copy.
   */
  const t = (
    key: TranslationKey,
    values: Readonly<Record<string, unknown>> = {},
  ) => formatTranslation(key, values, locale);

  return (
    <AdminPageShell section="makers" title={t("web.admin.makers.title")}>
      <main className="grid content-start gap-5 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="m-0 text-2xl font-semibold">
              {t("web.admin.makers.title")}
            </h1>
            <p className="m-0 text-sm text-muted-foreground">
              {t("web.admin.makers.description")}
            </p>
          </div>
          <Link className={buttonVariants()} to="/admin/makers/add">
            {t("web.action.addMaker")}
          </Link>
        </div>
        {makers.length ? (
          <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {makers.map((maker) => (
              <li
                className="grid gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground"
                key={maker.id}
              >
                {maker.images.find(({ deletedAt }) => !deletedAt) ? (
                  <img
                    alt={maker.name}
                    className="aspect-[4/3] w-full rounded-md object-cover"
                    src={maker.images.find(({ deletedAt }) => !deletedAt)?.url}
                  />
                ) : (
                  <div className="grid aspect-[4/3] place-items-center rounded-md bg-muted text-muted-foreground">
                    <Factory aria-hidden="true" className="size-8" />
                    <span className="sr-only">
                      {t("web.admin.makers.imagesEmpty")}
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <Factory aria-hidden="true" className="mt-0.5 size-5" />
                  <div className="min-w-0 flex-1">
                    <h2 className="m-0 truncate text-base font-semibold">
                      {maker.name}
                    </h2>
                    <p className="m-0 truncate text-xs text-muted-foreground">
                      {maker.slug}
                    </p>
                  </div>
                </div>
                <Link
                  aria-label={t("web.admin.makers.editMaker", {
                    name: maker.name,
                  })}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-full",
                  )}
                  params={{ makerId: String(maker.id) }}
                  to="/admin/makers/$makerId/edit"
                >
                  <Pencil aria-hidden="true" />
                  {t("web.action.edit")}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            {t("web.admin.makers.empty")}
          </p>
        )}
      </main>
    </AdminPageShell>
  );
}

/**
 * Renders the maker profile create or edit form.
 *
 * @param props - Maker form properties.
 * @param props.maker - Existing maker profile, or `undefined` for creation.
 * @returns The maker profile form page.
 */
export function AdminMakerFormPage({ maker }: AdminMakerFormPageProperties) {
  const { getToken } = useAuth();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const [name, setName] = useState(maker?.name ?? "");
  const [rootUrl, setRootUrl] = useState(maker?.rootUrl ?? "");
  const [description, setDescription] = useState(maker?.description ?? "");
  const [images, setImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<CatalogImage[]>(
    maker?.images ?? [],
  );
  const [editorLoading, setEditorLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  /**
   * Formats maker-form copy for the active locale.
   *
   * @param key - Localization key.
   * @param values - Translation interpolation values.
   * @returns Localized maker-form copy.
   */
  const t = (
    key: TranslationKey,
    values: Readonly<Record<string, unknown>> = {},
  ) => formatTranslation(key, values, locale);
  const title = maker
    ? t("web.admin.makers.editMaker", { name: maker.name })
    : t("web.action.addMaker");

  /**
   * Saves the current maker profile.
   *
   * @param event - Form submission event.
   * @returns A promise that resolves after validation and navigation complete.
   */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editorLoading || busy) return;
    const values = {
      description,
      makerId: maker?.id ?? null,
      name,
      rootUrl,
    };
    const parsed = makerProfileSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      setFormError("web.catalog.error.form");
      return;
    }
    setBusy(true);
    setFieldErrors({});
    setFormError(null);
    const result = await saveAdminMaker({ data: values });
    if (!result.ok) {
      setFieldErrors(result.fieldErrors);
      setFormError(result.formError);
      setBusy(false);
      return;
    }
    if (images.length) {
      try {
        await uploadImages({
          files: images,
          getToken,
          locale,
          targetId: result.maker.id,
          targetType: "maker",
        });
      } catch {
        setFormError("web.catalog.error.form");
        setBusy(false);
        return;
      }
    }
    await navigate({ to: "/admin/makers" });
  }

  /**
   * Returns the first localized error for one maker field.
   *
   * @param field - Maker form field name.
   * @returns The localized error, or `undefined` when valid.
   */
  function errorFor(field: string) {
    const key = fieldErrors[field]?.[0];
    return key ? t(key as TranslationKey) : undefined;
  }

  return (
    <AdminPageShell
      breadcrumbItems={[
        { label: t("web.admin.makers.title"), to: "/admin/makers" },
      ]}
      section="makers"
      title={title}
    >
      <main className="grid content-start gap-5 p-4 md:p-6">
        <h1 className="m-0 text-2xl font-semibold">{title}</h1>
        <form className="grid max-w-2xl gap-5" onSubmit={submit}>
          <MakerField
            error={errorFor("name")}
            label={t("web.catalog.field.name")}
          >
            <Input
              aria-invalid={Boolean(errorFor("name"))}
              disabled={busy}
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </MakerField>
          <MakerField label={t("web.catalog.field.slug")}>
            <Input readOnly value={maker?.slug ?? productSlugPreview(name)} />
          </MakerField>
          <MakerField
            error={errorFor("rootUrl")}
            label={t("web.admin.makers.rootUrl")}
          >
            <Input
              aria-invalid={Boolean(errorFor("rootUrl"))}
              disabled={busy}
              onChange={(event) => setRootUrl(event.target.value)}
              type="url"
              value={rootUrl}
            />
          </MakerField>
          <CatalogMarkdownEditor
            defaultValue={description}
            disabled={busy}
            error={errorFor("description")}
            help={t("web.catalog.help.markdownDescription")}
            id="maker-description"
            label={t("web.catalog.field.description")}
            onChange={setDescription}
            onLoadingChange={setEditorLoading}
          />
          <MakerImageFields
            existingImages={existingImages}
            images={images}
            locale={locale}
            onExistingImagesChange={setExistingImages}
            onImagesChange={setImages}
            t={t}
          />
          {formError ? (
            <p className="m-0 text-sm text-destructive" role="alert">
              {t(formError as TranslationKey)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || editorLoading} type="submit">
              {t("action.save")}
            </Button>
            <Link
              className={buttonVariants({ variant: "outline" })}
              to="/admin/makers"
            >
              {t("action.cancel")}
            </Link>
          </div>
        </form>
      </main>
    </AdminPageShell>
  );
}

/**
 * Renders maker image upload, placeholder, archive, and restore controls.
 *
 * @param props - Maker image field properties.
 * @returns Maker image administration controls.
 */
function MakerImageFields({
  existingImages,
  images,
  locale,
  onExistingImagesChange,
  onImagesChange,
  t,
}: {
  /** Persisted active and archived maker images. */
  existingImages: CatalogImage[];
  /** Images waiting to upload after the maker is saved. */
  images: File[];
  /** Active interface locale. */
  locale: SupportedLocale;
  /**
   * Receives persisted image state changes.
   *
   * @param images - Updated persisted images.
   */
  onExistingImagesChange(images: CatalogImage[]): void;
  /**
   * Receives pending upload changes.
   *
   * @param images - Updated pending images.
   */
  onImagesChange(images: File[]): void;
  /**
   * Formats localized maker image copy.
   *
   * @param key - Localization key.
   * @param values - Translation interpolation values.
   * @returns Localized copy.
   */
  t(key: TranslationKey, values?: Readonly<Record<string, unknown>>): string;
}) {
  const guidance = getImageUploadGuidance(locale);
  const activeImages = existingImages.filter(({ deletedAt }) => !deletedAt);
  return (
    <section className="grid gap-3">
      <FileDropInput
        accept=".avif,.jpeg,.jpg,.png,.webp"
        aspectRatio={4 / 3}
        aspectRatioHelpHref="/help/image-size-and-resolution-guide"
        aspectRatioHelpLabel={guidance.helpLabel}
        aspectRatioWarning={guidance.warning}
        browseLabel={t("web.resources.upload.browseFiles")}
        description={t("web.resources.upload.imagesHelp", {
          maxFileSize: formatMiB(maxImageBytes, locale),
          maxImages: maxImageSessionFiles,
          maxSessionSize: formatMiB(maxImageSessionBytes, locale),
        })}
        fileTypes={t("web.resources.upload.imageTypes")}
        files={images}
        id="maker-images"
        label={t("web.resources.upload.imagesLabel")}
        multiple
        onFilesChange={(additions) => onImagesChange([...images, ...additions])}
        onRemove={(index) =>
          onImagesChange(
            images.filter((_image, candidate) => candidate !== index),
          )
        }
        removeFileLabel={t("web.action.close")}
      />
      {!activeImages.length && !images.length ? (
        <div className="grid aspect-[4/3] max-w-sm place-items-center rounded-lg border border-dashed border-border bg-muted text-muted-foreground">
          <div className="grid justify-items-center gap-2 text-sm">
            <Factory aria-hidden="true" className="size-8" />
            <span>{t("web.admin.makers.imagesEmpty")}</span>
          </div>
        </div>
      ) : null}
      {existingImages.map((image) => (
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
            aria-label={t("web.admin.makers.imageAction", {
              action: t(
                image.deletedAt
                  ? "web.resources.action.restore"
                  : "web.resources.action.delete",
              ),
              fileName: image.fileName,
            })}
            onClick={async () => {
              if (image.deletedAt) {
                await restoreCatalogImage({
                  data: { imageId: image.id, targetType: "maker" },
                });
                onExistingImagesChange(
                  existingImages.map((candidate) =>
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
                  data: { imageId: image.id, targetType: "maker" },
                });
                onExistingImagesChange(
                  existingImages.map((candidate) =>
                    candidate.id === image.id
                      ? {
                          ...candidate,
                          deletedAt: new Date(),
                          deletedByClerkId: null,
                          deletedByRole: "admin",
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
 * Renders one labelled maker-form control and its validation message.
 *
 * @param props - Field label, control, and optional localized error.
 * @returns The labelled maker-form field.
 */
function MakerField({
  children,
  error,
  label,
}: {
  /** Form control. */
  children: ReactNode;
  /** Localized validation error. */
  error?: string;
  /** Localized field label. */
  label: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      {children}
      {error ? (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
