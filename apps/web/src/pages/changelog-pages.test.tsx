/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getChangelogEntries,
  paginateChangelog,
} from "@/lib/changelog-content";
import { ChangelogEntryPage, ChangelogListPage } from "./changelog-pages";

vi.mock("@/components/app-shell", () => ({
  /**
   * Preserves the page title and children under test.
   *
   * @param root0 - Shell inputs supplied by the page.
   * @returns The minimal shell markup.
   */
  AppShell: ({
    children,
    title,
  }: {
    /** Page content under test. */
    children: React.ReactNode;
    /** Page title under test. */
    title: string;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/components/markdown-content", () => ({
  /**
   * Exposes Markdown source text without parsing it.
   *
   * @param root0 - Markdown renderer inputs.
   * @returns The source text in a paragraph.
   */
  MarkdownContent: ({
    markdown,
  }: {
    /** Raw Markdown source rendered by the component. */
    markdown: string;
  }) => <p>{markdown}</p>,
}));

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Provides a stable English locale for component assertions.
   *
   * @returns The fixed locale context value.
   */
  useLocale: () => ({ locale: "en-US" }),
}));

(
  globalThis as {
    /** Enables React's act assertions in this jsdom test. */
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("changelog pages", () => {
  /** DOM host recreated for each test. */
  let container: HTMLDivElement;
  /** React root recreated for each test. */
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("renders full entries with permanent title and category links", () => {
    const page = paginateChangelog(getChangelogEntries("en-US"), 1);
    if (!page) throw new Error("The changelog fixture is missing.");

    act(() => root.render(<ChangelogListPage changelogPage={page} />));

    const title = [...container.querySelectorAll("a")].find(
      (link) => link.textContent === "Introducing the Pocket Trash changelog",
    );
    const category = [...container.querySelectorAll("a")].find(
      (link) => link.textContent === "New Feature",
    );
    expect(title?.getAttribute("href")).toBe(
      "/changelog/introducing-the-pocket-trash-changelog",
    );
    expect(category?.getAttribute("href")).toBe("/changelog/feature");
    expect(container.textContent).toContain(
      "You can now follow customer-facing Pocket Trash updates",
    );
    expect(container.textContent).toContain("Date: 2027-10-02");
    expect(container.querySelector("main")?.className).toContain(
      "lg:max-w-[75%]",
    );
  });

  it("copies the absolute permanent URL and reports success or failure", async () => {
    const entry = getChangelogEntries("en-US")[0];
    if (!entry) throw new Error("The changelog fixture is missing.");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    act(() => root.render(<ChangelogEntryPage entry={entry} />));
    const button = container.querySelector("button");
    await act(async () => button?.click());

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/changelog/introducing-the-pocket-trash-changelog`,
    );
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Link copied",
    );

    writeText.mockRejectedValue(new Error("denied"));
    await act(async () => button?.click());
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Couldn’t copy link",
    );
  });
});
