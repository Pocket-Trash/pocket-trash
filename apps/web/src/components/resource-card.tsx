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
import { downloadResource, type listResourceDirectory } from "@/lib/resources";
import { useLocale } from "@/providers/locale-provider";

export type ResourceCardItem = Awaited<
  ReturnType<typeof listResourceDirectory>
>["resources"][number];

const cardClassName =
  "relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm";

export function ResourceCard({
  mode = "directory",
  resource,
}: {
  mode?: "directory" | "owned";
  resource: ResourceCardItem;
}) {
  const { locale } = useLocale();
  const [downloading, setDownloading] = useState(false);
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
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  const url = await downloadResource({
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
                      filename: resource.currentVersion.fileName,
                    }),
                  );
                  setDownloading(false);
                }
              }}
              type="button"
            >
              <FileDown />
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

function ResourceCardContent({
  actions,
  locale,
  resource,
  showVisibility,
  t,
}: {
  actions: ReactNode;
  locale: SupportedLocale;
  resource: ResourceCardItem;
  showVisibility: boolean;
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
          {resource.isPrivate && resource.privateReason ? (
            <span>
              {t("web.resources.moderation.privateReason", {
                reason: resource.privateReason,
              })}
            </span>
          ) : null}
          <span>
            {t("web.resources.detail.totalDownloadCount", {
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

function ResourceFileIcon({ fileName }: { fileName: string }) {
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

function formatDate(value: Date, locale: SupportedLocale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(value),
  );
}
