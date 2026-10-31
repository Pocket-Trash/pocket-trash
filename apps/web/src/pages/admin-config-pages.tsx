import {
  faBoxesStacked,
  faChartColumn,
} from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type {
  CatalogProductTypeSummary,
  TrendsProductTypeConfiguration,
} from "@package/services";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useForm, useStore } from "@tanstack/react-form";
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
import { useMemo } from "react";
import { AdminPageShell } from "@/components/admin-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProductTypeConfiguration } from "@/hooks/use-product-type-configuration";
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

/** Configuration keys supplied by the stacked localization change. */
type AdminConfigTranslationKey =
  | TranslationKey
  | "web.admin.config.trends.alwaysIncluded"
  | "web.admin.config.trends.description"
  | "web.admin.config.trends.includeLabel"
  | "web.admin.config.trends.included"
  | "web.admin.config.trends.title"
  | "web.admin.config.trends.updateFailed"
  | "web.admin.config.trends.updated";

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
          <FontAwesomeIcon
            aria-hidden="true"
            className="size-5"
            icon={faBoxesStacked}
          />
          <span className="font-semibold">
            {formatTranslation("web.navigation.products", {}, locale)}
          </span>
        </Link>
        <Link
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-5 text-card-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          to="/admin/config/trends"
        >
          <FontAwesomeIcon
            aria-hidden="true"
            className="size-5"
            icon={faChartColumn}
          />
          <span className="font-semibold">
            {formatTranslation(
              "web.admin.config.trends.title" as TranslationKey,
              {},
              locale,
            )}
          </span>
        </Link>
      </main>
    </AdminPageShell>
  );
}

/**
 * Renders public Trends inclusion controls for product types.
 *
 * @param props - Trends configuration page properties.
 * @param props.productTypes - Product types available to configure.
 * @returns Trends configuration table.
 */
export function AdminTrendsConfigPage({
  productTypes,
}: {
  /** Product types available to configure. */
  productTypes: TrendsProductTypeConfiguration[];
}) {
  const { locale } = useLocale();
  /**
   * Formats localized Trends configuration copy.
   *
   * @param key - Translation key to format.
   * @param values - Optional interpolation values.
   * @returns Localized configuration copy.
   */
  const t = (
    key: AdminConfigTranslationKey,
    values: Readonly<Record<string, unknown>> = {},
  ) => formatTranslation(key as TranslationKey, values, locale);
  const { rows, savingIds, changeRow } = useProductTypeConfiguration(
    productTypes,
    "trends",
  );
  const title = t("web.admin.config.trends.title");
  return (
    <AdminPageShell
      breadcrumbItems={[
        { label: t("web.admin.config.title"), to: "/admin/config" },
      ]}
      section="config"
      title={title}
    >
      <main className="grid w-full max-w-4xl gap-5 p-4 md:p-6">
        <p className="m-0 text-sm text-muted-foreground">
          {t("web.admin.config.trends.description")}
        </p>
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
                  {t("web.admin.config.trends.included")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((productType) => (
                <tr
                  className="border-b border-border last:border-0"
                  key={productType.id}
                >
                  <th className="px-4 py-3 font-medium" scope="row">
                    {productType.name}
                  </th>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {productType.slug}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      aria-label={t("web.admin.config.trends.includeLabel", {
                        name: productType.name,
                      })}
                      checked={productType.includeInTrends}
                      className="size-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      disabled={
                        !productType.isPartOrAccessory ||
                        savingIds.has(productType.id)
                      }
                      onChange={(event) =>
                        changeRow(productType.id, event.target.checked)
                      }
                      type="checkbox"
                    />
                    {!productType.isPartOrAccessory ? (
                      <span className="sr-only">
                        {t("web.admin.config.trends.alwaysIncluded")}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  const { rows, savingIds, changeRow } = useProductTypeConfiguration(
    productTypes,
    "classification",
  );
  const form = useForm({ defaultValues: { query: "" } });
  const query = useStore(form.store, (state) => state.values.query);
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
      /**
       * Reconciles the table's search command into its form-owned field.
       * @param update - Current query or field updater.
       * @returns Nothing.
       */
      onGlobalFilterChange: (update) => form.setFieldValue("query", update),
      state: { globalFilter: query },
    },
    (state) => ({
      globalFilter: state.globalFilter,
      pagination: state.pagination,
    }),
  );

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
                          changeRow(original.id, event.target.checked)
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
