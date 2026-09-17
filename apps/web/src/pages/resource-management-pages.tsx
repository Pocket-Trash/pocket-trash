import { useAuth } from "@clerk/tanstack-react-start";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link, useNavigate } from "@tanstack/react-router";
import { FileUp, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ResourceCategoryInput } from "@/components/resource-category-input";
import {
  FileDropInput,
  ResourceFileInput,
} from "@/components/resource-file-input";
import { ResourceVisibilityToggle } from "@/components/resource-visibility-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPageShell } from "@/components/user-page-shell";
import {
  getResourceUploadErrorTranslation,
  uploadResourceSession,
  validateResourceUpload,
} from "@/lib/resource-upload-sessions";
import type { getResourceDetail, listOwnedResources } from "@/lib/resources";
import { updateResource } from "@/lib/resources";
import { useLocale } from "@/providers/locale-provider";

type OwnedResource = Awaited<ReturnType<typeof listOwnedResources>>[number];
type ResourceDetail = NonNullable<
  Awaited<ReturnType<typeof getResourceDetail>>
>;

export function ResourceManagementPage({
  resources,
}: {
  resources: OwnedResource[];
}) {
  const { locale } = useLocale();
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  return (
    <UserPageShell title={t("web.resources.management.title")}>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="m-0 text-sm text-muted-foreground">
            {t("web.resources.management.description")}
          </p>
          <Button nativeButton={false} render={<Link to="/resources/add" />}>
            <Plus />
            {t("web.resources.action.add" as TranslationKey)}
          </Button>
        </div>

        {resources.length === 0 ? (
          <p className="m-0 rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            {t("web.resources.management.empty")}
          </p>
        ) : (
          <div className="grid gap-4">
            {resources.map((resource) => (
              <Link
                className="relative grid gap-2 rounded-lg border border-border bg-card p-5 pr-24 text-card-foreground shadow-sm transition-transform hover:-translate-y-0.5 hover:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                key={resource.id}
                params={{ resourceId: String(resource.id) }}
                to="/resources/$resourceId"
              >
                <Badge
                  className="absolute top-4 right-4"
                  variant={resource.isPrivate ? "secondary" : "destructive"}
                >
                  {resource.isPrivate
                    ? t("web.resources.visibility.private" as TranslationKey)
                    : t("web.resources.visibility.public" as TranslationKey)}
                </Badge>
                <h2 className="m-0 truncate text-lg font-semibold">
                  {resource.name}
                </h2>
                {resource.privateReason ? (
                  <span className="text-sm text-muted-foreground">
                    {t("web.resources.moderation.privateReason", {
                      reason: resource.privateReason,
                    })}
                  </span>
                ) : null}
                <p className="m-0 text-sm text-muted-foreground">
                  {t("web.resources.detail.version", {
                    version: resource.version,
                  })}
                  {" · "}
                  {t("web.resources.detail.updatedOn", {
                    date: new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                    }).format(new Date(resource.updatedAt)),
                  })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </UserPageShell>
  );
}

export function ResourceEditPage({ detail }: { detail: ResourceDetail }) {
  const { locale } = useLocale();
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  return (
    <UserPageShell
      title={t("web.resources.management.editResources" as TranslationKey)}
    >
      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">
            {t("web.resources.action.edit")}
          </TabsTrigger>
          <TabsTrigger value="version">
            {t("web.resources.action.uploadNewVersion")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="edit">
          <ResourceEditForm detail={detail} />
        </TabsContent>
        <TabsContent value="version">
          <ResourceVersionUploadForm detail={detail} />
        </TabsContent>
      </Tabs>
    </UserPageShell>
  );
}

function ResourceEditForm({ detail }: { detail: ResourceDetail }) {
  const { locale } = useLocale();
  const navigate = useNavigate();
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);
  const [selectedCategories, setSelectedCategories] = useState(
    detail.categories.map(({ name }) => name),
  );
  const [previewFiles, setPreviewFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="grid gap-6 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm md:p-7"
      onSubmit={async (event) => {
        event.preventDefault();
        if (selectedCategories.length === 0) {
          toast.error(t("web.resources.validation.requiredCategory"));
          return;
        }
        setSubmitting(true);
        try {
          const formData = new FormData(event.currentTarget);
          if (previewFiles[0]) formData.set("preview", previewFiles[0]);
          await updateResource({ data: formData });
          await navigate({
            params: { resourceId: String(detail.id) },
            to: "/resources/$resourceId",
          });
        } catch {
          toast.error(t("web.resources.error.editFailed"));
          setSubmitting(false);
        }
      }}
    >
      <p className="m-0 text-sm text-muted-foreground">
        {t("web.resources.management.editDescription")}
      </p>
      <ResourceVisibilityToggle
        canAdminister={detail.canAdminister}
        isAdminPrivate={detail.isAdminPrivate}
        isOwner={detail.isOwner}
        isPrivate={detail.isPrivate}
        name={detail.name}
        resourceId={detail.id}
      />
      <input name="resourceId" type="hidden" value={detail.id} />

      <label
        className="grid gap-2 text-sm font-medium"
        htmlFor="edit-resource-name"
      >
        {t("web.resources.upload.nameLabel")}
        <Input
          defaultValue={detail.name}
          id="edit-resource-name"
          maxLength={120}
          name="name"
          required
        />
      </label>

      {detail.previewImageUrl ? (
        <img
          alt={t("web.resources.detail.previewAlt", { name: detail.name })}
          className="aspect-4/3 w-40 rounded-md border border-border object-cover"
          src={detail.previewImageUrl}
        />
      ) : null}
      <FileDropInput
        accept="image/jpeg,image/png,image/webp"
        browseLabel={t("web.resources.upload.browseFiles" as TranslationKey)}
        description={t("web.resources.upload.previewHelp")}
        disabled={submitting}
        files={previewFiles}
        fileTypes={t("web.resources.upload.previewTypes")}
        id="edit-resource-preview"
        label={t("web.resources.upload.previewLabel")}
        onFilesChange={setPreviewFiles}
        onRemove={() => setPreviewFiles([])}
        removeFileLabel={t("web.resources.action.removeFile")}
      />

      <label
        className="grid gap-2 text-sm font-medium"
        htmlFor="edit-resource-description"
      >
        {t("web.resources.upload.descriptionLabel")}
        <textarea
          className="min-h-32 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          defaultValue={detail.description}
          id="edit-resource-description"
          maxLength={5000}
          name="description"
          required
        />
      </label>

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

      <Button disabled={submitting} type="submit">
        {t("web.resources.action.saveChanges")}
      </Button>
    </form>
  );
}

export function ResourceVersionUploadPage({
  detail,
}: {
  detail: ResourceDetail;
}) {
  const { locale } = useLocale();
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  return (
    <UserPageShell
      title={t("web.resources.upload.newVersionTitle", { name: detail.name })}
    >
      <ResourceVersionUploadForm detail={detail} />
    </UserPageShell>
  );
}

function ResourceVersionUploadForm({ detail }: { detail: ResourceDetail }) {
  const { getToken } = useAuth();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  return (
    <form
      className="grid gap-6 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm md:p-7"
      onSubmit={async (event) => {
        event.preventDefault();
        const validation = validateResourceUpload(files);
        if (validation) {
          toast.error(t(validation.key, validation.params));
          return;
        }

        setSubmitting(true);
        setUploadStatus("");
        try {
          const result = await uploadResourceSession({
            files,
            getToken,
            onProgress: (filename, percent) =>
              setUploadStatus(
                t("web.resources.upload.progress", { filename, percent }),
              ),
            onStage: (stage) => {
              if (stage === "complete") {
                setUploadStatus(t("web.resources.upload.finalizing"));
              }
            },
            operation: "version",
            resourceId: detail.id,
          });
          toast.success(
            t("web.resources.upload.versionSuccess", {
              version: result.version,
            }),
          );
          await navigate({
            params: { resourceId: String(result.resourceId) },
            to: "/resources/$resourceId",
          });
        } catch (error) {
          const message = getResourceUploadErrorTranslation(error);
          toast.error(t(message.key, message.params));
          setSubmitting(false);
          setUploadStatus("");
        }
      }}
    >
      <ResourceFileInput
        browseLabel={t("web.resources.upload.browseFiles" as TranslationKey)}
        description={t("web.resources.upload.fileHelp", {
          maxFiles: 10,
          maxFileSize: "20 MiB",
          maxSessionSize: "50 MiB",
        })}
        disabled={submitting}
        files={files}
        fileTypes={t("web.resources.upload.fileTypes")}
        id="resource-version-file"
        label={t("web.resources.upload.filesLabel")}
        onFilesChange={setFiles}
        removeFileLabel={t("web.resources.action.removeFile")}
      />
      <Button disabled={submitting} type="submit">
        <FileUp />
        {t("web.resources.action.uploadNewVersion")}
      </Button>
      <p aria-live="polite" className="m-0 text-sm text-muted-foreground">
        {uploadStatus}
      </p>
    </form>
  );
}
