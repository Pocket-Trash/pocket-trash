import { createFileRoute, notFound } from "@tanstack/react-router";
import { slugPattern } from "@/lib/catalog";
import { getCatalogProduct } from "@/lib/catalog-api";
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
      const product = await getCatalogProduct({ data: params });
      if (!product) throw notFound();
      return product;
    },
    component: ProductRoute,
  },
);

function ProductRoute() {
  return <ProductDetailPage product={Route.useLoaderData()} />;
}
