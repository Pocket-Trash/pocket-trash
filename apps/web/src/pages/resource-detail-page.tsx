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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadResource, type getResourceDetail } from "@/lib/resources";
import { useLocale } from "@/providers/locale-provider";

type ResourceDetail = NonNullable<
  Awaited<ReturnType<typeof getResourceDetail>>
>;

export function ResourceDetailPage({ detail }: { detail: ResourceDetail }) {
  const { locale } = useLocale();
  const [downloadingVersionId, setDownloadingVersionId] = useState<number>();
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  async function startDownload(version: ResourceDetail["currentVersion"]) {
    setDownloadingVersionId(version.id);
    try {
      const url = await downloadResource({
        data: { resourceId: detail.id, versionId: version.id },
      });
      if (!url) throw new Error("missing download");
      window.location.assign(url);
    } catch {
      toast.error(
        t("web.resources.error.downloadUnavailable", {
          filename: version.fileName,
        }),
      );
      setDownloadingVersionId(undefined);
    }
  }

  return (
    <AppShell title={detail.name}>
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)] md:px-6">
        <section className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm">
          {detail.previewImageUrl ? (
            <img
              alt={t("web.resources.detail.previewAlt", { name: detail.name })}
              className="aspect-4/3 w-full border-b border-border object-cover"
              src={detail.previewImageUrl}
            />
          ) : (
            <div className="flex aspect-4/3 items-center justify-center border-b border-border bg-muted text-muted-foreground">
              <File className="size-16" aria-hidden="true" />
              <span className="sr-only">
                {t("web.resources.detail.noPreview")}
              </span>
            </div>
          )}
          <div className="grid gap-4 p-5">
            <p className="m-0 text-sm leading-6">{detail.description}</p>
            <div className="flex flex-wrap gap-2">
              {detail.isPrivate ? (
                <Badge variant="destructive">
                  {t("web.resources.moderation.privateBadge")}
                </Badge>
              ) : null}
              {detail.categories.map((category) => (
                <Badge key={category.id} variant="secondary">
                  {category.name}
                </Badge>
              ))}
            </div>
            <dl className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
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
              <DetailRow
                label={t("web.resources.detail.uploadedBy", {
                  uploader: detail.uploaderClerkId,
                })}
              />
              <DetailRow
                label={t("web.resources.detail.uploadedOn", {
                  date: formatDate(detail.createdAt, locale),
                })}
              />
              <DetailRow
                label={t("web.resources.detail.totalDownloadCount", {
                  count: detail.downloadCount,
                })}
              />
            </dl>
          </div>
        </section>

        <aside className="h-fit rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
          <p className="m-0 text-[11px] font-semibold tracking-[1px] text-muted-foreground uppercase">
            {t("web.resources.detail.currentVersion")}
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            {t("web.resources.detail.version", {
              version: detail.currentVersion.version,
            })}
          </h2>
          <dl className="mt-4 grid gap-2 text-sm text-muted-foreground">
            <DetailRow
              label={t("web.resources.detail.filename", {
                filename: detail.currentVersion.fileName,
              })}
            />
            <DetailRow
              label={t("web.resources.detail.fileSize", {
                size: formatFileSize(detail.currentVersion.size, locale),
              })}
            />
            <DetailRow
              label={t("web.resources.detail.downloadCount", {
                count: detail.currentVersion.downloadCount,
              })}
            />
            <DetailRow
              label={t("web.resources.detail.versionUploadedOn", {
                date: formatDate(detail.currentVersion.createdAt, locale),
                version: detail.currentVersion.version,
              })}
            />
          </dl>
          <Button
            className="mt-5 w-full"
            disabled={downloadingVersionId === detail.currentVersion.id}
            onClick={() => void startDownload(detail.currentVersion)}
            type="button"
          >
            <FileDown />
            {t("web.resources.action.download")}
          </Button>
          {detail.canEdit ? (
            <Button
              className="mt-2 w-full"
              nativeButton={false}
              render={
                <Link
                  params={{ resourceId: String(detail.id) }}
                  to="/resources/$resourceId/edit"
                />
              }
              variant="outline"
            >
              <Pencil />
              {t("web.resources.action.edit")}
            </Button>
          ) : null}
        </aside>

        <section className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm md:col-span-2">
          <h2 className="m-0 text-xl font-semibold">
            {t("web.resources.detail.versionHistory")}
          </h2>
          <div className="mt-4 grid gap-3">
            {detail.versions.map((version) => (
              <article
                className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                key={version.id}
              >
                <div className="grid gap-1 text-sm text-muted-foreground">
                  <h3 className="m-0 text-base font-semibold text-foreground">
                    {t("web.resources.detail.version", {
                      version: version.version,
                    })}
                  </h3>
                  <span>
                    {t("web.resources.detail.filename", {
                      filename: version.fileName,
                    })}
                  </span>
                  <span>{version.contentType}</span>
                  <span>
                    {t("web.resources.detail.fileSize", {
                      size: formatFileSize(version.size, locale),
                    })}
                  </span>
                  <span>
                    {t("web.resources.detail.downloadCount", {
                      count: version.downloadCount,
                    })}
                  </span>
                  <span>
                    {t("web.resources.detail.versionUploadedOn", {
                      date: formatDate(version.createdAt, locale),
                      version: version.version,
                    })}
                  </span>
                </div>
                <Button
                  disabled={downloadingVersionId === version.id}
                  onClick={() => void startDownload(version)}
                  type="button"
                  variant="outline"
                >
                  <FileDown />
                  {t("web.resources.action.download")}
                </Button>
              </article>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
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
