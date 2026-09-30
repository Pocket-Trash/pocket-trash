import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { parseHelpDocument } from "@/lib/help-content";
import { HelpIndexPage, HelpTopicPage } from "./help-pages";

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "es-MX" }),
}));

describe("HelpTopicPage", () => {
  it("shows only the modified date when one exists", () => {
    const document = parseHelpDocument(
      "---\ntitle: Test\ndatePublished: 2026-09-01\ndateModified: 2026-09-23\ncategory: Test\n---\nBody",
      "test",
    );
    const html = renderToStaticMarkup(
      <HelpTopicPage
        dateLabel="Date"
        dateModifiedLabel="Date Modified"
        document={document}
        helpTitle="Help"
      />,
    );

    expect(html).toContain("Date Modified:");
    expect(html).not.toContain("Date: 2026-09-01");
    expect(html).toContain('dateTime="2026-09-23"');
  });
});

describe("HelpIndexPage", () => {
  it("renders the Spanish help index", () => {
    const html = renderToStaticMarkup(
      <HelpIndexPage guideTitle="Guía de tamaño y resolución de imágenes" />,
    );

    expect(html).toContain("Esta página todavía está en desarrollo.");
    expect(html).toContain("Temas de ayuda");
    expect(html).toContain("Guía de tamaño y resolución de imágenes");
    expect(html).toContain("Contacto");
    expect(html).toContain("Próximamente.");
  });
});
