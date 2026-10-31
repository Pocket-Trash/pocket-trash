import { useAuth } from "@clerk/tanstack-react-start";
import {
  faArrowDown,
  faArrowRotateLeft,
  faArrowUp,
  faTrash,
} from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
import { useForm, useStore } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import React from "react";
import { type EffectEntity, useEffectReducer } from "use-effect-reducer";
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

/** Explicit material image administration intent. */
type MaterialImageAction =
  | {
      /** Moves one image to another specific/general scope. */
      kind: "move";
      /** Selected image. */
      imageId: number;
      /** Destination scope. */
      materialSpecificId: number | null;
    }
  | {
      /** Reorders the current active scope. */
      kind: "reorder";
      /** Current scope. */
      materialSpecificId: number | null;
      /** Complete active image order. */
      imageIds: number[];
    }
  | {
      /** Toggles one image's archived state. */
      kind: "archive";
      /** Selected persisted image and previous archive state. */
      image: CatalogImage;
    };
/** Confirmed image action captured by its material authoring owner. */
type MaterialImageEffect = {
  /** Image administration implementation. */
  type: "imageActionRequested";
  /** Confirmed image operation. */
  action: MaterialImageAction;
};

/** Existing material form feedback normalized by TanStack Form. */
type MaterialValidation = {
  /** Existing localized form failure key. */
  form?: string;
  /** Existing schema/server field failures. */
  fields?: Record<string, string | undefined>;
};
/** Captured material profile and upload values. */
type MaterialDraft = {
  /** Current Markdown description. */
  description: string;
  /** Current material name. */
  name: string;
  /** Whether a stable slug change was confirmed. */
  updateSlug: boolean;
  /** Files captured for upload after metadata is saved. */
  files: File[];
  /** Selected parent-specific image scope. */
  uploadScope: number | null;
};
/** Material editor lifecycle and explicit selection state. */
type MaterialEditorState = {
  /** Current material-wide image operation, serialized with metadata saves. */
  imageRequest:
    | EffectEntity<MaterialEditorState, MaterialEditorEvent>
    | undefined;
  /** Editor initialization state. */
  loading: boolean;
  /** Canonical material specifics. */
  specifics: MaterialSpecific[];
  /** Current specific editor identity. */
  editing: MaterialSpecific | "new" | null;
  /** Pending material save. */
  save: EffectEntity<MaterialEditorState, MaterialEditorEvent> | undefined;
  /** Whether the existing saved message is visible. */
  saved: boolean;
};
/** Material draft readiness, specific selection, and save intent. */
type MaterialEditorEvent =
  | MaterialImageEffect
  | {
      /** Stops a completed image operation. */
      type: "imageActionFinished";
    }
  | {
      /** Receives Markdown readiness. */
      type: "editorLoadingChanged";
      /** Current loading state. */
      loading: boolean;
    }
  | {
      /** Selects or dismisses a specific editor. */
      type: "specificSelected";
      /** Current specific identity or create mode. */
      specific: MaterialSpecific | "new" | null;
    }
  | {
      /** Receives a durably saved specific. */
      type: "specificSaved";
      /** Canonical saved specific. */
      specific: MaterialSpecific;
    }
  | {
      /** Starts one validated material save. */
      type: "saveRequested";
      /** Captured profile and upload fields. */
      value: MaterialDraft;
    }
  | {
      /** Stops a terminal save. */
      type: "saveFinished";
      /** Whether every save stage completed. */
      success: boolean;
    };
/** Confirmed material save descriptor. */
type MaterialEditorEffect =
  | Extract<
      MaterialEditorEvent,
      {
        /** Captured intent discriminant. */
        type: "saveRequested";
      }
    >
  | MaterialImageEffect;
/** Retained material write/upload outcome without observer side effects. */
type MaterialSaveOutcome = {
  /** Validation or upload failure when a stage failed. */
  error?: MaterialValidation;
  /** Canonical material identity created or updated before upload. */
  materialId?: number;
  /** Canonical stable slug after metadata save. */
  slug?: string;
  /** Failed captured files retained for retry. */
  failedFiles?: File[];
  /** Canonical images reloaded after uploads. */
  images?: CatalogImage[];
};

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
  const { userId } = useAuth();
  return (
    <AdminMaterialForm
      key={`${userId}:${initialMaterial?.id ?? "new"}`}
      initialMaterial={initialMaterial}
    />
  );
}

/**
 * Owns one administrator/material draft and its committed save stages.
 * @param props - Existing material profile.
 * @returns Scoped material authoring controls.
 */
function AdminMaterialForm({
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
  const savedMaterialId = React.useRef(initialMaterial?.id ?? null);
  const form = useForm({
    defaultValues: {
      description: initialMaterial?.description ?? "",
      name: initialMaterial?.name ?? "",
      slug: initialMaterial?.slug ?? "",
      updateSlug: false,
      files: [] as File[],
      existingImages: initialMaterial?.images ?? [],
      uploadScope: null as number | null,
    },
    validators: {
      /**
       * Keeps profile eligibility and image validation in the authoring form.
       * @param input - Current material and upload fields.
       * @returns Existing localized feedback when invalid.
       */
      onSubmit: ({ value }): MaterialValidation | undefined => {
        if (!value.name.trim() || value.description.length > 5000)
          return { form: "web.catalog.error.form" };
        const error = validateImages(value.files, locale);
        return error ? { form: error.key } : undefined;
      },
    },
    /**
     * Confirms a stable slug change and captures the validated authoring intent.
     * @param input - Current material and upload fields.
     */
    onSubmit: ({ value }) => {
      if (ui.loading || ui.save) return;
      if (
        initialMaterial &&
        value.updateSlug &&
        slugify(value.name) !== value.slug &&
        !window.confirm(
          `${t("web.materials.slug.confirmation", { oldUrl: `/materials/${value.slug}`, newUrl: `/materials/${slugify(value.name)}` })} ${t("web.materials.slug.affected", { count: ui.specifics.length })}`,
        )
      )
        return;
      dispatch({ type: "saveRequested", value });
    },
  });
  const {
    description,
    name,
    slug,
    updateSlug,
    files,
    existingImages,
    uploadScope,
  } = useStore(form.store, (state) => state.values);
  const fieldErrors = useStore(form.store, (state) => state.fieldMeta);
  const formFeedback = useStore(form.store, (state) => state.errorMap.onSubmit);
  const formError =
    typeof formFeedback === "string" ? formFeedback : formFeedback?.form;
  const canSave = useStore(
    form.store,
    (state) =>
      !state.isSubmitting &&
      Boolean(state.values.name.trim()) &&
      state.values.description.length <= 5000,
  );
  const task = React.useRef<{
    /** Descriptor whose save must not replay. */
    effect: Extract<
      MaterialEditorEffect,
      {
        /** Captured intent discriminant. */
        type: "saveRequested";
      }
    >;
    /** Metadata and upload completion retained across suspension. */
    promise: Promise<MaterialSaveOutcome>;
  } | null>(null);
  const observer = React.useRef<{
    /** Current save descriptor. */
    effect: Extract<
      MaterialEditorEffect,
      {
        /** Captured intent discriminant. */
        type: "saveRequested";
      }
    >;
    /** Current visible observer lifetime. */
    signal: AbortSignal;
  } | null>(null);
  const imageTask = React.useRef<{
    /** Captured operation whose mutation must not replay. */
    effect: MaterialImageEffect;
    /** Serialized operation identity retained after a refresh failure. */
    key: string;
    /** Durable mutation acknowledgement. */
    mutation: Promise<string | undefined>;
    /** Whether the server write committed. */
    committed?: boolean;
    /** Current canonical image reload. */
    refresh?: Promise<CatalogImage[] | undefined>;
  } | null>(null);
  const [ui, dispatch] = useEffectReducer<
    MaterialEditorState,
    MaterialEditorEvent,
    MaterialEditorEffect
  >(
    (state, event, exec) => {
      switch (event.type) {
        case "imageActionRequested":
          return state.save || state.imageRequest
            ? state
            : { ...state, imageRequest: exec(event) };
        case "imageActionFinished":
          exec.stop(state.imageRequest);
          return { ...state, imageRequest: undefined };
        case "editorLoadingChanged":
          return state.loading === event.loading
            ? state
            : { ...state, loading: event.loading };
        case "specificSelected":
          return { ...state, editing: event.specific };
        case "specificSaved":
          return {
            ...state,
            editing: null,
            specifics: [
              ...state.specifics.filter(({ id }) => id !== event.specific.id),
              event.specific,
            ].sort((a, b) => a.name.localeCompare(b.name)),
          };
        case "saveRequested":
          return state.loading || state.save || state.imageRequest
            ? state
            : { ...state, saved: false, save: exec(event) };
        case "saveFinished":
          exec.stop(state.save);
          return { ...state, save: undefined, saved: event.success };
      }
    },
    {
      imageRequest: undefined,
      loading: true,
      specifics: initialMaterial?.specifics ?? [],
      editing: null,
      save: undefined,
      saved: false,
    },
    {
      /**
       * Serializes image administration and reloads canonical images without replaying writes.
       * @param _state - Current material controls.
       * @param effect - Confirmed scope/order/archive operation.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current account observer lifetime.
       */
      imageActionRequested: (_state, effect, dispatch, { signal }) => {
        if (!initialMaterial) return;
        const previous = imageTask.current;
        const key = JSON.stringify(effect.action);
        if (previous?.effect !== effect)
          imageTask.current = {
            effect,
            key,
            committed: previous?.key === key && previous.committed,
            mutation:
              previous?.key === key && previous.committed
                ? previous.mutation
                : (async (): Promise<string | undefined> => {
                    try {
                      const action = effect.action;
                      if (action.kind === "move") {
                        const result = await moveAdminMaterialImage({
                          data: {
                            materialId: initialMaterial.id,
                            imageId: action.imageId,
                            materialSpecificId: action.materialSpecificId,
                          },
                        });
                        if (!result.ok) return result.formError;
                      } else if (action.kind === "reorder")
                        await reorderAdminMaterialImages({
                          data: {
                            materialId: initialMaterial.id,
                            materialSpecificId: action.materialSpecificId,
                            imageIds: action.imageIds,
                          },
                        });
                      else
                        await (action.image.deletedAt
                          ? restoreCatalogImage
                          : softDeleteCatalogImage)({
                          data: {
                            imageId: action.image.id,
                            targetType: "material",
                          },
                        });
                      return undefined;
                    } catch {
                      return "error.generic";
                    }
                  })(),
          };
        const task = imageTask.current;
        if (!task) return;
        void task.mutation.then(async (error) => {
          task.committed = !error;
          if (signal.aborted) return;
          if (!error) {
            task.refresh ??= getAdminMaterial({
              data: { materialId: initialMaterial.id },
            }).then(
              (material) => material?.images,
              () => undefined,
            );
            const images = await task.refresh;
            if (signal.aborted) return;
            if (images) form.setFieldValue("existingImages", images);
            else error = "error.generic";
          }
          dispatch({ type: "imageActionFinished" });
          if (error) form.setErrorMap({ onSubmit: { form: error } });
        });
      },
      /**
       * Saves metadata before scoped images and retains service results across Activity.
       * @param _state - Current editor and specific selection state.
       * @param effect - Captured material fields and pending files.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current account observer lifetime.
       * @returns Cleanup detaching interactive duplicate confirmation.
       */
      saveRequested: (_state, effect, dispatch, { signal }) => {
        const currentObserver = { effect, signal };
        observer.current = currentObserver;
        if (task.current?.effect !== effect)
          task.current = {
            effect,
            promise: (async (): Promise<MaterialSaveOutcome> => {
              let metadata: MaterialSaveOutcome = {};
              try {
                const result = await saveAdminMaterial({
                  data: {
                    description: effect.value.description,
                    materialId: savedMaterialId.current,
                    name: effect.value.name,
                    updateSlug: effect.value.updateSlug,
                  },
                });
                if (!result.ok)
                  return {
                    error: {
                      form: result.formError,
                      fields: Object.fromEntries(
                        Object.entries(result.fieldErrors).map(
                          ([name, errors]) => [
                            name,
                            Array.isArray(errors) ? errors[0] : undefined,
                          ],
                        ),
                      ),
                    },
                  };
                savedMaterialId.current = result.material.id;
                metadata = {
                  materialId: result.material.id,
                  slug: result.material.slug,
                };
                if (effect.value.files.length) {
                  const uploads = await uploadImages({
                    files: effect.value.files,
                    getToken,
                    locale,
                    targetId: result.material.id,
                    targetType: "material",
                    materialSpecificId: effect.value.uploadScope,
                    /**
                     * Confirms a duplicate only while its current account observer is active.
                     * @param imageId - Archived material image identifier.
                     * @returns Whether the archived image was restored.
                     * @rejects When restoration fails.
                     */
                    onOwnerDeletedDuplicate: async (imageId) => {
                      if (
                        observer.current?.effect !== effect ||
                        observer.current.signal.aborted ||
                        !window.confirm(
                          t("web.materials.image.restoreConfirmation"),
                        )
                      )
                        return false;
                      await restoreCatalogImage({
                        data: { imageId, targetType: "material" },
                      });
                      return true;
                    },
                  });
                  metadata.failedFiles = uploads.failed;
                  if (uploads.failed.length)
                    return {
                      ...metadata,
                      error: { form: "web.materials.image.uploadFailed" },
                    };
                  if (initialMaterial) {
                    const refreshed = await getAdminMaterial({
                      data: { materialId: result.material.id },
                    });
                    metadata.images = refreshed?.images;
                  }
                }
                return metadata;
              } catch (error) {
                return {
                  ...metadata,
                  error: {
                    form:
                      (error as ImageUploadError).key ??
                      "web.materials.image.uploadFailed",
                  },
                };
              }
            })(),
          };
        void task.current.promise.then((outcome) => {
          if (signal.aborted) return;
          dispatch({ type: "saveFinished", success: !outcome.error });
          if (outcome.slug !== undefined) {
            form.setFieldValue("slug", outcome.slug);
            form.setFieldValue("updateSlug", false);
          }
          const failedFiles = outcome.failedFiles;
          if (failedFiles)
            form.setFieldValue("files", (current) => [
              ...current.filter((file) => !effect.value.files.includes(file)),
              ...failedFiles,
            ]);
          if (outcome.images)
            form.setFieldValue("existingImages", outcome.images);
          if (outcome.error) form.setErrorMap({ onSubmit: outcome.error });
          else if (!initialMaterial && outcome.materialId)
            void navigate({
              params: { materialId: String(outcome.materialId) },
              to: "/admin/materials/$materialId/edit",
            });
        });
        return () => {
          if (observer.current === currentObserver) observer.current = null;
        };
      },
    },
  );
  /**
   * Receives readiness through the stable legacy Markdown callback contract.
   * @param loading - Whether editor initialization is pending.
   */
  const receiveDescriptionLoading = React.useCallback(
    (loading: boolean) => dispatch({ type: "editorLoadingChanged", loading }),
    [dispatch],
  );
  const descriptionLoading = ui.loading;
  const saving = Boolean(ui.save || ui.imageRequest);
  const specifics = ui.specifics;
  const editingSpecific = ui.editing;
  const status = ui.saved ? t("web.materials.admin.saved") : null;
  const imageGuidance = getImageUploadGuidance(locale);
  const title = initialMaterial
    ? t("web.materials.admin.editTitle")
    : t("web.materials.admin.addTitle");

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
                onChange={(event) =>
                  form.setFieldValue("name", event.target.value)
                }
                required
                value={name}
              />
              <FieldError error={fieldErrors.name?.errors[0]} />
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
                  aria-invalid={Boolean(fieldErrors.slug?.errors.length)}
                />
                <FieldError error={fieldErrors.slug?.errors[0]} />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={updateSlug}
                    onChange={(event) =>
                      form.setFieldValue("updateSlug", event.target.checked)
                    }
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
                fieldErrors.description?.errors[0]
                  ? t(fieldErrors.description.errors[0])
                  : undefined
              }
              help={t("web.catalog.help.markdownDescription")}
              id="material-description"
              label={t("web.catalog.field.description")}
              onChange={(value) => form.setFieldValue("description", value)}
              onLoadingChange={receiveDescriptionLoading}
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
                    form.setFieldValue(
                      "uploadScope",
                      value ? Number(value.id) : null,
                    )
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
                form.setFieldValue("files", (current) => [
                  ...current,
                  ...additions,
                ])
              }
              onRemove={(index) =>
                form.setFieldValue("files", (current) =>
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
                      materialSpecificId={scope.id}
                      specifics={specifics}
                      materialName={name || initialMaterial.name}
                      disabled={saving}
                      onAction={(action) => {
                        form.setErrorMap({
                          onSubmit: { form: "", fields: {} },
                        });
                        dispatch({ type: "imageActionRequested", action });
                      }}
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
                      onClick={() =>
                        dispatch({ type: "specificSelected", specific })
                      }
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
                onClick={() =>
                  dispatch({ type: "specificSelected", specific: "new" })
                }
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
                  onCancel={() =>
                    dispatch({ type: "specificSelected", specific: null })
                  }
                  onSaved={(specific) =>
                    dispatch({ type: "specificSaved", specific })
                  }
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
              disabled={saving || descriptionLoading || !canSave}
              onClick={() => {
                form.setErrorMap({ onSubmit: { form: "", fields: {} } });
                void form.handleSubmit();
              }}
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
  materialSpecificId,
  specifics,
  disabled,
  onAction,
  images,
  materialName,
}: {
  /** Exact scope being reordered. */
  materialSpecificId: number | null;
  /** Allowed destination scopes under this parent. */
  specifics: MaterialSpecific[];
  /** Whether a material-wide save/image action is pending. */
  disabled: boolean;
  /**
   * Requests one confirmed image administration action.
   * @param action - Captured scope/order/archive intent.
   */
  onAction(action: MaterialImageAction): void;
  /** Active and archived images. */
  images: CatalogImage[];
  /** Material name used in alternative text. */
  materialName: string;
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
              disabled={disabled}
              onValueChange={(value) => {
                if (
                  disabled ||
                  !value ||
                  Number(value.id) === (image.materialSpecificId ?? 0)
                )
                  return;
                if (
                  window.confirm(
                    t("web.materials.image.moveConfirmation", {
                      scope: value.name,
                    }),
                  )
                )
                  onAction({
                    kind: "move",
                    imageId: image.id,
                    materialSpecificId: Number(value.id) || null,
                  });
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
                        disabled ||
                        index + direction < 0 ||
                        index + direction >= active.length
                      }
                      onClick={() => {
                        const next = [...active];
                        const destination = next[index + direction];
                        const selected = next[index];
                        if (disabled || !destination || !selected) return;
                        next[index] = destination;
                        next[index + direction] = selected;
                        onAction({
                          kind: "reorder",
                          materialSpecificId,
                          imageIds: next.map(({ id }) => id),
                        });
                      }}
                    >
                      <FontAwesomeIcon
                        aria-hidden="true"
                        icon={direction < 0 ? faArrowUp : faArrowDown}
                      />
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
              disabled={disabled}
              onClick={() => {
                if (
                  !disabled &&
                  window.confirm(
                    t(
                      archived
                        ? "web.materials.image.restoreConfirmation"
                        : "web.materials.image.archiveConfirmation",
                    ),
                  )
                )
                  onAction({ kind: "archive", image });
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <FontAwesomeIcon
                aria-hidden="true"
                icon={archived ? faArrowRotateLeft : faTrash}
              />
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

/** Material-specific editor readiness and confirmed save. */
type SpecificEditorState = {
  /** Current Markdown readiness. */
  loading: boolean;
  /** Pending canonical-specific save. */
  save: EffectEntity<SpecificEditorState, SpecificEditorEvent> | undefined;
};
/** Specific editor readiness and explicit save intent. */
type SpecificEditorEvent =
  | {
      /** Receives current Markdown readiness. */
      type: "editorLoadingChanged";
      /** Whether editor initialization is pending. */
      loading: boolean;
    }
  | {
      /** Requests one confirmed specific save. */
      type: "saveRequested";
      /** Captured specific name. */
      name: string;
      /** Captured Markdown description. */
      description: string;
      /** Whether stable-slug replacement was confirmed. */
      updateSlug: boolean;
    }
  | {
      /** Stops a completed specific mutation. */
      type: "saveFinished";
    };
/** Captured specific save descriptor. */
type SpecificEditorEffect = Extract<
  SpecificEditorEvent,
  {
    /** Captured intent discriminant. */
    type: "saveRequested";
  }
>;

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
  const form = useForm({
    defaultValues: {
      name: specific?.name ?? "",
      description: specific?.description ?? "",
      updateSlug: false,
      slug: specific?.slug ?? "",
    },
    validators: {
      /**
       * Keeps existing required-name and Markdown-size eligibility in the form.
       * @param input - Current specific fields.
       * @returns Existing global feedback when invalid.
       */
      onSubmit: ({ value }): MaterialValidation | undefined =>
        !value.name.trim() || value.description.length > 5000
          ? { form: "web.catalog.error.form" }
          : undefined,
    },
    /**
     * Confirms stable URL replacement before queueing one specific mutation.
     * @param input - Validated specific fields.
     */
    onSubmit: ({ value }) => {
      if (ui.loading || ui.save) return;
      if (
        specific &&
        value.updateSlug &&
        slugify(value.name) !== specific.slug &&
        !window.confirm(
          t("web.materials.slug.confirmation", {
            oldUrl: `/materials/${material.slug}/${specific.slug}`,
            newUrl: `/materials/${material.slug}/${slugify(value.name)}`,
          }),
        )
      )
        return;
      dispatch({
        type: "saveRequested",
        name: value.name,
        description: value.description,
        updateSlug: value.updateSlug,
      });
    },
  });
  const { name, description, updateSlug } = useStore(
    form.store,
    (state) => state.values,
  );
  const fieldErrors = useStore(form.store, (state) => state.fieldMeta);
  const feedback = useStore(form.store, (state) => state.errorMap.onSubmit);
  const error = typeof feedback === "string" ? feedback : feedback?.form;
  const canSave = useStore(
    form.store,
    (state) =>
      !state.isSubmitting &&
      Boolean(state.values.name.trim()) &&
      state.values.description.length <= 5000,
  );
  const task = React.useRef<{
    /** Descriptor whose mutation must not replay. */
    effect: SpecificEditorEffect;
    /** Retained canonical result or existing validation feedback. */
    promise: Promise<{
      /** Canonical specific on success. */
      specific?: MaterialSpecific;
      /** Existing form/field feedback on failure. */
      error?: MaterialValidation;
    }>;
  } | null>(null);
  const [ui, dispatch] = useEffectReducer<
    SpecificEditorState,
    SpecificEditorEvent,
    SpecificEditorEffect
  >(
    (state, event, exec) => {
      if (event.type === "editorLoadingChanged")
        return state.loading === event.loading
          ? state
          : { ...state, loading: event.loading };
      if (event.type === "saveRequested")
        return state.loading || state.save
          ? state
          : { ...state, save: exec(event) };
      exec.stop(state.save);
      return { ...state, save: undefined };
    },
    { loading: true, save: undefined },
    {
      /**
       * Observes one canonical-specific write through this selected editor lifetime.
       * @param _state - Current readiness/save controls.
       * @param effect - Captured validated fields.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current observer lifetime.
       */
      saveRequested: (_state, effect, dispatch, { signal }) => {
        if (task.current?.effect !== effect)
          task.current = {
            effect,
            promise: Promise.resolve()
              .then(() =>
                saveAdminMaterialSpecific({
                  data: {
                    materialId: material.id,
                    specificId: specific?.id,
                    name: effect.name,
                    description: effect.description,
                    updateSlug: effect.updateSlug,
                  },
                }),
              )
              .then(
                (result) =>
                  result.ok
                    ? { specific: result.specific }
                    : {
                        error: {
                          form: result.formError ?? "error.generic",
                          fields: Object.fromEntries(
                            Object.entries(result.fieldErrors).map(
                              ([name, errors]) => [
                                name,
                                Array.isArray(errors) ? errors[0] : undefined,
                              ],
                            ),
                          ),
                        },
                      },
                () => ({ error: { form: "error.generic" } }),
              ),
          };
        void task.current.promise.then((result) => {
          if (signal.aborted) return;
          dispatch({ type: "saveFinished" });
          if (result.error) form.setErrorMap({ onSubmit: result.error });
          else if (result.specific) onSaved(result.specific);
        });
      },
    },
  );
  /**
   * Receives editor readiness without changing the legacy callback identity.
   * @param loading - Whether Markdown initialization is pending.
   */
  const receiveLoading = React.useCallback(
    (loading: boolean) => dispatch({ type: "editorLoadingChanged", loading }),
    [dispatch],
  );
  const loading = ui.loading;
  const saving = Boolean(ui.save);

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
          aria-invalid={Boolean(fieldErrors.name?.errors.length)}
          value={name}
          maxLength={255}
          required
          onChange={(event) => form.setFieldValue("name", event.target.value)}
        />
        <FieldError error={fieldErrors.name?.errors[0]} />
      </label>
      {specific ? (
        <div className="grid gap-2 text-sm">
          <Input
            aria-label={t("web.catalog.field.slug")}
            readOnly
            aria-invalid={Boolean(fieldErrors.slug?.errors.length)}
            value={specific.slug}
          />
          <FieldError error={fieldErrors.slug?.errors[0]} />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={updateSlug}
              onChange={(event) =>
                form.setFieldValue("updateSlug", event.target.checked)
              }
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
        onChange={(value) => form.setFieldValue("description", value)}
        onLoadingChange={receiveLoading}
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
          disabled={saving || loading || !canSave}
          onClick={() => {
            form.setErrorMap({ onSubmit: { form: "", fields: {} } });
            void form.handleSubmit();
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
