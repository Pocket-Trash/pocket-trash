import { createDb, type Database, schema } from "@package/database";
import { and, eq, inArray } from "drizzle-orm";
import { expect, test } from "./auth";
import {
  createMutationFixture,
  type MutationCleanupResult,
  type MutationFixture,
} from "./mutation-fixture";

test.use({ trace: "off" });

test("@mutation public collection browsing preserves effective privacy", async ({
  page,
  signInAs,
}) => {
  test.skip(
    process.env.E2E_RUN_MUTATIONS !== "true",
    "Collection mutations require explicit isolation opt-in.",
  );
  test.setTimeout(120_000);

  const mutation = await createMutationFixture();
  let privacy: PublicPrivacyFixture | undefined;
  let cleanup: MutationCleanupResult | undefined;
  try {
    const fixture = await createPublicPrivacyFixture(mutation);
    privacy = fixture;

    await page.goto("/collections");
    const publicCard = page
      .getByRole("article")
      .filter({ hasText: fixture.publicCollection.name });
    await expect(publicCard).toContainText(fixture.ownerUsername);
    await expect(publicCard).toContainText("Collection items: 2");
    const emptyCard = page
      .getByRole("article")
      .filter({ hasText: fixture.emptyCollection.name });
    await expect(emptyCard).toContainText("Collection items: 0");
    await expect(
      page.getByText(fixture.privateCollection.name, { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("img", {
        name: `Image of ${fixture.privateCollection.name}`,
      }),
    ).toHaveCount(0);

    await page
      .getByRole("link", {
        name: new RegExp(fixture.publicCollection.name, "u"),
      })
      .click();
    await expect(page).toHaveURL(
      new RegExp(
        `/collections/${fixture.ownerId}/${fixture.publicCollection.id}$`,
        "u",
      ),
    );
    await expect(
      page.locator("main").getByText("Collection items: 2"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        exact: true,
        name: fixture.publicSpinner.name,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        exact: true,
        name: fixture.publicButton.name,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(fixture.privateButton.name, { exact: true }),
    ).toHaveCount(0);

    await page
      .getByRole("link", {
        exact: true,
        name: fixture.publicSpinner.name,
      })
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: fixture.publicSpinner.name }),
    ).toBeVisible();
    await expect(
      page.getByText("Default Button", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(fixture.privateButton.name, { exact: true }),
    ).toHaveCount(0);

    await page.goto(
      `/collections/${fixture.ownerId}/${fixture.publicCollection.id}/${fixture.privateButton.id}`,
    );
    await expect(
      page.getByRole("heading", { name: "Page unavailable" }),
    ).toBeVisible();
    await page.goto(
      `/collections/${fixture.ownerId}/${fixture.privateCollection.id}`,
    );
    await expect(
      page.getByRole("heading", { name: "Page unavailable" }),
    ).toBeVisible();

    await page.goto(
      `/collections/${fixture.ownerId}/${fixture.publicCollection.id}`,
    );
    await page
      .getByRole("link", { exact: true, name: fixture.ownerUsername })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/collections/${fixture.ownerId}$`, "u"),
    );
    await expect(
      page.getByText(fixture.publicCollection.name, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(fixture.emptyCollection.name, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(fixture.privateCollection.name, { exact: true }),
    ).toHaveCount(0);

    await signInAs("regular");
    await page.goto("/user/collections");
    await expect(
      page.getByText(fixture.privateCollection.name, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: `Image of ${fixture.privateCollection.name}`,
      }),
    ).toHaveCount(1);
    await page.goto(`/user/collections/${fixture.privateCollection.id}`);
    await expect(
      page.getByRole("link", {
        exact: true,
        name: fixture.privateCollectionItem.name,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("link", {
        exact: true,
        name: fixture.privateCollectionItem.name,
      }),
    ).toBeVisible();
  } finally {
    try {
      await privacy?.cleanup();
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

test("@mutation admins can open private collection resources directly", async ({
  page,
  signInAs,
}) => {
  test.skip(
    process.env.E2E_RUN_MUTATIONS !== "true",
    "Collection mutations require explicit isolation opt-in.",
  );
  test.setTimeout(120_000);

  const mutation = await createMutationFixture();
  let privacy: PublicPrivacyFixture | undefined;
  let cleanup: MutationCleanupResult | undefined;
  try {
    const fixture = await createPublicPrivacyFixture(mutation);
    privacy = fixture;
    await signInAs("admin");

    await page.goto(
      `/collections/${fixture.ownerId}/${fixture.privateCollection.id}`,
    );
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: fixture.privateCollection.name,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: `Image of ${fixture.privateCollection.name}`,
      }),
    ).toHaveCount(1);

    await page.goto(
      `/collections/${fixture.ownerId}/${fixture.privateCollection.id}/${fixture.privateCollectionItem.id}`,
    );
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: fixture.privateCollectionItem.name,
      }),
    ).toBeVisible();
    await expect(page.getByText("Delisted", { exact: true })).toBeVisible();
  } finally {
    try {
      await privacy?.cleanup();
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

/** Collection identifier and browser-visible name. */
type CollectionReference = {
  /** Database identifier. */
  id: number;
  /** Browser-visible name. */
  name: string;
};

/** Public collection visibility scenarios created for one browser test. */
type PublicPrivacyFixture = {
  /**
   * Removes all additional collections created by this fixture.
   *
   * @returns Completion after removal.
   */
  cleanup: () => Promise<void>;
  /** Public collection with no items. */
  emptyCollection: CollectionReference;
  /** Regular user's database identifier. */
  ownerId: number;
  /** Regular user's browser-visible name. */
  ownerUsername: string;
  /** Public spinner-button item. */
  publicButton: CollectionReference;
  /** Public collection containing mixed item types. */
  publicCollection: CollectionReference;
  /** Public spinner item linked to a private button. */
  publicSpinner: CollectionReference;
  /** Private linked spinner-button item. */
  privateButton: CollectionReference;
  /** Private collection with a cover. */
  privateCollection: CollectionReference;
  /** Item hidden by its private collection. */
  privateCollectionItem: CollectionReference;
};

/**
 * Seeds public, private, empty, and linked collection scenarios.
 *
 * @param mutation - Existing isolated catalog and Bunny fixture.
 * @returns Seeded privacy scenarios and their cleanup operation.
 * @rejects When the owner, collection, or seeded rows are missing.
 */
async function createPublicPrivacyFixture(
  mutation: MutationFixture,
): Promise<PublicPrivacyFixture> {
  const database = createDb({
    databaseUrl: requiredEnvironment("DATABASE_URL"),
  });
  const clerkId = requiredEnvironment("E2E_CLERK_REGULAR_USER_ID");
  const [owner] = await database
    .select({ id: schema.user.id, username: schema.user.username })
    .from(schema.user)
    .where(eq(schema.user.clerkId, clerkId))
    .limit(1);
  const privateCollectionId = mutation.collectionId;
  if (privateCollectionId === null) {
    throw new Error("The public privacy fixture dependencies are missing.");
  }
  const [privateCollection] = await database
    .select({ id: schema.userCollection.id, name: schema.userCollection.name })
    .from(schema.userCollection)
    .where(eq(schema.userCollection.id, privateCollectionId))
    .limit(1);
  if (!owner || !privateCollection) {
    throw new Error("The public privacy fixture dependencies are missing.");
  }

  const runId = `e2e-${crypto.randomUUID()}`;
  const seeded = await database.transaction(async (transaction) => {
    const collections = await transaction
      .insert(schema.userCollection)
      .values([
        {
          isPrivate: false,
          name: `${runId} public`,
          normalizedName: `${runId}public`,
          ownerId: owner.id,
        },
        {
          isPrivate: false,
          name: `${runId} empty`,
          normalizedName: `${runId}empty`,
          ownerId: owner.id,
        },
      ])
      .returning({
        id: schema.userCollection.id,
        name: schema.userCollection.name,
      });
    const publicCollection = collections.find(({ name }) =>
      name.endsWith(" public"),
    );
    const emptyCollection = collections.find(({ name }) =>
      name.endsWith(" empty"),
    );
    if (!publicCollection || !emptyCollection) {
      throw new Error("The public collection scenarios are missing.");
    }

    const itemValues = [
      {
        collectionId: publicCollection.id,
        displayName: `${runId} public spinner`,
        isPrivate: false,
        ownerId: owner.id,
      },
      {
        collectionId: publicCollection.id,
        displayName: `${runId} public button`,
        isPrivate: false,
        ownerId: owner.id,
      },
      {
        collectionId: publicCollection.id,
        displayName: `${runId} private button`,
        isPrivate: true,
        ownerId: owner.id,
      },
      {
        collectionId: privateCollection.id,
        displayName: `${runId} private collection item`,
        isPrivate: false,
        ownerId: owner.id,
      },
    ];
    const items = await transaction
      .insert(schema.collectionItem)
      .values(itemValues)
      .returning({
        id: schema.collectionItem.id,
        name: schema.collectionItem.displayName,
      });
    /**
     * Finds one seeded item by its unique name suffix.
     *
     * @param suffix - Expected item-name suffix.
     * @returns Matching item reference.
     * @throws When the item is missing.
     */
    const item = (suffix: string) => {
      const result = items.find(({ name }) => name?.endsWith(suffix));
      if (!result?.name) throw new Error(`The ${suffix} item is missing.`);
      return { id: result.id, name: result.name };
    };
    const publicSpinner = item(" public spinner");
    const publicButton = item(" public button");
    const privateButton = item(" private button");
    const privateCollectionItem = item(" private collection item");

    await transaction.insert(schema.collectionSpinnerButton).values([
      { id: publicButton.id, productSpinnerButtonId: mutation.buttonProductId },
      {
        id: privateButton.id,
        productSpinnerButtonId: mutation.buttonProductId,
      },
    ]);
    await transaction.insert(schema.collectionSpinner).values([
      {
        id: publicSpinner.id,
        installedButtonId: privateButton.id,
        productSpinnerId: mutation.spinnerProductId,
      },
      {
        id: privateCollectionItem.id,
        productSpinnerId: mutation.spinnerProductId,
      },
    ]);
    await transaction.insert(schema.collectionImage).values({
      collectionId: privateCollection.id,
      contentType: "image/png",
      fileName: `${runId}.png`,
      isCurrent: true,
      objectPath: mutation.objectPath,
      position: 0,
      sha256: "a".repeat(64),
      size: 1,
      url: `https://cdn.test/${mutation.objectPath}`,
    });

    return {
      emptyCollection,
      privateButton,
      privateCollectionItem,
      publicButton,
      publicCollection,
      publicSpinner,
    };
  });

  return {
    /** Removes the public collections; the shared mutation fixture owns the private one. */
    async cleanup() {
      await cleanupPublicPrivacyFixture(database, owner.id, [
        seeded.publicCollection.id,
        seeded.emptyCollection.id,
      ]);
    },
    ...seeded,
    ownerId: owner.id,
    ownerUsername: owner.username ?? clerkId,
    privateCollection,
  };
}

/**
 * Removes additional public collection rows created by the privacy fixture.
 *
 * @param database - Isolated preview database.
 * @param ownerId - Expected collection owner identifier.
 * @param collectionIds - Exact public collection identifiers.
 * @returns Completion after removal.
 */
async function cleanupPublicPrivacyFixture(
  database: Database,
  ownerId: number,
  collectionIds: number[],
) {
  await database
    .delete(schema.userCollection)
    .where(
      and(
        eq(schema.userCollection.ownerId, ownerId),
        inArray(schema.userCollection.id, collectionIds),
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
