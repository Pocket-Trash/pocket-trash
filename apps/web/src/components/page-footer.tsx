import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useLocale } from "@/providers/locale-provider";

export function PageFooter() {
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);

  return (
    <footer className="mx-auto mt-9 mb-7 max-w-[720px] border-t border-border px-6 pt-4 text-center text-[12.5px] leading-7 text-muted-foreground">
      <div>
        {t("web.archive.footer.resourceFor")}{" "}
        <a
          className="text-primary underline underline-offset-2"
          href="https://www.reddit.com/r/machinedpens/"
          rel="noopener"
          target="_blank"
        >
          r/machinedpens
        </a>{" "}
        {t("web.archive.footer.discord")}
      </div>
      <div>
        {t("web.archive.footer.suggestionsOrContact")}{" "}
        <a
          className="text-primary underline underline-offset-2"
          href="https://www.reddit.com/user/BVG_Digital/"
          rel="noopener"
          target="_blank"
        >
          u/BVG_Digital
        </a>
      </div>
      <div className="mx-auto mt-3 max-w-[640px] border-t border-border pt-3 text-[11.5px] leading-5">
        {t("web.archive.footer.productOwnership")}{" "}
        {t("web.archive.footer.fanMade")}
      </div>
    </footer>
  );
}
