import { expect, test } from "playwright/test";

test("maker product pagination survives reload and browser history", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 480 });
  await page.goto("/makers/autmog?productsPage=2");
  await page.locator("html[data-hydrated='true']").waitFor();

  const pagination = page.getByRole("navigation", { name: "Maker products" });
  await expect(page).toHaveURL(/productsPage=2/u);
  await expect(pagination.getByText("Page 2 of 3")).toBeVisible();
  await expect(page.getByRole("list", { name: "Products" })).toContainText(
    "Product 9",
  );

  await page.reload();
  await page.locator("html[data-hydrated='true']").waitFor();
  await expect(page).toHaveURL(/productsPage=2/u);
  await pagination.getByRole("button", { name: "Previous page" }).click();
  await expect(page).not.toHaveURL(/productsPage=/u);

  await page.goBack();
  await expect(page).toHaveURL(/productsPage=2/u);
  await expect(pagination.getByText("Page 2 of 3")).toBeVisible();
});
