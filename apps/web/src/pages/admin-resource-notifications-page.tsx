import {
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { listResourceNotifications } from "@/lib/resources";
import {
  markResourceNotificationRead,
  listResourceNotifications as reloadResourceNotifications,
} from "@/lib/resources";
import { useLocale } from "@/providers/locale-provider";

type Notification = Awaited<
  ReturnType<typeof listResourceNotifications>
>[number];

export function AdminResourceNotificationsPage({
  initialNotifications,
}: {
  initialNotifications: Notification[];
}) {
  const { locale } = useLocale();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [acceptingId, setAcceptingId] = useState<number>();
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  async function accept(notificationId: number) {
    setAcceptingId(notificationId);
    try {
      await markResourceNotificationRead({ data: { notificationId } });
      setNotifications(await reloadResourceNotifications());
      toast.success(t("web.resources.notification.accepted"));
    } catch {
      toast.error(t("web.resources.notification.acceptFailed"));
    } finally {
      setAcceptingId(undefined);
    }
  }

  return (
    <AppShell
      sidebarContent={null}
      title={t("web.resources.notification.title")}
    >
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6 md:px-6">
        <p className="m-0 text-sm text-muted-foreground">
          {t("web.resources.notification.description")}
        </p>
        {notifications.length === 0 ? (
          <p className="m-0 rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            {t("web.resources.notification.empty")}
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
                        notification.type === "resource_created"
                          ? "web.resources.notification.resourceCreated"
                          : "web.resources.notification.categoryCreated",
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
                  {notification.type === "resource_created" ? (
                    <Link
                      className="font-medium text-primary underline-offset-4 hover:underline"
                      params={{ resourceId: String(notification.resourceId) }}
                      to="/resources/$resourceId"
                    >
                      {t("web.resources.notification.resourceName", {
                        name: notification.resourceName,
                      })}
                    </Link>
                  ) : (
                    <span className="font-medium">
                      {t("web.resources.notification.categoryName", {
                        name: notification.categoryName ?? "",
                      })}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {t("web.resources.notification.categories", {
                      categories: notification.categories.join(", "),
                    })}
                  </span>
                  <span className="text-muted-foreground">
                    {t("web.resources.notification.uploader", {
                      uploader: notification.uploaderClerkId,
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
    </AppShell>
  );
}

function formatDate(value: Date, locale: SupportedLocale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
