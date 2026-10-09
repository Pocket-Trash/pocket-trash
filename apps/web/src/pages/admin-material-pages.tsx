import { useAuth } from "@clerk/tanstack-react-start";
import type {
  AdminMaterial,
  AdminMaterialSummary,
  CatalogImage,
  MaterialSpecific,
} from "@package/services";
import {
  maxImageBytes,
  maxImageSessionBytes,
  maxImageSessionFiles,
} from "@package/services/constants";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, RotateCcw, Trash2 } from "lucide-react";
import * as React from "react";
import { AdminPageShell } from "@/components/admin-page-shell";
import { CatalogMarkdownEditor } from "@/components/catalog-markdown-editor";
import type { MarkdownEditorHandle } from "@/components/markdown-editor";
import { FileDropInput } from "@/components/resource-file-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { CatalogCombobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/catalog";
import {
  getAdminMaterial,
  moveAdminMaterialImage,
  reorderAdminMaterialImages,
  restoreCatalogImage,
  saveAdminMaterial,
  saveAdminMaterialSpecific,
  softDeleteCatalogImage,
} from "@/lib/catalog-api";
import { useCatalogCopy } from "@/lib/catalog-copy";
import { getImageUploadGuidance } from "@/lib/help-content";
import {
  formatMiB,
  type ImageUploadError,
  uploadImages,
  validateImages,
} from "@/lib/upload-sessions";
import { useLocale } from "@/providers/locale-provider";

/**
 * Lists administrator-managed materials and links to their editors.
 *
 * @param props - Material list properties.
 * @param props.materials - Materials visible to the product administrator.
 * @returns The material administration list.
 */
export function AdminMaterialsPage({
  materials,
}: {
  /** Materials visible to the product administrator. */
  materials: AdminMaterialSummary[];
}) {
  const t = useCatalogCopy();
  return (
    <AdminPageShell section="materials" title={t("web.materials.admin.title")}>
      <main className="grid w-full max-w-5xl gap-5 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-sm text-muted-foreground">
            {t("web.materials.admin.description")}
          </p>
          <Link className={buttonVariants()} to="/admin/materials/add">
            {t("web.action.addMaterial")}
          </Link>
        </div>
        {materials.length ? (
          <ul className="grid list-none gap-3 p-0">
            {materials.map((material) => (
              <li
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4"
                key={material.id}
              >
                <div className="min-w-0 flex-1">
                  <h2 className="m-0 truncate text-base font-semibold">
                    {material.name}
                  </h2>
                  <p className="m-0 truncate text-sm text-muted-foreground">
                    {material.slug}
                  </p>
                </div>
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  params={{ materialId: String(material.id) }}
                  to="/admin/materials/$materialId/edit"
                >
                  {t("web.action.edit")}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            {t("web.materials.admin.empty")}
          </p>
        )}
      </main>
    </AdminPageShell>
  );
}

/**
 * Renders the material create or edit form.
 *
 * @param props - Material form properties.
 * @param props.initialMaterial - Existing material, or nothing for creation.
 * @returns The material editor.
 */
export function AdminMaterialFormPage({
  initialMaterial,
}: {
  /** Existing material, or nothing for creation. */
  initialMaterial?: AdminMaterial;
}) {
  const { getToken } = useAuth();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const t = useCatalogCopy();
  const descriptionRef = React.useRef<MarkdownEditorHandle>(null);
  const [description, setDescription] = React.useState(
    initialMaterial?.description ?? "",
  );
  const [descriptionLoading, setDescriptionLoading] = React.useState(true);
  const [existingImages, setExistingImages] = React.useState(
    initialMaterial?.images ?? [],
  );
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[] | undefined>
  >({});
  const [files, setFiles] = React.useState<File[]>([]);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [name, setName] = React.useState(initialMaterial?.name ?? "");
  const [specifics, setSpecifics] = React.useState(
    initialMaterial?.specifics ?? [],
  );
  const [editingSpecific, setEditingSpecific] = React.useState<
    MaterialSpecific | "new" | null
  >(null);
  const [uploadScope, setUploadScope] = React.useState<number | null>(null);
  const [slug, setSlug] = React.useState(initialMaterial?.slug ?? "");
  const [updateSlug, setUpdateSlug] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const imageGuidance = getImageUploadGuidance(locale);
  const title = initialMaterial
    ? t("web.materials.admin.editTitle")
    : t("web.materials.admin.addTitle");

  /** Validates and saves the material, then uploads selected images. */
  const save = async () => {
    setFormError(null);
    setStatus(null);
    const imageError = validateImages(files, locale);
    if (imageError) {
      setFormError(imageError.key);
      return;
    }
    if (
      initialMaterial &&
      updateSlug &&
      slugify(name) !== slug &&
      !window.confirm(
        `${t("web.materials.slug.confirmation", { oldUrl: `/materials/${slug}`, newUrl: `/materials/${slugify(name)}` })} ${t("web.materials.slug.affected", { count: specifics.length })}`,
      )
    )
      return;
    setSaving(true);
    try {
      const result = await saveAdminMaterial({
        data: {
          description,
          materialId: initialMaterial?.id ?? null,
          name,
          updateSlug,
        },
      });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setFormError(result.formError);
        return;
      }
      setFieldErrors({});
      setSlug(result.material.slug);
      setUpdateSlug(false);
      if (files.length) {
        try {
          const uploads = await uploadImages({
            files,
            getToken,
            locale,
            /**
             * Restores an archived duplicate after administrator confirmation.
             *
             * @param imageId - Existing material-image identifier.
             * @returns Whether the archived image was restored.
             * @rejects When restoration fails.
             */
            onOwnerDeletedDuplicate: async (imageId) => {
              if (!window.confirm(t("web.materials.image.restoreConfirmation")))
                return false;
              await restoreCatalogImage({
                data: { imageId, targetType: "material" },
              });
              return true;
            },
            targetId: result.material.id,
            targetType: "material",
            materialSpecificId: uploadScope,
          });
          setFiles(uploads.failed);
          if (uploads.failed.length) {
            setFormError("web.materials.image.uploadFailed");
            return;
          }
          if (initialMaterial) {
            const refreshed = await getAdminMaterial({
              data: { materialId: initialMaterial.id },
            });
            if (refreshed) setExistingImages(refreshed.images);
          }
        } catch (error) {
          const uploadError = error as ImageUploadError;
          setFormError(uploadError.key ?? "web.materials.image.uploadFailed");
          return;
        }
      }
      if (!initialMaterial) {
        await navigate({
          params: { materialId: String(result.material.id) },
          to: "/admin/materials/$materialId/edit",
        });
        return;
      }
      setStatus(t("web.materials.admin.saved"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageShell
      breadcrumbItems={[
        {
          label: t("web.materials.admin.title"),
          to: "/admin/materials",
        },
      ]}
      section="materials"
      title={title}
    >
      <main className="grid w-full max-w-5xl gap-6 p-4 md:p-6">
        <div className="grid min-w-0 gap-5 rounded-xl border border-border bg-card p-5 lg:grid-cols-2">
          <div className="grid min-w-0 content-start gap-5">
            <label className="grid gap-2 text-sm font-medium">
              {t("web.catalog.field.name")}
              <Input
                maxLength={255}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
              <FieldError error={fieldErrors.name?.[0]} />
            </label>
            {initialMaterial ? (
              <div className="grid gap-2 text-sm font-medium">
                <label htmlFor="material-slug">
                  {t("web.catalog.field.slug")}
                </label>
                <Input
                  id="material-slug"
                  readOnly
                  value={slug}
                  aria-invalid={Boolean(fieldErrors.slug?.length)}
                />
                <FieldError error={fieldErrors.slug?.[0]} />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={updateSlug}
                    onChange={(event) => setUpdateSlug(event.target.checked)}
                  />
                  {t("web.materials.slug.update")}
                </label>
                {updateSlug ? (
                  <span className="text-xs text-muted-foreground">
                    {t("web.materials.slug.preview", {
                      url: `/materials/${slugify(name)}`,
                    })}
                  </span>
                ) : null}
                <span className="text-xs font-normal text-muted-foreground">
                  {t("web.materials.slug.help")}
                </span>
              </div>
            ) : null}
            <CatalogMarkdownEditor
              defaultValue={description}
              error={
                fieldErrors.description?.[0]
                  ? t(fieldErrors.description[0])
                  : undefined
              }
              help={t("web.catalog.help.markdownDescription")}
              id="material-description"
              label={t("web.catalog.field.description")}
              onChange={setDescription}
              onLoadingChange={setDescriptionLoading}
              ref={descriptionRef}
            />
          </div>
          <div className="grid min-w-0 content-start gap-5">
            {initialMaterial ? (
              <label className="grid gap-2 text-sm">
                {t("web.materials.image.scope")}
                <CatalogCombobox
                  ariaLabel={t("web.materials.image.scope")}
                  items={specifics}
                  value={specifics.find(({ id }) => id === uploadScope) ?? null}
                  placeholder={t("web.materials.image.generalScope")}
                  removeLabel={t("web.action.close")}
                  showSelectedPill
                  onValueChange={(value) =>
                    setUploadScope(value ? Number(value.id) : null)
                  }
                />
              </label>
            ) : null}
            <FileDropInput
              accept=".avif,.jpeg,.jpg,.png,.webp"
              aspectRatio={4 / 3}
              aspectRatioHelpHref="/help/image-size-and-resolution-guide"
              aspectRatioHelpLabel={imageGuidance.helpLabel}
              aspectRatioWarning={imageGuidance.warning}
              browseLabel={t("web.resources.upload.browseFiles")}
              description={t("web.materials.image.uploadHelp", {
                maxFileSize: formatMiB(maxImageBytes, locale),
                maxImages: maxImageSessionFiles,
                maxSessionSize: formatMiB(maxImageSessionBytes, locale),
              })}
              fileTypes={t("web.resources.upload.imageTypes")}
              files={files}
              id="material-images"
              label={t("web.resources.upload.imagesLabel")}
              multiple
              onFilesChange={(additions) =>
                setFiles((current) => [...current, ...additions])
              }
              onRemove={(index) =>
                setFiles((current) =>
                  current.filter((_, candidate) => candidate !== index),
                )
              }
              removeFileLabel={t("web.resources.action.removeFile")}
            />
            {initialMaterial ? (
              <div className="grid gap-5">
                {[
                  { id: null, name: t("web.materials.image.generalScope") },
                  ...specifics,
                ].map((scope) => (
                  <section className="grid gap-2" key={scope.id ?? "general"}>
                    <h3 className="text-sm font-semibold">{scope.name}</h3>
                    <MaterialImageEditor
                      images={existingImages.filter(
                        (image) =>
                          (image.materialSpecificId ?? null) === scope.id,
                      )}
                      materialId={initialMaterial.id}
                      materialSpecificId={scope.id}
                      specifics={specifics}
                      materialName={name || initialMaterial.name}
                      onChange={(images) =>
                        setExistingImages((current) => [
                          ...current.filter(
                            (image) =>
                              (image.materialSpecificId ?? null) !== scope.id,
                          ),
                          ...images,
                        ])
                      }
                      onRefresh={async () => {
                        const refreshed = await getAdminMaterial({
                          data: { materialId: initialMaterial.id },
                        });
                        if (refreshed) setExistingImages(refreshed.images);
                      }}
                      onError={setFormError}
                    />
                  </section>
                ))}
              </div>
            ) : null}
          </div>
          {initialMaterial ? (
            <section
              className="grid gap-3 lg:col-span-2"
              aria-label={t("web.materials.specific.title")}
            >
              <h2 className="font-semibold">
                {t("web.materials.specific.title")}
              </h2>
              {specifics.length ? (
                specifics.map((specific) => (
                  <div
                    className="flex items-center justify-between gap-2 border border-border p-3"
                    key={specific.id}
                  >
                    <span>{specific.name}</span>
                    <Button
                      variant="outline"
                      onClick={() => setEditingSpecific(specific)}
                    >
                      {t("web.action.edit")}
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("web.materials.specific.empty")}
                </p>
              )}
              <Button
                variant="outline"
                onClick={() => setEditingSpecific("new")}
              >
                {t("web.materials.specific.add")}
              </Button>
              {editingSpecific ? (
                <MaterialSpecificEditor
                  key={editingSpecific === "new" ? "new" : editingSpecific.id}
                  material={{ ...initialMaterial, name, slug }}
                  specific={
                    editingSpecific === "new" ? undefined : editingSpecific
                  }
                  onCancel={() => setEditingSpecific(null)}
                  onSaved={(saved) => {
                    setSpecifics((current) =>
                      [
                        ...current.filter(({ id }) => id !== saved.id),
                        saved,
                      ].sort((a, b) => a.name.localeCompare(b.name)),
                    );
                    setEditingSpecific(null);
                  }}
                />
              ) : null}
            </section>
          ) : null}
          {formError ? (
            <div
              className="rounded-lg border border-destructive p-4 text-destructive lg:col-span-2"
              role="alert"
            >
              {t(formError)}
            </div>
          ) : null}
          {status ? (
            <div
              className="rounded-lg border border-border bg-secondary p-4 text-secondary-foreground lg:col-span-2"
              role="status"
            >
              {status}
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 lg:col-span-2">
            <Link
              className={buttonVariants({ variant: "outline" })}
              to="/admin/materials"
            >
              {t("action.cancel")}
            </Link>
            <Button
              disabled={
                saving ||
                descriptionLoading ||
                !name.trim() ||
                description.length > 5000
              }
              onClick={() => void save()}
            >
              {t("action.save")}
            </Button>
          </div>
        </div>
      </main>
    </AdminPageShell>
  );
}

/**
 * Renders administrator archive and restore controls for material images.
 *
 * @param props - Material image editor properties.
 * @param props.images - Active and archived images.
 * @param props.materialName - Material name used in alternative text.
 * @param props.onChange - Receives updated image state.
 * @param props.onError - Receives a localized failure key.
 * @returns Material image controls.
 */
function MaterialImageEditor({
  materialId,
  materialSpecificId,
  specifics,
  onRefresh,
  images,
  materialName,
  onChange,
  onError,
}: {
  /** General material context retained by every image. */
  materialId: number;
  /** Exact scope being reordered. */
  materialSpecificId: number | null;
  /** Allowed destination scopes under this parent. */
  specifics: MaterialSpecific[];
  /**
   * Reloads canonical images after a scope move.
   * @returns Completion after canonical state reloads.
   */
  onRefresh(): Promise<void>;
  /** Active and archived images. */
  images: CatalogImage[];
  /** Material name used in alternative text. */
  materialName: string;
  /**
   * Receives updated image state.
   *
   * @param images - Updated active and archived images.
   * @returns Nothing.
   */
  onChange(images: CatalogImage[]): void;
  /**
   * Receives a localized failure key.
   *
   * @param error - Localized failure key.
   * @returns Nothing.
   */
  onError(error: string): void;
}) {
  const t = useCatalogCopy();
  if (!images.length)
    return (
      <p className="text-sm text-muted-foreground">
        {t("web.materials.image.empty")}
      </p>
    );

  return (
    <section
      aria-label={`${t("web.resources.upload.imagesLabel")}: ${materialSpecificId === null ? t("web.materials.image.generalScope") : specifics.find(({ id }) => id === materialSpecificId)?.name}`}
      className="grid gap-3"
    >
      {images.map((image) => {
        const archived = Boolean(image.deletedAt);
        return (
          <div
            className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg border border-border p-3"
            key={image.id}
          >
            <img
              alt={t("web.materials.image.alt", { name: materialName })}
              className="size-16 shrink-0 rounded-md object-cover"
              src={image.url}
            />
            <span className="min-w-0 flex-1 truncate text-sm">
              {image.fileName}
            </span>
            <CatalogCombobox
              ariaLabel={t("web.materials.image.move")}
              items={[
                { id: 0, name: t("web.materials.image.generalScope") },
                ...specifics,
              ]}
              value={
                specifics.find(({ id }) => id === image.materialSpecificId) ?? {
                  id: 0,
                  name: t("web.materials.image.generalScope"),
                }
              }
              placeholder={t("web.materials.image.move")}
              onValueChange={async (value) => {
                if (
                  !value ||
                  Number(value.id) === (image.materialSpecificId ?? 0)
                )
                  return;
                if (
                  !window.confirm(
                    t("web.materials.image.moveConfirmation", {
                      scope: value.name,
                    }),
                  )
                )
                  return;
                try {
                  const result = await moveAdminMaterialImage({
                    data: {
                      materialId,
                      imageId: image.id,
                      materialSpecificId: Number(value.id) || null,
                    },
                  });
                  if (!result.ok) {
                    onError(result.formError);
                    return;
                  }
                  await onRefresh();
                } catch {
                  onError("error.generic");
                }
              }}
            />
            {!archived
              ? ([-1, 1] as const).map((direction) => {
                  const active = images.filter(({ deletedAt }) => !deletedAt);
                  const index = active.findIndex(({ id }) => id === image.id);
                  return (
                    <Button
                      key={direction}
                      variant="outline"
                      size="sm"
                      aria-label={`${t("web.materials.image.move")} ${direction < 0 ? "↑" : "↓"} ${image.fileName}`}
                      disabled={
                        index + direction < 0 ||
                        index + direction >= active.length
                      }
                      onClick={async () => {
                        const next = [...active];
                        [next[index], next[index + direction]] = [
                          next[index + direction]!,
                          next[index]!,
                        ];
                        try {
                          await reorderAdminMaterialImages({
                            data: {
                              materialId,
                              materialSpecificId,
                              imageIds: next.map(({ id }) => id),
                            },
                          });
                          await onRefresh();
                        } catch {
                          onError("error.generic");
                        }
                      }}
                    >
                      {direction < 0 ? <ArrowUp /> : <ArrowDown />}
                    </Button>
                  );
                })
              : null}
            <Button
              aria-label={
                archived
                  ? t("web.materials.image.restore")
                  : t("web.action.deleteImage")
              }
              onClick={async () => {
                const confirmed = window.confirm(
                  t(
                    archived
                      ? "web.materials.image.restoreConfirmation"
                      : "web.materials.image.archiveConfirmation",
                  ),
                );
                if (!confirmed) return;
                try {
                  if (archived) {
                    await restoreCatalogImage({
                      data: { imageId: image.id, targetType: "material" },
                    });
                  } else {
                    await softDeleteCatalogImage({
                      data: { imageId: image.id, targetType: "material" },
                    });
                  }
                  onChange(
                    images.map((candidate) =>
                      candidate.id === image.id
                        ? {
                            ...candidate,
                            deletedAt: archived ? null : new Date(),
                            deletedByClerkId: null,
                            deletedByRole: archived ? null : "admin",
                          }
                        : candidate,
                    ),
                  );
                } catch {
                  onError("error.generic");
                }
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {archived ? <RotateCcw /> : <Trash2 />}
              {archived
                ? t("web.materials.image.restore")
                : t("web.action.deleteImage")}
            </Button>
          </div>
        );
      })}
    </section>
  );
}

/**
 * Edits one alloy or grade in read-only general material context.
 *
 * @param props - Parent, optional existing specific, and completion callbacks.
 * @returns Localized specific editor with stable-slug confirmation.
 */
function MaterialSpecificEditor({
  material,
  specific,
  onSaved,
  onCancel,
}: {
  /** Read-only general material context. */
  material: AdminMaterial;
  /** Existing specific, omitted for creation. */
  specific?: MaterialSpecific;
  /**
   * Receives the saved canonical specific.
   * @param specific - Saved canonical alloy or grade.
   */
  onSaved(specific: MaterialSpecific): void;
  /** Closes the transient editor. */
  onCancel(): void;
}) {
  const t = useCatalogCopy();
  const [name, setName] = React.useState(specific?.name ?? "");
  const [description, setDescription] = React.useState(
    specific?.description ?? "",
  );
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [updateSlug, setUpdateSlug] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[]>
  >({});
  const [error, setError] = React.useState<string | null>(null);
  return (
    <section className="grid gap-4 border border-border bg-card p-4">
      <h3 className="font-semibold">
        {t(
          specific
            ? "web.materials.specific.edit"
            : "web.materials.specific.add",
        )}
      </h3>
      <label className="grid gap-2 text-sm">
        {t("web.catalog.field.materials")}
        <Input readOnly value={material.name} />
      </label>
      <label className="grid gap-2 text-sm">
        {t("web.materials.specific.name")}
        <Input
          aria-invalid={Boolean(fieldErrors.name?.length)}
          value={name}
          maxLength={255}
          required
          onChange={(event) => setName(event.target.value)}
        />
        <FieldError error={fieldErrors.name?.[0]} />
      </label>
      {specific ? (
        <div className="grid gap-2 text-sm">
          <Input
            aria-label={t("web.catalog.field.slug")}
            readOnly
            aria-invalid={Boolean(fieldErrors.slug?.length)}
            value={specific.slug}
          />
          <FieldError error={fieldErrors.slug?.[0]} />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={updateSlug}
              onChange={(event) => setUpdateSlug(event.target.checked)}
            />
            {t("web.materials.slug.update")}
          </label>
          <p className="text-xs text-muted-foreground">
            {t("web.materials.slug.help")}
          </p>
          {updateSlug ? (
            <p>
              {t("web.materials.slug.preview", {
                url: `/materials/${material.slug}/${slugify(name)}`,
              })}
            </p>
          ) : null}
        </div>
      ) : null}
      <CatalogMarkdownEditor
        id={`specific-description-${specific?.id ?? "new"}`}
        defaultValue={description}
        label={t("web.catalog.field.description")}
        help={t("web.catalog.help.markdownDescription")}
        onChange={setDescription}
        onLoadingChange={setLoading}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t(error)}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          {t("action.cancel")}
        </Button>
        <Button
          disabled={
            saving || loading || !name.trim() || description.length > 5000
          }
          onClick={async () => {
            if (
              specific &&
              updateSlug &&
              slugify(name) !== specific.slug &&
              !window.confirm(
                t("web.materials.slug.confirmation", {
                  oldUrl: `/materials/${material.slug}/${specific.slug}`,
                  newUrl: `/materials/${material.slug}/${slugify(name)}`,
                }),
              )
            )
              return;
            setSaving(true);
            setError(null);
            setFieldErrors({});
            try {
              const result = await saveAdminMaterialSpecific({
                data: {
                  materialId: material.id,
                  specificId: specific?.id,
                  name,
                  description,
                  updateSlug,
                },
              });
              if (result.ok) onSaved(result.specific);
              else {
                setFieldErrors(result.fieldErrors);
                setError(result.formError ?? "error.generic");
              }
            } catch {
              setError("error.generic");
            } finally {
              setSaving(false);
            }
          }}
        >
          {t("action.save")}
        </Button>
      </div>
    </section>
  );
}

/**
 * Renders a localized field error.
 *
 * @param root0 - Field-error properties.
 * @param root0.error - Optional localized error key.
 * @returns The error message, or nothing when absent.
 */
function FieldError({ error }: { /** Translation key. */ error?: string }) {
  const t = useCatalogCopy();
  return error ? (
    <span className="text-sm font-normal text-destructive" role="alert">
      {t(error)}
    </span>
  ) : null;
}
