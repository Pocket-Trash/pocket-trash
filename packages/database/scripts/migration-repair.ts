import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  type AppliedMigration,
  loadRepositoryMigrations,
} from "./migration-history.js";

/** Journal tag that marks a database reconciled from the rebased slider stack. */
export const migrationHistoryReconciliationTag =
  "0066_repair_rebased_slider_history";

/** One migration identity from the slider stack before its merge-time rebase. */
export type LegacyRebasedSliderMigration = AppliedMigration & {
  /** Original migration tag retained for diagnostics. */
  tag: string;
};

/** Known pre-merge slider migrations that are equivalent to current 0057-0062. */
export const legacyRebasedSliderMigrations: LegacyRebasedSliderMigration[] = [
  {
    createdAt: 1_791_271_098_659,
    hash: "df07eb2da4482e38a4ca332fd2622aea3b3dbe94553f68d7829f24d74e82fdc1",
    tag: "0053_sweet_killraven",
  },
  {
    createdAt: 1_791_272_035_493,
    hash: "ce352d43a95d8bda4e34485a62236b64a62c16750a21acaf9f79b2e4d17c2da7",
    tag: "0054_legal_black_crow",
  },
  {
    createdAt: 1_791_273_198_103,
    hash: "f7343fc1e46f206b2d66af8a32a56046967a590428fd34aa6851555fc5490f80",
    tag: "0055_last_masque",
  },
  {
    createdAt: 1_791_274_910_747,
    hash: "db47250208599ed35d39d43e824a33041ad312e630ea9656045c693974eaa338",
    tag: "0056_lazy_komodo",
  },
  {
    createdAt: 1_791_276_097_381,
    hash: "4a4719241e0b1000732a7a904cd04fdc19066ce46fa96e2b35d68f6e8c134fe5",
    tag: "0057_demonic_miek",
  },
  {
    createdAt: 1_791_277_333_852,
    hash: "f8c152ec054f122dfd44764bdf5f0fd58c630313bf83402b05bf6450fa95aa59",
    tag: "0058_thin_white_tiger",
  },
];

/** Presence state for one atomic migration-owned schema group. */
export type MigrationSchemaGroupState = "absent" | "partial" | "present";

/** Schema groups that may follow the legacy slider migration history. */
export type MigrationRepairSchemaState = {
  /** Durable catalog-manifest tables from migration 0065. */
  catalogManifest: MigrationSchemaGroupState;
  /** Installed slider columns from migration 0063. */
  installedSliderComponents: MigrationSchemaGroupState;
  /** Owned insert setup column from migration 0064. */
  insertSetup: MigrationSchemaGroupState;
};

/** Drizzle journal shape written for a temporary repair bundle. */
type RepairMigrationJournal = {
  /** Drizzle journal format version. */
  version: "7";
  /** PostgreSQL dialect identifier. */
  dialect: "postgresql";
  /** Ordered migrations included in the repair bundle. */
  entries: Array<{
    /** Whether the SQL uses Drizzle statement breakpoints. */
    breakpoints: true;
    /** Zero-based position within this temporary bundle. */
    idx: number;
    /** Repository migration tag. */
    tag: string;
    /** Drizzle migration format version. */
    version: "7";
    /** Original repository migration timestamp. */
    when: number;
  }>;
};

/**
 * Plans a forward-only catch-up for the known pre-merge slider history.
 *
 * @param applied - Existing Drizzle migration rows.
 * @param schemaState - Presence of schema groups added after the legacy stack.
 * @returns Ordered repository migration tags to apply before normal migration.
 * @throws When only part of the known history or an atomic schema group exists.
 */
export function planMigrationRepair(
  applied: readonly AppliedMigration[],
  schemaState: MigrationRepairSchemaState,
): string[] {
  const matchedLegacyMigrations = legacyRebasedSliderMigrations.filter(
    (legacyMigration) =>
      applied.some(
        (migration) =>
          migration.createdAt === legacyMigration.createdAt &&
          migration.hash === legacyMigration.hash,
      ),
  );

  if (matchedLegacyMigrations.length === 0) return [];
  if (matchedLegacyMigrations.length !== legacyRebasedSliderMigrations.length) {
    throw new Error(
      "Refusing to repair a partially applied legacy slider migration history.",
    );
  }

  assertAtomicSchemaGroup(
    "installed slider component schema",
    schemaState.installedSliderComponents,
  );
  assertAtomicSchemaGroup("insert setup schema", schemaState.insertSetup);
  assertAtomicSchemaGroup(
    "catalog manifest schema",
    schemaState.catalogManifest,
  );

  const tags: string[] = [];
  if (schemaState.installedSliderComponents === "absent") {
    tags.push("0063_nostalgic_punisher");
  }
  if (schemaState.insertSetup === "absent") {
    tags.push("0064_dashing_reaper");
  }
  if (schemaState.catalogManifest === "absent") {
    tags.push("0065_rare_warhawk");
  }
  tags.push(migrationHistoryReconciliationTag);
  return tags;
}

/**
 * Copies an ordered subset of repository migrations into a temporary bundle.
 *
 * @param migrationsFolder - Complete repository migration directory.
 * @param repairFolder - Empty destination directory for the temporary bundle.
 * @param tags - Ordered repository migration tags selected by the repair plan.
 * @throws When a requested tag is absent or the requested order is unsafe.
 */
export function createMigrationRepairBundle(
  migrationsFolder: string,
  repairFolder: string,
  tags: readonly string[],
): void {
  const migrations = loadRepositoryMigrations(migrationsFolder);
  const requestedTags = new Set(tags);
  if (requestedTags.size !== tags.length) {
    throw new Error("Migration repair tags must be unique.");
  }

  const selected = migrations.filter(({ tag }) => requestedTags.has(tag));
  if (
    selected.length !== tags.length ||
    selected.some(({ tag }, index) => tag !== tags[index])
  ) {
    throw new Error(
      "Migration repair tags must exist in repository migration order.",
    );
  }

  mkdirSync(join(repairFolder, "meta"), { recursive: true });
  for (const migration of selected) {
    copyFileSync(
      join(migrationsFolder, `${migration.tag}.sql`),
      join(repairFolder, `${migration.tag}.sql`),
    );
  }

  const journal: RepairMigrationJournal = {
    version: "7",
    dialect: "postgresql",
    entries: selected.map((migration, idx) => ({
      idx,
      version: "7",
      when: migration.createdAt,
      tag: migration.tag,
      breakpoints: true,
    })),
  };
  writeFileSync(
    join(repairFolder, "meta", "_journal.json"),
    `${JSON.stringify(journal, null, 2)}\n`,
  );
}

/**
 * Rejects schema groups that cannot be safely replayed as a whole migration.
 *
 * @param name - Human-readable schema group.
 * @param state - Observed group presence.
 * @throws When only part of the group exists.
 */
function assertAtomicSchemaGroup(
  name: string,
  state: MigrationSchemaGroupState,
): void {
  if (state === "partial") {
    throw new Error(`Refusing to repair a partially applied ${name}.`);
  }
}
