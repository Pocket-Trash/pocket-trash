import { useAuth } from "@clerk/tanstack-react-start";
import {
  faChevronDown,
  faChevronUp,
  faFile,
  faFileArrowDown,
  faFileZipper,
  faPencil,
  faTrash,
  faUserLock,
} from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useForm, useStore } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useReducer, useRef } from "react";
import { toast } from "sonner";
import { type EffectEntity, useEffectReducer } from "use-effect-reducer";
import { AppShell } from "@/components/app-shell";
import { ImageGallery } from "@/components/image-gallery";
import { ResourceVisibilityToggle } from "@/components/resource-visibility-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useResourceDownloads } from "@/hooks/use-resource-downloads";
import { type getResourceDetail, softDeleteResource } from "@/lib/resources";
import { useLocale } from "@/providers/locale-provider";

/** Resource detail returned by the resource service. */
type ResourceDetail = NonNullable<
  Awaited<ReturnType<typeof getResourceDetail>>
>;

/** Resource deletion dialog and committed mutation lifetime. */
type ResourceDeleteState = {
  /** Whether deletion confirmation is open. */
  open: boolean;
  /** Pending confirmed deletion effect. */
  request: EffectEntity<ResourceDeleteState, ResourceDeleteEvent> | undefined;
};
/** Deletion confirmation intent and terminal cleanup. */
type ResourceDeleteEvent =
  | {
      /** Opens confirmation. */
      type: "opened";
    }
  | {
      /** Dismisses confirmation. */
      type: "dismissed";
    }
  | {
      /** Submits the existing reason after validation. */
      type: "requested";
      /** Existing optional moderation reason. */
      reason?: string;
    }
  | {
      /** Stops the completed deletion request. */
      type: "finished";
      /** Whether deletion committed successfully. */
      success: boolean;
    };
/** Captured confirmed deletion. */
type ResourceDeleteEffect = {
  /** Deletion implementation. */
  type: "remove";
  /** Existing optional moderation reason. */
  reason?: string;
};

/**
 * Renders resource metadata, images, files, and version history.
 *
 * @param props - Resource detail page properties.
 * @param props.detail - Resource detail to display.
 * @returns The resource detail page.
 */
export function ResourceDetailPage({
  detail,
}: {
  /** Resource detail to display. */ detail: ResourceDetail;
}) {
  const { userId } = useAuth();
  return (
    <ResourceDetailContent
      key={`${userId}:${detail.id}:${detail.isOwner}:${detail.canEdit}:${detail.canAdminister}`}
      detail={detail}
    />
  );
}

/**
 * Owns one current resource/permission identity's downloads and deletion controls.
 * @param props - Current resource detail.
 * @returns Scoped resource detail content.
 */
function ResourceDetailContent({
  detail,
}: {
  /** Current resource detail. */ detail: ResourceDetail;
}) {
  const { locale } = useLocale();
  const navigate = useNavigate();
  const {
    downloadingFileId,
    downloadingVersionId,
    failedVersionIds,
    startFile,
    startVersion,
  } = useResourceDownloads(detail.id);
  const [historyExpanded, dispatchHistory] = useReducer(
    (state: boolean, event: "historyToggled") =>
      event === "historyToggled" ? !state : state,
    false,
  );
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const form = useForm({
    defaultValues: { reason: "" },
    validators: {
      /**
       * Requires the existing staff reason for cross-owner deletion.
       * @param input - Current reason field.
       * @returns Existing reason feedback when invalid.
       */
      onSubmit: ({ value }): string | undefined =>
        !detail.isOwner && !value.reason.trim()
          ? "web.resources.moderation.reasonRequired"
          : undefined,
    },
    /**
     * Captures one confirmed resource deletion without changing its request payload.
     * @param input - Validated reason field.
     */
    onSubmit: ({ value }) => {
      dispatchDelete({ type: "requested", reason: value.reason || undefined });
    },
  });
  const deleteReason = useStore(form.store, (state) => state.values.reason);
  const canDelete = useStore(
    form.store,
    (state) => detail.isOwner || state.values.reason.trim().length > 0,
  );
  const task = useRef<{
    /** Descriptor whose mutation must not replay. */
    effect: ResourceDeleteEffect;
    /** Completion retained across suspended observers. */
    promise: Promise<boolean>;
  } | null>(null);
  const [deletion, dispatchDelete] = useEffectReducer<
    ResourceDeleteState,
    ResourceDeleteEvent,
    ResourceDeleteEffect
  >(
    (state, event, exec) => {
      if (event.type === "opened") return { ...state, open: true };
      if (event.type === "dismissed")
        return state.request ? state : { ...state, open: false };
      if (event.type === "requested")
        return state.request
          ? state
          : {
              ...state,
              request: exec({ type: "remove", reason: event.reason }),
            };
      exec.stop(state.request);
      return { open: event.success ? false : state.open, request: undefined };
    },
    { open: false, request: undefined },
    {
      /**
       * Observes one confirmed deletion through lifecycle resumption.
       * @param _state - Current confirmation state.
       * @param effect - Captured optional staff reason.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current observer lifetime.
       */
      remove: (_state, effect, dispatch, { signal }) => {
        if (task.current?.effect !== effect)
          task.current = {
            effect,
            promise: softDeleteResource({
              data: { reason: effect.reason, resourceId: detail.id },
            }).then(
              () => true,
              () => false,
            ),
          };
        void task.current.promise.then((success) => {
          if (signal.aborted) return;
          dispatch({ type: "finished", success });
          toast[success ? "success" : "error"](
            t(
              success
                ? "web.resources.trash.softDeleteSuccess"
                : "web.resources.trash.softDeleteFailure",
              { name: detail.name },
            ),
          );
          if (success)
            void navigate({
              to: detail.isOwner
                ? "/user/resources/trash"
                : "/admin/trash/resources",
            });
        });
      },
    },
  );
  const deleting = Boolean(deletion.request);
  /**
   * Owns confirmation through the committed dialog lifetime without dismissing preserved drafts.
   * @param node - Current dialog node.
   * @returns Cleanup closing this mounted dialog.
   */
  const bindDeleteDialog = useCallback((node: HTMLDialogElement | null) => {
    deleteDialogRef.current = node;
    if (!node) return;
    node.showModal();
    return () => {
      node.close();
      if (deleteDialogRef.current === node) deleteDialogRef.current = null;
    };
  }, []);
  /**
   * Formats localized resource copy.
   *
   * @param key - Localization key.
   * @param params - Values interpolated into the translation.
   * @returns The formatted translation.
   */
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  /**
   * Requests an individual file through its current resource lifetime.
   * @param file - Resource file to download.
   */
  function startDownload(
    file: ResourceDetail["currentVersion"]["files"][number],
  ) {
    startFile(file.id, file.fileName);
  }
  /**
   * Requests a version archive through its current resource lifetime.
   * @param version - Resource version to download.
   */
  function startVersionDownload(version: ResourceDetail["versions"][number]) {
    startVersion(version.id, version.version);
  }

  return (
    <AppShell title={detail.name}>
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:px-6">
        <section className="grid overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm md:grid-cols-[minmax(14rem,0.6fr)_minmax(0,1fr)]">
          {detail.images[0] ? (
            <div>
              <img
                alt={t("web.resources.detail.imageAlt", {
                  name: detail.name,
                })}
                className="aspect-4/3 h-full w-full border-b border-border object-cover md:border-r md:border-b-0"
                src={detail.images[0].url}
              />
            </div>
          ) : (
            <div className="flex aspect-4/3 items-center justify-center border-b border-border bg-muted text-muted-foreground md:border-r md:border-b-0">
              <FontAwesomeIcon
                aria-hidden="true"
                className="size-14"
                icon={faFile}
              />
              <span className="sr-only">
                {t("web.resources.detail.noImage")}
              </span>
            </div>
          )}
          <div className="grid content-start gap-4 p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <h1 className="m-0 text-2xl font-semibold">{detail.name}</h1>
              {detail.canEdit ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    nativeButton={false}
                    render={
                      <Link
                        params={{ resourceId: String(detail.id) }}
                        to="/resources/$resourceId/edit"
                      />
                    }
                    size="sm"
                    variant="outline"
                  >
                    <FontAwesomeIcon aria-hidden="true" icon={faPencil} />
                    {t("web.resources.action.edit")}
                  </Button>
                  <Button
                    onClick={() => dispatchDelete({ type: "opened" })}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    <FontAwesomeIcon aria-hidden="true" icon={faTrash} />
                    {t("web.resources.action.delete")}
                  </Button>
                </div>
              ) : null}
            </div>
            <p className="m-0 text-sm leading-6">{detail.description}</p>
            <div className="flex flex-wrap gap-2">
              {detail.categories.map((category) => (
                <Badge key={category.id} variant="secondary">
                  {category.name}
                </Badge>
              ))}
            </div>
            <dl className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <div>
                <dt>{t("web.resources.detail.sharedBy")}</dt>
                <dd className="m-0 inline-flex items-center gap-1 text-foreground">
                  {detail.uploaderIsProfilePublic ? (
                    detail.uploaderUsername
                  ) : (
                    <>
                      <FontAwesomeIcon aria-hidden="true" icon={faUserLock} />
                      {t("web.profiles.privateUser")}
                    </>
                  )}
                </dd>
              </div>
              <DetailRow
                label={t("web.resources.detail.downloadCount", {
                  count: detail.downloadCount,
                })}
              />
              {detail.isPrivate && detail.privateReason ? (
                <DetailRow
                  label={t("web.resources.moderation.privateReason", {
                    reason: detail.privateReason,
                  })}
                />
              ) : null}
              {detail.isPrivate && detail.privatedAt ? (
                <DetailRow
                  label={t("web.resources.moderation.privateSince", {
                    date: formatDate(detail.privatedAt, locale),
                  })}
                />
              ) : null}
            </dl>
            {detail.canEdit ? (
              <ResourceVisibilityToggle
                canAdminister={detail.canAdminister}
                isAdminPrivate={detail.isAdminPrivate}
                isOwner={detail.isOwner}
                isPrivate={detail.isPrivate}
                name={detail.name}
                resourceId={detail.id}
              />
            ) : null}
          </div>
        </section>

        <ImageGallery
          alt={t("web.resources.detail.imageAlt", { name: detail.name })}
          closeLabel={t("web.resources.action.closeImage")}
          groups={[{ images: detail.images }]}
          label={t("web.resources.upload.imagesLabel")}
          nextLabel={t("web.resources.action.nextImage")}
          previousLabel={t("web.resources.action.previousImage")}
        />

        <VersionCard
          canEdit={detail.canEdit}
          archiveDownloading={downloadingVersionId === detail.currentVersion.id}
          archiveFailed={failedVersionIds.has(detail.currentVersion.id)}
          downloadingFileId={downloadingFileId}
          locale={locale}
          onDownload={startDownload}
          onDownloadVersion={startVersionDownload}
          resourceId={detail.id}
          t={t}
          title={t("web.resources.detail.currentVersion")}
          version={detail.currentVersion}
        />

        <section className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="m-0 text-xl font-semibold">
              {t("web.resources.detail.versionHistory")}
            </h2>
            <Button
              aria-expanded={historyExpanded}
              aria-label={t(
                historyExpanded
                  ? "web.resources.action.collapseVersionHistory"
                  : "web.resources.action.expandVersionHistory",
              )}
              onClick={() => dispatchHistory("historyToggled")}
              size="icon"
              type="button"
              variant="ghost"
            >
              <FontAwesomeIcon
                aria-hidden="true"
                icon={historyExpanded ? faChevronUp : faChevronDown}
              />
            </Button>
          </div>
          {historyExpanded ? (
            <div className="mt-4 grid gap-3">
              {detail.versions.map((version) => (
                <VersionCard
                  archiveDownloading={downloadingVersionId === version.id}
                  archiveFailed={failedVersionIds.has(version.id)}
                  canEdit={detail.canEdit}
                  collapsible
                  downloadingFileId={downloadingFileId}
                  key={version.id}
                  locale={locale}
                  onDownload={startDownload}
                  onDownloadVersion={startVersionDownload}
                  resourceId={detail.id}
                  t={t}
                  version={version}
                />
              ))}
            </div>
          ) : null}
        </section>
        {deletion.open ? (
          <dialog
            aria-labelledby="soft-delete-resource-title"
            className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-lg border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
            ref={bindDeleteDialog}
            onCancel={(event) => {
              event.preventDefault();
              if (!deleting) dispatchDelete({ type: "dismissed" });
            }}
          >
            <div className="grid gap-5 p-6">
              <div className="grid gap-2">
                <h2
                  className="m-0 text-xl font-semibold"
                  id="soft-delete-resource-title"
                >
                  {t("web.resources.trash.softDeleteConfirmationTitle")}
                </h2>
                <p className="m-0 text-sm text-muted-foreground">
                  {t("web.resources.trash.softDeleteConfirmationDescription", {
                    name: detail.name,
                  })}
                </p>
              </div>
              {!detail.isOwner ? (
                <label className="grid gap-2 text-sm font-medium">
                  {t("web.resources.moderation.reasonLabel")}
                  <textarea
                    className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    maxLength={1000}
                    onChange={(event) =>
                      form.setFieldValue("reason", event.currentTarget.value)
                    }
                    placeholder={t(
                      "web.resources.moderation.reasonPlaceholder",
                    )}
                    required
                    value={deleteReason}
                  />
                </label>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button
                  disabled={deleting}
                  onClick={() => dispatchDelete({ type: "dismissed" })}
                  type="button"
                  variant="outline"
                >
                  {t("action.cancel")}
                </Button>
                <Button
                  disabled={deleting || !canDelete}
                  onClick={() => {
                    form.setErrorMap({ onSubmit: undefined });
                    void form.handleSubmit();
                  }}
                  type="button"
                  variant="destructive"
                >
                  <FontAwesomeIcon aria-hidden="true" icon={faTrash} />
                  {t("web.resources.action.delete")}
                </Button>
              </div>
            </div>
          </dialog>
        ) : null}
      </main>
    </AppShell>
  );
}

/**
 * Renders one resource version and its downloadable files.
 *
 * @param props - Resource version card properties.
 * @param props.archiveDownloading - Whether the version archive is downloading.
 * @param props.archiveFailed - Whether the archive download failed.
 * @param props.canEdit - Whether edit actions are available.
 * @param props.collapsible - Whether the file list can collapse.
 * @param props.downloadingFileId - File currently downloading.
 * @param props.locale - Locale used for dates and sizes.
 * @param props.onDownload - Starts a file download.
 * @param props.onDownloadVersion - Starts a version archive download.
 * @param props.resourceId - Resource identifier used by edit links.
 * @param props.t - Resource translation formatter.
 * @param props.title - Optional version card label.
 * @param props.version - Resource version to display.
 * @returns The resource version card.
 */
function VersionCard({
  archiveDownloading,
  archiveFailed,
  canEdit,
  collapsible = false,
  downloadingFileId,
  locale,
  onDownload,
  onDownloadVersion,
  resourceId,
  t,
  title,
  version,
}: {
  /** Whether the version archive is downloading. */
  archiveDownloading: boolean;
  /** Whether the archive download failed. */
  archiveFailed: boolean;
  /** Whether edit actions are available. */
  canEdit: boolean;
  /** Whether the file list can collapse. */
  collapsible?: boolean;
  /** File currently downloading. */
  downloadingFileId?: number;
  /** Locale used for dates and sizes. */
  locale: SupportedLocale;
  /**
   * Starts a file download.
   *
   * @param file - Resource file to download.
   */
  onDownload: (file: ResourceDetail["currentVersion"]["files"][number]) => void;
  /**
   * Starts a version archive download.
   *
   * @param version - Resource version to download.
   */
  onDownloadVersion: (version: ResourceDetail["versions"][number]) => void;
  /** Resource identifier used by edit links. */
  resourceId: number;
  /**
   * Formats localized resource copy.
   *
   * @param key - Localization key.
   * @param params - Values interpolated into the translation.
   * @returns The formatted translation.
   */
  t: (key: TranslationKey, params?: Record<string, number | string>) => string;
  /** Optional version card label. */
  title?: string;
  /** Resource version to display. */
  version: ResourceDetail["versions"][number];
}) {
  const [expanded, dispatch] = useReducer(
    (state: boolean, event: "filesDisclosureToggled") =>
      event === "filesDisclosureToggled" ? !state : state,
    !collapsible,
  );
  return (
    <article className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
      {title ? (
        <p className="m-0 mb-2 text-[11px] font-semibold tracking-[1px] text-muted-foreground uppercase">
          {title}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-4">
        <h2 className="m-0 text-base font-semibold">
          {t("web.resources.detail.version", { version: version.version })}
          {", "}
          {t("web.resources.detail.downloadCount", {
            count: version.downloadCount,
          })}
          {", "}
          {t("web.resources.detail.uploadedOn", {
            date: formatDate(version.createdAt, locale),
          })}
        </h2>
        <div className="flex items-center gap-2">
          {version.files.length >= 2 ? (
            <Button
              disabled={archiveDownloading || archiveFailed}
              onClick={() => onDownloadVersion(version)}
              type="button"
              variant="outline"
            >
              <FontAwesomeIcon aria-hidden="true" icon={faFileZipper} />
              {t("web.resources.action.download")}
            </Button>
          ) : null}
          {collapsible ? (
            <Button
              aria-expanded={expanded}
              aria-label={t(
                expanded
                  ? "web.resources.action.collapseVersion"
                  : "web.resources.action.expandVersion",
                { version: version.version },
              )}
              onClick={() => dispatch("filesDisclosureToggled")}
              size="icon"
              type="button"
              variant="ghost"
            >
              <FontAwesomeIcon
                aria-hidden="true"
                icon={expanded ? faChevronUp : faChevronDown}
              />
            </Button>
          ) : null}
        </div>
      </div>
      {expanded ? (
        <div className="mt-4 grid gap-2">
          {version.files.map((file) => (
            <ResourceFileDownload
              canEdit={canEdit}
              downloading={downloadingFileId === file.id}
              file={file}
              key={file.id}
              locale={locale}
              onDownload={onDownload}
              resourceId={resourceId}
              t={t}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

/**
 * Renders metadata and download controls for one resource file.
 *
 * @param props - Resource file download properties.
 * @param props.canEdit - Whether edit actions are available.
 * @param props.downloading - Whether this file is downloading.
 * @param props.file - Resource file to display.
 * @param props.locale - Locale used to format file size.
 * @param props.onDownload - Starts a file download.
 * @param props.resourceId - Resource identifier used by edit links.
 * @param props.t - Resource translation formatter.
 * @returns The resource file row.
 */
function ResourceFileDownload({
  canEdit,
  downloading,
  file,
  locale,
  onDownload,
  resourceId,
  t,
}: {
  /** Whether edit actions are available. */
  canEdit: boolean;
  /** Whether this file is downloading. */
  downloading: boolean;
  /** Resource file to display. */
  file: ResourceDetail["currentVersion"]["files"][number];
  /** Locale used to format file size. */
  locale: SupportedLocale;
  /**
   * Starts a file download.
   *
   * @param file - Resource file to download.
   */
  onDownload: (file: ResourceDetail["currentVersion"]["files"][number]) => void;
  /** Resource identifier used by edit links. */
  resourceId: number;
  /**
   * Formats localized resource copy.
   *
   * @param key - Localization key.
   * @param params - Values interpolated into the translation.
   * @returns The formatted translation.
   */
  t: (key: TranslationKey, params?: Record<string, number | string>) => string;
}) {
  return (
    <div className="grid gap-3 rounded-md border border-border p-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="m-0 truncate font-medium">{file.fileName}</p>
        <p className="m-0 text-muted-foreground">
          {t("web.resources.detail.fileSize", {
            size: formatFileSize(file.size, locale),
          })}
        </p>
      </div>
      <div className="flex gap-2">
        {canEdit ? (
          <Button
            nativeButton={false}
            render={
              <Link
                params={{ resourceId: String(resourceId) }}
                to="/resources/$resourceId/edit"
              />
            }
            variant="outline"
          >
            <FontAwesomeIcon aria-hidden="true" icon={faPencil} />
            {t("web.resources.action.edit")}
          </Button>
        ) : null}
        <Button
          disabled={downloading}
          onClick={() => onDownload(file)}
          type="button"
          variant="outline"
        >
          <FontAwesomeIcon aria-hidden="true" icon={faFileArrowDown} />
          {t("web.resources.action.download")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Renders one resource detail-list label.
 *
 * @param props - Detail row properties.
 * @param props.label - Detail text.
 * @returns The detail-list row.
 */
function DetailRow({
  label,
}: {
  /** Detail text. */
  label: string;
}) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="m-0">{label}</dd>
    </div>
  );
}

/**
 * Formats a resource date for the current locale.
 *
 * @param value - Date to format.
 * @param locale - Locale used for formatting.
 * @returns The localized date.
 */
function formatDate(value: Date, locale: SupportedLocale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(value),
  );
}

/**
 * Formats a byte count with an appropriate localized unit.
 *
 * @param bytes - File size in bytes.
 * @param locale - Locale used for formatting.
 * @returns The localized file size.
 */
function formatFileSize(bytes: number, locale: SupportedLocale) {
  const units = ["byte", "kilobyte", "megabyte"] as const;
  const exponent = Math.min(
    Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)),
    units.length - 1,
  );
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: exponent === 0 ? 0 : 1,
    style: "unit",
    unit: units[exponent],
    unitDisplay: "short",
  }).format(bytes / 1024 ** exponent);
}

/**
 * Advances an image index with wraparound.
 *
 * @param current - Current image index.
 * @param direction - Direction to move.
 * @param imageCount - Number of available images.
 * @returns The next valid image index.
 */
export function cycleImageIndex(
  current: number,
  direction: -1 | 1,
  imageCount: number,
): number {
  if (imageCount <= 0) return 0;
  return (current + direction + imageCount) % imageCount;
}
