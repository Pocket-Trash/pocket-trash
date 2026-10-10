import type { CatalogProductTypeSummary } from "@package/services";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { Boxes } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminPageShell } from "@/components/admin-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setProductTypePartOrAccessory } from "@/lib/catalog-api";
import { useLocale } from "@/providers/locale-provider";

/** TanStack Table features required by product-type configuration. */
const productTypeTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

/** Product-type column builder bound to the configured table features. */
const productTypeColumnHelper = createColumnHelper<
  typeof productTypeTableFeatures,
  CatalogProductTypeSummary
>();

/** Columns used for product-type filtering and pagination. */
const productTypeColumns = productTypeColumnHelper.columns([
  productTypeColumnHelper.accessor("name", { header: "name" }),
  productTypeColumnHelper.accessor("slug", { header: "slug" }),
  productTypeColumnHelper.accessor("isPartOrAccessory", {
    header: "isPartOrAccessory",
  }),
]);

/** Delay that collapses rapid classification changes into one request. */
const productTypeSaveDebounceMs = 300;

/**
 * Renders the administrator configuration hub.
 *
 * @returns Config and Settings navigation page.
 */
export function AdminConfigPage() {
  const { locale } = useLocale();
  const title = formatTranslation("web.admin.config.title", {}, locale);
  return (
    <AdminPageShell section="config" title={title}>
      <main className="grid w-full max-w-2xl gap-3 p-4 md:p-6">
        <Link
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-5 text-card-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          to="/admin/config/products"
        >
          <Boxes aria-hidden="true" className="size-5" />
          <span className="font-semibold">
            {formatTranslation("web.navigation.products", {}, locale)}
          </span>
        </Link>
      </main>
    </AdminPageShell>
  );
}

/**
 * Renders searchable, immediately saved product-type classification controls.
 *
 * @param props - Product configuration page properties.
 * @param props.productTypes - Product types available to configure.
 * @returns Product configuration table.
 */
export function AdminProductConfigPage({
  productTypes,
}: {
  /** Product types available to configure. */
  productTypes: CatalogProductTypeSummary[];
}) {
  const { locale } = useLocale();
  /**
   * Formats localized configuration copy.
   *
   * @param key - Translation key to format.
   * @param values - Optional interpolation values.
   * @returns Localized configuration copy.
   */
  const t = (
    key: TranslationKey,
    values: Readonly<Record<string, unknown>> = {},
  ) => formatTranslation(key, values, locale);
  const [rows, setRows] = useState(productTypes);
  const [query, setQuery] = useState("");
  const [savingIds, setSavingIds] = useState<Set<number>>(() => new Set());
  const persisted = useRef(
    new Map(productTypes.map((type) => [type.id, type.isPartOrAccessory])),
  );
  const timers = useRef(new Map<number, number>());
  const initialState = useMemo(
    () => ({ pagination: { pageIndex: 0, pageSize: 30 } }),
    [],
  );
  const table = useTable(
    {
      columns: productTypeColumns,
      data: rows,
      features: productTypeTableFeatures,
      /**
       * Limits global search to visible product-type identity fields.
       *
       * @param column - Candidate table column.
       * @returns Whether global filtering should search the column.
       */
      getColumnCanGlobalFilter: (column) =>
        column.id === "name" || column.id === "slug",
      globalFilterFn: "includesString",
      initialState,
      onGlobalFilterChange: setQuery,
      state: { globalFilter: query },
    },
    (state) => ({
      globalFilter: state.globalFilter,
      pagination: state.pagination,
    }),
  );

  useEffect(
    /**
     * Registers cleanup for pending debounced updates.
     *
     * @returns Cleanup that clears every pending timer.
     */
    () => () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer);
    },
    [],
  );

  /**
   * Optimistically changes one row and schedules its persisted update.
   *
   * @param productType - Product type being changed.
   * @param isPartOrAccessory - Desired classification.
   */
  function scheduleUpdate(
    productType: CatalogProductTypeSummary,
    isPartOrAccessory: boolean,
  ) {
    setRows((current) =>
      current.map((candidate) =>
        candidate.id === productType.id
          ? { ...candidate, isPartOrAccessory }
          : candidate,
      ),
    );
    const pending = timers.current.get(productType.id);
    if (pending !== undefined) window.clearTimeout(pending);
    timers.current.set(
      productType.id,
      window.setTimeout(() => {
        timers.current.delete(productType.id);
        setSavingIds((current) => new Set(current).add(productType.id));
        void setProductTypePartOrAccessory({
          data: { isPartOrAccessory, productTypeId: productType.id },
        })
          .then((saved) => {
            persisted.current.set(saved.id, saved.isPartOrAccessory);
            setRows((current) =>
              current.map((candidate) =>
                candidate.id === saved.id ? saved : candidate,
              ),
            );
            toast.success(
              t("web.admin.config.products.updated", {
                name: saved.name,
              }),
            );
          })
          .catch(() => {
            const previous = persisted.current.get(productType.id) ?? false;
            setRows((current) =>
              current.map((candidate) =>
                candidate.id === productType.id
                  ? { ...candidate, isPartOrAccessory: previous }
                  : candidate,
              ),
            );
            toast.error(
              t("web.admin.config.products.updateFailed", {
                name: productType.name,
              }),
            );
          })
          .finally(() => {
            setSavingIds((current) => {
              const next = new Set(current);
              next.delete(productType.id);
              return next;
            });
          });
      }, productTypeSaveDebounceMs),
    );
  }

  const pageCount = table.getPageCount();
  const visibleRows = table.getRowModel().rows;
  const title = t("web.navigation.products");

  return (
    <AdminPageShell
      breadcrumbItems={[
        {
          label: t("web.admin.config.title"),
          to: "/admin/config",
        },
      ]}
      section="config"
      title={title}
    >
      <main className="grid w-full max-w-6xl gap-5 p-4 md:p-6">
        <p className="m-0 text-sm text-muted-foreground">
          {t("web.admin.config.products.description")}
        </p>
        <div className="grid max-w-md gap-1.5">
          <label className="sr-only" htmlFor="product-type-search">
            {t("web.admin.config.products.searchPlaceholder")}
          </label>
          <Input
            id="product-type-search"
            onChange={(event) => {
              table.setGlobalFilter(event.target.value);
              table.firstPage();
            }}
            placeholder={t("web.admin.config.products.searchPlaceholder")}
            type="search"
            value={query}
          />
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase">
                <th className="px-4 py-3 font-semibold" scope="col">
                  {t("web.catalog.field.productType")}
                </th>
                <th className="px-4 py-3 font-semibold" scope="col">
                  {t("web.catalog.field.slug")}
                </th>
                <th className="px-4 py-3 text-center font-semibold" scope="col">
                  {t("web.catalog.partsAndAccessories")}
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length ? (
                visibleRows.map(({ original }) => (
                  <tr
                    className="border-b border-border last:border-0"
                    key={original.id}
                  >
                    <th className="px-4 py-3 font-medium" scope="row">
                      {original.name}
                    </th>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {original.slug}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        aria-label={t(
                          "web.admin.config.products.partOrAccessoryLabel",
                          { name: original.name },
                        )}
                        checked={original.isPartOrAccessory}
                        className="size-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        disabled={savingIds.has(original.id)}
                        onChange={(event) =>
                          scheduleUpdate(original, event.target.checked)
                        }
                        type="checkbox"
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-muted-foreground"
                    colSpan={3}
                  >
                    {t("web.admin.config.products.noResults")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pageCount > 1 ? (
          <nav
            aria-label={title}
            className="flex items-center justify-center gap-3"
          >
            <Button
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              type="button"
              variant="outline"
            >
              {t("web.collections.gallery.previousPage")}
            </Button>
            <output aria-live="polite" className="text-sm">
              {t("web.collections.gallery.pageStatus", {
                page: table.state.pagination.pageIndex + 1,
                pageCount,
              })}
            </output>
            <Button
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              type="button"
              variant="outline"
            >
              {t("web.collections.gallery.nextPage")}
            </Button>
          </nav>
        ) : null}
      </main>
    </AdminPageShell>
  );
}
