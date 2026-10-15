import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { getPublishedUserTrends } from "@/lib/catalog-api";
import { parseCatalogTrendsSearch } from "@/lib/catalog-filters";
import { UserTrendsPage } from "@/pages/user-trends-page";

/** Shows one user's explicitly published, privacy-filtered Trends. */
export const Route = createFileRoute("/users/$username/trends")({
  component: PublicUserTrendsRoute,
  /**
   * Prevents explicitly shared personal Trends from entering search indexes.
   *
   * @returns Route title and noindex directive.
   */
  head: () => ({
    meta: [
      { title: formatTranslation("web.userTrends.title" as never) },
      { content: "noindex,follow", name: "robots" },
    ],
  }),
  /**
   * Loads an exact published username without distinguishing private from absent profiles.
   *
   * @param context - Route parameters.
   * @returns Privacy-filtered public collections and items.
   * @rejects With not-found for absent and private profiles.
   */
  loader: async ({ params }) => {
    const owner = await getPublishedUserTrends({
      data: { username: params.username },
    });
    if (!owner) throw notFound();
    return owner;
  },
  validateSearch: parseCatalogTrendsSearch,
});

/**
 * Connects published owner data and stable URL filter state to personal Trends.
 *
 * @returns Published personal Trends route content.
 */
function PublicUserTrendsRoute() {
  const navigate = useNavigate();
  const owner = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <UserTrendsPage
      collectionCount={owner.collections.length}
      items={owner.items}
      onSearchChange={(nextSearch) =>
        void navigate({
          params: { username: owner.username },
          replace: true,
          search: nextSearch,
          to: "/users/$username/trends",
        })
      }
      publicUsername={owner.username}
      search={search}
    />
  );
}
