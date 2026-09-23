import { createFileRoute } from "@tanstack/react-router";
import { UserIndexPage } from "@/pages/user-index-page";

export const Route = createFileRoute("/user/")({
  component: UserIndexPage,
});
