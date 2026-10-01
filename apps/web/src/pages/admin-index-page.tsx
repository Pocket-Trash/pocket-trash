import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  MessageSquare,
  ScrollText,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { AdminPageShell } from "@/components/admin-page-shell";
import { useLocale } from "@/providers/locale-provider";

/**
 * Renders the permission-filtered administrator landing page.
 *
 * @returns Administrator navigation cards.
 */
export function AdminIndexPage() {
  const { sessionClaims, userId } = useAuth();
  const actor = userId ? normalizeActor(userId, sessionClaims) : undefined;
  const { locale } = useLocale();
  /** Formats administrator copy for the active locale.
   *
   * @param key - Translation key to format.
   * @returns Localized administrator copy.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const feedbackLink = {
    icon: MessageSquare,
    label: t("web.feedback.title"),
    to: "/admin/feedback" as const,
  };
  const notificationsLink = {
    icon: Bell,
    label: t("web.admin.notifications.title"),
    to: "/notifications" as const,
  };
  const auditLink = {
    icon: ScrollText,
    label: t("web.admin.audit.title"),
    to: "/admin/audit" as const,
  };
  const usersLink = {
    icon: UsersRound,
    label: t("web.admin.users.title"),
    to: "/admin/users" as const,
  };
  const primaryLinks = [
    ...(hasPermission(actor, "users.manage") ? [usersLink] : []),
    ...(hasPermission(actor, "audit.read") ? [auditLink] : []),
    ...(hasPermission(actor, "feedback.manage") ? [feedbackLink] : []),
    ...(hasPermission(actor, "feedback.manage") ||
    hasPermission(actor, "resources.manage")
      ? [notificationsLink]
      : []),
  ];

  return (
    <AdminPageShell title={t("web.admin.hub.title")}>
      <main
        aria-label={t("web.admin.hub.description")}
        className="grid content-start gap-4 p-4 md:p-6"
      >
        <div className="flex items-center gap-3">
          <ShieldCheck aria-hidden="true" className="size-6" />
          <p className="m-0 text-sm text-muted-foreground">
            {t("web.admin.hub.description")}
          </p>
        </div>
        <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
          {primaryLinks.map(({ icon: Icon, label, to }) => (
            <Link
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-5 text-card-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              key={to}
              to={to}
            >
              <Icon aria-hidden="true" className="size-5" />
              <span className="font-semibold">{label}</span>
            </Link>
          ))}
        </div>
      </main>
    </AdminPageShell>
  );
}

import { useAuth } from "@clerk/tanstack-react-start";
import { hasPermission, normalizeActor } from "@package/services/authorization";
