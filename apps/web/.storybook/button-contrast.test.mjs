import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { chromium } from "playwright";

// Run with Storybook already listening on port 6006:
// node apps/web/.storybook/button-contrast.test.mjs
// Storybook userEvent dispatches synthetic events, which do not activate CSS :hover.

/** Resolves the accessibility addon's existing axe dependency. */
const require = createRequire(import.meta.url);
/** Headless browser exercising native CSS hover rather than synthetic events. */
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(
    "http://localhost:6006/iframe.html?id=ui-button--destructive&viewMode=story",
  );
  await page.addScriptTag({
    path: require.resolve("axe-core/axe.min.js", {
      paths: [require.resolve("@storybook/addon-a11y")],
    }),
  });
  for (const index of [0, 1]) {
    const button = page
      .getByRole("button", { name: "Button", exact: true })
      .nth(index);
    await button.hover();
    assert(await button.evaluate((element) => element.matches(":hover")));
    await button.evaluate(async (element) => {
      await Promise.allSettled(
        element.getAnimations().map((animation) => animation.finished),
      );
    });
    const violations = await page.evaluate(async () => {
      const result = await globalThis.axe.run(globalThis.document.body, {
        runOnly: ["color-contrast"],
      });
      return result.violations.map(({ id, nodes }) => ({
        id,
        failures: nodes.map(({ failureSummary }) => failureSummary),
      }));
    });
    assert.deepEqual(
      violations,
      [],
      index === 0 ? "Light hover contrast" : "Dark hover contrast",
    );
  }
} finally {
  await browser.close();
}
