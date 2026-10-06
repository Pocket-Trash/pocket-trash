import { createDb, schema } from "@package/database";
import { eq } from "drizzle-orm";
import { expect, test, waitForHydration } from "./auth";

test.use({ trace: "off" });

test("maker directory adapts and links to public profiles", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 480 });
  await page.goto("/makers");
  await waitForHydration(page);

  await expect(
    page.getByRole("heading", { level: 1, name: "Makers" }),
  ).toBeVisible();
  const popular = page.locator('section[aria-labelledby="popular-makers"]');
  await expect(
    popular.getByRole("heading", { name: "Popular Makers" }),
  ).toBeVisible();
  const popularCards = popular.locator("li");
  expect(await popularCards.count()).toBeGreaterThanOrEqual(6);
  await expect(popularCards.nth(0)).toBeVisible();
  await expect(popularCards.nth(3)).toBeVisible();
  await expect(popularCards.nth(4)).toBeHidden();

  await page.setViewportSize({ height: 900, width: 768 });
  await expect(popularCards.nth(4)).toBeVisible();
  await expect(popularCards.nth(5)).toBeVisible();

  await page
    .getByRole("link", { exact: true, name: /Autmog/u })
    .first()
    .click();
  await expect(page).toHaveURL(/\/makers\/autmog$/u);
  await expect(
    page.getByRole("heading", { level: 1, name: "Autmog" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Visit maker website" }),
  ).toHaveAttribute("target", "_blank");
});

test("@mutation maker product pagination survives reload and browser history", async ({
  page,
}) => {
  test.skip(
    process.env.E2E_RUN_MUTATIONS !== "true",
    "Maker pagination setup requires explicit isolation opt-in.",
  );
  const fixture = await createMakerPaginationFixture();
  await page.setViewportSize({ height: 900, width: 480 });
  try {
    await page.goto(`/makers/${fixture.slug}?productsPage=2`);
    await waitForHydration(page);
    await expect(page).toHaveURL(/productsPage=2/u);
    const productsPagination = page.getByRole("navigation", {
      name: "Maker products",
    });
    await expect(productsPagination.getByText("Page 2 of 3")).toBeVisible();

    await page.reload();
    await waitForHydration(page);
    await expect(page).toHaveURL(/productsPage=2/u);
    await productsPagination
      .getByRole("button", { name: "Previous page" })
      .click();
    await expect(page).not.toHaveURL(/productsPage=/u);
    await page.goBack();
    await expect(page).toHaveURL(/productsPage=2/u);
    await expect(productsPagination.getByText("Page 2 of 3")).toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});

test("administrators can navigate maker profiles and stage images", async ({
  page,
  signInAs,
}) => {
  await signInAs("admin");
  await page.goto("/admin/makers");
  await waitForHydration(page);

  await expect(page.getByRole("heading", { name: "Makers" })).toBeVisible();
  await page.getByRole("link", { name: "Add maker" }).click();
  await expect(page.getByRole("heading", { name: "Add maker" })).toBeVisible();
  await page.getByLabel("Name").fill("Browser Test Maker");
  await expect(page.getByLabel("Slug")).toHaveValue("browser-test-maker");

  await page
    .getByLabel("Images")
    .setInputFiles(
      new URL("./fixtures/collection-covers/blue.png", import.meta.url)
        .pathname,
    );
  await expect(page.getByText("blue.png", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close blue.png" }).click();
  await expect(page.getByText("blue.png", { exact: true })).toHaveCount(0);
  await expect(page.getByText("No maker images yet.")).toBeVisible();
});

/**
 * Creates one isolated maker with enough products for three compact pages.
 *
 * @returns The public maker slug and verified cleanup operation.
 */
async function createMakerPaginationFixture() {
  const database = createDb({
    databaseUrl: requiredEnvironment("DATABASE_URL"),
  });
  const runId = `maker-e2e-${crypto.randomUUID()}`;
  const fixture = await database.transaction(async (transaction) => {
    await transaction
      .insert(schema.productType)
      .values({ name: "Spinner", slug: "spinner" })
      .onConflictDoNothing({ target: schema.productType.slug });
    const [productType] = await transaction
      .select({ id: schema.productType.id })
      .from(schema.productType)
      .where(eq(schema.productType.slug, "spinner"))
      .limit(1);
    if (!productType) throw new Error("The spinner product type is missing.");

    const [maker] = await transaction
      .insert(schema.maker)
      .values({
        description: "Maker pagination browser fixture.",
        name: runId,
        rootUrl: "https://example.com",
        slug: runId,
      })
      .returning({ id: schema.maker.id, slug: schema.maker.slug });
    if (!maker) throw new Error("Failed to create the maker fixture.");
    const products = await transaction
      .insert(schema.product)
      .values(
        Array.from({ length: 17 }, (_value, index) => ({
          approvalStatus: "approved" as const,
          makerId: maker.id,
          name: `${runId} product ${index + 1}`,
          productTypeId: productType.id,
          slug: `${runId}-product-${index + 1}`,
        })),
      )
      .returning({ id: schema.product.id });
    await transaction
      .insert(schema.productSpinner)
      .values(products.map(({ id }) => ({ id })));
    return maker;
  });

  return {
    slug: fixture.slug,
    /** Removes the maker fixture and its products. */
    async cleanup() {
      await database
        .delete(schema.product)
        .where(eq(schema.product.makerId, fixture.id));
      await database
        .delete(schema.maker)
        .where(eq(schema.maker.id, fixture.id));
      const remaining = await database
        .select({ id: schema.maker.id })
        .from(schema.maker)
        .where(eq(schema.maker.id, fixture.id));
      expect(remaining).toHaveLength(0);
    },
  };
}

/**
 * Reads one non-empty E2E environment variable.
 *
 * @param name - Required variable name.
 * @returns The trimmed environment value.
 * @throws When the variable is missing or blank.
 */
function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
