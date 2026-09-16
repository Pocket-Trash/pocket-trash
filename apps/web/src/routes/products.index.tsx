import { createFileRoute } from "@tanstack/react-router";
import { listCatalogProducts } from "@/lib/catalog-api";
import { ProductsPage } from "@/pages/catalog-pages";

export const Route = createFileRoute("/products/")({
  loader: () => listCatalogProducts(),
  component: ProductsRoute,
});

function ProductsRoute() {
  return <ProductsPage products={Route.useLoaderData()} />;
}
