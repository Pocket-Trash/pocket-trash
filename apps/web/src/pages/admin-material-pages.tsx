import { useAuth } from "@clerk/tanstack-react-start";
import type {
  AdminMaterial,
  AdminMaterialSummary,
  CatalogImage,
} from "@package/services";
import {
  maxImageBytes,
  maxImageSessionBytes,
  maxImageSessionFiles,
} from "@package/services/constants";
import { Link, useNavigate } from "@tanstack/react-router";
import { RotateCcw, Trash2 } from "lucide-react";
import * as React from "react";
import { AdminPageShell } from "@/components/admin-page-shell";
import { CatalogMarkdownEditor } from "@/components/catalog-markdown-editor";
import type { MarkdownEditorHandle } from "@/components/markdown-editor";
import { FileDropInput } from "@/components/resource-file-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getAdminMaterial,
  restoreCatalogImage,
  saveAdminMaterial,
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
    setSaving(true);
    try {
      const result = await saveAdminMaterial({
        data: {
          description,
          materialId: initialMaterial?.id ?? null,
          name,
        },
      });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setFormError(result.formError);
        return;
      }
      setFieldErrors({});
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
              <label className="grid gap-2 text-sm font-medium">
                {t("web.catalog.field.slug")}
                <Input readOnly value={initialMaterial.slug} />
                <span className="text-xs font-normal text-muted-foreground">
                  {t("web.materials.admin.slugHelp")}
                </span>
              </label>
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
              <MaterialImageEditor
                images={existingImages}
                materialName={name || initialMaterial.name}
                onChange={setExistingImages}
                onError={setFormError}
              />
            ) : null}
          </div>
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
  images,
  materialName,
  onChange,
  onError,
}: {
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
      aria-label={t("web.resources.upload.imagesLabel")}
      className="grid gap-3"
    >
      {images.map((image) => {
        const archived = Boolean(image.deletedAt);
        return (
          <div
            className="flex min-w-0 items-center gap-3 rounded-lg border border-border p-3"
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
