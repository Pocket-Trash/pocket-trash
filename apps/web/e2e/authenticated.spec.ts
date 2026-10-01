import { expect, test } from "./auth";

test.use({ trace: "off" });

test("regular users can open account and settings", async ({
  page,
  signInAs,
}) => {
  await signInAs("regular");

  await page.goto("/user/account");
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();

  await page.goto("/user/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

test("regular users receive not found for admin routes", async ({
  page,
  signInAs,
}) => {
  await signInAs("regular");
  await page.goto("/admin");

  await expect(
    page.getByRole("heading", { name: "Page unavailable" }),
  ).toBeVisible();
});

test("admins can open the admin route", async ({ page, signInAs }) => {
  await signInAs("admin");
  await page.goto("/admin");

  await expect(
    page.getByRole("heading", { name: "Admin Panel" }),
  ).toBeVisible();
});

test("@mutation regular user settings persist after reload", async ({
  page,
  signInAs,
}) => {
  await signInAs("regular");
  await page.goto("/user/settings");

  const millimeters = page.getByRole("button", { name: "Millimeters" });
  const inches = page.getByRole("button", { name: "Inches" });
  const startedInMillimeters =
    (await millimeters.getAttribute("aria-pressed")) === "true";
  const originalUnit = startedInMillimeters ? millimeters : inches;
  const nextUnit = startedInMillimeters ? inches : millimeters;
  let changed = false;

  try {
    await nextUnit.click();
    await expect(nextUnit).toBeDisabled();
    await expect(nextUnit).toBeEnabled();
    changed = true;

    await page.reload();
    await expect(nextUnit).toHaveAttribute("aria-pressed", "true");
  } finally {
    if (changed) {
      await page.goto("/user/settings");
      await originalUnit.click();
      await expect(originalUnit).toBeDisabled();
      await expect(originalUnit).toBeEnabled();
    }
  }
});
