import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Provides the public resource route tree.
 */
export const Route = createFileRoute("/resources")({
  component: Outlet,
});
