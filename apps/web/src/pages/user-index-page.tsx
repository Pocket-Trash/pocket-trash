import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import {
  Files,
  FlaskConical,
  Folder,
  ListTodo,
  MessageSquare,
  MessageSquarePlus,
  Settings,
  User,
} from "lucide-react";
import { UserPageShell } from "@/components/user-page-shell";
import { useLocale } from "@/providers/locale-provider";

/**
 * Renders the user navigation hub with eligible feedback links.
 *
 * @param root0 - User navigation state.
 * @returns The user index page.
 */
export function UserIndexPage({
  hasFeedback,
}: {
  /** Whether the user has feedback eligible for the request-history link. */
  hasFeedback: boolean;
}) {
  const { locale } = useLocale();
  /**
   * Formats localized user-navigation copy.
   *
   * @param key - Translation key.
   * @returns The localized message.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const links = [
    {
      icon: User,
      label: t("web.navigation.account"),
      to: "/user/account" as const,
    },
    {
      icon: Files,
      label: t("web.resources.management.title"),
      to: "/user/resources" as const,
    },
    {
      icon: Folder,
      label: t("web.navigation.collections"),
      to: "/user/collections" as const,
    },
    {
      icon: Settings,
      label: t("web.settings.settings"),
      to: "/user/settings" as const,
    },
    {
      icon: FlaskConical,
      label: t("web.navigation.betaFeatures"),
      to: "/user/settings/beta-features" as const,
    },
    {
      icon: MessageSquare,
      label: t("web.feedback.title"),
      to: "/feedback" as const,
    },
    {
      icon: MessageSquarePlus,
      label: t("web.feedback.new.title"),
      to: "/feedback/new" as const,
    },
    ...(hasFeedback
      ? [
          {
            icon: ListTodo,
            label: t("web.feedback.myRequests.title"),
            to: "/feedback/my-requests" as const,
          },
        ]
      : []),
  ];

  return (
    <UserPageShell contentClassName="p-0" title={t("web.navigation.user")}>
      <main className="grid w-full max-w-3xl gap-3 p-4 md:grid-cols-2 md:p-6">
        {links.map(({ icon: Icon, label, to }) => (
          <Link
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-5 text-card-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            key={to}
            to={to}
          >
            <Icon aria-hidden="true" className="size-5" />
            <span className="font-semibold">{label}</span>
          </Link>
        ))}
      </main>
    </UserPageShell>
  );
}
