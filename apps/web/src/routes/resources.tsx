import { createFileRoute } from "@tanstack/react-router";
import { ResourcesPage } from "@/pages/catalog-pages";

export const Route = createFileRoute("/resources")({
  component: ResourcesPage,
});
