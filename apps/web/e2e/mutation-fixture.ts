import { createDb, type Database, schema } from "@package/database";
import { and, eq, inArray } from "drizzle-orm";
import { assertMutationIsolation } from "./mutation-guard";

/** Result of removing one isolated database and Bunny fixture pair. */
export type MutationCleanupResult = {
  /** Whether every catalog fixture row was deleted. */
  catalogDeleted: boolean;
  /** Whether the fixture collection was deleted. */
  collectionDeleted: boolean;
  /** Bunny deletion result for the fixture object. */
  objectDeleted: "deleted" | "missing";
};

/** Isolated mutation fixture created for one Playwright test. */
export type MutationFixture = {
  /** Spinner-button product name created for browser selection. */
  buttonProductName: string;
  /** Spinner-button product identifier created for downstream collection tests. */
  buttonProductId: number;
  /** Database collection identifier created for this run, when requested. */
  collectionId: number | null;
  /** Unique collection names reserved for browser-created rows. */
  collectionNames: [string, string];
  /** Finish name created for browser selection. */
  finishName: string;
  /** Material identifier created for downstream collection tests. */
  materialId: number;
  /** Material name created for browser selection. */
  materialName: string;
  /** Bunny object path created for this run. */
  objectPath: string;
  /** Spinner product identifier created for downstream collection tests. */
  spinnerProductId: number;
  /** Spinner product name created for browser selection. */
  spinnerProductName: string;
  /** Spinner product slug created for browser navigation. */
  spinnerProductSlug: string;
  /**
   * Removes and verifies every created row and object.
   *
   * @returns The verified database and Bunny cleanup result.
   */
  cleanup: () => Promise<MutationCleanupResult>;
};

/**
 * Creates uniquely named database rows and one Bunny object after safety checks.
 *
 * @param root0 - Fixture setup options.
 * @param root0.createCollection - Whether setup should create the first collection.
 * @returns The created identifiers and their cleanup operation.
 * @rejects When isolation is unsafe or fixture setup fails.
 */
export async function createMutationFixture({
  createCollection = true,
}: {
  /** Whether setup should create the first collection. */
  createCollection?: boolean;
} = {}): Promise<MutationFixture> {
  const isolation = assertMutationIsolation(process.env);
  const database = createDb({
    databaseUrl: requiredEnvironment("DATABASE_URL"),
  });
  const clerkId = requiredEnvironment("E2E_CLERK_REGULAR_USER_ID");
  const storage = {
    accessKey: requiredEnvironment("BUNNY_STORAGE_ACCESS_KEY"),
    endpoint: requiredEnvironment("BUNNY_STORAGE_ENDPOINT"),
    zoneName: requiredEnvironment("BUNNY_STORAGE_ZONE_NAME"),
  };
  const runId = `e2e-${crypto.randomUUID()}`;
  const buttonProductName = `${runId} button`;
  const collectionNames: [string, string] = [
    `${runId} first`,
    `${runId} second`,
  ];
  const finishName = `${runId} finish`;
  const materialName = `${runId} material`;
  const spinnerProductName = `${runId} spinner`;
  const spinnerProductSlug = `${runId}-spinner`;
  const bytes = new TextEncoder().encode(runId);
  const objectPath = `${isolation.resourcePrefix}/${runId}.txt`;
  const [owner] = await database
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.clerkId, clerkId))
    .limit(1);
  if (!owner)
    throw new Error("The regular E2E user is missing from the database.");
  if (!createCollection) {
    await database
      .delete(schema.userCollection)
      .where(eq(schema.userCollection.ownerId, owner.id));
  }

  const databaseFixture = await database.transaction(async (transaction) => {
    const createdProductTypes = await transaction
      .insert(schema.productType)
      .values([
        { name: "Spinner", slug: "spinner" },
        { name: "Spinner button", slug: "spinner-button" },
      ])
      .onConflictDoNothing({ target: schema.productType.slug })
      .returning({ id: schema.productType.id });
    const productTypes = await transaction
      .select({ id: schema.productType.id, slug: schema.productType.slug })
      .from(schema.productType)
      .where(inArray(schema.productType.slug, ["spinner", "spinner-button"]));
    const spinnerType = productTypes.find(({ slug }) => slug === "spinner");
    const buttonType = productTypes.find(
      ({ slug }) => slug === "spinner-button",
    );
    if (!spinnerType || !buttonType) {
      throw new Error("Failed to seed E2E product types.");
    }

    const [maker] = await transaction
      .insert(schema.maker)
      .values({ name: runId })
      .returning({ id: schema.maker.id });
    const [material] = await transaction
      .insert(schema.material)
      .values({ name: materialName, slug: `${runId}-material` })
      .returning({ id: schema.material.id });
    const [finish] = await transaction
      .insert(schema.finish)
      .values({ name: finishName, slug: `${runId}-finish` })
      .returning({ id: schema.finish.id });
    if (!maker || !material || !finish) {
      throw new Error("Failed to seed E2E lookups.");
    }

    const products = await transaction
      .insert(schema.product)
      .values([
        {
          approvalStatus: "approved",
          makerId: maker.id,
          name: spinnerProductName,
          productTypeId: spinnerType.id,
          slug: spinnerProductSlug,
        },
        {
          approvalStatus: "approved",
          makerId: maker.id,
          name: buttonProductName,
          productTypeId: buttonType.id,
          slug: `${runId}-button`,
        },
      ])
      .returning({
        id: schema.product.id,
        productTypeId: schema.product.productTypeId,
      });
    const spinner = products.find(
      ({ productTypeId }) => productTypeId === spinnerType.id,
    );
    const button = products.find(
      ({ productTypeId }) => productTypeId === buttonType.id,
    );
    if (!spinner || !button) throw new Error("Failed to seed E2E products.");

    await transaction.insert(schema.productSpinner).values({ id: spinner.id });
    await transaction
      .insert(schema.productSpinnerButton)
      .values({ id: button.id });
    await transaction.insert(schema.productMaterial).values([
      { materialId: material.id, productId: spinner.id },
      { materialId: material.id, productId: button.id },
    ]);
    const finishOptions = await transaction
      .insert(schema.finishOption)
      .values([
        { position: 0, productId: spinner.id },
        { position: 0, productId: button.id },
      ])
      .returning({ id: schema.finishOption.id });
    await transaction.insert(schema.finishOptionFinish).values(
      finishOptions.map(({ id }) => ({
        finishId: finish.id,
        finishOptionId: id,
        position: 0,
      })),
    );

    const collection = createCollection
      ? (
          await transaction
            .insert(schema.userCollection)
            .values({
              isPrivate: true,
              name: collectionNames[0],
              normalizedName: collectionNames[0],
              ownerId: owner.id,
            })
            .returning({ id: schema.userCollection.id })
        )[0]
      : null;
    if (createCollection && !collection) {
      throw new Error("Failed to create the E2E fixture collection.");
    }

    return {
      buttonProductId: button.id,
      collectionId: collection?.id ?? null,
      collectionNames,
      createdProductTypeIds: createdProductTypes.map(({ id }) => id),
      finishId: finish.id,
      makerId: maker.id,
      materialId: material.id,
      spinnerProductId: spinner.id,
    };
  });

  try {
    await requestBunny(storage, objectPath, [200, 201], {
      body: bytes,
      headers: {
        "content-length": String(bytes.byteLength),
        "content-type": "text/plain",
      },
      method: "PUT",
    });
  } catch (error) {
    await cleanupDatabaseFixture(database, owner.id, databaseFixture);
    throw error;
  }

  return {
    buttonProductName,
    buttonProductId: databaseFixture.buttonProductId,
    collectionId: databaseFixture.collectionId,
    collectionNames,
    finishName,
    materialId: databaseFixture.materialId,
    materialName,
    objectPath,
    spinnerProductId: databaseFixture.spinnerProductId,
    spinnerProductName,
    spinnerProductSlug,
    /**
     * Removes the fixture and reports whether every resource was deleted.
     *
     * @returns The verified database and Bunny cleanup result.
     */
    async cleanup() {
      const [objectResponse, databaseDeleted] = await Promise.all([
        requestBunny(storage, objectPath, [200, 404], { method: "DELETE" }),
        cleanupDatabaseFixture(database, owner.id, databaseFixture),
      ]);

      return {
        ...databaseDeleted,
        objectDeleted: objectResponse.status === 404 ? "missing" : "deleted",
      };
    },
  };
}

/** Bunny Storage settings used only by the isolated fixture object. */
type BunnyFixtureStorage = {
  /** Storage-zone password. */
  accessKey: string;
  /** Regional Bunny Storage API origin. */
  endpoint: string;
  /** Storage-zone name. */
  zoneName: string;
};

/**
 * Sends one bounded request to the fixture's exact Bunny object path.
 *
 * @param storage - Bunny Storage connection settings.
 * @param objectPath - Guarded PR-prefixed object path.
 * @param expectedStatuses - HTTP statuses accepted by the operation.
 * @param init - Request body, headers, and method.
 * @returns The accepted Bunny response.
 * @rejects When Bunny rejects or times out the request.
 */
async function requestBunny(
  storage: BunnyFixtureStorage,
  objectPath: string,
  expectedStatuses: number[],
  init: RequestInit,
) {
  const endpoint = storage.endpoint.replace(/\/+$/u, "");
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `${endpoint}/${encodeURIComponent(storage.zoneName)}/${encodedPath}`,
    {
      ...init,
      headers: { AccessKey: storage.accessKey, ...init.headers },
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`Bunny storage request failed: ${response.status}.`);
  }
  return response;
}

/** Rows created together for one isolated mutation run. */
type DatabaseFixture = {
  /** Spinner-button product identifier. */
  buttonProductId: number;
  /** Collection identifier created directly by setup, when requested. */
  collectionId: number | null;
  /** Collection names that browser setup may persist. */
  collectionNames: [string, string];
  /** Product-type identifiers inserted because canonical rows were missing. */
  createdProductTypeIds: number[];
  /** Finish identifier. */
  finishId: number;
  /** Maker identifier. */
  makerId: number;
  /** Material identifier. */
  materialId: number;
  /** Spinner product identifier. */
  spinnerProductId: number;
};

/**
 * Deletes every database row owned by one mutation fixture.
 *
 * @param database - Isolated preview database.
 * @param ownerId - Expected collection owner identifier.
 * @param fixture - Exact identifiers created by setup.
 * @returns Whether the collection and catalog rows were removed.
 */
async function cleanupDatabaseFixture(
  database: Database,
  ownerId: number,
  fixture: DatabaseFixture,
) {
  return database.transaction(async (transaction) => {
    await transaction
      .delete(schema.userCollection)
      .where(
        and(
          eq(schema.userCollection.ownerId, ownerId),
          inArray(schema.userCollection.name, fixture.collectionNames),
        ),
      );
    const remainingCollections = await transaction
      .select({ id: schema.userCollection.id })
      .from(schema.userCollection)
      .where(
        and(
          eq(schema.userCollection.ownerId, ownerId),
          inArray(schema.userCollection.name, fixture.collectionNames),
        ),
      );
    const deletedProducts = await transaction
      .delete(schema.product)
      .where(
        inArray(schema.product.id, [
          fixture.spinnerProductId,
          fixture.buttonProductId,
        ]),
      )
      .returning({ id: schema.product.id });
    const deletedMaterials = await transaction
      .delete(schema.material)
      .where(eq(schema.material.id, fixture.materialId))
      .returning({ id: schema.material.id });
    const deletedFinishes = await transaction
      .delete(schema.finish)
      .where(eq(schema.finish.id, fixture.finishId))
      .returning({ id: schema.finish.id });
    const deletedMakers = await transaction
      .delete(schema.maker)
      .where(eq(schema.maker.id, fixture.makerId))
      .returning({ id: schema.maker.id });
    const deletedProductTypes = fixture.createdProductTypeIds.length
      ? await transaction
          .delete(schema.productType)
          .where(inArray(schema.productType.id, fixture.createdProductTypeIds))
          .returning({ id: schema.productType.id })
      : [];

    return {
      catalogDeleted:
        deletedProducts.length === 2 &&
        deletedMaterials.length === 1 &&
        deletedFinishes.length === 1 &&
        deletedMakers.length === 1 &&
        deletedProductTypes.length === fixture.createdProductTypeIds.length,
      collectionDeleted: remainingCollections.length === 0,
    };
  });
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
