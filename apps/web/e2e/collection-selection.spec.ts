import type { Page } from "playwright/test";
import { expect, test, waitForHydration } from "./auth";
import {
  createMutationFixture,
  type MutationCleanupResult,
} from "./mutation-fixture";

test.use({ trace: "off" });

test("@mutation collection selection and linked-item moves use the public UI", async ({
  page,
  signInAs,
}) => {
  test.skip(
    process.env.E2E_RUN_MUTATIONS !== "true",
    "Collection mutations require explicit isolation opt-in.",
  );
  test.setTimeout(120_000);

  const fixture = await createMutationFixture({ createCollection: false });
  let cleanup: MutationCleanupResult | undefined;
  try {
    await signInAs("regular");
    const productUrl = `/products/spinner/${fixture.spinnerProductSlug}`;
    const addToCollectionUrl = new RegExp(
      `/collections/add\\?product=${fixture.spinnerProductId}$`,
      "u",
    );

    await page.goto(productUrl);
    await waitForHydration(page);
    await page.getByRole("link", { name: "Add to collection" }).click();
    await expect(page).toHaveURL(addToCollectionUrl);
    await expect(page.locator("main input").first()).toHaveValue(
      fixture.spinnerProductName,
    );
    const defaultCollectionName = await page
      .getByRole("combobox", { name: "Collection" })
      .and(page.locator("input"))
      .inputValue();
    expect(defaultCollectionName).not.toBe("");
    fixture.collectionNames.push(defaultCollectionName);

    await page.goto("/user/collections");
    await expect(
      page.getByText(defaultCollectionName, { exact: true }),
    ).toHaveCount(0);

    await page.goto(productUrl);
    await waitForHydration(page);
    await page.getByRole("link", { name: "Add to collection" }).click();
    await stageCollection(page, fixture.collectionNames[0]);
    await expect(
      page
        .getByRole("combobox", { name: "Collection" })
        .and(page.locator("input")),
    ).toHaveValue(fixture.collectionNames[0]);

    const collectionCheck = await page.context().newPage();
    await collectionCheck.goto("/user/collections");
    await expect(
      collectionCheck.getByText(fixture.collectionNames[0], { exact: true }),
    ).toHaveCount(0);
    await collectionCheck.close();

    await selectOption(page, "Materials", fixture.materialName);
    await selectOption(page, "Finish", fixture.finishName);
    await selectOption(page, "Button", fixture.buttonProductName);
    await selectOption(page, "Materials", fixture.materialName, 1);
    await selectOption(page, "Finish", fixture.finishName, 1);
    await page.getByRole("button", { name: "Add to collection" }).click();
    await expect(page).toHaveURL(/\/user\/collections\/\d+$/u);
    const firstCollectionUrl = page.url();
    await expect(
      page.getByRole("link", {
        exact: true,
        name: fixture.spinnerProductName,
      }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("link", {
        exact: true,
        name: fixture.buttonProductName,
      }),
    ).toHaveCount(1);

    await page.goto(`/collections/add?product=${fixture.spinnerProductId}`);
    await waitForHydration(page);
    await expect(
      page
        .getByRole("combobox", { name: "Collection" })
        .and(page.locator("input")),
    ).toHaveValue(fixture.collectionNames[0]);
    await stageCollection(page, fixture.collectionNames[1]);
    await selectOption(page, "Materials", fixture.materialName);
    await selectOption(page, "Finish", fixture.finishName);
    await page.getByRole("button", { name: "Add to collection" }).click();
    await expect(
      page.getByText(
        `${fixture.spinnerProductName}: Matching products already owned: 1. Confirm to add another.`,
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add another" }).click();
    await expect(page).toHaveURL(/\/user\/collections\/\d+$/u);
    const secondCollectionUrl = page.url();

    await page.goto(`/collections/add?product=${fixture.spinnerProductId}`);
    await waitForHydration(page);
    const collectionInput = page
      .getByRole("combobox", { name: "Collection" })
      .and(page.locator("input"));
    await expect(collectionInput).toHaveValue("");
    await selectOption(page, "Collection", fixture.collectionNames[0]);
    await selectOption(page, "Materials", fixture.materialName);
    await selectOption(page, "Finish", fixture.finishName);
    await page.getByRole("button", { name: "Add to collection" }).click();
    await expect(
      page.getByText(
        `${fixture.spinnerProductName}: Matching products already owned: 2. Confirm to add another.`,
      ),
    ).toBeVisible();

    await page.goto(firstCollectionUrl);
    await waitForHydration(page);
    await page
      .getByRole("link", { exact: true, name: fixture.spinnerProductName })
      .click();
    await expect(page).toHaveURL(/\/collections\/\d+\/\d+\/\d+$/u);
    await expect(page.locator('span[aria-current="page"]')).toHaveText(
      fixture.spinnerProductName,
    );
    await page
      .getByRole("link", { name: "Edit" })
      .and(page.locator('a[href^="/collections/edit/"]'))
      .click();
    await expect(page).toHaveURL(/\/collections\/edit\/\d+$/u);
    await expect(
      page.getByRole("combobox", { name: "Collection" }),
    ).toBeVisible();
    await selectOption(page, "Collection", fixture.collectionNames[1]);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(secondCollectionUrl);
    await expect(
      page.getByRole("link", {
        exact: true,
        name: fixture.spinnerProductName,
      }),
    ).toHaveCount(2);
    await expect(
      page.getByRole("link", {
        exact: true,
        name: fixture.buttonProductName,
      }),
    ).toHaveCount(1);

    await page.goto(firstCollectionUrl);
    await expect(
      page.getByRole("link", {
        exact: true,
        name: fixture.spinnerProductName,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", {
        exact: true,
        name: fixture.buttonProductName,
      }),
    ).toHaveCount(0);
  } finally {
    cleanup = await fixture.cleanup();
  }

  expect(cleanup).toEqual({
    catalogDeleted: true,
    collectionDeleted: true,
    objectDeleted: "deleted",
  });
});

/**
 * Stages a collection through the nested form without persisting it.
 *
 * @param page - Authenticated collection-item form page.
 * @param name - Unique collection name to stage.
 * @returns When the nested dialog closes.
 */
async function stageCollection(page: Page, name: string) {
  const dialog = page.getByRole("dialog");
  await page.getByRole("button", { name: "Add new collection" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { exact: true, name: "Name" }).fill(name);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).not.toBeVisible();
}

/**
 * Selects one visible option from a labeled catalog combobox.
 *
 * @param page - Current browser page.
 * @param label - Accessible combobox label.
 * @param option - Exact visible option name.
 * @param index - Matching combobox index when fields repeat.
 * @returns When the option is selected.
 */
async function selectOption(
  page: Page,
  label: string,
  option: string,
  index = 0,
) {
  await page
    .getByRole("combobox", { name: label })
    .and(page.locator("input"))
    .nth(index)
    .click();
  await page.getByRole("option", { exact: true, name: option }).click();
}
