import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import {
  createMigrationRepairBundle,
  legacyRebasedSliderMigrations,
  planMigrationRepair,
} from "../scripts/migration-repair.js";

/** Applied form of the complete known pre-rebase slider history. */
const completeLegacyHistory = legacyRebasedSliderMigrations.map(
  ({ createdAt, hash }) => ({ createdAt, hash }),
);

describe("planMigrationRepair", () => {
  test("plans the missing suffix for the merged slider-stack history", () => {
    expect(
      planMigrationRepair(completeLegacyHistory, {
        catalogManifest: "absent",
        installedSliderComponents: "absent",
        insertSetup: "absent",
      }),
    ).toEqual([
      "0063_nostalgic_punisher",
      "0064_dashing_reaper",
      "0065_rare_warhawk",
      "0066_repair_rebased_slider_history",
    ]);
  });

  test("uses only the marker when the schema already contains the suffix", () => {
    expect(
      planMigrationRepair(completeLegacyHistory, {
        catalogManifest: "present",
        installedSliderComponents: "present",
        insertSetup: "present",
      }),
    ).toEqual(["0066_repair_rebased_slider_history"]);
  });

  test("does not repair an ordinary repository history", () => {
    expect(
      planMigrationRepair([{ createdAt: 1, hash: "ordinary" }], {
        catalogManifest: "absent",
        installedSliderComponents: "absent",
        insertSetup: "absent",
      }),
    ).toEqual([]);
  });

  test("rejects partial legacy and partial schema states", () => {
    expect(() =>
      planMigrationRepair(completeLegacyHistory.slice(0, -1), {
        catalogManifest: "absent",
        installedSliderComponents: "absent",
        insertSetup: "absent",
      }),
    ).toThrow(/partially applied legacy slider migration history/u);

    expect(() =>
      planMigrationRepair(completeLegacyHistory, {
        catalogManifest: "absent",
        installedSliderComponents: "partial",
        insertSetup: "absent",
      }),
    ).toThrow(/partially applied installed slider component schema/u);
  });
});

test("creates an ordered Drizzle bundle from repository migrations", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "migration-repair-"));
  context.onTestFinished(() =>
    rmSync(directory, { force: true, recursive: true }),
  );
  const migrationsFolder = join(directory, "repository");
  const repairFolder = join(directory, "repair");
  mkdirSync(join(migrationsFolder, "meta"), { recursive: true });
  writeFileSync(
    join(migrationsFolder, "meta", "_journal.json"),
    JSON.stringify({
      entries: [
        {
          breakpoints: true,
          idx: 0,
          tag: "0063_nostalgic_punisher",
          version: "7",
          when: 100,
        },
        {
          breakpoints: true,
          idx: 1,
          tag: "0066_repair_rebased_slider_history",
          version: "7",
          when: 200,
        },
      ],
    }),
  );
  writeFileSync(
    join(migrationsFolder, "0063_nostalgic_punisher.sql"),
    "select 63;\n",
  );
  writeFileSync(
    join(migrationsFolder, "0066_repair_rebased_slider_history.sql"),
    "select 66;\n",
  );

  createMigrationRepairBundle(migrationsFolder, repairFolder, [
    "0063_nostalgic_punisher",
    "0066_repair_rebased_slider_history",
  ]);

  expect(
    readFileSync(join(repairFolder, "0063_nostalgic_punisher.sql"), "utf8"),
  ).toBe("select 63;\n");
  expect(
    JSON.parse(
      readFileSync(join(repairFolder, "meta", "_journal.json"), "utf8"),
    ),
  ).toMatchObject({
    dialect: "postgresql",
    entries: [
      { idx: 0, tag: "0063_nostalgic_punisher", when: 100 },
      {
        idx: 1,
        tag: "0066_repair_rebased_slider_history",
        when: 200,
      },
    ],
    version: "7",
  });
});
