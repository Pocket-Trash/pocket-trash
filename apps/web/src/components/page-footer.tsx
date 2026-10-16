import { faDiscord, faXTwitter } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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

/** Shared focus, hover, and underline styles for internal footer links. */
const linkClassName =
  "rounded-sm text-primary underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
/** Shared focus and hover styles for icon-only social links. */
const socialLinkClassName =
  "rounded-sm p-2 text-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Renders localized site navigation, social links, and copyright text.
 *
 * @param props - Page footer properties.
 * @param props.year - Copyright year to display.
 * @returns The localized site footer.
 * @throws {Error} If the required locale provider is missing.
 */
export function PageFooter({
  year,
}: {
  /** Copyright year to display. */
  year: number;
}) {
  const { locale } = useLocale();
  /**
   * Formats a footer translation for the active locale.
   *
   * @param key - Footer localization key.
   * @returns The localized footer text.
   */
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
          <FontAwesomeIcon aria-hidden className="size-5" icon={faXTwitter} />
        </a>
        <a
          aria-label={t("web.footer.discordNewTab")}
          className={socialLinkClassName}
          href="https://discord.gg/jQWqfnCX73"
          rel="noopener noreferrer"
          target="_blank"
        >
          <span className="sr-only">{t("web.footer.discordNewTab")}</span>
          <FontAwesomeIcon aria-hidden className="size-5" icon={faDiscord} />
        </a>
      </div>
      <p className="mt-3 text-[11.5px] leading-5">
        © {year} {t("web.site.name")}
      </p>
    </footer>
  );
}
