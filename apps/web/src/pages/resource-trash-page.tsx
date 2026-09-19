import {
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPageShell } from "@/components/user-page-shell";
import type { listAdminResourceTrash } from "@/lib/resources";
import { restoreResource } from "@/lib/resources";
import { useLocale } from "@/providers/locale-provider";

type TrashItem = Awaited<ReturnType<typeof listAdminResourceTrash>>[number];

export function OwnerResourceTrashPage({
  initialResources,
}: {
  initialResources: TrashItem[];
}) {
  const { locale } = useLocale();
  return (
    <UserPageShell
      title={formatTranslation("web.resources.trash.ownerTitle", {}, locale)}
    >
      <ResourceTrashList
        emptyKey="web.resources.trash.ownerEmpty"
        initialResources={initialResources}
        locale={locale}
        showActor={false}
      />
    </UserPageShell>
  );
}

export function AdminResourceTrashPage({
  initialResources,
}: {
  initialResources: TrashItem[];
}) {
  const { locale } = useLocale();
  return (
    <AppShell
      sidebarContent={null}
      title={formatTranslation("web.resources.trash.adminTitle", {}, locale)}
    >
      <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
        <ResourceTrashList
          emptyKey="web.resources.trash.adminEmpty"
          initialResources={initialResources}
          locale={locale}
          showActor
        />
      </main>
    </AppShell>
  );
}

function ResourceTrashList({
  emptyKey,
  initialResources,
  locale,
  showActor,
}: {
  emptyKey: TranslationKey;
  initialResources: TrashItem[];
  locale: SupportedLocale;
  showActor: boolean;
}) {
  const [resources, setResources] = useState(initialResources);
  const [restoringId, setRestoringId] = useState<number>();
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  if (resources.length === 0) {
    return (
      <p className="m-0 rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
        {t(emptyKey)}
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {resources.map((resource) => (
        <article
          className="grid gap-4 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          key={resource.id}
        >
          <div className="grid min-w-0 gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="m-0 truncate text-lg font-semibold">
                {resource.name}
              </h2>
              <Badge variant="secondary">
                {t(
                  (resource.isPrivate
                    ? "web.resources.visibility.private"
                    : "web.resources.visibility.public") as TranslationKey,
                )}
              </Badge>
            </div>
            <p className="m-0 text-sm text-muted-foreground">
              {t("web.resources.trash.deletedOn", {
                date: formatDate(resource.deletedAt, locale),
              })}
            </p>
            {showActor ? (
              <div className="grid gap-1 text-sm text-muted-foreground">
                <span>
                  {t("web.resources.trash.deletedBy", {
                    user: resource.deletedByClerkId,
                  })}
                </span>
                <span>
                  {t(
                    resource.deletedByRole === "admin"
                      ? "web.resources.trash.deletionRoleAdmin"
                      : "web.resources.trash.deletionRoleOwner",
                  )}
                </span>
              </div>
            ) : null}
          </div>
          <Button
            disabled={restoringId === resource.id}
            onClick={async () => {
              setRestoringId(resource.id);
              try {
                await restoreResource({ data: { resourceId: resource.id } });
                setResources((current) =>
                  current.filter(({ id }) => id !== resource.id),
                );
                toast.success(
                  t("web.resources.trash.restoreSuccess", {
                    name: resource.name,
                  }),
                );
              } catch {
                toast.error(
                  t("web.resources.trash.restoreFailure", {
                    name: resource.name,
                  }),
                );
              } finally {
                setRestoringId(undefined);
              }
            }}
            type="button"
            variant="outline"
          >
            <RotateCcw />
            {t("web.resources.action.restore")}
          </Button>
        </article>
      ))}
    </div>
  );
}

function formatDate(value: Date, locale: SupportedLocale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
