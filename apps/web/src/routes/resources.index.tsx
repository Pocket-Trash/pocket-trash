import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { ResourcesPage } from "@/pages/resources-page";

export const Route = createFileRoute("/resources/")({
  component: ResourcesPage,
  head: () => ({
    meta: [{ title: formatTranslation("web.resources.directory.title") }],
  }),
});
