import {
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { RotateCcw, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AdminPageShell } from "@/components/admin-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPageShell } from "@/components/user-page-shell";
import type { listAdminResourceTrash } from "@/lib/resources";
import { permanentlyDeleteResource, restoreResource } from "@/lib/resources";
import { useLocale } from "@/providers/locale-provider";

/** A recoverable resource trash item. */
type TrashItem = Awaited<ReturnType<typeof listAdminResourceTrash>>[number];

/**
 * Renders the signed-in owner's resource trash.
 *
 * @param props - Owner resource trash properties.
 * @param props.initialResources - Recoverable resources shown initially.
 * @returns The owner resource trash page.
 */
export function OwnerResourceTrashPage({
  initialResources,
}: {
  /** Recoverable resources shown initially. */
  initialResources: TrashItem[];
}) {
  const { locale } = useLocale();
  return (
    <UserPageShell
      title={formatTranslation("web.resources.trash.ownerTitle", {}, locale)}
    >
      <ResourceTrashList
        emptyKey="web.resources.trash.ownerEmpty"
        initialResources={initialResources}
        locale={locale}
        showPermanentDelete={false}
        showActor={false}
      />
    </UserPageShell>
  );
}

/**
 * Renders administrative resource trash controls.
 *
 * @param props - Admin resource trash properties.
 * @param props.initialResources - Recoverable resources shown initially.
 * @returns The admin resource trash page.
 */
export function AdminResourceTrashPage({
  initialResources,
}: {
  /** Recoverable resources shown initially. */
  initialResources: TrashItem[];
}) {
  const { locale } = useLocale();
  return (
    <AdminPageShell
      breadcrumbItems={[
        {
          label: formatTranslation("web.navigation.admin", {}, locale),
          to: "/admin",
        },
        {
          label: formatTranslation("web.admin.trash.title", {}, locale),
          to: "/admin/trash",
        },
      ]}
      section="trash"
      title={formatTranslation("web.resources.trash.adminTitle", {}, locale)}
    >
      <main className="w-full max-w-5xl px-4 py-6 md:px-6">
        <ResourceTrashList
          emptyKey="web.resources.trash.adminEmpty"
          initialResources={initialResources}
          locale={locale}
          showPermanentDelete
          showActor
        />
      </main>
    </AdminPageShell>
  );
}

/**
 * Renders recoverable resources for an owner or administrator.
 *
 * @param props - Trash contents and display permissions.
 * @param props.emptyKey - Localization key for the empty state.
 * @param props.initialResources - Recoverable resources shown initially.
 * @param props.locale - Locale used for copy and dates.
 * @param props.showPermanentDelete - Whether permanent deletion is available.
 * @param props.showActor - Whether deletion attribution is shown.
 * @returns The resource trash list.
 */
function ResourceTrashList({
  emptyKey,
  initialResources,
  locale,
  showPermanentDelete,
  showActor,
}: {
  /** Localization key for the empty state. */
  emptyKey: TranslationKey;
  /** Recoverable resources shown initially. */
  initialResources: TrashItem[];
  /** Locale used for copy and dates. */
  locale: SupportedLocale;
  /** Whether permanent deletion is available. */
  showPermanentDelete: boolean;
  /** Whether deletion attribution is shown. */
  showActor: boolean;
}) {
  const [resources, setResources] = useState(initialResources);
  const [restoringId, setRestoringId] = useState<number>();
  /**
   * Formats localized resource trash copy.
   *
   * @param key - Localization key.
   * @param params - Values interpolated into the translation.
   * @returns The formatted translation.
   */
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  if (resources.length === 0) {
    return (
      <p className="m-0 rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
        {t(emptyKey)}
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {resources.map((resource) => (
        <article
          className="grid gap-4 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          key={resource.id}
        >
          <div className="grid min-w-0 gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="m-0 truncate text-lg font-semibold">
                {resource.name}
              </h2>
              <Badge variant="secondary">
                {t(
                  resource.isPrivate
                    ? "web.resources.visibility.private"
                    : "web.resources.visibility.public",
                )}
              </Badge>
            </div>
            <p className="m-0 text-sm text-muted-foreground">
              {t("web.resources.trash.deletedOn", {
                date: formatDate(resource.deletedAt, locale),
              })}
            </p>
            {showActor ? (
              <div className="grid gap-1 text-sm text-muted-foreground">
                <span>
                  {t("web.resources.trash.deletedBy", {
                    user: resource.deletedByUsername,
                  })}
                </span>
                <span>
                  {t(
                    resource.deletedByRole === "admin"
                      ? "web.resources.trash.deletionRoleAdmin"
                      : "web.resources.trash.deletionRoleOwner",
                  )}
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={restoringId === resource.id}
              onClick={async () => {
                const reason = showPermanentDelete
                  ? window
                      .prompt(t("web.resources.moderation.reasonLabel"))
                      ?.trim()
                  : undefined;
                if (showPermanentDelete && !reason) {
                  toast.error(t("web.resources.moderation.reasonRequired"));
                  return;
                }
                setRestoringId(resource.id);
                try {
                  await restoreResource({
                    data: { reason, resourceId: resource.id },
                  });
                  setResources((current) =>
                    current.filter(({ id }) => id !== resource.id),
                  );
                  toast.success(
                    t("web.resources.trash.restoreSuccess", {
                      name: resource.name,
                    }),
                  );
                } catch {
                  toast.error(
                    t("web.resources.trash.restoreFailure", {
                      name: resource.name,
                    }),
                  );
                } finally {
                  setRestoringId(undefined);
                }
              }}
              type="button"
              variant="outline"
            >
              <RotateCcw />
              {t("web.resources.action.restore")}
            </Button>
            {showPermanentDelete ? (
              <PermanentDeleteButton
                onDeleted={() =>
                  setResources((current) =>
                    current.filter(({ id }) => id !== resource.id),
                  )
                }
                resource={resource}
                t={t}
              />
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

/**
 * Renders the permanent deletion confirmation flow.
 *
 * @param props - Resource, callback, and localized copy.
 * @param props.onDeleted - Removes the deleted resource from parent state.
 * @param props.resource - Resource to delete permanently.
 * @param props.t - Resource translation formatter.
 * @returns The permanent deletion button and dialog.
 */
function PermanentDeleteButton({
  onDeleted,
  resource,
  t,
}: {
  /** Removes the deleted resource from parent state. */
  onDeleted(): void;
  /** Resource to delete permanently. */
  resource: TrashItem;
  /**
   * Formats localized resource copy.
   *
   * @param key - Localization key.
   * @param params - Values interpolated into the translation.
   * @returns The formatted translation.
   */
  t: (key: TranslationKey, params?: Record<string, number | string>) => string;
}) {
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = `permanently-delete-resource-${resource.id}`;

  return (
    <>
      <Button
        onClick={() => dialogRef.current?.showModal()}
        type="button"
        variant="destructive"
      >
        <Trash2 />
        {t("web.resources.action.permanentlyDelete")}
      </Button>
      <dialog
        aria-labelledby={titleId}
        className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-lg border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
        ref={dialogRef}
      >
        <div className="grid gap-5 p-6">
          <div className="grid gap-2">
            <h2 className="m-0 text-xl font-semibold" id={titleId}>
              {t("web.resources.trash.permanentConfirmationTitle")}
            </h2>
            <p className="m-0 text-sm text-muted-foreground">
              {t("web.resources.trash.permanentConfirmationDescription", {
                name: resource.name,
              })}
            </p>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            {t("web.resources.moderation.reasonLabel")}
            <textarea
              className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              maxLength={1000}
              onChange={(event) => setReason(event.currentTarget.value)}
              placeholder={t("web.resources.moderation.reasonPlaceholder")}
              required
              value={reason}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button
              disabled={deleting}
              onClick={() => dialogRef.current?.close()}
              type="button"
              variant="outline"
            >
              {t("action.cancel")}
            </Button>
            <Button
              disabled={deleting || !reason.trim()}
              onClick={async () => {
                setDeleting(true);
                try {
                  await permanentlyDeleteResource({
                    data: { reason, resourceId: resource.id },
                  });
                  dialogRef.current?.close();
                  onDeleted();
                  toast.success(
                    t("web.resources.trash.permanentSuccess", {
                      name: resource.name,
                    }),
                  );
                } catch {
                  toast.error(
                    t("web.resources.trash.permanentFailure", {
                      name: resource.name,
                    }),
                  );
                } finally {
                  setDeleting(false);
                }
              }}
              type="button"
              variant="destructive"
            >
              <Trash2 />
              {t("web.resources.action.permanentlyDelete")}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/**
 * Formats a resource deletion date and time.
 *
 * @param value - Date to format.
 * @param locale - Locale used for formatting.
 * @returns The localized date and time.
 */
function formatDate(value: Date, locale: SupportedLocale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
