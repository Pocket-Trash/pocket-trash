import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/providers/locale-provider";

export function NotFoundPage() {
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-card px-6 py-8 text-center text-card-foreground shadow-sm">
        <p className="text-[12px] font-semibold tracking-[1px] text-muted-foreground uppercase">
          {t("web.page.notFound.title")}
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-[0.5px]">
          {t("web.page.notFound.unavailable")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t("web.page.notFound.description")}
        </p>
        <Button className="mt-6" nativeButton={false} render={<Link to="/" />}>
          {t("web.page.notFound.returnToArchive")}
        </Button>
      </section>
    </main>
  );
}
