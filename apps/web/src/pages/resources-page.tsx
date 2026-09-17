import { useAuth } from "@clerk/tanstack-react-start";
import {
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Box,
  File,
  FileArchive,
  FileDown,
  FileText,
  Pencil,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadResource, type listResourceDirectory } from "@/lib/resources";
import { useLocale } from "@/providers/locale-provider";

type ResourceDirectory = Awaited<ReturnType<typeof listResourceDirectory>>;

export function ResourcesPage({
  directory,
  selectedCategorySlugs,
}: {
  directory: ResourceDirectory;
  selectedCategorySlugs: string[];
}) {
  const { isSignedIn } = useAuth();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const [downloadingVersionId, setDownloadingVersionId] = useState<number>();
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  function setCategoryFilters(categorySlugs: string[]) {
    void navigate({
      search: categorySlugs.length > 0 ? { category: categorySlugs } : {},
      to: "/resources",
    });
  }

  return (
    <AppShell
      headerActions={
        isSignedIn ? (
          <Button nativeButton={false} render={<Link to="/resources/upload" />}>
            <Upload />
            {t("web.resources.action.upload")}
          </Button>
        ) : null
      }
      sidebarContent={
        <ResourceFilters
          categories={directory.categories}
          onChange={setCategoryFilters}
          selectedCategorySlugs={selectedCategorySlugs}
          t={t}
        />
      }
      title={t("web.resources.directory.title")}
    >
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 md:px-6">
        <p className="m-0 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("web.resources.directory.description")}
        </p>

        {directory.invalidFilters.length > 0 ? (
          <p
            className="m-0 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
            role="alert"
          >
            {t("web.resources.directory.invalidFilter")}
          </p>
        ) : directory.resources.length === 0 ? (
          <p className="m-0 rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            {t(
              selectedCategorySlugs.length > 0
                ? "web.resources.directory.emptyFiltered"
                : "web.resources.directory.empty",
            )}
          </p>
        ) : (
          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {directory.resources.map((resource) => (
              <article
                className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm"
                key={resource.id}
              >
                {resource.previewImageUrl ? (
                  <img
                    alt={t("web.resources.detail.previewAlt", {
                      name: resource.name,
                    })}
                    className="aspect-4/3 w-full border-b border-border object-cover"
                    loading="lazy"
                    src={resource.previewImageUrl}
                  />
                ) : (
                  <div className="flex aspect-4/3 items-center justify-center border-b border-border bg-muted text-muted-foreground">
                    <ResourceFileIcon
                      fileName={resource.currentVersion.fileName}
                    />
                    <span className="sr-only">
                      {t("web.resources.detail.fileTypeFallback")}
                    </span>
                  </div>
                )}

                <div className="flex flex-1 flex-col gap-4 p-5">
                  <div className="grid gap-2">
                    <h2 className="m-0 truncate text-lg font-semibold">
                      {resource.name}
                    </h2>
                    <div className="flex flex-wrap gap-1.5">
                      {resource.isPrivate ? (
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

                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="flex-1"
                      disabled={
                        downloadingVersionId === resource.currentVersion.id
                      }
                      onClick={async () => {
                        setDownloadingVersionId(resource.currentVersion.id);
                        try {
                          const url = await downloadResource({
                            data: {
                              resourceId: resource.id,
                              versionId: resource.currentVersion.id,
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
                          setDownloadingVersionId(undefined);
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
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </AppShell>
  );
}

export function ResourceDirectoryStatusPage({
  messageKey,
}: {
  messageKey:
    | "web.resources.directory.loading"
    | "web.resources.error.loadDirectory";
}) {
  const { locale } = useLocale();
  return (
    <AppShell
      title={formatTranslation("web.resources.directory.title", {}, locale)}
    >
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
        <p className="m-0 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          {formatTranslation(messageKey, {}, locale)}
        </p>
      </main>
    </AppShell>
  );
}

function ResourceFilters({
  categories,
  onChange,
  selectedCategorySlugs,
  t,
}: {
  categories: ResourceDirectory["categories"];
  onChange: (categorySlugs: string[]) => void;
  selectedCategorySlugs: string[];
  t: (key: TranslationKey, params?: Record<string, number | string>) => string;
}) {
  return (
    <fieldset className="grid gap-3 px-2">
      <legend className="mb-2 text-sm font-semibold">
        {t("web.resources.directory.filters")}
      </legend>
      <Button
        className="justify-start"
        onClick={() => onChange([])}
        type="button"
        variant={selectedCategorySlugs.length === 0 ? "secondary" : "ghost"}
      >
        {t("web.resources.category.all")}
      </Button>
      {categories.length === 0 ? (
        <p className="m-0 px-3 text-sm text-muted-foreground">
          {t("web.resources.category.noResults")}
        </p>
      ) : (
        categories.map((category) => (
          <label
            className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-3 text-sm hover:bg-sidebar-accent focus-within:ring-2 focus-within:ring-sidebar-ring"
            key={category.id}
          >
            <input
              checked={selectedCategorySlugs.includes(category.slug)}
              className="size-4 accent-primary"
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selectedCategorySlugs, category.slug]
                    : selectedCategorySlugs.filter(
                        (slug) => slug !== category.slug,
                      ),
                )
              }
              type="checkbox"
            />
            <span>{category.name}</span>
          </label>
        ))
      )}
    </fieldset>
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
