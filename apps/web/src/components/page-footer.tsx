import { webText } from "@/lib/ui-text";
import { useLocale } from "@/providers/locale-provider";

export function PageFooter() {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof webText>[1]) => webText(locale, key);

  return (
    <footer className="mx-auto mt-9 mb-7 max-w-[720px] border-t border-border px-6 pt-4 text-center text-[12.5px] leading-7 text-muted-foreground">
      <div>
        {t("A resource for")}{" "}
        <a
          className="text-primary underline underline-offset-2"
          href="https://www.reddit.com/r/machinedpens/"
          rel="noopener"
          target="_blank"
        >
          r/machinedpens
        </a>{" "}
        {t("and the Machined Pens Discord.")}
      </div>
      <div>
        {t("Suggestions or contact:")}{" "}
        <a
          className="text-primary underline underline-offset-2"
          href="https://www.reddit.com/user/BVG_Digital/"
          rel="noopener"
          target="_blank"
        >
          u/BVG_Digital
        </a>
      </div>
      <div className="mx-auto mt-3 max-w-[640px] border-t border-border pt-3 text-[11.5px] leading-5 opacity-70">
        {t(
          "Product names, images, and descriptions remain the property of their respective owners.",
        )}{" "}
        {t("Made by a fan; not affiliated with any maker.")}
      </div>
    </footer>
  );
}
