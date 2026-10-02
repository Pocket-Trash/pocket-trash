import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { AppShell } from "@/components/app-shell";
import { MarkdownContent } from "@/components/markdown-content";
import type { HelpDocument } from "@/lib/help-content";
import { useLocale } from "@/providers/locale-provider";

/**
 * Renders the localized help topic index.
 *
 * @param props - Published help documents.
 * @returns The help index page.
 */
export function HelpIndexPage({
  documents,
}: {
  /** Published help documents. */
  documents: HelpDocument[];
}) {
  const { locale } = useLocale();
  /**
   * Formats localized help-index copy.
   *
   * @param key - Translation key.
   * @returns The localized message.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);

  return (
    <AppShell title={t("web.navigation.help")}>
      <main className="mx-auto grid w-full gap-6 p-3 md:p-[18px_22px_22px] lg:max-w-[75%]">
        <blockquote className="border-l-4 border-primary bg-accent/30 p-4">
          {t("web.help.developmentCallout")}
        </blockquote>
        <section className="grid gap-4">
          <h2 className="text-xl font-semibold">{t("web.help.topics")}</h2>
          <ul className="grid gap-2">
            {documents.map((document) => (
              <li className="ml-5 list-disc" key={document.slug}>
                <a
                  className="text-primary underline underline-offset-2"
                  href={`/help/${document.slug}`}
                >
                  {document.metadata.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
        <section className="grid gap-4">
          <h2 className="text-xl font-semibold">{t("web.help.contact")}</h2>
          <p>{t("web.help.comingSoon")}</p>
        </section>
      </main>
    </AppShell>
  );
}

/**
 * Renders a dated help topic from trusted Markdown.
 *
 * @param root0 - Help document and localized labels.
 * @returns The help topic page.
 * @throws When the document has neither a published nor modified date.
 */
export function HelpTopicPage({
  dateLabel,
  dateModifiedLabel,
  document,
  helpTitle,
}: {
  /** Label for the original publication date. */
  dateLabel: string;
  /** Label for the most recent modification date. */
  dateModifiedLabel: string;
  /** Parsed help document to render. */
  document: HelpDocument;
  /** Localized help-index title used by the breadcrumb. */
  helpTitle: string;
}) {
  const modified = document.metadata.dateModified;
  const date = modified ?? document.metadata.datePublished;
  if (!date) throw new Error(`Help topic ${document.slug} has no date.`);

  return (
    <AppShell
      breadcrumbItems={[{ label: helpTitle, to: "/help" }]}
      title={document.metadata.title}
    >
      <main className="mx-auto grid w-full gap-6 p-3 md:p-[18px_22px_22px] lg:max-w-[75%]">
        <p className="text-sm text-muted-foreground">
          {modified ? dateModifiedLabel : dateLabel}:{" "}
          <time dateTime={date}>{date}</time>
        </p>
        <HelpArticle document={document} includeMain={false} />
      </main>
    </AppShell>
  );
}

/**
 * Renders trusted help Markdown with its repository-owned capabilities.
 *
 * @param props - Help document and wrapper choice.
 * @returns The rendered help article.
 */
function HelpArticle({
  document,
  includeMain = true,
}: {
  /** Parsed help document to render. */
  document: HelpDocument;
  /** Whether the article supplies its own main landmark. */
  includeMain?: boolean;
}) {
  const content = (
    <MarkdownContent markdown={document.body} trustedCodeBlocks />
  );

  return includeMain ? (
    <main className="mx-auto w-full p-3 md:p-[18px_22px_22px] lg:max-w-[75%]">
      {content}
    </main>
  ) : (
    content
  );
}
