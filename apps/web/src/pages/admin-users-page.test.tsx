import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminUsersPage } from "./admin-users-page";

vi.mock("@pocket-trash/localizations", () => ({
  /**
   * Returns a localization key as test copy.
   *
   * @param key - Localization key.
   * @returns The unchanged key.
   */
  formatTranslation: (key: string) => key,
}));

vi.mock("@/components/admin-page-shell", () => ({
  /**
   * Renders only the shell's children.
   *
   * @param root0 - Shell properties.
   * @param root0.children - Nested page content.
   * @returns Nested page content.
   */
  AdminPageShell: ({
    children,
  }: {
    /** Nested page content. */
    children: React.ReactNode;
  }) => <>{children}</>,
}));

vi.mock("@/lib/user-bans", () => ({
  getAdminUserAccess: vi.fn(),
  searchAdminUsers: vi.fn(),
  setAdminUserBanState: vi.fn(),
}));

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns the fixed test locale.
   *
   * @returns Fixed English locale.
   */
  useLocale: () => ({ locale: "en-US" }),
}));

describe("AdminUsersPage", () => {
  it("labels and requires user search before showing access controls", () => {
    const html = renderToStaticMarkup(<AdminUsersPage />);

    expect(html).toContain('for="admin-user-search"');
    expect(html).toContain('id="admin-user-search"');
    expect(html).toContain("required");
    expect(html).toContain('role="status"');
  });
});
