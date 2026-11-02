import { useAuth } from "@clerk/tanstack-react-start";
import {
  faFileArrowUp,
  faPlus,
  faSpinnerScale,
  faTrash,
  faXmark,
} from "@fortawesome/pro-light-svg-icons";
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
import { Link, useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { toast } from "sonner";
import { type EffectEntity, useEffectReducer } from "use-effect-reducer";
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
import { useResourceUpload } from "@/hooks/use-resource-upload";
import type { getResourceDetail, listOwnedResources } from "@/lib/resources";
import { updateResource } from "@/lib/resources";
import {
  appendResourceUploadFiles,
  formatMiB,
  type ResourceUploadValidationError,
  validateResourceImages,
  validateResourceUpload,
} from "@/lib/upload-sessions";
import { useLocale } from "@/providers/locale-provider";

/** A resource owned by the signed-in user. */
type OwnedResource = Awaited<ReturnType<typeof listOwnedResources>>[number];
/** Resource detail returned by the resource service. */
type ResourceDetail = NonNullable<
  Awaited<ReturnType<typeof getResourceDetail>>
>;

/**
 * Renders the signed-in user's resource management index.
 *
 * @param props - Resource management properties.
 * @param props.resources - Owned resources to display.
 * @returns The resource management page.
 */
export function ResourceManagementPage({
  resources,
}: {
  /** Owned resources to display. */
  resources: OwnedResource[];
}) {
  const { locale } = useLocale();
  /**
   * Formats localized resource management copy.
   *
   * @param key - Localization key.
   * @param params - Values interpolated into the translation.
   * @returns The formatted translation.
   */
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  return (
    <UserPageShell
      contentClassName="p-0"
      section="resources"
      title={t("web.resources.management.title")}
    >
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
              <FontAwesomeIcon aria-hidden="true" icon={faTrash} />
              {t("web.resources.trash.ownerTitle")}
            </Button>
            <Button nativeButton={false} render={<Link to="/resources/add" />}>
              <FontAwesomeIcon aria-hidden="true" icon={faPlus} />
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
    </UserPageShell>
  );
}

/**
 * Renders resource editing and version upload tabs.
 *
 * @param props - Resource edit page properties.
 * @param props.detail - Resource detail being edited.
 * @returns The resource edit page.
 */
export function ResourceEditPage({
  detail,
}: {
  /** Resource detail being edited. */
  detail: ResourceDetail;
}) {
  const { locale } = useLocale();
  const { userId } = useAuth();
  /**
   * Formats localized resource edit copy.
   *
   * @param key - Localization key.
   * @param params - Values interpolated into the translation.
   * @returns The formatted translation.
   */
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  return (
    <UserPageShell
      section="resources"
      title={t("web.resources.management.editResources")}
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
          <ResourceEditForm key={`${detail.id}:${userId}`} detail={detail} />
        </TabsContent>
        <TabsContent value="version">
          <ResourceVersionUploadForm
            key={`${detail.id}:${userId}`}
            detail={detail}
          />
        </TabsContent>
      </Tabs>
    </UserPageShell>
  );
}

/** Pending captured resource metadata save. */
type ResourceMetadataState =
  | EffectEntity<ResourceMetadataState, ResourceMetadataEvent>
  | undefined;
/** Metadata save intent and terminal cleanup. */
type ResourceMetadataEvent =
  | {
      /** Requests one validated metadata edit. */
      type: "requested";
      /** Captured existing multipart wire payload. */
      data: FormData;
    }
  | {
      /** Stops a completed or failed edit. */
      type: "finished";
    };
/** Committed existing multipart metadata mutation. */
type ResourceMetadataEffect = {
  /** Save implementation. */
  type: "save";
  /** Captured multipart wire payload. */
  data: FormData;
};

/**
 * Renders editable resource metadata, visibility, and images.
 *
 * @param props - Resource edit form properties.
 * @param props.detail - Resource detail being edited.
 * @returns The resource edit form.
 */
function ResourceEditForm({
  detail,
}: {
  /** Resource detail being edited. */
  detail: ResourceDetail;
}) {
  const { locale } = useLocale();
  const navigate = useNavigate();
  /**
   * Formats localized resource edit copy.
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
      selectedCategories: detail.categories.map(({ name }) => name),
      imageFiles: [] as File[],
      retainedImageIds: detail.images.map(({ id }) => id),
    },
    onSubmitMeta: { data: undefined as FormData | undefined },
    validators: {
      /**
       * Preserves categories and retained/new image validation before metadata mutation.
       * @param input - Current metadata selections.
       * @returns Existing localized validation feedback.
       */
      onSubmit: ({ value }): ResourceUploadValidationError | undefined =>
        value.selectedCategories.length === 0
          ? { key: "web.resources.validation.requiredCategory" }
          : (validateResourceImages(
              value.imageFiles,
              value.retainedImageIds.length + value.imageFiles.length,
              true,
              locale,
            ) ?? undefined),
    },
    /**
     * Reports existing validation feedback without discarding retained or new images.
     * @param input - Invalid form and current validation result.
     */
    onSubmitInvalid: ({ formApi }) => {
      const error = formApi.state.errorMap.onSubmit;
      if (error) toast.error(t(error.key, error.params));
    },
    /**
     * Completes the existing multipart payload from validated form-owned selections.
     * @param input - Validated selections and captured native metadata.
     */
    onSubmit: ({ value, meta }) => {
      if (!meta.data) return;
      const data = meta.data;
      data.delete("categories");
      value.selectedCategories.forEach((category) =>
        data.append("categories", category),
      );
      value.retainedImageIds.forEach((id) =>
        data.append("retainedImageIds", String(id)),
      );
      value.imageFiles.forEach((image) => data.append("images", image));
      dispatch({ type: "requested", data });
    },
  });
  const { selectedCategories, imageFiles, retainedImageIds } = useStore(
    form.store,
    (state) => state.values,
  );
  const task = useRef<{
    /** Descriptor whose mutation must not replay. */
    effect: ResourceMetadataEffect;
    /** Server completion retained across suspended observers. */
    promise: ReturnType<typeof updateResource>;
  } | null>(null);
  const [save, dispatch] = useEffectReducer<
    ResourceMetadataState,
    ResourceMetadataEvent,
    ResourceMetadataEffect
  >(
    (state, event, exec) => {
      if (event.type === "requested")
        return state ?? exec({ type: "save", data: event.data });
      exec.stop(state);
      return undefined;
    },
    undefined,
    {
      /**
       * Observes one metadata edit without publishing disposed account/resource feedback.
       * @param _state - Current save lifetime.
       * @param effect - Captured multipart edit.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current observer lifetime.
       */
      save: (_state, effect, dispatch, { signal }) => {
        if (task.current?.effect !== effect)
          task.current = {
            effect,
            promise: updateResource({ data: effect.data }),
          };
        void task.current.promise.then(
          () => {
            if (signal.aborted) return;
            dispatch({ type: "finished" });
            void navigate({
              params: { resourceId: String(detail.id) },
              to: "/resources/$resourceId",
            });
          },
          () => {
            if (signal.aborted) return;
            dispatch({ type: "finished" });
            toast.error(t("web.resources.error.editFailed"));
          },
        );
      },
    },
  );
  const submitting = Boolean(save);

  return (
    <form
      className="grid gap-6 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm md:p-7"
      onSubmit={(event) => {
        event.preventDefault();
        if (submitting) return;
        const data = new FormData(event.currentTarget);
        form.setErrorMap({ onSubmit: undefined });
        void form.handleSubmit({ data });
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
                  form.setFieldValue("retainedImageIds", (current) =>
                    current.filter((id) => id !== image.id),
                  )
                }
                size="icon"
                type="button"
                variant="secondary"
              >
                <FontAwesomeIcon aria-hidden="true" icon={faXmark} />
              </Button>
            </div>
          ))}
      </div>
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
        id="edit-resource-images"
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
        onChange={(categories) =>
          form.setFieldValue("selectedCategories", categories)
        }
        placeholder={t("web.resources.category.search")}
        removeLabel={(category) =>
          t("web.resources.category.remove", { category })
        }
        selected={selectedCategories}
      />

      {!detail.isOwner ? (
        <label className="grid gap-2 text-sm font-medium">
          {t("web.resources.moderation.reasonLabel")}
          <textarea
            className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            maxLength={1000}
            name="reason"
            placeholder={t("web.resources.moderation.reasonPlaceholder")}
            required
          />
        </label>
      ) : null}

      <Button disabled={submitting} type="submit">
        {t("web.resources.action.saveChanges")}
      </Button>
    </form>
  );
}

/**
 * Renders the standalone resource version upload page.
 *
 * @param props - Version upload page properties.
 * @param props.detail - Resource receiving the new version.
 * @returns The resource version upload page.
 */
export function ResourceVersionUploadPage({
  detail,
}: {
  /** Resource receiving the new version. */
  detail: ResourceDetail;
}) {
  const { locale } = useLocale();
  const { userId } = useAuth();
  /**
   * Formats localized version upload copy.
   *
   * @param key - Localization key.
   * @param params - Values interpolated into the translation.
   * @returns The formatted translation.
   */
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  return (
    <UserPageShell
      section="resources"
      title={t("web.resources.upload.newVersionTitle", { name: detail.name })}
    >
      <ResourceVersionUploadForm
        key={`${detail.id}:${userId}`}
        detail={detail}
      />
    </UserPageShell>
  );
}

/**
 * Renders the resource version upload form.
 *
 * @param props - Version upload form properties.
 * @param props.detail - Resource receiving the new version.
 * @returns The resource version upload form.
 */
function ResourceVersionUploadForm({
  detail,
}: {
  /** Resource receiving the new version. */
  detail: ResourceDetail;
}) {
  const { locale } = useLocale();
  const { submitting, status: uploadStatus, startUpload } = useResourceUpload();
  /**
   * Formats localized version upload copy.
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
    defaultValues: { files: [] as File[], reason: "" },
    validators: {
      /**
       * Preserves version-file validation and cross-owner staff reasons.
       * @param input - Current selected files and reason.
       * @returns Existing localized validation feedback.
       */
      onSubmit: ({ value }): ResourceUploadValidationError | undefined =>
        !detail.isOwner && !value.reason.trim()
          ? { key: "web.resources.moderation.reasonRequired" }
          : (validateResourceUpload(value.files, [], false, locale) ??
            undefined),
    },
    /**
     * Reports existing file/reason validation without discarding selections.
     * @param input - Invalid form and current feedback.
     */
    onSubmitInvalid: ({ formApi }) => {
      const error = formApi.state.errorMap.onSubmit;
      if (error) toast.error(t(error.key, error.params));
    },
    /**
     * Starts one validated version upload using the current reason contract.
     * @param input - Validated files and reason.
     */
    onSubmit: ({ value }) => {
      startUpload({
        files: value.files,
        operation: "version",
        reason: value.reason || undefined,
        resourceId: detail.id,
      });
    },
  });
  const { files, reason } = useStore(form.store, (state) => state.values);

  return (
    <form
      aria-busy={submitting}
      className="grid gap-6 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm md:p-7"
      onSubmit={(event) => {
        event.preventDefault();
        if (submitting) return;
        form.setErrorMap({ onSubmit: undefined });
        void form.handleSubmit();
      }}
    >
      {!detail.isOwner ? (
        <label className="grid gap-2 text-sm font-medium">
          {t("web.resources.moderation.reasonLabel")}
          <textarea
            className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            maxLength={1000}
            onChange={(event) =>
              form.setFieldValue("reason", event.currentTarget.value)
            }
            placeholder={t("web.resources.moderation.reasonPlaceholder")}
            required
            value={reason}
          />
        </label>
      ) : null}
      <ResourceFileInput
        browseLabel={t("web.resources.upload.browseFiles")}
        description={t("web.resources.upload.fileHelp", {
          maxFiles: maxResourceFiles,
          maxFileSize: formatMiB(maxResourceFileBytes, locale),
          maxSessionSize: formatMiB(maxResourceSessionBytes, locale),
        })}
        disabled={submitting}
        files={files}
        fileTypes={t("web.resources.upload.fileTypes")}
        id="resource-version-file"
        label={t("web.resources.upload.filesLabel")}
        onFilesChange={(files) => form.setFieldValue("files", files)}
        removeFileLabel={t("web.resources.action.removeFile")}
      />
      <Button disabled={submitting} type="submit">
        {submitting ? (
          <FontAwesomeIcon
            aria-hidden="true"
            className="animate-spin"
            icon={faSpinnerScale}
          />
        ) : (
          <FontAwesomeIcon aria-hidden="true" icon={faFileArrowUp} />
        )}
        {t("web.resources.action.uploadNewVersion")}
      </Button>
      <p aria-live="polite" className="m-0 text-sm text-muted-foreground">
        {uploadStatus}
      </p>
    </form>
  );
}
