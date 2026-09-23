import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  parseChangesetEntries,
  validateChangesetEntries,
} from "./check-pr-changeset.mjs";

test("rejects Changesets that target unknown packages", () => {
  const directory = mkdtempSync(join(tmpdir(), "changeset-test-"));
  const changesetPath = join(directory, "change.md");

  writeFileSync(
    changesetPath,
    `---
"@pocket-trash/repo": patch
---

Change release automation.
`,
  );

  assert.throws(
    () =>
      validateChangesetEntries(
        changesetPath,
        parseChangesetEntries(changesetPath),
        new Set(["@app/web"]),
      ),
    /unknown workspace package @pocket-trash\/repo/,
  );
});
