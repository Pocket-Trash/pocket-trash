import type { Locator, Page } from "playwright/test";
import { expect, test, waitForHydration } from "./auth";

test.use({ trace: "off" });

test("regular users can open account and settings", async ({
  page,
  signInAs,
}) => {
  await signInAs("regular");

  await page.goto("/user/account");
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();

  await page.goto("/user/settings");
  await expect(
    page.getByRole("group", { name: "Measurement system options" }),
  ).toBeVisible();
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
  await waitForHydration(page);

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
  const nextThemeName = originalThemeName === "Dark" ? "Light" : "Dark";
  const nextTheme = page.getByRole("button", {
    name: nextThemeName,
  });

  try {
    await selectThemeAndWaitForPersistence(page, nextTheme, nextThemeName);

    await page.reload();
    await expect(nextTheme).toHaveAttribute("aria-pressed", "true");
  } finally {
    await page.goto("/user/settings");
    await waitForHydration(page);
    if ((await originalTheme.getAttribute("aria-pressed")) !== "true") {
      await selectThemeAndWaitForPersistence(
        page,
        originalTheme,
        originalThemeName,
      );
    }
    await page.reload();
    await expect(originalTheme).toHaveAttribute("aria-pressed", "true");
  }
});

/**
 * Selects a theme and waits for its authenticated settings request to finish.
 *
 * @param page - Browser page issuing the settings request.
 * @param themeButton - Theme option to select.
 * @param themeName - Theme name expected in the request payload.
 * @returns Nothing after persistence succeeds and controls are enabled again.
 * @rejects When persistence fails or no matching settings request completes.
 */
async function selectThemeAndWaitForPersistence(
  page: Page,
  themeButton: Locator,
  themeName: "Dark" | "Light" | "System",
): Promise<void> {
  const theme = themeName.toLowerCase();
  const responsePromise = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === "POST" &&
      request.postData()?.includes("theme") === true &&
      request.postData()?.includes(theme) === true
    );
  });
  await themeButton.click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  await expect(themeButton).toBeEnabled();
}
