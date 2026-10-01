import { describe, expect, it } from "vitest";
import {
  type ChangelogEntry,
  getChangelogEntries,
  getChangelogEntry,
  paginateChangelog,
  parseChangelogPage,
} from "./changelog-content";

describe("changelog content", () => {
  it("loads localized entries with English metadata fallback", () => {
    const entry = getChangelogEntry(
      "es-MX",
      "introducing-the-pocket-trash-changelog",
    );

    expect(entry).toMatchObject({
      categories: ["feature"],
      datePublished: "2027-10-02",
      slug: "introducing-the-pocket-trash-changelog",
      title: "Presentamos el registro de cambios de Pocket Trash",
    });
    expect(entry?.body).toContain("Ahora puedes consultar las novedades");
  });

  it("filters categories without changing publication-date order", () => {
    expect(
      getChangelogEntries("en-US", "feature").map(({ slug }) => slug),
    ).toEqual(["introducing-the-pocket-trash-changelog"]);
    expect(getChangelogEntries("en-US", "bug")).toEqual([]);
  });

  it.each([
    undefined,
    "",
    "nope",
    "0",
    "-2",
    "1.5",
    "0x2",
    [2],
    [999],
  ])("normalizes page %j to the first page", (value) => {
    expect(parseChangelogPage(value)).toBe(1);
  });

  it("returns ten full entries per page and rejects valid pages past the end", () => {
    const sample = getChangelogEntries("en-US")[0];
    if (!sample) throw new Error("The changelog fixture is missing.");
    const entries = Array.from({ length: 11 }, (_, index) => ({
      ...sample,
      datePublished: `2027-09-${String(30 - index).padStart(2, "0")}`,
      slug: `entry-${index + 1}`,
    })) satisfies ChangelogEntry[];

    expect(paginateChangelog(entries, 1)).toMatchObject({
      entries: expect.arrayContaining([
        expect.objectContaining({ slug: "entry-1" }),
      ]),
      page: 1,
      pageCount: 2,
    });
    expect(paginateChangelog(entries, 1)?.entries).toHaveLength(10);
    expect(paginateChangelog(entries, 2)?.entries).toHaveLength(1);
    expect(paginateChangelog(entries, 3)).toBeUndefined();
  });
});
