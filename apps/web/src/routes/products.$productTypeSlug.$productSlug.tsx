import { createFileRoute, notFound } from "@tanstack/react-router";
import { slugPattern } from "@/lib/catalog";
import { getCatalogProductDetail } from "@/lib/catalog-api";
import { ProductDetailPage } from "@/pages/catalog-pages";

export const Route = createFileRoute("/products/$productTypeSlug/$productSlug")(
  {
    params: {
      parse: (params) => {
        if (
          !slugPattern.test(params.productTypeSlug) ||
          !slugPattern.test(params.productSlug)
        ) {
          throw notFound();
        }
        return params;
      },
    },
    loader: async ({ params }) => {
      const detail = await getCatalogProductDetail({ data: params });
      if (!detail) throw notFound();
      return detail;
    },
    component: ProductRoute,
  },
);

function ProductRoute() {
  const { collectionItems, product } = Route.useLoaderData();
  return (
    <ProductDetailPage collectionItems={collectionItems} product={product} />
  );
}
