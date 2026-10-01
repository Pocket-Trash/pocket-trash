import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { hasAdminAccess } from "@/lib/authorization";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    if (!(await hasAdminAccess())) throw notFound();
  },
  component: Outlet,
});
