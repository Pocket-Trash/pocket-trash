import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createChangelogEntry, parseChangeset } from "./release.mjs";

test("changelog entries include selected changeset packages", () => {
  const directory = mkdtempSync(join(tmpdir(), "release-test-"));
  mkdirSync(join(directory, ".changeset"));
  const changesetPath = join(directory, ".changeset", "repo-change.md");

  writeFileSync(
    changesetPath,
    `---
"@pocket-trash/repo": patch
"@package/logger": minor
---

Improve release notes.
`,
  );

  assert.equal(
    parseChangeset(changesetPath).packages.join(", "),
    "@pocket-trash/repo, @package/logger",
  );
  assert.match(
    createChangelogEntry("1.2.3", [parseChangeset(changesetPath)]),
    /- \*\*@pocket-trash\/repo, @package\/logger\*\*: Improve release notes\./,
  );
});
