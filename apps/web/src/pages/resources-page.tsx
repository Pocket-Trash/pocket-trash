import { useAuth } from "@clerk/tanstack-react-start";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/providers/locale-provider";

export function ResourcesPage() {
  const { isSignedIn } = useAuth();
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);

  return (
    <AppShell
      headerActions={
        isSignedIn ? (
          <Button nativeButton={false} render={<Link to="/resources/upload" />}>
            <Upload />
            {t("web.resources.action.upload")}
          </Button>
        ) : null
      }
      title={t("web.resources.directory.title")}
    >
      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
        <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
          <p className="m-0 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("web.resources.directory.description")}
          </p>
        </section>
      </main>
    </AppShell>
  );
}
