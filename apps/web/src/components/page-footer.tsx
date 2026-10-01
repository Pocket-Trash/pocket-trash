import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { useLocale } from "@/providers/locale-provider";

/** Localized internal links shown in the site footer. */
const footerLinks = [
  { labelKey: "web.navigation.home", to: "/" },
  { labelKey: "web.navigation.changelog", to: "/changelog" },
  { labelKey: "web.navigation.help", to: "/help" },
  { labelKey: "web.navigation.contact", to: "/contact" },
  { labelKey: "web.feedback.title", to: "/feedback" },
  { labelKey: "web.navigation.privacy", to: "/privacy" },
  {
    labelKey: "web.navigation.termsOfService",
    to: "/terms-of-service",
  },
] as const satisfies ReadonlyArray<{
  /** Translation key for the link label. */
  labelKey: TranslationKey;
  /** Supported internal footer destination. */
  to:
    | "/"
    | "/changelog"
    | "/contact"
    | "/feedback"
    | "/help"
    | "/privacy"
    | "/terms-of-service";
}>;

const linkClassName =
  "rounded-sm text-primary underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const socialLinkClassName =
  "rounded-sm p-2 text-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PageFooter({ year }: { year: number }) {
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);

  return (
    <footer className="mx-auto mt-9 mb-7 w-full max-w-[720px] border-t border-border px-4 pt-5 text-center text-[12.5px] leading-7 text-muted-foreground">
      <p>{t("web.footer.tagline")}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {footerLinks.map(({ labelKey, to }) => (
          <Link className={linkClassName} key={to} to={to}>
            {t(labelKey)}
          </Link>
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-2">
        <a
          aria-label={t("web.footer.xNewTab")}
          className={socialLinkClassName}
          href="https://x.com/pockettrashapp"
          rel="noopener noreferrer"
          target="_blank"
        >
          <span className="sr-only">{t("web.footer.xNewTab")}</span>
          <svg
            aria-hidden="true"
            className="size-5"
            fill="currentColor"
            focusable="false"
            viewBox="0 0 24 24"
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
        <a
          aria-label={t("web.footer.discordNewTab")}
          className={socialLinkClassName}
          href="https://discord.gg/jQWqfnCX73"
          rel="noopener noreferrer"
          target="_blank"
        >
          <span className="sr-only">{t("web.footer.discordNewTab")}</span>
          <svg
            aria-hidden="true"
            className="size-5"
            fill="currentColor"
            focusable="false"
            viewBox="0 0 24 24"
          >
            <path d="M20.317 4.369a19.8 19.8 0 0 0-4.885-1.515l-.617 1.267a18.3 18.3 0 0 0-5.613 0l-.625-1.267a19.7 19.7 0 0 0-4.89 1.519C.595 8.954-.243 13.418.176 17.816a19.9 19.9 0 0 0 5.993 3.03l1.462-1.99a12.8 12.8 0 0 1-2.303-1.106q.289-.21.564-.43a14.2 14.2 0 0 0 12.221 0q.277.225.565.43a12.9 12.9 0 0 1-2.307 1.106l1.462 1.99a19.8 19.8 0 0 0 5.993-3.03c.491-5.1-.84-9.523-3.509-13.447M8.02 15.127c-1.167 0-2.129-1.075-2.129-2.397s.94-2.406 2.129-2.406 2.15 1.084 2.129 2.406c-.02 1.322-.94 2.397-2.129 2.397m7.974 0c-1.168 0-2.129-1.075-2.129-2.397s.94-2.406 2.129-2.406 2.149 1.084 2.129 2.406c-.021 1.322-.941 2.397-2.129 2.397" />
          </svg>
        </a>
      </div>
      <p className="mt-3 text-[11.5px] leading-5">
        © {year} {t("web.site.name")}
      </p>
    </footer>
  );
}
