import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "yaml";

/** Parsed version-update configuration under test. */
const config = parse(readFileSync(".github/dependabot.yml", "utf8"));
/** Parsed trusted writer workflow under test. */
const workflow = parse(
  readFileSync(".github/workflows/dependabot-changeset.yml", "utf8"),
);

test("pilot is paused, age constrained and isolated from manually owned refreshes", () => {
  assert.equal(config.version, 2);
  assert.equal(config.updates.length, 1);
  const update = config.updates[0];
  assert.equal(update["package-ecosystem"], "npm");
  assert.equal(update.directory, "/");
  assert.equal(update["target-branch"], "main");
  assert.deepEqual(update.schedule, {
    interval: "weekly",
    day: "monday",
    time: "04:00",
    timezone: "America/Toronto",
  });
  assert.equal(update["open-pull-requests-limit"], 0);
  assert.equal(update.cooldown["default-days"], 7);
  assert.deepEqual(update.allow, [{ "dependency-name": "yaml" }]);
  assert.deepEqual(update.groups.compatible["update-types"], [
    "patch",
    "minor",
  ]);
  assert.equal(update.groups.compatible["applies-to"], "version-updates");
  assert.deepEqual(update["commit-message"], {
    prefix: "chore",
    include: "scope",
  });
  assert.deepEqual(update.registries, ["fontawesome"]);
  assert.equal(
    config.registries.fontawesome.url,
    "https://npm.fontawesome.com",
  );
  assert.equal(
    config.registries.fontawesome.token,
    "${{ secrets.FONTAWESOME_PACKAGE_TOKEN }}",
  );
});

test("writer uses a trusted base checkout and narrow GitHub token permissions", () => {
  assert.ok(workflow.on.pull_request_target.types.includes("synchronize"));
  assert.deepEqual(workflow.permissions, {
    contents: "write",
    "pull-requests": "read",
  });
  assert.equal(workflow.concurrency["cancel-in-progress"], true);
  const steps = workflow.jobs.marker.steps;
  assert.equal(steps[0].with.ref, "${{ github.event.pull_request.base.sha }}");
  assert.equal(steps[0].with["persist-credentials"], false);
  assert.equal(steps[2].run, "node scripts/dependabot-changeset.mjs");
  assert.ok(!steps.some((step) => step.run?.includes("install")));
  assert.equal(steps[2].env.GITHUB_TOKEN, "${{ github.token }}");
});
