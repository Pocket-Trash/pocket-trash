import { useAuth } from "@clerk/tanstack-react-start";
import { faSpinnerScale } from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  maxImageBytes,
  maxResourceFileBytes,
  maxResourceFiles,
  maxResourceImages,
  maxResourceSessionBytes,
} from "@package/services/constants";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useForm, useStore } from "@tanstack/react-form";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ResourceCategoryInput } from "@/components/resource-category-input";
import {
  FileDropInput,
  ResourceFileInput,
} from "@/components/resource-file-input";
import { PublicResourceSwitch } from "@/components/resource-visibility-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useResourceUpload } from "@/hooks/use-resource-upload";
import {
  appendResourceUploadFiles,
  formatMiB,
  type ResourceUploadValidationError,
  validateResourceUpload,
} from "@/lib/upload-sessions";
import { useLocale } from "@/providers/locale-provider";

/**
 * Renders the resource creation and upload form.
 *
 * @returns The resource upload page.
 */
export function ResourceUploadPage() {
  const { userId } = useAuth();
  return <ResourceUploadForm key={userId} />;
}

/**
 * Owns one account's resource authoring draft and upload intent.
 * @returns Account-scoped resource upload form.
 */
function ResourceUploadForm() {
  const { locale } = useLocale();
  const { submitting, status: uploadStatus, startUpload } = useResourceUpload();
  /**
   * Formats localized resource upload copy.
   *
   * @param key - Localization key.
   * @param params - Values interpolated into the translation.
   * @returns The formatted translation.
   */
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);
  const form = useForm({
    defaultValues: {
      selectedCategories: [] as string[],
      files: [] as File[],
      imageFiles: [] as File[],
      isPublic: true,
    },
    onSubmitMeta: { name: "", description: "" },
    validators: {
      /**
       * Preserves category and file validation before starting an upload session.
       * @param input - Current resource authoring fields.
       * @returns Existing localized validation feedback.
       */
      onSubmit: ({ value }): ResourceUploadValidationError | undefined =>
        value.selectedCategories.length === 0
          ? { key: "web.resources.validation.requiredCategory" }
          : (validateResourceUpload(
              value.files,
              value.imageFiles,
              true,
              locale,
            ) ?? undefined),
    },
    /**
     * Reports existing validation feedback without discarding the selected files.
     * @param input - Invalid form and its current feedback.
     */
    onSubmitInvalid: ({ formApi }) => {
      const error = formApi.state.errorMap.onSubmit;
      if (error) toast.error(t(error.key, error.params));
    },
    /**
     * Captures native metadata and form-owned selections for one resource upload.
     * @param input - Validated selections and native metadata snapshot.
     */
    onSubmit: ({ value, meta }) => {
      startUpload({
        categories: value.selectedCategories,
        description: meta.description,
        files: value.files,
        images: value.imageFiles,
        isPrivate: !value.isPublic,
        name: meta.name,
        operation: "create",
      });
    },
  });
  const { selectedCategories, files, imageFiles, isPublic } = useStore(
    form.store,
    (state) => state.values,
  );

  return (
    <AppShell title={t("web.resources.add.title")}>
      <main className="mx-auto w-full max-w-2xl px-4 py-8 md:px-6">
        <form
          aria-busy={submitting}
          className="grid gap-6 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm md:p-7"
          encType="multipart/form-data"
          onSubmit={(event) => {
            event.preventDefault();
            if (submitting) return;
            const data = new FormData(event.currentTarget);
            form.setErrorMap({ onSubmit: undefined });
            void form.handleSubmit({
              name: String(data.get("name") ?? ""),
              description: String(data.get("description") ?? ""),
            });
          }}
        >
          <p className="m-0 text-sm leading-6 text-muted-foreground">
            {t("web.resources.upload.description")}
          </p>

          <Field
            htmlFor="resource-name"
            label={t("web.resources.upload.nameLabel")}
          >
            <Input
              id="resource-name"
              maxLength={120}
              name="name"
              placeholder={t("web.resources.upload.namePlaceholder")}
              required
            />
          </Field>

          <FileDropInput
            accept="image/avif,image/jpeg,image/png,image/webp"
            browseLabel={t("web.resources.upload.browseFiles")}
            description={t("web.resources.upload.imagesHelp", {
              maxFileSize: formatMiB(maxImageBytes, locale),
              maxImages: maxResourceImages,
              maxSessionSize: formatMiB(maxResourceSessionBytes, locale),
            })}
            disabled={submitting}
            files={imageFiles}
            fileTypes={t("web.resources.upload.imageTypes")}
            id="resource-images"
            label={t("web.resources.upload.imagesLabel")}
            multiple
            onFilesChange={(additions) =>
              form.setFieldValue("imageFiles", (current) =>
                appendResourceUploadFiles(current, additions),
              )
            }
            onRemove={(index) =>
              form.setFieldValue("imageFiles", (current) =>
                current.filter((_, itemIndex) => itemIndex !== index),
              )
            }
            removeFileLabel={t("web.resources.action.removeFile")}
          />

          <Field
            htmlFor="resource-description"
            label={t("web.resources.upload.descriptionLabel")}
          >
            <textarea
              className="min-h-32 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              id="resource-description"
              maxLength={5000}
              name="description"
              placeholder={t("web.resources.upload.descriptionPlaceholder")}
              required
            />
          </Field>

          <ResourceFileInput
            browseLabel={t("web.resources.upload.browseFiles")}
            description={t("web.resources.upload.fileHelp", {
              maxFileSize: formatMiB(maxResourceFileBytes, locale),
              maxFiles: maxResourceFiles,
              maxSessionSize: formatMiB(maxResourceSessionBytes, locale),
            })}
            disabled={submitting}
            files={files}
            fileTypes={t("web.resources.upload.fileTypes")}
            id="resource-file"
            label={t("web.resources.upload.filesLabel")}
            onFilesChange={(files) => form.setFieldValue("files", files)}
            removeFileLabel={t("web.resources.action.removeFile")}
          />

          <ResourceCategoryInput
            disabled={submitting}
            label={t("web.resources.category.label")}
            noResultsLabel={t("web.resources.category.noResults")}
            onChange={(categories) =>
              form.setFieldValue("selectedCategories", categories)
            }
            placeholder={t("web.resources.category.search")}
            removeLabel={(category) =>
              t("web.resources.category.remove", { category })
            }
            selected={selectedCategories}
          />

          <PublicResourceSwitch
            checked={isPublic}
            disabled={submitting}
            onCheckedChange={(checked) =>
              form.setFieldValue("isPublic", checked)
            }
          />

          <Button disabled={submitting} type="submit">
            {submitting ? (
              <FontAwesomeIcon
                aria-hidden="true"
                className="animate-spin"
                icon={faSpinnerScale}
              />
            ) : null}
            {t("web.resources.action.add")}
          </Button>
          <p aria-live="polite" className="m-0 text-sm text-muted-foreground">
            {uploadStatus}
          </p>
        </form>
      </main>
    </AppShell>
  );
}

/**
 * Renders one labeled resource upload field.
 *
 * @param props - Upload field properties.
 * @param props.children - Field control.
 * @param props.description - Optional supporting description.
 * @param props.htmlFor - Identifier of the labeled control.
 * @param props.label - Visible field label.
 * @returns The labeled upload field.
 */
function Field({
  children,
  description,
  htmlFor,
  label,
}: {
  /** Field control. */
  children: React.ReactNode;
  /** Optional supporting description. */
  description?: string;
  /** Identifier of the labeled control. */
  htmlFor: string;
  /** Visible field label. */
  label: string;
}) {
  return (
    <div className="grid gap-2 text-sm font-medium">
      <label htmlFor={htmlFor}>{label}</label>
      {description ? (
        <span className="text-xs leading-5 font-normal text-muted-foreground">
          {description}
        </span>
      ) : null}
      {children}
    </div>
  );
}
