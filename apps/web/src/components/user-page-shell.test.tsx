import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserPageShell } from "./user-page-shell";

/** Controls whether the test actor can access admin pages. */
const hasStaffPermission = vi.hoisted(() => vi.fn());

vi.mock("@clerk/tanstack-react-start", () => ({
  /**
   * Returns the authenticated test actor.
   *
   * @returns Authentication state for the test actor.
   */
  useAuth: () => ({ sessionClaims: {}, userId: "user_1" }),
  /**
   * Returns the minimal Clerk client consumed by the sign-out action.
   *
   * @returns A Clerk client with a sign-out spy.
   */
  useClerk: () => ({ signOut: vi.fn() }),
}));

vi.mock("@package/services/authorization", () => ({
  hasStaffPermission,
  /**
   * Returns a normalized test actor.
   *
   * @returns The normalized actor.
   */
  normalizeActor: () => ({}),
}));

vi.mock("@tanstack/react-router", () => ({
  /**
   * Renders router links as anchors.
   *
   * @param props - Link rendering input.
   * @returns An anchor targeting the requested route.
   */
  Link: (props: {
    /** Link contents. */
    children: React.ReactNode;
    /** Link destination. */
    to: string;
  }) => <a href={props.to}>{props.children}</a>,
}));

vi.mock("@/components/app-shell", () => ({
  /**
   * Renders shell contents without shared chrome.
   *
   * @param props - Shell rendering input.
   * @returns The shell contents.
   */
  AppShell: (props: {
    /** Shell contents. */
    children: React.ReactNode;
  }) => <>{props.children}</>,
}));

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns the fixed test locale.
   *
   * @returns The locale state consumed by the shell.
   */
  useLocale: () => ({ locale: "en-US" }),
}));

describe("UserPageShell", () => {
  beforeEach(() => hasStaffPermission.mockReturnValue(false));

  it("renders the user navigation groups and active collection links", () => {
    const html = renderToStaticMarkup(
      <UserPageShell section="collections" title="Collections">
        Content
      </UserPageShell>,
    );

    expect(html).toContain('aria-label="User"');
    expect(html).toContain('href="/user/collections"');
    expect(html).toContain('href="/user/collections/add"');
    expect(html).toContain('href="/user/resources"');
    expect(html).toContain('href="/user/account"');
    expect(html).toContain('href="/user/settings"');
    expect(html).toContain('href="/user/settings/beta-features"');
    expect(html).toContain(">Profile</h2>");
    expect(html).toContain(">Sign out</span>");
    expect(html).not.toContain('href="/admin"');
  });

  it("shows the admin link to staff", () => {
    hasStaffPermission.mockReturnValue(true);

    const html = renderToStaticMarkup(
      <UserPageShell title="Account">Content</UserPageShell>,
    );

    expect(html).toContain('href="/admin"');
  });
});
