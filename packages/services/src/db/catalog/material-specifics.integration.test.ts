import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createNoopLogger } from "@package/logger";
import { createUploadStorage, sha256 } from "@package/storage";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { expect, it } from "vitest";
import { createStorageService } from "../../storage/index.js";
import { createDbServices } from "../index.js";

it("preserves offered IDs, retained canonical selections, and scoped upload completion", async (context) => {
  const client = new PGlite();
  context.onTestFinished(() => client.close());
  const db = drizzle({ client, relations: schema.relations });
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL("../../../../database/drizzle", import.meta.url),
    ),
  });
  const [maker] = await db
    .insert(schema.maker)
    .values({ name: "KAP", slug: "kap" })
    .returning();
  await db
    .insert(schema.productType)
    .values({ name: "Spinner", slug: "spinner" })
    .returning();
  const [material] = await db
    .insert(schema.material)
    .values({ name: "Stainless Steel", slug: "stainless-steel" })
    .returning();
  const [owner] = await db
    .insert(schema.user)
    .values({ clerkId: "specific-admin" })
    .returning();
  const [collection] = await db
    .insert(schema.userCollection)
    .values({ ownerId: owner!.id, name: "Steel", normalizedName: "steel" })
    .returning();
  const logger = createNoopLogger({ app: "test", environment: "test" });
  const services = createDbServices(db as unknown as Database, logger);
  const actor = { clerkId: "specific-admin", role: "admin" } as const;
  const specific = await services.catalog.saveMaterialSpecific({
    actor,
    materialId: material!.id,
    name: "M390 Steel",
  });
  await expect(
    services.catalog.saveMaterialSpecific({
      actor,
      materialId: material!.id,
      name: "m390 STEEL",
    }),
  ).rejects.toThrow("web.materials.validation.duplicateSpecific");
  await expect(
    services.catalog.updateMaterial({
      actor,
      materialId: material!.id,
      name: " M390 STEEL ",
      description: null,
    }),
  ).rejects.toThrow("web.materials.validation.parentNameConflict");
  const input = {
    actor,
    name: "Bar Cell Mini",
    slug: "bar-cell-mini",
    productTypeSlug: "spinner" as const,
    makerId: maker!.id,
    finishOptions: [],
    specs: {},
    materialAssignments: [
      { materialId: material!.id, materialSpecificId: null },
      { materialId: material!.id, materialSpecificId: specific.id },
    ],
  };
  const product = await services.catalog.createProduct(input);
  expect(product.materials).toHaveLength(2);
  const assignment = product.materials.find(
    ({ specific: choice }) => choice?.id === specific.id,
  )!;
  const unchanged = await services.catalog.updateProduct({
    ...input,
    productId: product.id,
    description: "Unrelated edit",
  });
  expect(
    unchanged.materials.map(({ assignmentId }) => assignmentId).sort(),
  ).toEqual(product.materials.map(({ assignmentId }) => assignmentId).sort());
  const item = await services.collections.addSpinner({
    actor,
    collectionId: collection!.id,
    displayName: "My M390",
    spinnerProductId: product.id,
    spinnerMaterialAssignmentId: assignment.assignmentId,
    spinnerFinishOptionId: null,
    spinnerCustomFinish: null,
    buttonProductId: null,
    buttonMaterialAssignmentId: null,
    buttonFinishOptionId: null,
    buttonCustomFinish: null,
  });
  await services.catalog.updateProduct({
    ...input,
    productId: product.id,
    materialAssignments: [input.materialAssignments[0]!],
  });
  await services.catalog.saveMaterialSpecific({
    actor,
    materialId: material!.id,
    specificId: specific.id,
    name: "M390 Grade",
  });
  expect((await services.catalog.listMaterialSpecifics())[0]?.slug).toBe(
    "m390-steel",
  );
  await services.collections.updateItem({
    actor,
    collectionItemId: item.spinnerItemId,
    displayName: "Still M390",
    customFinish: null,
    finishOptionId: null,
  });
  expect(
    (await services.collections.getOwnedItem(actor, item.spinnerItemId))
      ?.material?.specific?.name,
  ).toBe("M390 Grade");
  await expect(
    services.collections.updateItem({
      actor,
      collectionItemId: item.spinnerItemId,
      displayName: "Invalid",
      customFinish: null,
      finishOptionId: null,
      materialAssignmentId: assignment.assignmentId,
    }),
  ).rejects.toThrow("web.materials.validation.invalidSpecific");

  await db
    .insert(schema.productType)
    .values({ name: "Spinner Button", slug: "spinner-button" });
  const buttonProduct = await services.catalog.createProduct({
    ...input,
    name: "Button",
    slug: "button",
    productTypeSlug: "spinner-button",
    specs: {},
  });
  const buttonAssignment = buttonProduct.materials.find(
    ({ specific: choice }) => choice?.id === specific.id,
  )!;
  const buttonItemId = await services.collections.addSpinnerButton({
    actor,
    collectionId: collection!.id,
    displayName: "My button",
    productId: buttonProduct.id,
    materialAssignmentId: buttonProduct.materials.find(
      ({ specific: choice }) => !choice,
    )!.assignmentId,
    finishOptionId: null,
    customFinish: null,
  });
  await services.collections.updateItem({
    actor,
    collectionItemId: item.spinnerItemId,
    displayName: "With M390 button",
    customFinish: null,
    finishOptionId: null,
    installedButton: {
      collectionItemId: buttonItemId,
      materialAssignmentId: buttonAssignment.assignmentId,
      customFinish: null,
      finishOptionId: null,
    },
  });
  expect(
    (await db.select().from(schema.auditEvent)).some(
      ({ action, targetId, afterState }) =>
        action === "collections.item.updated" &&
        targetId === String(buttonItemId) &&
        afterState?.materialAssignmentId === buttonAssignment.assignmentId &&
        afterState?.materialId === material!.id &&
        afterState?.materialSpecificId === specific.id,
    ),
  ).toBe(true);

  const storage = createUploadStorage({
    accessKey: "test",
    endpoint: "https://storage.test",
    zoneName: "zone",
    cdnBaseUrl: "https://cdn.test",
    imageFolderPrefix: "images/dev",
    folderPrefix: "resources/dev",
    /**
     * Stubs successful object uploads without network access.
     * @returns Successful isolated storage response.
     */
    fetch: async () => new Response(null, { status: 201 }),
  });
  const uploads = createStorageService({
    db: db as unknown as Database,
    audit: services.audit,
    logger,
    storage,
  });
  const bytes = new Uint8Array(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2kAAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
  const manifest = {
    target: { type: "material", id: material!.id },
    payload: { materialSpecificId: specific.id, reason: "Reviewed scope" },
    files: [
      {
        kind: "image",
        fileName: "steel.png",
        contentType: "image/png",
        size: bytes.length,
        sha256: await sha256(bytes),
      },
    ],
  };
  const session = await uploads.create(manifest, actor);
  await uploads.upload(
    session.id,
    session.uploads[0]!.id,
    actor,
    new Request("https://api.test/upload", {
      method: "PUT",
      body: bytes,
      headers: {
        "content-type": "image/png",
        "content-length": String(bytes.length),
      },
    }),
  );
  await uploads.completeUpload(session.id, actor);
  await uploads.completeUpload(session.id, actor);
  const images = await db.select().from(schema.materialImage);
  expect(images).toHaveLength(1);
  expect(images[0]).toMatchObject({
    materialId: material!.id,
    materialSpecificId: specific.id,
    position: 0,
  });
  await expect(uploads.create(manifest, actor)).rejects.toMatchObject({
    code: "duplicate_active",
  });
  await expect(
    uploads.create(
      { ...manifest, target: { type: "product", id: product.id } },
      actor,
    ),
  ).rejects.toMatchObject({ code: "invalid_request" });
  const otherScope = await uploads.create(
    { ...manifest, payload: { materialSpecificId: null } },
    actor,
  );
  expect(otherScope.id).not.toBe(session.id);
  await uploads.upload(
    otherScope.id,
    otherScope.uploads[0]!.id,
    actor,
    new Request("https://api.test/upload", {
      method: "PUT",
      body: bytes,
      headers: {
        "content-type": "image/png",
        "content-length": String(bytes.length),
      },
    }),
  );
  await uploads.completeUpload(otherScope.id, actor);
  expect(await db.select().from(schema.materialImage)).toHaveLength(2);
  await expect(
    services.catalog.moveMaterialImage({
      actor,
      materialId: material!.id,
      imageId: images[0]!.id,
      materialSpecificId: null,
    }),
  ).rejects.toThrow("web.materials.validation.duplicateAtDestination");
  const destination = await services.catalog.saveMaterialSpecific({
    actor,
    materialId: material!.id,
    name: "Other test grade",
  });
  await services.catalog.attachImages({
    actor,
    target: { type: "material", id: material!.id },
    materialSpecificId: destination.id,
    files: [
      {
        kind: "image",
        fileName: "destination.png",
        contentType: "image/png",
        size: 1,
        sha256: "b".repeat(64),
        position: 0,
        objectPath: `images/dev/materials/${material!.id}/destination.png`,
        url: "https://cdn.test/destination.png",
      },
    ],
  });
  await services.catalog.moveMaterialImage({
    actor,
    materialId: material!.id,
    imageId: images[0]!.id,
    materialSpecificId: destination.id,
  });
  expect(
    (
      await db
        .select()
        .from(schema.materialImage)
        .where(eq(schema.materialImage.id, images[0]!.id))
    )[0],
  ).toMatchObject({
    materialSpecificId: destination.id,
    position: 1,
    objectPath: images[0]!.objectPath,
  });
  await expect(
    services.catalog.reorderMaterialImages({
      actor,
      materialId: material!.id,
      materialSpecificId: specific.id,
      imageIds: [images[0]!.id],
    }),
  ).rejects.toThrow();
}, 30_000);
