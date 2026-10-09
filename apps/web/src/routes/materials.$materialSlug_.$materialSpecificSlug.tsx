import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { slugPattern } from "@/lib/catalog";
import { getPublicMaterial } from "@/lib/catalog-api";
import { materialHead, materialSearchSchema } from "@/lib/materials";
import { MaterialDetailPage } from "@/pages/material-pages";

/** Shows one canonical alloy or grade and its exact public usage. */
export const Route = createFileRoute(
  "/materials/$materialSlug_/$materialSpecificSlug",
)({
  params: {
    /**
     * Rejects malformed material route slugs.
     *
     * @param params - Candidate route parameters.
     * @returns Validated route parameters.
     * @throws A not-found response when the material slug is malformed.
     */
    parse: (params) => {
      if (
        !slugPattern.test(params.materialSlug) ||
        !slugPattern.test(params.materialSpecificSlug)
      )
        throw notFound();
      return params;
    },
  },
  /**
   * Normalizes material-detail pagination parameters.
   *
   * @param search - Candidate search parameters.
   * @returns Validated material-detail pagination parameters.
   */
  validateSearch: (search) => materialSearchSchema.parse(search),
  /**
   * Loads public material detail by its scoped slug pair.
   *
   * @param context - Route loader context.
   * @param context.params - Validated material route parameters.
   * @returns The public material.
   * @rejects A not-found response when the material does not exist.
   */
  loader: async ({ params }) => {
    const material = await getPublicMaterial({ data: params });
    if (!material) throw notFound();
    return material;
  },
  /**
   * Describes the canonical exact-specific material page.
   *
   * @param context - Loaded public material context.
   * @param context.loaderData - Public material data.
   * @returns Canonical page metadata.
   */
  head: ({ loaderData }) => materialHead(loaderData),
  component: MaterialRoute,
});

/**
 * Renders the material detail route with independent URL pagination.
 *
 * @returns The material detail route.
 */
function MaterialRoute() {
  const material = Route.useLoaderData();
  const search = Route.useSearch();
  const { materialSlug, materialSpecificSlug } = Route.useParams();
  const navigate = useNavigate();
  return (
    <MaterialDetailPage
      collectionItemsPage={search.collectionItemsPage}
      material={material}
      onCollectionItemsPageChange={(collectionItemsPage) =>
        void navigate({
          params: { materialSlug, materialSpecificSlug },
          replace: true,
          search: { ...search, collectionItemsPage },
          to: "/materials/$materialSlug/$materialSpecificSlug",
        })
      }
      onProductsPageChange={(productsPage) =>
        void navigate({
          params: { materialSlug, materialSpecificSlug },
          replace: true,
          search: { ...search, productsPage },
          to: "/materials/$materialSlug/$materialSpecificSlug",
        })
      }
      productsPage={search.productsPage}
    />
  );
}
