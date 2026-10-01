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
  await expect(page.getByRole("group", { name: "Dimensions" })).toBeVisible();
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
    page.getByRole("main", {
      name: "Manage Pocket Trash administration.",
    }),
  ).toBeVisible();
});

test("@mutation regular user theme persists after reload", async ({
  page,
  signInAs,
}) => {
  await signInAs("regular");
  await page.goto("/user/settings");

  const themeGroup = page.getByRole("group", { name: "Theme" });
  const selectedTheme = themeGroup.locator('[aria-pressed="true"]');
  await expect(selectedTheme).toHaveCount(1);
  const originalThemeName = await selectedTheme.getAttribute("aria-label");
  if (
    originalThemeName !== "Dark" &&
    originalThemeName !== "Light" &&
    originalThemeName !== "System"
  ) {
    throw new Error("No active theme was found.");
  }

  const originalTheme = page.getByRole("button", { name: originalThemeName });
  const nextTheme = page.getByRole("button", {
    name: originalThemeName === "Dark" ? "Light" : "Dark",
  });
  let changed = false;

  try {
    await nextTheme.click();
    await expect(nextTheme).toBeDisabled();
    await expect(nextTheme).toBeEnabled();
    changed = true;

    await page.reload();
    await expect(nextTheme).toHaveAttribute("aria-pressed", "true");
  } finally {
    if (changed) {
      await page.goto("/user/settings");
      await originalTheme.click();
      await expect(originalTheme).toBeDisabled();
      await expect(originalTheme).toBeEnabled();
    }
  }
});
