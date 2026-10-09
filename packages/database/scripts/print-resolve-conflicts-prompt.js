import process from "node:process";

/** Agent prompt for resolving conflicting timestamp-folder migrations safely. */
const prompt =
  "Use $pocket-trash db-migration-conflicts to review timestamp-folder Drizzle migration conflicts on the current branch. Preserve compatible complete sibling folders and run drizzle-kit check first. Preserve schema intent and custom SQL; regenerate only confirmed never-applied conflicting artifacts against current mainline. Never edit applied SQL, snapshots, or ledger rows, and never restore a legacy journal. Run fresh-chain validation and report any custom SQL carried forward.";

process.stdout.write(`${prompt}\n`);
