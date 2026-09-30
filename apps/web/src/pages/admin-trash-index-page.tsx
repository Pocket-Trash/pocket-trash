import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { ImageOff, PackageX } from "lucide-react";
import { AdminPageShell } from "@/components/admin-page-shell";
import { useLocale } from "@/providers/locale-provider";

export function AdminTrashIndexPage() {
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const links = [
    {
      icon: PackageX,
      label: t("web.resources.trash.adminTitle"),
      to: "/admin/trash/resources" as const,
    },
    {
      icon: ImageOff,
      label: t("web.admin.hub.catalogImageTrash"),
      to: "/admin/trash/catalog-images" as const,
    },
  ];

  return (
    <AdminPageShell
      breadcrumbItems={[{ label: t("web.navigation.admin"), to: "/admin" }]}
      section="trash"
      title={t("web.admin.trash.title")}
    >
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
    </AdminPageShell>
  );
}
