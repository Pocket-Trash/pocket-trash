import { expect, test } from "playwright/test";

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
