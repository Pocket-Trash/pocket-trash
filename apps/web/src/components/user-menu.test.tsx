import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserMenu } from "./user-menu";

const clerkState = vi.hoisted(() => ({
  isLoaded: true,
  user: null as null | {
    imageUrl: string;
    primaryEmailAddress: { emailAddress: string };
    username: string;
  },
}));

vi.mock("@clerk/tanstack-react-start", () => ({
  useClerk: () => ({ signOut: vi.fn() }),
  useUser: () => clerkState,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));

vi.mock("@/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en-US" }),
}));

describe("UserMenu", () => {
  beforeEach(() => {
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
