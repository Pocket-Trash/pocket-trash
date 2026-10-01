import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/pages/catalog-pages";

/**
 * Shows the public home page.
 */
export const Route = createFileRoute("/")({
  component: HomePage,
});
