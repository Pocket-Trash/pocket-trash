import {
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPageShell } from "@/components/admin-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { listFeedbackNotifications } from "@/lib/feedback";
import {
  markFeedbackNotificationRead,
  listFeedbackNotifications as reloadFeedbackNotifications,
} from "@/lib/feedback";
import { useLocale } from "@/providers/locale-provider";

/** Feedback notification displayed to administrators. */
type Notification = Awaited<
  ReturnType<typeof listFeedbackNotifications>
>[number];

/** Renders feedback notifications and read-state controls.
 *
 * @param props - Notification page properties.
 * @param props.initialNotifications - Notifications loaded for the initial render.
 * @returns The feedback notification administration page.
 */
export function AdminFeedbackNotificationsPage({
  initialNotifications,
}: {
  /** Notifications loaded for the initial render. */
  initialNotifications: Notification[];
}) {
  const { locale } = useLocale();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [acceptingId, setAcceptingId] = useState<number>();
  /** Formats feedback notification copy for the active locale.
   *
   * @param key - Translation key to format.
   * @param params - Values interpolated into the translation.
   * @returns Localized notification copy.
   */
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  /** Marks a feedback notification read and refreshes the list.
   *
   * @param notificationId - Notification identifier to accept.
   * @returns Completion after the notification list is refreshed or an error is shown.
   */
  async function accept(notificationId: number) {
    setAcceptingId(notificationId);
    try {
      await markFeedbackNotificationRead({ data: { notificationId } });
      setNotifications(await reloadFeedbackNotifications());
      toast.success(t("web.resources.notification.accepted"));
    } catch {
      toast.error(t("web.resources.notification.acceptFailed"));
    } finally {
      setAcceptingId(undefined);
    }
  }

  return (
    <AdminPageShell
      breadcrumbItems={[
        { label: t("web.navigation.admin"), to: "/admin" },
        { label: t("web.admin.notifications.title"), to: "/notifications" },
      ]}
      section="notifications"
      title={t("web.feedback.notification.title")}
    >
      <main className="grid w-full max-w-5xl gap-6 px-4 py-6 md:px-6">
        <p className="m-0 text-sm text-muted-foreground">
          {t("web.feedback.notification.description")}
        </p>
        {notifications.length === 0 ? (
          <p className="m-0 rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            {t("web.feedback.notification.empty")}
          </p>
        ) : (
          <div className="grid gap-4">
            {notifications.map((notification) => (
              <article
                className="grid gap-4 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                key={notification.id}
              >
                <div className="grid min-w-0 gap-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>
                      {t(
                        notification.type === "submitted"
                          ? "web.feedback.notification.submitted"
                          : "web.feedback.notification.completed",
                      )}
                    </Badge>
                    <Badge
                      variant={notification.readAt ? "outline" : "secondary"}
                    >
                      {t(
                        notification.readAt
                          ? "web.resources.notification.read"
                          : "web.resources.notification.unread",
                      )}
                    </Badge>
                  </div>
                  <h2 className="m-0 truncate text-base font-semibold">
                    {notification.title}
                  </h2>
                  <span className="text-muted-foreground">
                    {t("web.feedback.metadata.submittedBy", {
                      submitter:
                        notification.submitterUsername ??
                        t("web.navigation.user"),
                    })}
                  </span>
                  <span className="text-muted-foreground">
                    {t("web.resources.notification.createdAt", {
                      date: formatDate(notification.createdAt, locale),
                    })}
                  </span>
                </div>
                <Button
                  disabled={
                    Boolean(notification.readAt) ||
                    acceptingId === notification.id
                  }
                  onClick={() => void accept(notification.id)}
                  type="button"
                  variant="outline"
                >
                  <Check />
                  {t("web.resources.action.accept")}
                </Button>
              </article>
            ))}
          </div>
        )}
      </main>
    </AdminPageShell>
  );
}

/** Formats a notification timestamp for the active locale.
 *
 * @param value - Timestamp to format.
 * @param locale - Locale controlling date and time formatting.
 * @returns The localized medium-date and short-time label.
 */
function formatDate(value: Date, locale: SupportedLocale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
