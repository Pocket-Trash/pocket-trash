import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Defines the `/resources` route and its data lifecycle.
 */
export const Route = createFileRoute("/resources")({
  component: Outlet,
});
