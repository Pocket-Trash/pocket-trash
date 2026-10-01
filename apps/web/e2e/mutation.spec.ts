import { expect, test } from "playwright/test";
import {
  createMutationFixture,
  type MutationCleanupResult,
} from "./mutation-fixture";

test.use({ trace: "off" });

test("@mutation isolated fixtures create and remove database and Bunny records", async () => {
  test.skip(
    process.env.E2E_RUN_MUTATIONS !== "true",
    "Mutation fixtures require explicit isolation opt-in.",
  );

  const fixture = await createMutationFixture();
  let cleanup: MutationCleanupResult | undefined;
  try {
    expect(fixture.collectionId).toBeGreaterThan(0);
    expect(fixture.spinnerProductId).toBeGreaterThan(0);
    expect(fixture.buttonProductId).toBeGreaterThan(0);
    expect(fixture.materialId).toBeGreaterThan(0);
    expect(fixture.objectPath).toContain(`/pr-${process.env.E2E_PR_NUMBER}/`);
  } finally {
    cleanup = await fixture.cleanup();
  }

  expect(cleanup).toEqual({
    catalogDeleted: true,
    collectionDeleted: true,
    objectDeleted: "deleted",
  });
});
