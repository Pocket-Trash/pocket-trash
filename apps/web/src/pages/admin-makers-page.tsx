import { useAuth } from "@clerk/tanstack-react-start";
import {
  faArrowRotateLeft,
  faIndustry,
  faPencil,
  faTrash,
} from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
import { useForm, useStore } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useCallback, useRef } from "react";
import { toast } from "sonner";
import { type EffectEntity, useEffectReducer } from "use-effect-reducer";
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
                    <FontAwesomeIcon
                      aria-hidden="true"
                      className="size-8"
                      icon={faIndustry}
                    />
                    <span className="sr-only">
                      {t("web.admin.makers.imagesEmpty")}
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <FontAwesomeIcon
                    aria-hidden="true"
                    className="mt-0.5 size-5"
                    icon={faIndustry}
                  />
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
                  <FontAwesomeIcon aria-hidden="true" icon={faPencil} />
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

/** Maker schema/form feedback normalized by TanStack Form. */
type MakerValidation = {
  /** Existing global error key. */
  form?: string;
  /** Existing per-field error keys. */
  fields?: Partial<Record<"name" | "rootUrl" | "description", string>>;
};
/** Maker failure feedback and any captured files still needing upload. */
type MakerSaveOutcome = MakerValidation & {
  /** Failed captured uploads retained for retry. */
  failedImages?: File[];
};
/** Maker profile save and editor readiness. */
type MakerEditorState = {
  /** Whether Markdown initialization is pending. */
  loading: boolean;
  /** Captured profile save lifetime. */
  save: EffectEntity<MakerEditorState, MakerEditorEvent> | undefined;
};
/** Maker-specific editor and save intent. */
type MakerEditorEvent =
  | {
      /** Receives editor readiness. */
      type: "editorLoadingChanged";
      /** Current editor loading state. */
      loading: boolean;
    }
  | {
      /** Submits one validated maker profile. */
      type: "saveRequested";
      /** Existing profile wire values. */
      values: {
        /** Existing profile description. */
        description: string;
        /** Existing maker identity. */
        makerId: number | null;
        /** Existing name. */
        name: string;
        /** Existing root URL. */
        rootUrl: string;
      };
      /** Pending image files captured at submission. */
      images: File[];
    }
  | {
      /** Stops a completed profile save. */
      type: "saveFinished";
    };
/** One confirmed maker profile save. */
type MakerEditorEffect = Extract<
  MakerEditorEvent,
  {
    /** Captured intent discriminant. */
    type: "saveRequested";
  }
>;

/**
 * Renders the maker profile create or edit form.
 *
 * @param props - Maker form properties.
 * @param props.maker - Existing maker profile, or `undefined` for creation.
 * @returns The maker profile form page.
 */
export function AdminMakerFormPage({ maker }: AdminMakerFormPageProperties) {
  const { userId } = useAuth();
  return (
    <AdminMakerForm key={`${userId}:${maker?.id ?? "new"}`} maker={maker} />
  );
}

/**
 * Owns one account/maker profile draft and committed save.
 * @param props - Existing maker profile.
 * @returns Scoped maker authoring form.
 */
function AdminMakerForm({ maker }: AdminMakerFormPageProperties) {
  const { getToken } = useAuth();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const form = useForm({
    defaultValues: {
      name: maker?.name ?? "",
      rootUrl: maker?.rootUrl ?? "",
      description: maker?.description ?? "",
      images: [] as File[],
      existingImages: maker?.images ?? [],
    },
    validators: {
      /**
       * Validates the existing maker profile before any write starts.
       * @param input - Current maker fields.
       * @returns Existing localized form and field feedback.
       */
      onSubmit: ({ value }): MakerValidation | undefined => {
        const result = makerProfileSchema.safeParse({
          ...value,
          makerId: savedMakerId.current,
        });
        if (!result.success)
          return {
            form: "web.catalog.error.form",
            fields: Object.fromEntries(
              Object.entries(result.error.flatten().fieldErrors).map(
                ([name, errors]) => [
                  name,
                  Array.isArray(errors) ? errors[0] : undefined,
                ],
              ),
            ),
          };
        return undefined;
      },
    },
    /**
     * Captures one validated profile save and selected uploads.
     * @param input - Current form values.
     */
    onSubmit: ({ value }) => {
      dispatch({
        type: "saveRequested",
        values: {
          name: value.name,
          rootUrl: value.rootUrl,
          description: value.description,
          makerId: savedMakerId.current,
        },
        images: value.images,
      });
    },
  });
  const { name, rootUrl, description, images, existingImages } = useStore(
    form.store,
    (state) => state.values,
  );
  const fieldErrors = useStore(form.store, (state) => state.fieldMeta);
  const formError = useStore(form.store, (state) => state.errorMap.onSubmit);
  const savedMakerId = useRef(maker?.id ?? null);
  const task = useRef<{
    /** Descriptor whose profile mutation must not replay. */
    effect: MakerEditorEffect;
    /** Server and upload result retained while suspended. */
    promise: Promise<MakerSaveOutcome | undefined>;
  } | null>(null);
  const [ui, dispatch] = useEffectReducer<
    MakerEditorState,
    MakerEditorEvent,
    MakerEditorEffect
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
       * Saves metadata before images and retains a created identity after upload failure.
       * @param _state - Current editor/save controls.
       * @param effect - Validated maker metadata and captured uploads.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current account observer lifetime.
       */
      saveRequested: (_state, effect, dispatch, { signal }) => {
        if (task.current?.effect !== effect)
          task.current = {
            effect,
            promise: (async (): Promise<MakerSaveOutcome | undefined> => {
              try {
                const result = await saveAdminMaker({
                  data: { ...effect.values, makerId: savedMakerId.current },
                });
                if (!result.ok)
                  return {
                    form: result.formError,
                    fields: Object.fromEntries(
                      Object.entries(result.fieldErrors).map(
                        ([name, errors]) => [
                          name,
                          Array.isArray(errors) ? errors[0] : undefined,
                        ],
                      ),
                    ),
                  };
                savedMakerId.current = result.maker.id;
                if (effect.images.length) {
                  const uploads = await uploadImages({
                    files: effect.images,
                    getToken,
                    locale,
                    targetId: result.maker.id,
                    targetType: "maker",
                  });
                  if (uploads.failed.length)
                    return {
                      form: "web.catalog.error.form",
                      failedImages: uploads.failed,
                    };
                }
                return undefined;
              } catch {
                return { form: "web.catalog.error.form" };
              }
            })(),
          };
        void task.current.promise.then((error) => {
          if (signal.aborted) return;
          dispatch({ type: "saveFinished" });
          if (error) {
            const failed = error.failedImages;
            if (failed)
              form.setFieldValue("images", (current) => [
                ...current.filter((file) => !effect.images.includes(file)),
                ...failed,
              ]);
            form.setErrorMap({ onSubmit: error });
          } else void navigate({ to: "/admin/makers" });
        });
      },
    },
  );
  /**
   * Receives editor readiness through the stable legacy editor callback contract.
   * @param loading - Whether Markdown is initializing.
   */
  const receiveEditorLoading = useCallback(
    (loading: boolean) => dispatch({ type: "editorLoadingChanged", loading }),
    [dispatch],
  );
  const editorLoading = ui.loading;
  const busy = Boolean(ui.save);
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
   * Returns the first localized error for one maker field.
   *
   * @param field - Maker form field name.
   * @returns The localized error, or `undefined` when valid.
   */
  function errorFor(field: "name" | "rootUrl" | "description") {
    const key = fieldErrors[field]?.errors[0];
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
        <form
          className="grid max-w-2xl gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (busy || editorLoading) return;
            form.setErrorMap({ onSubmit: { form: "", fields: {} } });
            void form.handleSubmit();
          }}
        >
          <MakerField
            error={errorFor("name")}
            label={t("web.catalog.field.name")}
          >
            <Input
              aria-invalid={Boolean(errorFor("name"))}
              disabled={busy}
              maxLength={200}
              onChange={(event) =>
                form.setFieldValue("name", event.target.value)
              }
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
              onChange={(event) =>
                form.setFieldValue("rootUrl", event.target.value)
              }
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
            onChange={(value) => form.setFieldValue("description", value)}
            onLoadingChange={receiveEditorLoading}
          />
          <MakerImageFields
            existingImages={existingImages}
            images={images}
            locale={locale}
            onExistingImageChanged={(image) =>
              form.setFieldValue("existingImages", (current) =>
                current.map((candidate) =>
                  candidate.id === image.id ? image : candidate,
                ),
              )
            }
            onImagesChange={(value) => form.setFieldValue("images", value)}
            t={t}
          />
          {formError ? (
            <p className="m-0 text-sm text-destructive" role="alert">
              {t(
                (typeof formError === "string"
                  ? formError
                  : formError.form) as TranslationKey,
              )}
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

/** Independent maker image mutation lifetimes. */
type MakerImageState = ReadonlyMap<
  number,
  EffectEntity<MakerImageState, MakerImageEvent>
>;
/** Maker image action and terminal cleanup. */
type MakerImageEvent =
  | {
      /** Requests one archive/restore action. */
      type: "requested";
      /** Selected persisted image. */
      image: CatalogImage;
    }
  | {
      /** Stops one completed image action. */
      type: "finished";
      /** Completed persisted image. */
      imageId: number;
    };
/** Captured persisted image whose archive state is changing. */
type MakerImageEffect = Extract<
  MakerImageEvent,
  {
    /** Captured intent discriminant. */
    type: "requested";
  }
>;

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
  onExistingImageChanged,
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
   * @param image - Updated persisted image.
   */
  onExistingImageChanged(image: CatalogImage): void;
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
  const tasks = useRef(
    new Map<
      number,
      {
        /** Descriptor whose image mutation must not replay. */
        effect: MakerImageEffect;
        /** Retained mutation completion. */
        promise: Promise<boolean>;
      }
    >(),
  );
  const [pending, dispatchImage] = useEffectReducer<
    MakerImageState,
    MakerImageEvent,
    MakerImageEffect
  >(
    (state, event, exec) => {
      const next = new Map(state);
      if (event.type === "requested") {
        if (next.has(event.image.id)) return state;
        next.set(event.image.id, exec(event));
      } else {
        exec.stop(next.get(event.imageId));
        next.delete(event.imageId);
      }
      return next;
    },
    new Map(),
    {
      /**
       * Observes one maker image action through its mounted account/maker form.
       * @param _state - Current pending image actions.
       * @param effect - Captured image and its previous archive state.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current observer lifetime.
       */
      requested: (_state, effect, dispatch, { signal }) => {
        if (tasks.current.get(effect.image.id)?.effect !== effect)
          tasks.current.set(effect.image.id, {
            effect,
            promise: Promise.resolve()
              .then(() =>
                effect.image.deletedAt
                  ? restoreCatalogImage({
                      data: { imageId: effect.image.id, targetType: "maker" },
                    })
                  : softDeleteCatalogImage({
                      data: { imageId: effect.image.id, targetType: "maker" },
                    }),
              )
              .then(
                () => true,
                () => false,
              ),
          });
        void tasks.current.get(effect.image.id)?.promise.then((success) => {
          if (signal.aborted) return;
          tasks.current.delete(effect.image.id);
          dispatch({ type: "finished", imageId: effect.image.id });
          if (!success) {
            toast.error(t("web.catalog.error.form"));
            return;
          }
          onExistingImageChanged({
            ...effect.image,
            deletedAt: effect.image.deletedAt ? null : new Date(),
            deletedByClerkId: null,
            deletedByRole: effect.image.deletedAt ? null : "admin",
          });
        });
      },
    },
  );
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
            <FontAwesomeIcon
              aria-hidden="true"
              className="size-8"
              icon={faIndustry}
            />
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
            disabled={pending.has(image.id)}
            onClick={() => dispatchImage({ type: "requested", image })}
            size="sm"
            type="button"
            variant="outline"
          >
            <FontAwesomeIcon
              aria-hidden="true"
              icon={image.deletedAt ? faArrowRotateLeft : faTrash}
            />
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
