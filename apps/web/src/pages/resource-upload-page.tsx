import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createResource, listResourceCategories } from "@/lib/resources";
import { useLocale } from "@/providers/locale-provider";

type Category = Awaited<ReturnType<typeof listResourceCategories>>[number];

export function ResourceUploadPage() {
  const { locale } = useLocale();
  const navigate = useNavigate();
  const categoryListId = useId();
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void listResourceCategories({ data: { search: categoryQuery } })
        .then(setCategories)
        .catch(() => setCategories([]));
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [categoryQuery]);

  const normalizedQuery = categoryQuery.trim();
  const matchingCategory = categories.find(
    ({ name }) =>
      name.toLocaleLowerCase() === normalizedQuery.toLocaleLowerCase(),
  );

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
    <AppShell title={t("web.resources.upload.title")}>
      <main className="mx-auto w-full max-w-2xl px-4 py-8 md:px-6">
        <form
          className="grid gap-6 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm md:p-7"
          encType="multipart/form-data"
          onSubmit={async (event) => {
            event.preventDefault();
            if (selectedCategories.length === 0) {
              toast.error(t("web.resources.validation.requiredCategory"));
              return;
            }

            setSubmitting(true);
            try {
              const result = await createResource({
                data: new FormData(event.currentTarget),
              });
              toast.success(t("web.resources.upload.success"));
              await navigate({
                params: { resourceId: String(result.id) },
                to: "/resources/$resourceId",
              });
            } catch {
              toast.error(t("web.resources.error.saveFailed"));
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <p className="m-0 text-sm leading-6 text-muted-foreground">
            {t("web.resources.upload.description")}
          </p>

          <Field
            htmlFor="resource-name"
            label={t("web.resources.upload.nameLabel")}
          >
            <Input
              id="resource-name"
              maxLength={120}
              name="name"
              placeholder={t("web.resources.upload.namePlaceholder")}
              required
            />
          </Field>

          <Field
            htmlFor="resource-description"
            label={t("web.resources.upload.descriptionLabel")}
          >
            <textarea
              className="min-h-32 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              id="resource-description"
              maxLength={5000}
              name="description"
              placeholder={t("web.resources.upload.descriptionPlaceholder")}
              required
            />
          </Field>

          <Field
            description={t("web.resources.upload.fileHelp", {
              maxFileSize: "4 MiB",
              maxFiles: 10,
              maxSessionSize: "40 MiB",
            })}
            htmlFor="resource-file"
            label={t("web.resources.upload.filesLabel")}
          >
            <Input
              accept=".stl,.3mf,.step,.stp,.pdf,.txt,.zip"
              className="h-auto py-2 file:mr-3 file:font-medium"
              id="resource-file"
              multiple
              name="files"
              required
              type="file"
            />
            <p className="m-0 text-xs text-muted-foreground">
              {t("web.resources.upload.fileTypes")}
            </p>
          </Field>

          <Field
            description={t("web.resources.upload.previewHelp")}
            htmlFor="resource-preview"
            label={t("web.resources.upload.previewLabel")}
          >
            <Input
              accept="image/jpeg,image/png,image/webp"
              className="h-auto py-2 file:mr-3 file:font-medium"
              id="resource-preview"
              name="preview"
              type="file"
            />
            <p className="m-0 text-xs text-muted-foreground">
              {t("web.resources.upload.previewTypes")}
            </p>
          </Field>

          <Field
            htmlFor="resource-category"
            label={t("web.resources.category.label")}
          >
            <div className="flex gap-2">
              <Input
                aria-label={t("web.resources.category.search")}
                id="resource-category"
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
                <Badge
                  className="gap-1 pr-1"
                  key={category}
                  variant="secondary"
                >
                  {category}
                  <button
                    aria-label={t("web.resources.category.remove", {
                      category,
                    })}
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
            <p className="m-0 text-xs text-muted-foreground">
              {t("web.resources.category.selectedCount", {
                count: selectedCategories.length,
              })}
            </p>
          </Field>

          <Button disabled={submitting} type="submit">
            {t("web.resources.action.upload")}
          </Button>
        </form>
      </main>
    </AppShell>
  );
}

function Field({
  children,
  description,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  description?: string;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="grid gap-2 text-sm font-medium">
      <label htmlFor={htmlFor}>{label}</label>
      {description ? (
        <span className="text-xs leading-5 font-normal text-muted-foreground">
          {description}
        </span>
      ) : null}
      {children}
    </div>
  );
}
