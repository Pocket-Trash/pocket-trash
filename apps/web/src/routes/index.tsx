import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/pages/catalog-pages";

/**
 * Defines the `/` route and its data lifecycle.
 */
export const Route = createFileRoute("/")({
  component: HomePage,
});
