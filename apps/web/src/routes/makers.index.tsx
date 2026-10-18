import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { listPublicMakers } from "@/lib/catalog-api";
import { parseDirectorySearch } from "@/lib/directory-search";
import { MakersDirectoryPage } from "@/pages/makers-directory-page";

/** Shows the public maker directory. */
export const Route = createFileRoute("/makers/")({
  validateSearch: parseDirectorySearch,
  /**
   * Loads public maker summaries and counts.
   *
   * @returns Public maker directory entries.
   * @rejects When maker aggregation or image delivery fails.
   */
  loader: () => listPublicMakers(),
  component: MakersRoute,
});

/**
 * Renders the public maker directory route.
 *
 * @returns The maker directory page.
 */
function MakersRoute() {
  const navigate = useNavigate();
  const { q = "" } = Route.useSearch();
  return (
    <MakersDirectoryPage
      makers={Route.useLoaderData()}
      onQueryChange={(query) =>
        void navigate({
          replace: true,
          search: query ? { q: query } : {},
          to: "/makers",
        })
      }
      query={q}
    />
  );
}
