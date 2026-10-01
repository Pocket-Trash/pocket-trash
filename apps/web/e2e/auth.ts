import { clerk } from "@clerk/testing/playwright";
import { test as base, expect, type Page } from "playwright/test";

/** Supported Pocket Trash test-user roles. */
export type TestUserRole = "admin" | "disposable" | "editor" | "regular";

/** Clerk authentication operations exposed to E2E tests. */
type AuthFixtures = {
  /**
   * Signs a fresh browser context in as one configured development user.
   *
   * @param role - Development user role to authenticate.
   * @returns When Clerk finishes signing in.
   */
  signInAs: (role: TestUserRole) => Promise<void>;
};

/** Environment variable containing each development user's email address. */
const emailVariables: Record<TestUserRole, string> = {
  admin: "E2E_CLERK_ADMIN_USER_EMAIL",
  disposable: "E2E_CLERK_DISPOSABLE_USER_EMAIL",
  editor: "E2E_CLERK_EDITOR_USER_EMAIL",
  regular: "E2E_CLERK_REGULAR_USER_EMAIL",
};

/** Playwright test with fresh Clerk role sessions and no shared auth state. */
export const test = base.extend<AuthFixtures>({
  /**
   * Supplies a role-based Clerk sign-in operation to each fresh test context.
   *
   * @param root0 - Playwright fixtures for the current test.
   * @param root0.page - Browser page for the fresh test context.
   * @param use - Fixture registration callback.
   * @returns When the test finishes using the fixture.
   */
  signInAs: async ({ page }, use) => {
    await use(async (role) => {
      await page.goto("/");
      await clerk.signOut({ page });
      await clerk.signIn({
        emailAddress: requiredEnvironment(emailVariables[role]),
        page,
      });
    });
  },
});

export { expect };

/**
 * Waits until the client application can handle browser interactions.
 *
 * @param page - Server-rendered application page.
 * @returns When React hydration completes.
 */
export async function waitForHydration(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
}

/**
 * Reads one non-empty E2E environment variable.
 *
 * @param name - Required variable name.
 * @returns The trimmed variable value.
 * @throws When the variable is missing or blank.
 */
function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
