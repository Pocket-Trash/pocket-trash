import type { PublicMakerSummary } from "@package/services";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  MakersDirectoryPage,
  makerDirectorySections,
} from "./makers-directory-page";

vi.mock("@/components/app-shell", () => ({
  /**
   * Renders only page content in directory tests.
   *
   * @param props - Shell properties.
   * @returns Shell content.
   */
  AppShell: (props: {
    /** Page content. */
    children: React.ReactNode;
  }) => <>{props.children}</>,
}));

vi.mock("@/lib/catalog-copy", () => ({
  /**
   * Returns a deterministic translation formatter.
   *
   * @returns Translation formatter used by static markup tests.
   */
  useCatalogCopy:
    () =>
    (key: string, values: Readonly<Record<string, unknown>> = {}) =>
      `${key}${Object.keys(values).length ? `:${JSON.stringify(values)}` : ""}`,
}));

describe("MakersDirectoryPage", () => {
  it("groups and sorts makers into 0-9, A-Z, and Other sections", () => {
    const sections = makerDirectorySections([
      maker(1, "Élan"),
      maker(2, "10 Tools"),
      maker(3, "Beta"),
      maker(4, "alpha"),
      maker(5, "Acme"),
    ]);

    expect(section(sections, "0-9")).toEqual(["10 Tools"]);
    expect(section(sections, "A")).toEqual(["Acme", "alpha"]);
    expect(section(sections, "B")).toEqual(["Beta"]);
    expect(section(sections, "Other")).toEqual(["Élan"]);
  });

  it("renders responsive popular cards, stable anchors, counts, and placeholders", () => {
    const makers = Array.from({ length: 9 }, (_value, index) =>
      maker(index + 1, `${String.fromCharCode(65 + index)} Maker`, 9 - index),
    );
    const html = renderToStaticMarkup(<MakersDirectoryPage makers={makers} />);

    expect(html).toContain('aria-label="web.makers.tableOfContents"');
    expect(html).toContain('href="#makers-a"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("hidden md:block");
    expect(html).toContain("hidden lg:block");
    expect(html).toContain('href="/makers/a-maker"');
    expect(html).toContain("web.makers.productCount:{&quot;count&quot;:1}");
    expect(html).toContain(
      "web.makers.collectionItemCount:{&quot;count&quot;:9}",
    );
    expect(html).toContain("lucide-factory");
  });
});

/**
 * Creates one public maker summary fixture.
 *
 * @param id - Maker identifier.
 * @param name - Maker name.
 * @param collectionItemCount - Popularity count.
 * @returns Public maker fixture.
 */
function maker(
  id: number,
  name: string,
  collectionItemCount = 0,
): PublicMakerSummary {
  return {
    collectionItemCount,
    description: null,
    id,
    images: [],
    name,
    productCount: 1,
    rootUrl: null,
    slug: name.toLowerCase().replaceAll(" ", "-"),
  };
}

/**
 * Returns maker names assigned to one section label.
 *
 * @param sections - Directory sections.
 * @param label - Section label.
 * @returns Maker names in the section.
 */
function section(
  sections: ReturnType<typeof makerDirectorySections>,
  label: string,
) {
  return sections
    .find((candidate) => candidate.label === label)
    ?.makers.map(({ name }) => name);
}
