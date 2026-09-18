import {
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { File, FileDown, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ResourceVisibilityToggle } from "@/components/resource-visibility-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadResource, type getResourceDetail } from "@/lib/resources";
import { useLocale } from "@/providers/locale-provider";

type ResourceDetail = NonNullable<
  Awaited<ReturnType<typeof getResourceDetail>>
>;

export function ResourceDetailPage({ detail }: { detail: ResourceDetail }) {
  const { locale } = useLocale();
  const [downloadingFileId, setDownloadingFileId] = useState<number>();
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  async function startDownload(
    file: ResourceDetail["currentVersion"]["files"][number],
  ) {
    setDownloadingFileId(file.id);
    try {
      const url = await downloadResource({
        data: { fileId: file.id, resourceId: detail.id },
      });
      if (!url) throw new Error("missing download");
      window.location.assign(url);
    } catch {
      toast.error(
        t("web.resources.error.downloadUnavailable", {
          filename: file.fileName,
        }),
      );
      setDownloadingFileId(undefined);
    }
  }

  return (
    <AppShell title={detail.name}>
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:px-6">
        <section className="grid overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm md:grid-cols-[minmax(14rem,0.6fr)_minmax(0,1fr)]">
          {detail.previewImageUrl ? (
            <img
              alt={t("web.resources.detail.previewAlt", { name: detail.name })}
              className="aspect-4/3 h-full w-full border-b border-border object-cover md:border-r md:border-b-0"
              src={detail.previewImageUrl}
            />
          ) : (
            <div className="flex aspect-4/3 items-center justify-center border-b border-border bg-muted text-muted-foreground md:border-r md:border-b-0">
              <File aria-hidden="true" className="size-14" />
              <span className="sr-only">
                {t("web.resources.detail.noPreview")}
              </span>
            </div>
          )}
          <div className="grid content-start gap-4 p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <h1 className="m-0 text-2xl font-semibold">{detail.name}</h1>
              {detail.canEdit ? (
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
                  <Pencil />
                  {t("web.resources.action.edit")}
                </Button>
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
                <dt>{t("web.resources.detail.sharedBy" as TranslationKey)}</dt>
                <dd className="m-0 text-foreground">
                  {detail.uploaderClerkId}
                </dd>
              </div>
              <DetailRow
                label={t("web.resources.detail.totalDownloadCount", {
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

        <VersionCard
          canEdit={detail.canEdit}
          downloadingFileId={downloadingFileId}
          locale={locale}
          onDownload={startDownload}
          resourceId={detail.id}
          t={t}
          title={t("web.resources.detail.currentVersion")}
          version={detail.currentVersion}
        />

        <section className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
          <h2 className="m-0 text-xl font-semibold">
            {t("web.resources.detail.versionHistory")}
          </h2>
          <div className="mt-4 grid gap-3">
            {detail.versions.map((version) => (
              <VersionCard
                canEdit={detail.canEdit}
                downloadingFileId={downloadingFileId}
                key={version.id}
                locale={locale}
                onDownload={startDownload}
                resourceId={detail.id}
                t={t}
                version={version}
              />
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}

function VersionCard({
  canEdit,
  downloadingFileId,
  locale,
  onDownload,
  resourceId,
  t,
  title,
  version,
}: {
  canEdit: boolean;
  downloadingFileId?: number;
  locale: SupportedLocale;
  onDownload: (file: ResourceDetail["currentVersion"]["files"][number]) => void;
  resourceId: number;
  t: (key: TranslationKey, params?: Record<string, number | string>) => string;
  title?: string;
  version: ResourceDetail["versions"][number];
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
      {title ? (
        <p className="m-0 mb-2 text-[11px] font-semibold tracking-[1px] text-muted-foreground uppercase">
          {title}
        </p>
      ) : null}
      <h2 className="m-0 text-base font-semibold">
        {t("web.resources.detail.version", { version: version.version })}
        {", "}
        {t("web.resources.detail.totalDownloadCount", {
          count: version.downloadCount,
        })}
        {", "}
        {t("web.resources.detail.uploadedOn", {
          date: formatDate(version.createdAt, locale),
        })}
      </h2>
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
    </article>
  );
}

function ResourceFileDownload({
  canEdit,
  downloading,
  file,
  locale,
  onDownload,
  resourceId,
  t,
}: {
  canEdit: boolean;
  downloading: boolean;
  file: ResourceDetail["currentVersion"]["files"][number];
  locale: SupportedLocale;
  onDownload: (file: ResourceDetail["currentVersion"]["files"][number]) => void;
  resourceId: number;
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
          {", "}
          {t("web.resources.detail.downloadCount", {
            count: file.downloadCount,
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
            <Pencil />
            {t("web.resources.action.edit")}
          </Button>
        ) : null}
        <Button
          disabled={downloading}
          onClick={() => onDownload(file)}
          type="button"
          variant="outline"
        >
          <FileDown />
          {t("web.resources.action.download")}
        </Button>
      </div>
    </div>
  );
}

function DetailRow({ label }: { label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="m-0">{label}</dd>
    </div>
  );
}

function formatDate(value: Date, locale: SupportedLocale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(value),
  );
}

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
