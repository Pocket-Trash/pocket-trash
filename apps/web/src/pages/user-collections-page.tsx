import { UserPageShell } from "@/components/user-page-shell";
import { webText } from "@/lib/ui-text";
import { useLocale } from "@/providers/locale-provider";

export function UserCollectionsPage() {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof webText>[1]) => webText(locale, key);

  return (
    <UserPageShell title={t("Collections")}>
      <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
        {t("Collections will be available later.")}
      </div>
    </UserPageShell>
  );
}
