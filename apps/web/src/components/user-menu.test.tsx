import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserMenu } from "./user-menu";

/** Mutable Clerk state shared by the authentication test doubles. */
const clerkState = vi.hoisted(() => ({
  role: "user",
  userId: "user_123",
  isLoaded: true,
  user: null as null | {
    /** Avatar image URL. */
    imageUrl: string;
    /** User's primary email record. */
    primaryEmailAddress: {
      /** Primary email address text. */
      emailAddress: string;
    };
    /** User display name. */
    username: string;
  },
}));

vi.mock("@clerk/tanstack-react-start", () => ({
  /**
   * Returns authentication claims from the mutable test state.
   *
   * @returns Authentication state consumed by the menu.
   */
  useAuth: () => ({
    sessionClaims: { role: clerkState.role },
    userId: clerkState.userId,
  }),
  /**
   * Returns a Clerk client with a sign-out spy.
   *
   * @returns The minimal Clerk client consumed by the menu.
   */
  useClerk: () => ({ signOut: vi.fn() }),
  /**
   * Returns user loading and profile state from the mutable test state.
   *
   * @returns User state consumed by the menu.
   */
  useUser: () => clerkState,
}));

vi.mock("@tanstack/react-router", () => ({
  /**
   * Renders router links as plain anchors for server rendering.
   *
   * @param input - Link rendering input.
   * @param input.children - Link contents.
   * @param input.to - Anchor destination.
   * @returns A plain anchor for the requested destination.
   */
  Link: ({
    children,
    to,
  }: {
    /** Link contents. */
    children: React.ReactNode;
    /** Anchor destination. */
    to: string;
  }) => <a href={to}>{children}</a>,
}));

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns the fixed English locale used by menu assertions.
   *
   * @returns Locale state consumed by the menu.
   */
  useLocale: () => ({ locale: "en-US" }),
}));

describe("UserMenu", () => {
  beforeEach(() => {
    clerkState.role = "user";
    clerkState.isLoaded = true;
    clerkState.user = null;
  });

  it("renders an explicit sign-in button when signed out", () => {
    expect(renderToStaticMarkup(<UserMenu />)).toContain(">Sign in</a>");
  });

  it("renders an avatar-only account trigger when signed in", () => {
    clerkState.user = {
      imageUrl: "/roy.png",
      primaryEmailAddress: { emailAddress: "roy@example.com" },
      username: "Roy",
    };

    const html = renderToStaticMarkup(<UserMenu />);

    expect(html).toContain('aria-label="Account menu"');
    expect(html).toContain(">R</span>");
    expect(html).not.toContain("roy@example.com");
  });
});
