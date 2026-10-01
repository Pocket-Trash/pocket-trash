import { createFileRoute } from "@tanstack/react-router";
import { ArchivePage } from "@/pages/archive-page";

/**
 * Defines the `/autmog` route and its data lifecycle.
 */
export const Route = createFileRoute("/autmog")({
  component: ArchivePage,
});
