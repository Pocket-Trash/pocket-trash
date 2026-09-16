import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link, useNavigate } from "@tanstack/react-router";
import { FileUp, Pencil, Upload, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPageShell } from "@/components/user-page-shell";
import type { getResourceDetail, listOwnedResources } from "@/lib/resources";
import {
  listResourceCategories,
  updateResource,
  uploadResourceVersion,
} from "@/lib/resources";
import { useLocale } from "@/providers/locale-provider";

type OwnedResource = Awaited<ReturnType<typeof listOwnedResources>>[number];
type ResourceDetail = NonNullable<
  Awaited<ReturnType<typeof getResourceDetail>>
>;
type Category = Awaited<ReturnType<typeof listResourceCategories>>[number];

export function ResourceManagementPage({
  resources,
}: {
  resources: OwnedResource[];
}) {
  const { locale } = useLocale();
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  return (
    <UserPageShell title={t("web.resources.management.title")}>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="m-0 text-sm text-muted-foreground">
            {t("web.resources.management.description")}
          </p>
          <Button nativeButton={false} render={<Link to="/resources/upload" />}>
            <Upload />
            {t("web.resources.action.upload")}
          </Button>
        </div>

        {resources.length === 0 ? (
          <p className="m-0 rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            {t("web.resources.management.empty")}
          </p>
        ) : (
          <div className="grid gap-4">
            {resources.map((resource) => (
              <article
                className="grid gap-4 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                key={resource.id}
              >
                <div className="min-w-0">
                  <h2 className="m-0 truncate text-lg font-semibold">
                    {resource.name}
                  </h2>
                  <p className="mt-1 mb-0 text-sm text-muted-foreground">
                    {t("web.resources.detail.version", {
                      version: resource.version,
                    })}
                    {" · "}
                    {t("web.resources.detail.updatedOn", {
                      date: new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                      }).format(new Date(resource.updatedAt)),
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
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
                  <Button
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
                  <Button
                    nativeButton={false}
                    render={
                      <Link
                        params={{ resourceId: String(resource.id) }}
                        to="/resources/$resourceId/versions/new"
                      />
                    }
                  >
                    <FileUp />
                    {t("web.resources.action.uploadNewVersion")}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </UserPageShell>
  );
}

export function ResourceEditPage({ detail }: { detail: ResourceDetail }) {
  const { locale } = useLocale();
  const navigate = useNavigate();
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);
  const [selectedCategories, setSelectedCategories] = useState(
    detail.categories.map(({ name }) => name),
  );
  const [categoryQuery, setCategoryQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const categoryListId = useId();
  const normalizedQuery = categoryQuery.trim();
  const matchingCategory = categories.find(
    ({ name }) =>
      name.toLocaleLowerCase() === normalizedQuery.toLocaleLowerCase(),
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void listResourceCategories({ data: { search: categoryQuery } })
        .then(setCategories)
        .catch(() => setCategories([]));
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [categoryQuery]);

  function addCategory() {
    const category = matchingCategory?.name ?? normalizedQuery;
    if (
      !category ||
      selectedCategories.length >= 10 ||
      selectedCategories.some(
        (selected) =>
          selected.toLocaleLowerCase() === category.toLocaleLowerCase(),
      )
    ) {
      return;
    }
    setSelectedCategories((current) => [...current, category]);
    setCategoryQuery("");
  }

  return (
    <UserPageShell
      title={t("web.resources.management.editTitle", { name: detail.name })}
    >
      <form
        className="grid gap-6 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm md:p-7"
        onSubmit={async (event) => {
          event.preventDefault();
          if (selectedCategories.length === 0) {
            toast.error(t("web.resources.validation.requiredCategory"));
            return;
          }
          setSubmitting(true);
          try {
            await updateResource({ data: new FormData(event.currentTarget) });
            await navigate({
              params: { resourceId: String(detail.id) },
              to: "/resources/$resourceId",
            });
          } catch {
            toast.error(t("web.resources.error.editFailed"));
            setSubmitting(false);
          }
        }}
      >
        <p className="m-0 text-sm text-muted-foreground">
          {t("web.resources.management.editDescription")}
        </p>
        <p className="m-0 rounded-md bg-muted p-3 text-xs text-muted-foreground">
          {t("web.resources.management.metadataOnly")}
        </p>
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
        <label
          className="grid gap-2 text-sm font-medium"
          htmlFor="edit-resource-preview"
        >
          {t("web.resources.upload.previewLabel")}
          <span className="text-xs font-normal text-muted-foreground">
            {t("web.resources.upload.previewHelp")}
          </span>
          <Input
            accept="image/jpeg,image/png,image/webp"
            className="h-auto py-2 file:mr-3 file:font-medium"
            id="edit-resource-preview"
            name="preview"
            type="file"
          />
        </label>

        <div className="grid gap-2 text-sm font-medium">
          <label htmlFor="edit-resource-category">
            {t("web.resources.category.label")}
          </label>
          <div className="flex gap-2">
            <Input
              id="edit-resource-category"
              list={categoryListId}
              onChange={(event) => setCategoryQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCategory();
                }
              }}
              placeholder={t("web.resources.category.search")}
              value={categoryQuery}
            />
            <Button
              disabled={!normalizedQuery || selectedCategories.length >= 10}
              onClick={addCategory}
              type="button"
              variant="secondary"
            >
              {!normalizedQuery
                ? t("web.resources.category.select")
                : matchingCategory
                  ? t("web.resources.action.accept")
                  : t("web.resources.category.create", {
                      category: normalizedQuery,
                    })}
            </Button>
            <datalist id={categoryListId}>
              {categories.map((category) => (
                <option key={category.id} value={category.name} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedCategories.map((category) => (
              <Badge className="gap-1 pr-1" key={category} variant="secondary">
                {category}
                <button
                  aria-label={t("web.resources.category.remove", { category })}
                  className="rounded-full p-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() =>
                    setSelectedCategories((current) =>
                      current.filter((selected) => selected !== category),
                    )
                  }
                  type="button"
                >
                  <X className="size-3" />
                </button>
                <input name="categories" type="hidden" value={category} />
              </Badge>
            ))}
          </div>
        </div>

        <Button disabled={submitting} type="submit">
          {t("web.resources.action.saveChanges")}
        </Button>
      </form>
    </UserPageShell>
  );
}

export function ResourceVersionUploadPage({
  detail,
}: {
  detail: ResourceDetail;
}) {
  const { locale } = useLocale();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  return (
    <UserPageShell
      title={t("web.resources.upload.newVersionTitle", { name: detail.name })}
    >
      <form
        className="grid gap-6 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm md:p-7"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          try {
            const result = await uploadResourceVersion({
              data: new FormData(event.currentTarget),
            });
            toast.success(
              t("web.resources.upload.versionSuccess", {
                version: result.version,
              }),
            );
            await navigate({
              params: { resourceId: String(detail.id) },
              to: "/resources/$resourceId",
            });
          } catch {
            toast.error(t("web.resources.error.saveFailed"));
            setSubmitting(false);
          }
        }}
      >
        <input name="resourceId" type="hidden" value={detail.id} />
        <label
          className="grid gap-2 text-sm font-medium"
          htmlFor="resource-version-file"
        >
          {t("web.resources.upload.filesLabel")}
          <span className="text-xs font-normal text-muted-foreground">
            {t("web.resources.upload.fileHelp", {
              maxFiles: 1,
              maxFileSize: "4 MiB",
              maxSessionSize: "4 MiB",
            })}
          </span>
          <Input
            accept=".stl,.3mf,.step,.stp,.pdf,.txt,.zip"
            className="h-auto py-2 file:mr-3 file:font-medium"
            id="resource-version-file"
            name="file"
            required
            type="file"
          />
        </label>
        <Button disabled={submitting} type="submit">
          <FileUp />
          {t("web.resources.action.uploadNewVersion")}
        </Button>
      </form>
    </UserPageShell>
  );
}
