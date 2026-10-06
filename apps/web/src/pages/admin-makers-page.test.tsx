import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminMakerFormPage, AdminMakersPage } from "./admin-makers-page";

vi.mock("@pocket-trash/localizations", () => ({
  /**
   * Returns the localization key as stable test copy.
   *
   * @param key - Localization key.
   * @returns The unchanged key.
   */
  formatTranslation: (key: string) => key,
}));

vi.mock("@tanstack/react-router", () => ({
  /**
   * Renders a plain anchor for route links.
   *
   * @param props - Anchor properties.
   * @returns A plain anchor element.
   */
  Link: (props: React.ComponentProps<"a">) => {
    const { children, ...anchorProps } = props;
    return <a {...anchorProps}>{children}</a>;
  },
  /**
   * Returns a navigation spy.
   *
   * @returns A navigation spy.
   */
  useNavigate: () => vi.fn(),
}));

vi.mock("@/components/admin-page-shell", () => ({
  /**
   * Renders only the administration page content.
   *
   * @param props - Shell properties.
   * @returns The shell children.
   */
  AdminPageShell: (props: {
    /** Shell content. */
    children: React.ReactNode;
  }) => <>{props.children}</>,
}));

vi.mock("@/components/catalog-markdown-editor", () => ({
  /**
   * Renders a labelled textarea in place of the visual Markdown editor.
   *
   * @param props - Editor properties.
   * @returns A labelled textarea.
   */
  CatalogMarkdownEditor: (props: {
    /** Initial field value. */
    defaultValue?: string;
    /** Field identifier. */
    id: string;
    /** Field label. */
    label: string;
  }) => (
    <textarea
      defaultValue={props.defaultValue}
      id={props.id}
      title={props.label}
    />
  ),
}));

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns a fixed English locale.
   *
   * @returns The English locale.
   */
  useLocale: () => ({ locale: "en-US" }),
}));

describe("maker administration pages", () => {
  it("renders maker profiles with stable edit destinations", () => {
    const html = renderToStaticMarkup(
      <AdminMakersPage
        makers={[
          {
            description: null,
            id: 1000,
            name: "Autmog",
            rootUrl: "https://autmog.com",
            slug: "autmog",
          },
        ]}
      />,
    );

    expect(html).toContain("Autmog");
    expect(html).toContain("autmog");
    expect(html).toContain("web.action.addMaker");
    expect(html).toContain("web.action.edit: Autmog");
  });

  it("keeps the persisted slug read-only while editing a renamed maker", () => {
    const html = renderToStaticMarkup(
      <AdminMakerFormPage
        maker={{
          description: "Profile",
          id: 1000,
          name: "Renamed Autmog",
          rootUrl: null,
          slug: "autmog",
        }}
      />,
    );

    expect(html).toContain('value="Renamed Autmog"');
    expect(html).toContain('value="autmog"');
    expect(html).toContain("readOnly");
    expect(html).toContain("Profile");
  });
});
