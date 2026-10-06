import { createFileRoute } from "@tanstack/react-router";
import { listPublicMakers } from "@/lib/catalog-api";
import { MakersDirectoryPage } from "@/pages/makers-directory-page";

/** Shows the public maker directory. */
export const Route = createFileRoute("/makers/")({
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
  return <MakersDirectoryPage makers={Route.useLoaderData()} />;
}
