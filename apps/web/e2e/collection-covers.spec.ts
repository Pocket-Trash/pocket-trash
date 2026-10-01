import { fileURLToPath } from "node:url";
import { createDb, schema } from "@package/database";
import { and, eq, inArray } from "drizzle-orm";
import { expect, test, waitForHydration } from "./auth";
import {
  createMutationFixture,
  type MutationCleanupResult,
} from "./mutation-fixture";

test.use({ trace: "off" });

test("@mutation collection covers survive failures and retain reusable history", async ({
  page,
  signInAs,
}) => {
  test.skip(
    process.env.E2E_RUN_MUTATIONS !== "true",
    "Mutation fixtures require explicit isolation opt-in.",
  );
  test.setTimeout(120_000);

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const clerkId = process.env.E2E_CLERK_REGULAR_USER_ID?.trim();
  const storageAccessKey = process.env.BUNNY_STORAGE_ACCESS_KEY?.trim();
  const storageEndpoint = process.env.BUNNY_STORAGE_ENDPOINT?.trim();
  const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME?.trim();
  const imagePrefix = process.env.BUNNY_IMAGE_FOLDER_PREFIX?.trim();
  if (
    !databaseUrl ||
    !clerkId ||
    !storageAccessKey ||
    !storageEndpoint ||
    !storageZoneName ||
    !imagePrefix
  ) {
    throw new Error("Collection cover E2E environment is incomplete.");
  }

  const fixture = await createMutationFixture();
  const database = createDb({ databaseUrl });
  const firstImage = fileURLToPath(
    new URL("../public/images/tmp/7866240630971-2.jpg", import.meta.url),
  );
  const secondImage = fileURLToPath(
    new URL("../public/images/tmp/8104228421819-2.jpg", import.meta.url),
  );
  const collectionName = `Cover lifecycle ${crypto.randomUUID()}`;
  const objectPaths = new Set<string>();
  let collectionId: number | undefined;
  let cleanup: MutationCleanupResult | undefined;

  const [owner] = await database
    .select({ id: schema.user.id, username: schema.user.username })
    .from(schema.user)
    .where(eq(schema.user.clerkId, clerkId))
    .limit(1);
  if (!owner) throw new Error("The regular E2E user is missing.");

  try {
    await signInAs("regular");
    await page.route("**/api/v0/storage/upload-sessions", (route) =>
      route.fulfill({
        body: JSON.stringify({ code: "upload_failed" }),
        contentType: "application/json",
        status: 503,
      }),
    );
    await page.goto("/user/collections/add");
    await waitForHydration(page);
    await page.getByLabel("Name").fill(collectionName);
    await page.getByLabel("Images").setInputFiles(firstImage);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByText(
        "The collection was saved, but its images could not be uploaded. Try again from Edit collection.",
      ),
    ).toBeVisible();

    const [savedCollection] = await database
      .select({ id: schema.userCollection.id })
      .from(schema.userCollection)
      .where(
        and(
          eq(schema.userCollection.ownerId, owner.id),
          eq(schema.userCollection.name, collectionName),
        ),
      )
      .limit(1);
    if (!savedCollection) {
      throw new Error("The collection was not preserved after upload failure.");
    }
    const createdCollectionId = savedCollection.id;
    collectionId = createdCollectionId;

    await page.unroute("**/api/v0/storage/upload-sessions");
    await page.goto(`/user/collections/${createdCollectionId}/edit`);
    await waitForHydration(page);
    await page
      .locator('input[type="file"][aria-label="Gallery"]')
      .setInputFiles(firstImage);
    await page.getByRole("button", { name: "Upload images" }).click();
    await expect(
      page.getByRole("heading", { name: "Current cover" }),
    ).toBeVisible();

    let images = await database
      .select({
        fileName: schema.collectionImage.fileName,
        id: schema.collectionImage.id,
        isCurrent: schema.collectionImage.isCurrent,
        objectPath: schema.collectionImage.objectPath,
      })
      .from(schema.collectionImage)
      .where(eq(schema.collectionImage.collectionId, createdCollectionId));
    expect(images).toHaveLength(1);
    expect(images[0]?.isCurrent).toBe(true);
    expect(images[0]?.objectPath.startsWith(`${imagePrefix}/`)).toBe(true);
    if (images[0]) objectPaths.add(images[0].objectPath);

    await page.goto(`/user/collections/${createdCollectionId}`);
    await expect(
      page.getByRole("button", {
        name: `Gallery: ${images[0]?.fileName}`,
      }),
    ).toBeVisible();

    await page.context().clearCookies();
    await page.goto(`/collections/${owner.id}/${createdCollectionId}`);
    await expect(
      page.getByRole("heading", { name: "Page unavailable" }),
    ).toBeVisible();

    await signInAs("regular");
    await page.goto(`/user/collections/${createdCollectionId}/edit`);
    await waitForHydration(page);
    await page.getByRole("switch", { name: "Public" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/user/collections/${createdCollectionId}$`, "u"),
    );

    await page.context().clearCookies();
    await page.goto(`/collections/${owner.id}/${createdCollectionId}`);
    await expect(
      page.getByRole("heading", { name: collectionName }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `Gallery: ${images[0]?.fileName}`,
      }),
    ).toBeVisible();

    await signInAs("regular");
    await page.goto(`/user/collections/${createdCollectionId}/edit`);
    await waitForHydration(page);
    await page
      .locator('input[type="file"][aria-label="Gallery"]')
      .setInputFiles(secondImage);
    await page.getByRole("button", { name: "Upload images" }).click();
    await expect(
      page.getByRole("button", { name: "Use this cover" }),
    ).toHaveCount(1);

    images = await database
      .select({
        fileName: schema.collectionImage.fileName,
        id: schema.collectionImage.id,
        isCurrent: schema.collectionImage.isCurrent,
        objectPath: schema.collectionImage.objectPath,
      })
      .from(schema.collectionImage)
      .where(eq(schema.collectionImage.collectionId, createdCollectionId));
    expect(images).toHaveLength(2);
    for (const image of images) objectPaths.add(image.objectPath);
    const original = images.find(({ isCurrent }) => isCurrent);
    const replacement = images.find(({ isCurrent }) => !isCurrent);
    if (!original || !replacement) {
      throw new Error("The collection cover history was not retained.");
    }

    await page.getByRole("button", { name: "Use this cover" }).click();
    await expect
      .poll(async () => {
        const [current] = await database
          .select({ id: schema.collectionImage.id })
          .from(schema.collectionImage)
          .where(
            and(
              eq(schema.collectionImage.collectionId, createdCollectionId),
              eq(schema.collectionImage.isCurrent, true),
            ),
          );
        return current?.id;
      })
      .toBe(replacement.id);

    const originalGalleryItem = page.getByRole("listitem").filter({
      has: page.getByRole("button", {
        name: `Delete image ${original.fileName}`,
      }),
    });
    await originalGalleryItem
      .getByRole("button", { name: "Use this cover" })
      .click();
    await expect
      .poll(async () => {
        const [current] = await database
          .select({ id: schema.collectionImage.id })
          .from(schema.collectionImage)
          .where(
            and(
              eq(schema.collectionImage.collectionId, createdCollectionId),
              eq(schema.collectionImage.isCurrent, true),
            ),
          );
        return current?.id;
      })
      .toBe(original.id);

    await page
      .locator('input[type="file"][aria-label="Gallery"]')
      .setInputFiles(secondImage);
    await page.getByRole("button", { name: "Upload images" }).click();
    await expect(
      page.getByRole("heading", { name: "Current cover" }),
    ).toBeVisible();
    const afterDuplicate = await database
      .select({
        id: schema.collectionImage.id,
        objectPath: schema.collectionImage.objectPath,
      })
      .from(schema.collectionImage)
      .where(eq(schema.collectionImage.collectionId, createdCollectionId));
    expect(afterDuplicate).toHaveLength(2);
    expect(afterDuplicate).toEqual(
      expect.arrayContaining([
        { id: original.id, objectPath: original.objectPath },
        { id: replacement.id, objectPath: replacement.objectPath },
      ]),
    );

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Clear cover" }).click();
    await expect
      .poll(async () => {
        const current = await database
          .select({ id: schema.collectionImage.id })
          .from(schema.collectionImage)
          .where(
            and(
              eq(schema.collectionImage.collectionId, createdCollectionId),
              eq(schema.collectionImage.isCurrent, true),
            ),
          );
        return current.length;
      })
      .toBe(0);
    await expect(
      page.getByRole("button", { name: "Use this cover" }),
    ).toHaveCount(2);

    await page.getByRole("button", { name: "Use this cover" }).first().click();
    await expect
      .poll(async () => {
        const [current] = await database
          .select({ id: schema.collectionImage.id })
          .from(schema.collectionImage)
          .where(
            and(
              eq(schema.collectionImage.collectionId, createdCollectionId),
              eq(schema.collectionImage.isCurrent, true),
            ),
          );
        return current?.id;
      })
      .toBe(replacement.id);

    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", {
        name: new RegExp(`Delete image.*${original.fileName}`, "u"),
      })
      .click();
    await expect
      .poll(async () => {
        const remaining = await database
          .select({ id: schema.collectionImage.id })
          .from(schema.collectionImage)
          .where(eq(schema.collectionImage.collectionId, createdCollectionId));
        return remaining.map(({ id }) => id);
      })
      .toEqual([replacement.id]);

    const encodedDeletedPath = original.objectPath
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    const deletedObject = await fetch(
      `${storageEndpoint.replace(/\/+$/u, "")}/${encodeURIComponent(storageZoneName)}/${encodedDeletedPath}`,
      { headers: { AccessKey: storageAccessKey } },
    );
    expect(deletedObject.status).toBe(404);

    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Current cover" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: new RegExp(`Delete image.*${replacement.fileName}`, "u"),
      }),
    ).toBeVisible();
  } finally {
    if (collectionId) {
      const cleanupCollectionId = collectionId;
      const remainingImages = await database
        .select({ objectPath: schema.collectionImage.objectPath })
        .from(schema.collectionImage)
        .where(eq(schema.collectionImage.collectionId, cleanupCollectionId));
      for (const { objectPath } of remainingImages) objectPaths.add(objectPath);

      await Promise.all(
        [...objectPaths].map(async (objectPath) => {
          const encodedPath = objectPath
            .split("/")
            .map(encodeURIComponent)
            .join("/");
          const response = await fetch(
            `${storageEndpoint.replace(/\/+$/u, "")}/${encodeURIComponent(storageZoneName)}/${encodedPath}`,
            {
              headers: { AccessKey: storageAccessKey },
              method: "DELETE",
            },
          );
          if (response.status !== 200 && response.status !== 404) {
            throw new Error(
              `Collection cover cleanup failed: ${response.status}.`,
            );
          }
        }),
      );
      const folderResponse = await fetch(
        `${storageEndpoint.replace(/\/+$/u, "")}/${encodeURIComponent(storageZoneName)}/${imagePrefix
          .split("/")
          .map(encodeURIComponent)
          .join("/")}/collection/${cleanupCollectionId}/`,
        {
          headers: { AccessKey: storageAccessKey },
          method: "DELETE",
        },
      );
      if (folderResponse.status !== 200 && folderResponse.status !== 404) {
        throw new Error(
          `Collection cover folder cleanup failed: ${folderResponse.status}.`,
        );
      }

      await database.transaction(async (transaction) => {
        if (objectPaths.size) {
          await transaction
            .delete(schema.storageObjectDeletion)
            .where(
              inArray(schema.storageObjectDeletion.objectPath, [
                ...objectPaths,
              ]),
            );
        }
        await transaction
          .delete(schema.uploadSession)
          .where(
            and(
              eq(schema.uploadSession.targetType, "collection"),
              eq(schema.uploadSession.targetId, cleanupCollectionId),
            ),
          );
        await transaction
          .delete(schema.auditEvent)
          .where(
            and(
              eq(schema.auditEvent.targetType, "collection"),
              eq(schema.auditEvent.targetId, String(cleanupCollectionId)),
            ),
          );
        await transaction
          .delete(schema.userCollection)
          .where(
            and(
              eq(schema.userCollection.id, cleanupCollectionId),
              eq(schema.userCollection.ownerId, owner.id),
            ),
          );
      });
    }
    cleanup = await fixture.cleanup();
  }

  expect(cleanup).toEqual({
    catalogDeleted: true,
    collectionDeleted: true,
    objectDeleted: "deleted",
  });
});
