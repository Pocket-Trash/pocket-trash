import { formatTranslation } from "@pocket-trash/localizations";
import { AppShell } from "@/components/app-shell";
import { MarkdownContent } from "@/components/markdown-content";
import type { LegalDocument } from "@/lib/legal-content";
import { useLocale } from "@/providers/locale-provider";

/** Properties accepted by the public legal document page. */
type LegalDocumentPageProps = {
  /** Parsed legal document to display. */
  document: LegalDocument;
};

/**
 * Renders a published legal document with its version and effective date.
 *
 * @param props - Legal document page properties.
 * @returns The public legal document page.
 */
export function LegalDocumentPage({ document }: LegalDocumentPageProps) {
  const { locale } = useLocale();
  const modified = document.metadata.dateModified;
  const date = modified ?? document.metadata.effectiveDate;

  return (
    <AppShell title={document.metadata.title}>
      <main className="mx-auto grid w-full gap-6 p-3 md:p-[18px_22px_22px] lg:max-w-[75%]">
        <p className="text-sm text-muted-foreground">
          {formatTranslation(
            modified ? "web.help.dateModified" : "web.help.datePublished",
            {},
            locale,
          )}
          : <time dateTime={date}>{date}</time> · v{document.metadata.version}
        </p>
        <MarkdownContent markdown={document.body} />
      </main>
    </AppShell>
  );
}
