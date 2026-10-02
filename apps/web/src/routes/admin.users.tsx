import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageUsers } from "@/lib/user-bans";
import { AdminUsersPage } from "@/pages/admin-users-page";

/** Permission-gated administrator user-access route. */
export const Route = createFileRoute("/admin/users")({
  /**
   * Requires user-management permission.
   *
   * @returns Completion when the requester is authorized.
   * @rejects When authorization cannot be checked or the requester lacks user-management permission.
   */
  beforeLoad: async () => {
    if (!(await canManageUsers())) throw notFound();
  },
  component: AdminUsersPage,
  /**
   * Builds localized document metadata.
   *
   * @returns Localized document metadata.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.admin.users.title") }],
  }),
});
