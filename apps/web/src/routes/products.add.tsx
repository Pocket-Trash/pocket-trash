import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { getCatalogOptions } from "@/lib/catalog-api";
import { ProductFormPage } from "@/pages/catalog-form-pages";

/**
 * Defines the `/products/add` route and its data lifecycle.
 */
export const Route = createFileRoute("/products/add")({
  /**
   * Requires authentication before entering the products add route.
   *
   * @throws When navigation must continue at another route.
   * @rejects When navigation must continue at another route.
   */
  beforeLoad: async () => {
    if (!(await getAuthState()).isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
  /**
   * Loads catalog options for creating a product.
   *
   * @returns The route's loader data.
   */
  loader: () => getCatalogOptions(),
  component: ProductAddRoute,
});

/**
 * Renders the product add route content.
 *
 * @returns The rendered route UI.
 */
function ProductAddRoute() {
  return <ProductFormPage options={Route.useLoaderData()} />;
}
