import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { parseHelpDocument } from "@/lib/help-content";
import { LegalDocumentPage } from "./legal-document-page";

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en-US" }),
}));

describe("LegalDocumentPage", () => {
  it("renders publication metadata and policy content", () => {
    const document = parseHelpDocument(
      "---\ntitle: Privacy Policy\neffectiveDate: 2026-09-30\nversion: 1.0\n---\n## Privacy rights\n\nPolicy body.",
      "privacy-policy",
    );
    const html = renderToStaticMarkup(
      <LegalDocumentPage document={document} />,
    );

    expect(html).toContain('dateTime="2026-09-30"');
    expect(html).toContain("v1.0");
    expect(html).toContain("Privacy rights");
    expect(html).toContain("Policy body.");
  });
});
