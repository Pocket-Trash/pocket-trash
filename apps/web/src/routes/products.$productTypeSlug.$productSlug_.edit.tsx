import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { slugPattern } from "@/lib/catalog";
import { getCatalogOptions, getCatalogProduct } from "@/lib/catalog-api";
import { ProductFormPage } from "@/pages/catalog-form-pages";

export const Route = createFileRoute(
  "/products/$productTypeSlug/$productSlug_/edit",
)({
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
  beforeLoad: async () => {
    if (!(await getAuthState()).isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
  loader: async ({ params }) => {
    const [initialProduct, options] = await Promise.all([
      getCatalogProduct({ data: params }),
      getCatalogOptions(),
    ]);
    if (!initialProduct?.canEdit) throw notFound();
    return { initialProduct, options };
  },
  component: ProductEditRoute,
});

function ProductEditRoute() {
  const data = Route.useLoaderData();
  return <ProductFormPage {...data} />;
}
