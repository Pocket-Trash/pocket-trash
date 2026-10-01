import { createFileRoute } from "@tanstack/react-router";
import { ArchivePage } from "@/pages/archive-page";

/**
 * Shows the archive landing page.
 */
export const Route = createFileRoute("/autmog")({
  component: ArchivePage,
});
