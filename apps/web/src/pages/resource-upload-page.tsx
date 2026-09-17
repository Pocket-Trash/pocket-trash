import { useAuth } from "@clerk/tanstack-react-start";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
import {
  getResourceUploadErrorTranslation,
  uploadResourceSession,
  validateResourceUpload,
} from "@/lib/resource-upload-sessions";
import { useLocale } from "@/providers/locale-provider";

export function ResourceUploadPage() {
  const { getToken } = useAuth();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [previewFiles, setPreviewFiles] = useState<File[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  return (
    <AppShell title={t("web.resources.add.title" as TranslationKey)}>
      <main className="mx-auto w-full max-w-2xl px-4 py-8 md:px-6">
        <form
          className="grid gap-6 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm md:p-7"
          encType="multipart/form-data"
          onSubmit={async (event) => {
            event.preventDefault();
            if (selectedCategories.length === 0) {
              toast.error(t("web.resources.validation.requiredCategory"));
              return;
            }

            const formData = new FormData(event.currentTarget);
            const preview = previewFiles[0];
            const validation = validateResourceUpload(files, preview);
            if (validation) {
              toast.error(t(validation.key, validation.params));
              return;
            }

            setSubmitting(true);
            setUploadStatus("");
            try {
              const result = await uploadResourceSession({
                categories: selectedCategories,
                description: String(formData.get("description") ?? ""),
                files,
                getToken,
                isPrivate: !isPublic,
                name: String(formData.get("name") ?? ""),
                onProgress: (filename, percent) =>
                  setUploadStatus(
                    t("web.resources.upload.progress", { filename, percent }),
                  ),
                onStage: (stage) => {
                  if (stage === "complete") {
                    setUploadStatus(t("web.resources.upload.finalizing"));
                  }
                },
                operation: "create",
                preview,
              });
              toast.success(t("web.resources.upload.success"));
              await navigate({
                params: { resourceId: String(result.resourceId) },
                to: "/resources/$resourceId",
              });
            } catch (error) {
              const message = getResourceUploadErrorTranslation(error);
              toast.error(t(message.key, message.params));
            } finally {
              setSubmitting(false);
              setUploadStatus("");
            }
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
            accept="image/jpeg,image/png,image/webp"
            browseLabel={t(
              "web.resources.upload.browseFiles" as TranslationKey,
            )}
            description={t("web.resources.upload.previewHelp")}
            disabled={submitting}
            files={previewFiles}
            fileTypes={t("web.resources.upload.previewTypes")}
            id="resource-preview"
            label={t("web.resources.upload.previewLabel")}
            onFilesChange={setPreviewFiles}
            onRemove={() => setPreviewFiles([])}
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
            browseLabel={t(
              "web.resources.upload.browseFiles" as TranslationKey,
            )}
            description={t("web.resources.upload.fileHelp", {
              maxFileSize: "20 MiB",
              maxFiles: 10,
              maxSessionSize: "50 MiB",
            })}
            disabled={submitting}
            files={files}
            fileTypes={t("web.resources.upload.fileTypes")}
            id="resource-file"
            label={t("web.resources.upload.filesLabel")}
            onFilesChange={setFiles}
            removeFileLabel={t("web.resources.action.removeFile")}
          />

          <ResourceCategoryInput
            disabled={submitting}
            label={t("web.resources.category.label")}
            noResultsLabel={t("web.resources.category.noResults")}
            onChange={setSelectedCategories}
            placeholder={t("web.resources.category.search")}
            removeLabel={(category) =>
              t("web.resources.category.remove", { category })
            }
            selected={selectedCategories}
          />

          <PublicResourceSwitch
            checked={isPublic}
            disabled={submitting}
            onCheckedChange={setIsPublic}
          />

          <Button disabled={submitting} type="submit">
            {t("web.resources.action.add" as TranslationKey)}
          </Button>
          <p aria-live="polite" className="m-0 text-sm text-muted-foreground">
            {uploadStatus}
          </p>
        </form>
      </main>
    </AppShell>
  );
}

function Field({
  children,
  description,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  description?: string;
  htmlFor: string;
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
