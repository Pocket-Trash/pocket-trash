import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  canManageProductConfiguration,
  listTrendsProductTypeConfigurations,
} from "@/lib/catalog-api";
import { AdminTrendsConfigPage } from "@/pages/admin-config-pages";

/** Provides permission-gated public Trends configuration. */
export const Route = createFileRoute("/admin/config/trends")({
  /**
   * Requires product-management permission before entering the route.
   *
   * @rejects When authorization cannot be checked or the requester lacks access.
   */
  beforeLoad: async () => {
    if (!(await canManageProductConfiguration())) throw notFound();
  },
  component: AdminTrendsConfigRoute,
  /**
   * Builds localized document metadata.
   *
   * @returns Localized document metadata.
   */
  head: () => ({
    meta: [
      {
        title: formatTranslation(
          "web.admin.config.trends.title" as TranslationKey,
        ),
      },
    ],
  }),
  /**
   * Loads product-type Trends configuration.
   *
   * @returns Product types ordered by name.
   * @rejects When authorization, service loading, or persistence fails.
   */
  loader: () => listTrendsProductTypeConfigurations(),
});

/**
 * Renders the public Trends configuration route.
 *
 * @returns Loaded Trends configuration page.
 */
function AdminTrendsConfigRoute() {
  return <AdminTrendsConfigPage productTypes={Route.useLoaderData()} />;
}
