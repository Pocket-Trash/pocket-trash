import { createFileRoute } from "@tanstack/react-router";
import { ArchivePage } from "@/pages/archive-page";

export const Route = createFileRoute("/autmog")({
  component: ArchivePage,
});
