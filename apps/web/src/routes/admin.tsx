import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { isResourceAdmin } from "@/lib/resources";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    if (!(await isResourceAdmin())) throw notFound();
  },
  component: Outlet,
});
