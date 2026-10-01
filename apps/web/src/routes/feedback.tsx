import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";

export const Route = createFileRoute("/feedback")({
  beforeLoad: async () => {
    if (!(await getAuthState()).isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
  component: Outlet,
});
