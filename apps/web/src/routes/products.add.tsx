import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { getCatalogOptions } from "@/lib/catalog-api";
import { ProductFormPage } from "@/pages/catalog-form-pages";

/**
 * Provides authenticated catalog-product creation.
 */
export const Route = createFileRoute("/products/add")({
  /**
   * Requires authentication before entering the products add route.
   *
   * @rejects When an unauthenticated visitor is redirected to sign in.
   */
  beforeLoad: async () => {
    if (!(await getAuthState()).isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
  /**
   * Loads catalog options for creating a product.
   *
   * @returns Catalog form options.
   * @rejects When catalog form options cannot be loaded.
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
