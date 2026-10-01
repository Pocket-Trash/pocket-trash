import assert from "node:assert/strict";
import test from "node:test";

import { needsChangelogReminder } from "./check-changelog-reminder.mjs";

test("warns for customer-facing web changes without a registry update", () => {
  for (const file of [
    "apps/web/src/components/example.tsx",
    "apps/web/src/pages/example.tsx",
    "apps/web/src/routes/example.tsx",
    "apps/web/src/styles.css",
  ]) {
    assert.equal(needsChangelogReminder([file]), true, file);
  }
});

test("does not warn when the registry is updated or changes are unrelated", () => {
  assert.equal(
    needsChangelogReminder([
      "apps/web/src/pages/example.tsx",
      "apps/web/src/lib/changelog-content.ts",
    ]),
    false,
  );
  assert.equal(
    needsChangelogReminder(["packages/database/src/schema.ts"]),
    false,
  );
});
