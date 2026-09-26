import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { AppShell } from "@/components/app-shell";
import { MarkdownContent } from "@/components/markdown-content";
import type { HelpDocument } from "@/lib/help-content";
import { useLocale } from "@/providers/locale-provider";

export function HelpIndexPage({ guideTitle }: { guideTitle: string }) {
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);

  return (
    <AppShell title={t("web.navigation.help")}>
      <main className="mx-auto grid w-full max-w-3xl gap-6 p-6">
        <blockquote className="border-l-4 border-primary bg-accent/30 p-4">
          {t("web.help.developmentCallout")}
        </blockquote>
        <section className="grid gap-4">
          <h2 className="text-xl font-semibold">{t("web.help.topics")}</h2>
          <ul>
            <li className="ml-5 list-disc">
              <a
                className="text-primary underline underline-offset-2"
                href="/help/image-size-and-resolution-guide"
              >
                {guideTitle}
              </a>
            </li>
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

export function HelpTopicPage({
  dateLabel,
  dateModifiedLabel,
  document,
  helpTitle,
}: {
  dateLabel: string;
  dateModifiedLabel: string;
  document: HelpDocument;
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
      <main className="mx-auto grid w-full max-w-3xl gap-6 p-6">
        <p className="text-sm text-muted-foreground">
          {modified ? dateModifiedLabel : dateLabel}:{" "}
          <time dateTime={date}>{date}</time>
        </p>
        <HelpArticle document={document} includeMain={false} />
      </main>
    </AppShell>
  );
}

function HelpArticle({
  document,
  includeMain = true,
}: {
  document: HelpDocument;
  includeMain?: boolean;
}) {
  const content = <MarkdownContent markdown={document.body} />;

  return includeMain ? (
    <main className="mx-auto w-full max-w-3xl p-6">{content}</main>
  ) : (
    content
  );
}
