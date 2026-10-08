import { createDb, type Database, schema } from "@package/database";
import { and, eq, inArray } from "drizzle-orm";
import type { Page } from "playwright/test";
import { expect, test, waitForHydration } from "./auth";
import {
  createMutationFixture,
  type MutationCleanupResult,
} from "./mutation-fixture";

test.use({ trace: "off" });

test("@mutation collection lifecycle and deletion choices persist through the public UI", async ({
  page,
  signInAs,
}) => {
  test.skip(
    process.env.E2E_RUN_MUTATIONS !== "true",
    "Collection mutations require explicit isolation opt-in.",
  );
  test.setTimeout(120_000);

  const mutation = await createMutationFixture();
  if (!mutation.collectionId) {
    throw new Error(
      "The collection lifecycle fixture is missing a collection.",
    );
  }
  let lifecycle: CollectionLifecycleFixture | undefined;
  let cleanup: MutationCleanupResult | undefined;
  try {
    const fixture = await createCollectionLifecycleFixture(
      mutation.collectionId,
      mutation.spinnerProductId,
    );
    lifecycle = fixture;
    await signInAs("regular");

    await page.goto("/user/collections/add");
    await waitForHydration(page);
    await page
      .getByRole("textbox", { exact: true, name: "Name" })
      .fill(fixture.createdName);
    await page
      .getByRole("textbox", { name: "Description" })
      .fill("Created through Playwright.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/user\/collections\/\d+$/u);
    await expect(page.getByText("Created through Playwright.")).toBeVisible();
    await expect(
      page.locator("main").getByText("Private", { exact: true }),
    ).toBeVisible();

    const createdUrl = page.url();
    await page.getByRole("link", { name: "Edit" }).click();
    await page
      .getByRole("textbox", { exact: true, name: "Name" })
      .fill(fixture.editedName);
    await page
      .getByRole("textbox", { name: "Description" })
      .fill("Edited through Playwright.");
    await page.getByRole("switch", { name: "Public" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(createdUrl);
    await expect(
      page.getByRole("heading", { level: 2, name: fixture.editedName }),
    ).toBeVisible();
    await expect(page.getByText("Edited through Playwright.")).toBeVisible();
    await expect(
      page.locator("main").getByText("Public", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText("Edited through Playwright.")).toBeVisible();
    await expect(
      page.locator("main").getByText("Public", { exact: true }),
    ).toBeVisible();

    await page.goto("/user/collections/add");
    await waitForHydration(page);
    await page
      .getByRole("textbox", { exact: true, name: "Name" })
      .fill(fixture.equivalentName);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByText("We couldn't save this. Check the fields and try again."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/user\/collections\/add$/u);

    await archiveCollection(page, fixture.archive);
    await expect(
      page.locator("main").getByText("Private", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { exact: true, name: fixture.archive.itemName }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.locator("main").getByText("Private", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { exact: true, name: fixture.archive.itemName }),
    ).toBeVisible();

    await page.goto(`/collections/edit/${fixture.archive.itemId}`);
    await waitForHydration(page);
    await page
      .getByRole("button", { exact: true, name: "Permanently delete item" })
      .click();
    const itemDeletionDialog = page.getByRole("dialog", {
      name: "Permanently delete item",
    });
    await itemDeletionDialog
      .getByRole("checkbox", {
        name: "I understand that deleting this item and its images cannot be undone.",
      })
      .check();
    await itemDeletionDialog
      .getByRole("button", { exact: true, name: "Permanently delete item" })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/user/collections/${fixture.archive.id}$`, "u"),
    );
    await expect(
      page.getByRole("link", { exact: true, name: fixture.archive.itemName }),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("link", { exact: true, name: fixture.archive.itemName }),
    ).toHaveCount(0);

    await openDeletionDialog(page, fixture.deleted.id);
    await page
      .getByRole("radio", {
        name: "Permanently delete collection and items",
      })
      .check();
    const deleteButton = page.getByRole("button", {
      name: "Delete permanently",
    });
    await expect(deleteButton).toBeDisabled();
    await page
      .getByRole("checkbox", {
        name: "I understand that deleting this collection, its items, and their images cannot be undone.",
      })
      .check();
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();
    await expect(page).toHaveURL(/\/user\/collections$/u);
    await expect(
      page.getByText(fixture.deleted.name, { exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByText(fixture.deleted.name, { exact: true }),
    ).toHaveCount(0);

    await openDeletionDialog(page, fixture.moved.id);
    await page
      .getByRole("radio", { name: "Move items, then delete collection" })
      .check();
    const moveButton = page.getByRole("button", {
      name: "Move items and delete",
    });
    await expect(moveButton).toBeDisabled();
    await selectCollection(page, fixture.destinationName);
    await page
      .getByRole("checkbox", {
        name: "I understand that this collection and its cover images will be permanently deleted. Moved items and their images will be kept.",
      })
      .check();
    await expect(moveButton).toBeEnabled();
    await moveButton.click();
    await expect(page).toHaveURL(
      new RegExp(`/user/collections/${mutation.collectionId}$`, "u"),
    );
    await expect(
      page.getByRole("link", { exact: true, name: fixture.moved.itemName }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("link", { exact: true, name: fixture.moved.itemName }),
    ).toBeVisible();
    await page.goto("/user/collections");
    await expect(
      page.getByText(fixture.moved.name, { exact: true }),
    ).toHaveCount(0);
  } finally {
    try {
      await lifecycle?.cleanup();
    } finally {
      cleanup = await mutation.cleanup();
    }
  }

  expect(cleanup).toEqual({
    catalogDeleted: true,
    collectionDeleted: true,
    objectDeleted: "deleted",
  });
});

/** One collection seeded with one browser-visible item. */
type CollectionScenario = {
  /** Database collection identifier. */
  id: number;
  /** Browser-editable collection-item identifier. */
  itemId: number;
  /** Browser-visible item name. */
  itemName: string;
  /** Browser-visible collection name. */
  name: string;
};

/** Isolated collection lifecycle preconditions for one browser test. */
type CollectionLifecycleFixture = {
  /** Public collection retained by the archive choice. */
  archive: CollectionScenario;
  /**
   * Removes all collections created by this lifecycle test.
   *
   * @returns Completion after removal.
   */
  cleanup: () => Promise<void>;
  /** Name used when the browser creates the collection. */
  createdName: string;
  /** Existing destination collection name. */
  destinationName: string;
  /** Collection removed with all its items. */
  deleted: CollectionScenario;
  /** Name persisted by the browser edit. */
  editedName: string;
  /** Canonically equivalent name rejected by the create form. */
  equivalentName: string;
  /** Collection removed after its items move. */
  moved: CollectionScenario;
};

/**
 * Seeds collection deletion preconditions around an existing mutation fixture.
 *
 * @param destinationCollectionId - Existing collection that receives moved items.
 * @param productId - Spinner product used by the browser-visible items.
 * @returns Seeded collection scenarios and their cleanup operation.
 * @rejects When fixture dependencies or seeded rows are missing.
 */
async function createCollectionLifecycleFixture(
  destinationCollectionId: number,
  productId: number,
): Promise<CollectionLifecycleFixture> {
  const database = createDb({
    databaseUrl: requiredEnvironment("DATABASE_URL"),
  });
  const clerkId = requiredEnvironment("E2E_CLERK_REGULAR_USER_ID");
  const [owner] = await database
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.clerkId, clerkId))
    .limit(1);
  const [destination] = await database
    .select({ name: schema.userCollection.name })
    .from(schema.userCollection)
    .where(eq(schema.userCollection.id, destinationCollectionId))
    .limit(1);
  if (!owner || !destination) {
    throw new Error(
      "The collection lifecycle fixture dependencies are missing.",
    );
  }

  const runId = `e2e-${crypto.randomUUID()}`;
  const createdName = `${runId} lifecycle`;
  const editedName = `${runId} lifecycle edited`;
  const scenarios = ["archive", "delete", "move"].map((action) => ({
    itemName: `${runId} ${action} item`,
    name: `${runId} ${action}`,
  }));
  const seeded = await database.transaction(async (transaction) => {
    const collections = await transaction
      .insert(schema.userCollection)
      .values(
        scenarios.map(({ name }, index) => ({
          isPrivate: index !== 0,
          name,
          normalizedName: name,
          ownerId: owner.id,
        })),
      )
      .returning({
        id: schema.userCollection.id,
        name: schema.userCollection.name,
      });
    if (collections.length !== scenarios.length) {
      throw new Error("Failed to seed collection lifecycle scenarios.");
    }

    const collectionScenarios = scenarios.map((scenario) => {
      const collection = collections.find(({ name }) => name === scenario.name);
      if (!collection) throw new Error("A lifecycle collection is missing.");
      return { ...scenario, id: collection.id };
    });
    const items = await transaction
      .insert(schema.collectionItem)
      .values(
        collectionScenarios.map(({ id, itemName }) => ({
          approvalStatus: "approved" as const,
          collectionId: id,
          displayName: itemName,
          ownerId: owner.id,
        })),
      )
      .returning({
        collectionId: schema.collectionItem.collectionId,
        id: schema.collectionItem.id,
      });
    if (items.length !== collectionScenarios.length) {
      throw new Error("Failed to seed collection lifecycle items.");
    }
    await transaction.insert(schema.collectionDetailSpinner).values(
      items.map(({ id }) => ({
        id,
        productSpinnerId: productId,
      })),
    );
    return collectionScenarios.map((scenario) => {
      const item = items.find(
        ({ collectionId }) => collectionId === scenario.id,
      );
      if (!item) throw new Error("A lifecycle collection item is missing.");
      return { ...scenario, itemId: item.id };
    });
  });

  const [archive, deleted, moved] = seeded;
  if (!archive || !deleted || !moved) {
    throw new Error("The collection lifecycle scenarios are incomplete.");
  }
  return {
    archive,
    /** Removes every collection that may remain after the browser scenario. */
    async cleanup() {
      await cleanupLifecycleCollections(database, owner.id, {
        browserNames: [createdName, editedName],
        seededIds: seeded.map(({ id }) => id),
      });
    },
    createdName,
    deleted,
    destinationName: destination.name,
    editedName,
    equivalentName: editedName.toUpperCase().replaceAll(" ", " / "),
    moved,
  };
}

/**
 * Opens one collection's deletion dialog from its edit route.
 *
 * @param page - Authenticated browser page.
 * @param collectionId - Collection to edit.
 * @returns When the modal deletion choices are visible.
 */
async function openDeletionDialog(page: Page, collectionId: number) {
  await page.goto(`/user/collections/${collectionId}/edit`);
  await waitForHydration(page);
  await page.getByRole("button", { name: "Delete or archive" }).click();
  await expect(
    page.getByRole("dialog", { name: "Delete or archive" }),
  ).toBeVisible();
}

/**
 * Marks one collection private with the non-destructive archive choice.
 *
 * @param page - Authenticated browser page.
 * @param collection - Collection to archive.
 * @returns When the collection detail page is visible.
 */
async function archiveCollection(page: Page, collection: CollectionScenario) {
  await openDeletionDialog(page, collection.id);
  await page.getByRole("button", { name: "Mark private" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/user/collections/${collection.id}$`, "u"),
  );
  await expect(
    page.getByRole("heading", {
      exact: true,
      level: 2,
      name: collection.name,
    }),
  ).toBeVisible();
}

/**
 * Selects one destination from the collection deletion combobox.
 *
 * @param page - Authenticated browser page.
 * @param name - Exact destination collection name.
 * @returns When the destination is selected.
 */
async function selectCollection(page: Page, name: string) {
  const input = page
    .getByRole("combobox", { name: "Destination collection" })
    .and(page.locator("input"));
  await input.fill(name);
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(input).toHaveValue(name);
}

/**
 * Removes remaining seeded and browser-created collections for one test run.
 *
 * @param database - Isolated preview database.
 * @param ownerId - Expected collection owner identifier.
 * @param targets - Exact collection identifiers and names created by the test.
 * @returns When cleanup finishes.
 */
async function cleanupLifecycleCollections(
  database: Database,
  ownerId: number,
  targets: {
    /** Browser-created collection names. */
    browserNames: string[];
    /** Directly seeded collection identifiers. */
    seededIds: number[];
  },
) {
  await database
    .delete(schema.userCollection)
    .where(
      and(
        eq(schema.userCollection.ownerId, ownerId),
        inArray(schema.userCollection.name, targets.browserNames),
      ),
    );
  await database
    .delete(schema.userCollection)
    .where(
      and(
        eq(schema.userCollection.ownerId, ownerId),
        inArray(schema.userCollection.id, targets.seededIds),
      ),
    );
}

/**
 * Reads one non-empty E2E environment variable.
 *
 * @param name - Required variable name.
 * @returns The trimmed variable value.
 * @throws When the variable is missing or blank.
 */
function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
