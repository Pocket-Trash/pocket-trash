import { useAuth } from "@clerk/tanstack-react-start";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link, useNavigate } from "@tanstack/react-router";
import { FileUp, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ResourceCard } from "@/components/resource-card";
import { ResourceCategoryInput } from "@/components/resource-category-input";
import {
  FileDropInput,
  ResourceFileInput,
} from "@/components/resource-file-input";
import { ResourceVisibilityToggle } from "@/components/resource-visibility-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPageShell } from "@/components/user-page-shell";
import {
  appendResourceUploadFiles,
  getResourceUploadErrorTranslation,
  uploadResourceSession,
  validateResourceImages,
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
    <AppShell sidebarContent={null} title={t("web.resources.management.title")}>
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="m-0 text-sm text-muted-foreground">
            {t("web.resources.management.description")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              nativeButton={false}
              render={<Link to="/user/resources/trash" />}
              variant="outline"
            >
              <Trash2 />
              {t("web.resources.trash.ownerTitle")}
            </Button>
            <Button nativeButton={false} render={<Link to="/resources/add" />}>
              <Plus />
              {t("web.resources.action.add")}
            </Button>
          </div>
        </div>

        {resources.length === 0 ? (
          <p className="m-0 rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            {t("web.resources.management.empty")}
          </p>
        ) : (
          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {resources.map((resource) => (
              <ResourceCard
                key={resource.id}
                mode="owned"
                resource={resource}
              />
            ))}
          </section>
        )}
      </main>
    </AppShell>
  );
}

export function ResourceEditPage({ detail }: { detail: ResourceDetail }) {
  const { locale } = useLocale();
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  return (
    <UserPageShell title={t("web.resources.management.editResources")}>
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
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [retainedImageIds, setRetainedImageIds] = useState(
    detail.images.map(({ id }) => id),
  );
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
        const imageValidation = validateResourceImages(
          imageFiles,
          retainedImageIds.length + imageFiles.length,
        );
        if (imageValidation) {
          toast.error(t(imageValidation.key, imageValidation.params));
          return;
        }
        setSubmitting(true);
        try {
          const formData = new FormData(event.currentTarget);
          retainedImageIds.forEach((id) => {
            formData.append("retainedImageIds", String(id));
          });
          imageFiles.forEach((image) => {
            formData.append("images", image);
          });
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {detail.images
          .filter(({ id }) => retainedImageIds.includes(id))
          .map((image) => (
            <div className="relative" key={image.id}>
              <img
                alt={t("web.resources.detail.imageAlt", {
                  name: detail.name,
                })}
                className="aspect-4/3 w-full rounded-md border border-border object-cover"
                src={image.url}
              />
              <Button
                aria-label={`${t("web.resources.action.removeFile")} ${image.fileName}`}
                className="absolute top-2 right-2"
                onClick={() =>
                  setRetainedImageIds(
                    retainedImageIds.filter((id) => id !== image.id),
                  )
                }
                size="icon"
                type="button"
                variant="secondary"
              >
                <X />
              </Button>
            </div>
          ))}
      </div>
      <FileDropInput
        accept="image/jpeg,image/png,image/webp"
        browseLabel={t("web.resources.upload.browseFiles")}
        description={t("web.resources.upload.imagesHelp", {
          maxFileSize: "20 MiB",
          maxImages: 10,
          maxSessionSize: "100 MiB",
        })}
        disabled={submitting}
        files={imageFiles}
        fileTypes={t("web.resources.upload.imageTypes")}
        id="edit-resource-images"
        label={t("web.resources.upload.imagesLabel")}
        multiple
        onFilesChange={(additions) =>
          setImageFiles(appendResourceUploadFiles(imageFiles, additions))
        }
        onRemove={(index) =>
          setImageFiles(
            imageFiles.filter((_, itemIndex) => itemIndex !== index),
          )
        }
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
      aria-busy={submitting}
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
        browseLabel={t("web.resources.upload.browseFiles")}
        description={t("web.resources.upload.fileHelp", {
          maxFiles: 10,
          maxFileSize: "20 MiB",
          maxSessionSize: "100 MiB",
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
        {submitting ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <FileUp />
        )}
        {t("web.resources.action.uploadNewVersion")}
      </Button>
      <p aria-live="polite" className="m-0 text-sm text-muted-foreground">
        {uploadStatus}
      </p>
    </form>
  );
}
