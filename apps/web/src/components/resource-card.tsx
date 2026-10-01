import {
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import {
  Box,
  File,
  FileArchive,
  FileDown,
  FileText,
  Pencil,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  downloadResourceFile,
  downloadResourceVersion,
  type listResourceDirectory,
} from "@/lib/resources";
import { useLocale } from "@/providers/locale-provider";

/**
 * Resource summary returned by the resource directory.
 */
export type ResourceCardItem = Awaited<
  ReturnType<typeof listResourceDirectory>
>["resources"][number];

/**
 * Shared layout and surface styles for linked and standalone resource cards.
 */
const cardClassName =
  "relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm";

/**
 * Renders a downloadable directory card or a linked owned-resource card.
 *
 * @param props - Resource card properties.
 * @param props.mode - Directory mode shows actions; owned mode links the entire card and shows visibility.
 * @param props.resource - Resource summary to present.
 * @returns The resource card UI.
 * @throws {Error} When rendered outside `LocaleProvider`.
 */
export function ResourceCard({
  mode = "directory",
  resource,
}: {
  /**
   * Directory mode shows actions; owned mode links the entire card and shows visibility.
   *
   * @default "directory"
   */
  mode?: "directory" | "owned";
  /**
   * Resource summary to present.
   */
  resource: ResourceCardItem;
}) {
  const { locale } = useLocale();
  const [downloading, setDownloading] = useState(false);
  const [archiveFailed, setArchiveFailed] = useState(false);
  const downloadsArchive = resource.currentVersion.fileCount >= 2;
  /**
   * Formats resource-card copy for the active locale.
   *
   * @param key - Resource translation key.
   * @param params - Translation interpolation values.
   * @returns Localized resource-card text.
   */
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);
  const content = (
    <ResourceCardContent
      actions={
        mode === "directory" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              className="flex-1"
              disabled={downloading || archiveFailed}
              onClick={async () => {
                setDownloading(true);
                try {
                  const url = downloadsArchive
                    ? await downloadResourceVersion({
                        data: {
                          resourceId: resource.id,
                          versionId: resource.currentVersion.id,
                        },
                      })
                    : await downloadResourceFile({
                        data: {
                          fileId: resource.currentVersion.fileId,
                          resourceId: resource.id,
                        },
                      });
                  if (!url) throw new Error("missing download");
                  window.location.assign(url);
                } catch {
                  toast.error(
                    t("web.resources.error.downloadUnavailable", {
                      filename: downloadsArchive
                        ? `resource-${resource.id}-v${resource.currentVersion.version}.zip`
                        : resource.currentVersion.fileName,
                    }),
                    downloadsArchive
                      ? {
                          description: (
                            <Link
                              className="underline"
                              params={{ resourceId: String(resource.id) }}
                              to="/resources/$resourceId"
                            >
                              {t("web.resources.error.archiveDownloadFallback")}
                            </Link>
                          ),
                        }
                      : undefined,
                  );
                  if (downloadsArchive) setArchiveFailed(true);
                  setDownloading(false);
                }
              }}
              type="button"
            >
              {downloadsArchive ? <FileArchive /> : <FileDown />}
              {t("web.resources.action.download")}
            </Button>
            <Button
              className="flex-1"
              nativeButton={false}
              render={
                <Link
                  params={{ resourceId: String(resource.id) }}
                  to="/resources/$resourceId"
                />
              }
              variant="outline"
            >
              {t("web.resources.action.details")}
            </Button>
            {resource.canEdit ? (
              <Button
                className="flex-1"
                nativeButton={false}
                render={
                  <Link
                    params={{ resourceId: String(resource.id) }}
                    to="/resources/$resourceId/edit"
                  />
                }
                variant="outline"
              >
                <Pencil />
                {t("web.resources.action.edit")}
              </Button>
            ) : null}
          </div>
        ) : null
      }
      locale={locale}
      resource={resource}
      showVisibility={mode === "owned"}
      t={t}
    />
  );

  if (mode === "owned") {
    return (
      <Link
        className={`${cardClassName} transition-transform hover:-translate-y-0.5 hover:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50`}
        params={{ resourceId: String(resource.id) }}
        to="/resources/$resourceId"
      >
        {content}
      </Link>
    );
  }

  return <article className={cardClassName}>{content}</article>;
}

/**
 * Renders the shared resource preview, metadata, visibility, and actions.
 *
 * @param props - Resource card content properties.
 * @param props.actions - Controls rendered below the resource metadata.
 * @param props.locale - Locale used to format the upload date.
 * @param props.resource - Resource summary to present.
 * @param props.showVisibility - Whether to show the public/private badge over the preview.
 * @param props.t - Formats localized resource copy.
 * @returns The shared resource card content.
 */
function ResourceCardContent({
  actions,
  locale,
  resource,
  showVisibility,
  t,
}: {
  /**
   * Controls rendered below the resource metadata.
   */
  actions: ReactNode;
  /**
   * Locale used to format the upload date.
   */
  locale: SupportedLocale;
  /**
   * Resource summary to present.
   */
  resource: ResourceCardItem;
  /**
   * Whether to show the public/private badge over the preview.
   */
  showVisibility: boolean;
  /**
   * Formats localized resource copy.
   *
   * @param key - Resource translation key.
   * @param params - Translation interpolation values.
   * @returns Localized resource-card text.
   */
  t: (key: TranslationKey, params?: Record<string, number | string>) => string;
}) {
  return (
    <>
      <div className="relative">
        {resource.coverImageUrl ? (
          <img
            alt={t("web.resources.detail.imageAlt", {
              name: resource.name,
            })}
            className="aspect-4/3 w-full border-b border-border object-cover"
            loading="lazy"
            src={resource.coverImageUrl}
          />
        ) : (
          <div className="flex aspect-4/3 items-center justify-center border-b border-border bg-muted text-muted-foreground">
            <ResourceFileIcon fileName={resource.currentVersion.fileName} />
            <span className="sr-only">
              {t("web.resources.detail.fileTypeFallback")}
            </span>
          </div>
        )}
        {showVisibility ? (
          <Badge
            className="absolute top-3 right-3"
            variant={resource.isPrivate ? "secondary" : "destructive"}
          >
            {resource.isPrivate
              ? t("web.resources.visibility.private")
              : t("web.resources.visibility.public")}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="grid gap-2">
          <h2 className="m-0 truncate text-lg font-semibold">
            {resource.name}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {!showVisibility && resource.isPrivate ? (
              <Badge variant="destructive">
                {t("web.resources.moderation.privateBadge")}
              </Badge>
            ) : null}
            {resource.categories.map((category) => (
              <Badge key={category.id} variant="secondary">
                {category.name}
              </Badge>
            ))}
          </div>
        </div>

        <div className="mt-auto grid gap-1 text-sm text-muted-foreground">
          <span>
            {t("web.resources.detail.sharedBy")} {resource.uploaderUsername}
          </span>
          {resource.isPrivate && resource.privateReason ? (
            <span>
              {t("web.resources.moderation.privateReason", {
                reason: resource.privateReason,
              })}
            </span>
          ) : null}
          <span>
            {t("web.resources.detail.downloadCount", {
              count: resource.downloadCount,
            })}
          </span>
          <span>
            {t("web.resources.detail.uploadedOn", {
              date: formatDate(resource.createdAt, locale),
            })}
          </span>
        </div>

        {actions}
      </div>
    </>
  );
}

/**
 * Renders an icon selected from the resource file-name extension.
 *
 * @param props - Resource file icon properties.
 * @param props.fileName - File name used to select an archive, document, model, or generic icon.
 * @returns The decorative file-type icon.
 */
function ResourceFileIcon({
  fileName,
}: {
  /** File name used to choose the icon. */
  fileName: string;
}) {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  const className = "size-16";

  if (extension === ".zip") {
    return <FileArchive aria-hidden="true" className={className} />;
  }
  if (extension === ".pdf" || extension === ".txt") {
    return <FileText aria-hidden="true" className={className} />;
  }
  if ([".3mf", ".step", ".stl", ".stp"].includes(extension)) {
    return <Box aria-hidden="true" className={className} />;
  }
  return <File aria-hidden="true" className={className} />;
}

/**
 * Formats a resource date with the locale's medium date style.
 *
 * @param value - Date to format.
 * @param locale - Locale used by the date formatter.
 * @returns The localized date text.
 */
function formatDate(value: Date, locale: SupportedLocale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(value),
  );
}
