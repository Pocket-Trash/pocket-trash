import process from "node:process";

const prompt =
  "Use $pocket-trash db-migration-conflicts to resolve Drizzle migration conflicts on the current branch. Preserve the intended schema changes, remove stale generated Drizzle migration artifacts, regenerate migrations from the latest mainline migration state, run drizzle-kit check, and report any hand-written SQL that was carried forward.";

process.stdout.write(`${prompt}\n`);
