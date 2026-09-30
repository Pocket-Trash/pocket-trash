import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { getCatalogOptions } from "@/lib/catalog-api";
import { ProductFormPage } from "@/pages/catalog-form-pages";

export const Route = createFileRoute("/products/add")({
  beforeLoad: async () => {
    if (!(await getAuthState()).isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
  loader: () => getCatalogOptions(),
  component: ProductAddRoute,
});

function ProductAddRoute() {
  return <ProductFormPage options={Route.useLoaderData()} />;
}
