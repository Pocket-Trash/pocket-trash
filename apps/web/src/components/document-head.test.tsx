/** @vitest-environment jsdom */
import {
  formatTranslation,
  getChangelogCategoryTitle,
} from "@pocket-trash/localizations";
import type * as RouterModule from "@tanstack/react-router";
import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getChangelogEntries,
  getChangelogEntry,
} from "@/lib/changelog-content";
import { changelogDocumentTitle, DocumentHead } from "./document-head";

/** Current head assets, canonical matches, and shared live locale. */
const source = vi.hoisted(() => ({
  locale: "en-US" as "en-US" | "es-MX",
  matches: [
    {
      routeId: "/changelog/",
      status: "success",
      loaderData: undefined as unknown,
    },
  ],
  tags: [
    {
      tag: "meta" as const,
      attrs: { name: "description", content: "Fixture metadata" },
    },
    { tag: "title" as const, children: "Router fallback" },
  ],
}));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof RouterModule>()),
  /** Supplies the document's existing CSP nonce.
   * @returns Router options used by head assets. */
  useRouter: () => ({ options: { ssr: { nonce: "fixture-nonce" } } }),
  /** Supplies canonical head assets in their original order.
   * @returns Current Router-managed tags. */
  useTags: () => source.tags,
  /** Supplies the active route's resolved loader data.
   * @param options - Existing route-state selector.
   * @returns Current canonical matches. */
  useRouterState: (options: {
    /** Selects current canonical matches.
     * @param state - Current fixture Router state.
     * @returns Selected match data. */
    select: (state: {
      /** Current canonical matches. */ matches: typeof source.matches;
    }) => unknown;
  }) => options.select({ matches: source.matches }),
}));
vi.mock("@/providers/locale-provider", () => ({
  /** Supplies the same locale consumed by the changelog body.
   * @returns Current live locale. */
  useLocale: () => ({ locale: source.locale }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("declarative localized document titles", () => {
  let root: Root | undefined;
  let originalHead: string | undefined;
  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    root = undefined;
    if (originalHead !== undefined) document.head.innerHTML = originalHead;
    originalHead = undefined;
    source.locale = "en-US";
    source.matches = [
      { routeId: "/changelog/", status: "success", loaderData: undefined },
    ];
  });
  it("emits one SSR title, hydrates it, updates live locale, and restores Router titles on navigation/error", async () => {
    originalHead = document.head.innerHTML;
    const html = renderToString(<DocumentHead />);
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html).toContain(
      `${formatTranslation("web.navigation.changelog")} · ${formatTranslation("web.site.name")}`,
    );
    document.head.innerHTML = html;
    await act(async () => {
      root = hydrateRoot(document.head, <DocumentHead />);
    });
    expect(document.head.querySelectorAll("title")).toHaveLength(1);
    source.locale = "es-MX";
    await act(async () => root?.render(<DocumentHead />));
    expect(document.title).toBe(
      `${formatTranslation("web.navigation.changelog", {}, "es-MX")} · ${formatTranslation("web.site.name", {}, "es-MX")}`,
    );
    expect(
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content"),
    ).toBe("Fixture metadata");
    source.matches = [
      { routeId: "/products", status: "success", loaderData: undefined },
    ];
    await act(async () => root?.render(<DocumentHead />));
    expect(document.title).toBe("Router fallback");
    source.matches = [
      { routeId: "/changelog/", status: "error", loaderData: undefined },
    ];
    await act(async () => root?.render(<DocumentHead />));
    expect(document.title).toBe("Router fallback");
    expect(document.head.querySelectorAll("title")).toHaveLength(1);
  });
  it("resolves localized category/entry titles and preserves metadata for unresolved or malformed routes", () => {
    const entry = getChangelogEntries("en-US")[0];
    if (!entry) throw new Error("Expected entry fixture");
    expect(
      changelogDocumentTitle(
        [
          {
            routeId: "/changelog/$slug",
            status: "success",
            loaderData: { kind: "entry", slug: entry.slug },
          },
        ],
        "es-MX",
      ),
    ).toBe(
      `${getChangelogEntry("es-MX", entry.slug)?.title} · ${formatTranslation("web.site.name", {}, "es-MX")}`,
    );
    expect(
      changelogDocumentTitle(
        [
          {
            routeId: "/changelog/$slug",
            status: "success",
            loaderData: { kind: "category", category: "feature" },
          },
        ],
        "es-MX",
      ),
    ).toBe(
      `${getChangelogCategoryTitle("feature", "es-MX")} · ${formatTranslation("web.site.name", {}, "es-MX")}`,
    );
    for (const loaderData of [
      null,
      "bad data",
      { kind: "category", category: "unknown" },
      { kind: "entry", slug: "missing" },
    ])
      expect(
        changelogDocumentTitle(
          [{ routeId: "/changelog/$slug", status: "success", loaderData }],
          "en-US",
        ),
      ).toBeUndefined();
  });
});
