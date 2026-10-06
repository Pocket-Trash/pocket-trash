import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { slugPattern } from "@/lib/catalog";
import { getPublicMaterial } from "@/lib/catalog-api";
import { MaterialDetailPage } from "@/pages/material-pages";

/** Material-detail pagination query parameters. */
const materialSearchSchema = z.object({
  collectionItemsPage: z.coerce.number().int().positive().catch(1),
  productsPage: z.coerce.number().int().positive().catch(1),
});

/** Shows one public material and its catalog usage. */
export const Route = createFileRoute("/materials/$materialSlug")({
  params: {
    /**
     * Rejects malformed material route slugs.
     *
     * @param params - Candidate route parameters.
     * @returns Validated route parameters.
     * @throws A not-found response when the material slug is malformed.
     */
    parse: (params) => {
      if (!slugPattern.test(params.materialSlug)) throw notFound();
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
   * Loads public material detail by its stable slug.
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
  const { materialSlug } = Route.useParams();
  const navigate = useNavigate();
  return (
    <MaterialDetailPage
      collectionItemsPage={search.collectionItemsPage}
      material={material}
      onCollectionItemsPageChange={(collectionItemsPage) =>
        void navigate({
          params: { materialSlug },
          replace: true,
          search: { ...search, collectionItemsPage },
          to: "/materials/$materialSlug",
        })
      }
      onProductsPageChange={(productsPage) =>
        void navigate({
          params: { materialSlug },
          replace: true,
          search: { ...search, productsPage },
          to: "/materials/$materialSlug",
        })
      }
      productsPage={search.productsPage}
    />
  );
}
