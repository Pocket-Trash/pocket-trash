import {
  type ChangelogCategorySlug,
  changelogCategories,
  formatTranslation,
  getChangelogCategoryTitle,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";
import {
  Asset,
  useRouter,
  useRouterState,
  useTags,
} from "@tanstack/react-router";
import { getChangelogEntry } from "@/lib/changelog-content";
import { useLocale } from "@/providers/locale-provider";

/** Router match fields used by localized changelog title ownership. */
type TitleMatch = {
  /** Stable route identity. */
  routeId: string;
  /** Current loader status. */
  status: string;
  /** Resolved entry/category data. */
  loaderData?: unknown;
};

/**
 * Renders Router-managed head assets with one live localized changelog title.
 * @returns Existing document assets, preserving Router order and CSP nonce.
 */
export function DocumentHead() {
  const { locale } = useLocale();
  const router = useRouter();
  const tags = useTags();
  const matches = useRouterState({
    /** Selects current route data for declarative title ownership.
     * @param state - Current Router state.
     * @returns Current route matches. */
    select: (state) => state.matches,
  });
  const title = changelogDocumentTitle(matches, locale);
  return (
    <>
      {tags.map((tag) => {
        const asset =
          tag.tag === "title" && title ? { ...tag, children: title } : tag;
        return (
          <Asset
            {...asset}
            key={`tsr-meta-${JSON.stringify(tag)}`}
            nonce={router.options.ssr?.nonce}
          />
        );
      })}
    </>
  );
}

/**
 * Resolves a successful changelog match without replacing Router error/fallback metadata.
 * @param matches - Current canonical route matches.
 * @param locale - Live locale shared by head and page content.
 * @returns Localized changelog title, or no override for other/failing routes.
 */
export function changelogDocumentTitle(
  matches: TitleMatch[],
  locale: SupportedLocale,
) {
  /** Formats existing document copy in the shared active locale.
   * @param key - Existing document translation key.
   * @returns Localized document copy. */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const match = matches.find(
    (match) =>
      match.routeId === "/changelog/" || match.routeId === "/changelog/$slug",
  );
  if (match?.status !== "success") return undefined;
  let title: string | undefined;
  if (match.routeId === "/changelog/") title = t("web.navigation.changelog");
  else {
    const data = match.loaderData;
    if (data && typeof data === "object") {
      if (
        "kind" in data &&
        data.kind === "entry" &&
        "slug" in data &&
        typeof data.slug === "string"
      )
        title = getChangelogEntry(locale, data.slug)?.title;
      else if (
        "kind" in data &&
        data.kind === "category" &&
        "category" in data &&
        typeof data.category === "string" &&
        Object.hasOwn(changelogCategories, data.category)
      )
        title = getChangelogCategoryTitle(
          data.category as ChangelogCategorySlug,
          locale,
        );
    }
  }
  return title ? `${title} · ${t("web.site.name")}` : undefined;
}
