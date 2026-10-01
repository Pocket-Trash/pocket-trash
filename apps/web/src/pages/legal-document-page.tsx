import { formatTranslation } from "@pocket-trash/localizations";
import { AppShell } from "@/components/app-shell";
import { MarkdownContent } from "@/components/markdown-content";
import type { LegalDocument } from "@/lib/legal-content";
import { useLocale } from "@/providers/locale-provider";

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  const { locale } = useLocale();
  const modified = document.metadata.dateModified;
  const date = modified ?? document.metadata.effectiveDate;

  return (
    <AppShell title={document.metadata.title}>
      <main className="mx-auto grid w-full max-w-3xl gap-6 p-6">
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
