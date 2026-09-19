import { useAuth } from "@clerk/tanstack-react-start";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ResourceCard } from "@/components/resource-card";
import { Button } from "@/components/ui/button";
import type { listResourceDirectory } from "@/lib/resources";
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
          <Button nativeButton={false} render={<Link to="/resources/add" />}>
            <Plus />
            {t("web.resources.action.add" as TranslationKey)}
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
              <ResourceCard key={resource.id} resource={resource} />
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
