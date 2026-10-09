import { expect, test } from "./auth";

test("anonymous visitors can open the public directory", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Products" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Collections" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Resources" })).toBeVisible();
});

test("anonymous visitors are redirected from user routes", async ({ page }) => {
  await page.goto("/user/account");

  await expect(page).toHaveURL(/\/sign-in(?:\/|$)/u);
});

test("public material specifics have scoped URLs, canonical metadata, and slug-pair validation", async ({
  page,
}) => {
  const response = await page.goto(
    "/materials/stainless-steel/m390-steel?productsPage=2&collectionItemsPage=3",
  );
  expect(response?.status()).toBe(200);
  await expect(page.locator('span[aria-current="page"]')).toHaveText(
    "M390 Steel",
  );
  await expect(
    page.getByRole("link", { name: "Stainless Steel", exact: true }),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/materials\/stainless-steel\/m390-steel$/,
  );
  await expect(page).toHaveTitle("M390 Steel");
  const missing = await page.goto("/materials/zirconium/m390-steel");
  expect(missing?.status()).toBe(404);
  const malformed = await page.goto("/materials/stainless-steel/M390");
  expect(malformed?.status()).toBe(404);
});
