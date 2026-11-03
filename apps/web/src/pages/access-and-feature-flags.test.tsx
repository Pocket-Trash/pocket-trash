/** @vitest-environment jsdom */

import type {
  FeatureFlagListItem,
  UserBetaFeatureFlag,
} from "@package/services";
import { formatTranslation } from "@pocket-trash/localizations";
import { Activity, act, type ReactNode, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAdminFeatureFlag,
  listAdminTargetingForUser,
  searchFeatureFlagUsers,
  setAdminFeatureFlagForUser,
  setUserBetaFeatureFlag,
  updateAdminFeatureFlag,
} from "@/lib/feature-flags";
import {
  type AdminUserIdentity,
  getAdminUserAccess,
  searchAdminUsers,
  setAdminUserBanState,
} from "@/lib/user-bans";
import { AdminFeatureFlagsPage } from "./admin-feature-flags-page";
import { AdminUsersPage } from "./admin-users-page";
import { UserBetaFeaturesPage } from "./user-beta-features-page";

/** Current account and route refresh boundary. */
const session = vi.hoisted(() => ({ userId: "user_a", invalidate: vi.fn() }));
vi.mock("@clerk/tanstack-react-start", () => ({
  /** Supplies current account scope.
   * @returns Current test account. */
  useAuth: () => ({ userId: session.userId }),
}));
vi.mock("@tanstack/react-router", () => ({
  /** Supplies Router data refresh.
   * @returns Current invalidation observer. */
  useRouter: () => ({ invalidate: session.invalidate }),
}));
vi.mock("@/providers/locale-provider", () => ({
  /** Supplies the current UI locale.
   * @returns English locale context. */
  useLocale: () => ({ locale: "en-US" }),
}));
vi.mock("@/components/admin-page-shell", () => ({
  /**
   * Renders the current route content.
   * @param props - Nested route content.
   * @returns Route content.
   */
  AdminPageShell: ({
    children,
  }: {
    /** Nested route content. */
    children: ReactNode;
  }) => children,
}));
vi.mock("@/components/user-page-shell", () => ({
  /**
   * Renders the current user route content.
   * @param props - Nested route content.
   * @returns Route content.
   */
  UserPageShell: ({
    children,
  }: {
    /** Nested route content. */
    children: ReactNode;
  }) => children,
}));
vi.mock("@/lib/feature-flags", async (original) => ({
  ...(await original<object>()),
  createAdminFeatureFlag: vi.fn(),
  listAdminTargetingForUser: vi.fn(),
  searchFeatureFlagUsers: vi.fn(),
  setAdminFeatureFlagForUser: vi.fn(),
  setUserBetaFeatureFlag: vi.fn(),
  updateAdminFeatureFlag: vi.fn(),
}));
vi.mock("@/lib/user-bans", async (original) => ({
  ...(await original<object>()),
  getAdminUserAccess: vi.fn(),
  searchAdminUsers: vi.fn(),
  setAdminUserBanState: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/** Existing authorized flag snapshot. */
const flag: FeatureFlagListItem = {
  archivedAt: null,
  audience: "admin",
  createdAt: new Date("2026-10-01"),
  updatedAt: new Date("2026-10-01"),
  defaultEnabled: false,
  description: "Private description",
  name: "Private feature",
  slug: "private-feature",
};
/** Existing user-specific opt-in snapshot. */
const beta: UserBetaFeatureFlag = {
  description: "Account-specific description",
  enabled: false,
  name: "Private beta",
  slug: "private-beta",
};
/** First selected account. */
const first: AdminUserIdentity = {
  banned: false,
  clerkId: "target_first",
  email: "first@example.test",
  name: "First user",
  username: "first",
};
/** Second selected account. */
const second: AdminUserIdentity = {
  ...first,
  clerkId: "target_second",
  email: "second@example.test",
  name: "Second user",
  username: "second",
};

/**
 * Changes a native controlled field through React's browser event path.
 * @param field - Mounted input or textarea.
 * @param value - Next field value.
 * @rejects When the expected field is absent.
 */
async function change(
  field: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
) {
  if (!field) throw new Error("Expected field");
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value",
    )?.set?.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("user access and feature-flag consumers", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.resetAllMocks();
    session.userId = "user_a";
    session.invalidate.mockResolvedValue(undefined);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  /**
   * Clicks an existing named command or selected identity.
   * @param name - Accessible command name or identity display name.
   * @rejects When the expected command is absent.
   */
  async function click(name: string) {
    const button = [...container.querySelectorAll("button")].find(
      (node) =>
        (node.getAttribute("aria-label") ?? node.textContent?.trim()) ===
          name || node.textContent?.trim().startsWith(name),
    );
    if (!button) throw new Error(`Expected command: ${name}`);
    await act(async () => button.click());
  }
  /** Submits the current explicit user-search form.
   * @rejects When its form is absent. */
  async function search() {
    const form = container.querySelector("form");
    if (!form) throw new Error("Expected search form");
    await act(async () =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
  }

  it("renders route-owned flags without client loading and hides snapshots from a different account", async () => {
    expect(
      renderToString(
        <UserBetaFeaturesPage actorId="user_a" initialFlags={[beta]} />,
      ),
    ).toContain("Private beta");
    await act(async () =>
      root.render(
        <UserBetaFeaturesPage actorId="user_a" initialFlags={[beta]} />,
      ),
    );
    expect(container.textContent).toContain("Private beta");
    session.userId = "user_b";
    await act(async () =>
      root.render(
        <UserBetaFeaturesPage actorId="user_a" initialFlags={[beta]} />,
      ),
    );
    expect(container.textContent).not.toContain("Private beta");
    await act(async () =>
      root.render(
        <AdminFeatureFlagsPage actorId="user_a" initialFlags={[flag]} />,
      ),
    );
    expect(container.textContent).not.toContain("Private feature");
    expect(container.textContent).not.toContain("Private description");
  });

  it("submits beta opt-in/out against refreshed route flags", async () => {
    vi.mocked(setUserBetaFeatureFlag).mockResolvedValue(undefined);
    await act(async () =>
      root.render(
        <UserBetaFeaturesPage actorId="user_a" initialFlags={[beta]} />,
      ),
    );
    await click(formatTranslation("web.status.disabled", {}, "en-US"));
    expect(setUserBetaFeatureFlag).toHaveBeenCalledExactlyOnceWith({
      data: { slug: beta.slug, enabled: true },
    });
    await act(async () =>
      root.render(
        <UserBetaFeaturesPage
          actorId="user_a"
          initialFlags={[{ ...beta, enabled: true }]}
        />,
      ),
    );
    await click(formatTranslation("web.status.enabled", {}, "en-US"));
    expect(setUserBetaFeatureFlag).toHaveBeenLastCalledWith({
      data: { slug: beta.slug, enabled: false },
    });
    expect(session.invalidate).toHaveBeenCalledTimes(2);
  });

  it("retains failed flag edits, disables immutable audience/slug fields, and resets only after refresh succeeds", async () => {
    vi.mocked(updateAdminFeatureFlag)
      .mockRejectedValueOnce(new Error("Save offline"))
      .mockResolvedValueOnce({ ...flag, name: "Updated feature" });
    await act(async () =>
      root.render(
        <AdminFeatureFlagsPage actorId="user_a" initialFlags={[flag]} />,
      ),
    );
    await click(`Edit ${flag.slug}`);
    const inputs = container.querySelectorAll<HTMLInputElement>(
      'aside input:not([type="checkbox"])',
    );
    expect(inputs[0]?.value).toBe(flag.slug);
    expect(inputs[0]?.disabled).toBe(true);
    await change(inputs[1] ?? null, "Updated feature");
    await click(formatTranslation("web.action.saveFlag", {}, "en-US"));
    expect(container.textContent).toContain("Save offline");
    expect(inputs[1]?.value).toBe("Updated feature");
    expect(session.invalidate).not.toHaveBeenCalled();
    await click(formatTranslation("web.action.saveFlag", {}, "en-US"));
    expect(updateAdminFeatureFlag).toHaveBeenLastCalledWith({
      data: {
        defaultEnabled: false,
        description: "Private description",
        name: "Updated feature",
        slug: "private-feature",
      },
    });
    expect(session.invalidate).toHaveBeenCalledTimes(1);
    expect(inputs[0]?.value).toBe("");
    expect(inputs[0]?.disabled).toBe(false);
  });

  it.each([
    false,
    true,
  ])("recovers acknowledged creation after a failed refresh (edited=%s)", async (edited) => {
    vi.mocked(createAdminFeatureFlag).mockResolvedValue({
      ...flag,
      audience: "user",
    });
    vi.mocked(updateAdminFeatureFlag).mockResolvedValue({
      ...flag,
      name: "Changed after create",
    });
    session.invalidate
      .mockRejectedValueOnce(new Error("Refresh offline"))
      .mockResolvedValueOnce(undefined);
    await act(async () =>
      root.render(<AdminFeatureFlagsPage actorId="user_a" initialFlags={[]} />),
    );
    const fields = container.querySelectorAll<HTMLInputElement>(
      'aside input:not([type="checkbox"])',
    );
    await change(fields[0] ?? null, flag.slug);
    await change(fields[1] ?? null, flag.name);
    await click(formatTranslation("web.action.saveFlag", {}, "en-US"));
    expect(container.textContent).toContain("Refresh offline");
    expect(fields[0]?.disabled).toBe(true);
    if (edited) await change(fields[1] ?? null, "Changed after create");
    await click(formatTranslation("web.action.saveFlag", {}, "en-US"));
    expect(createAdminFeatureFlag).toHaveBeenCalledTimes(1);
    expect(updateAdminFeatureFlag).toHaveBeenCalledTimes(edited ? 1 : 0);
    if (edited)
      expect(updateAdminFeatureFlag).toHaveBeenCalledWith({
        data: {
          name: "Changed after create",
          description: null,
          defaultEnabled: false,
          slug: flag.slug,
        },
      });
    expect(session.invalidate).toHaveBeenCalledTimes(2);
    expect(fields[0]?.value).toBe("");
  });

  it("ignores stale targeting lookups and disposes mutations when the selected user changes", async () => {
    vi.mocked(searchFeatureFlagUsers).mockResolvedValue([
      { ...first, imageUrl: null },
      { ...second, imageUrl: null },
    ]);
    /** Completes an older selected user's targeting lookup.
     * @param value - Prior account targeting rows.
     * @returns Nothing. */
    let completeLookup: (
      value: Awaited<ReturnType<typeof listAdminTargetingForUser>>,
    ) => void = (value) => {
      void value;
    };
    vi.mocked(listAdminTargetingForUser)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          completeLookup = resolve;
        }),
      )
      .mockResolvedValueOnce([{ ...beta, name: "Second targeting" }])
      .mockResolvedValueOnce([]);
    await act(async () =>
      root.render(
        <AdminFeatureFlagsPage actorId="user_a" initialFlags={[flag]} />,
      ),
    );
    await click(
      formatTranslation("web.admin.featureFlags.searchUsers", {}, "en-US"),
    );
    await click("First user");
    await click("Second user");
    await act(async () =>
      completeLookup([{ ...beta, name: "Old first targeting" }]),
    );
    expect(container.textContent).toContain("Second targeting");
    expect(container.textContent).not.toContain("Old first targeting");
    /** Completes the disposed selected user's targeting write. */
    let completeMutation = () => {};
    vi.mocked(setAdminFeatureFlagForUser).mockReturnValueOnce(
      new Promise((resolve) => {
        completeMutation = resolve;
      }),
    );
    await click("Second targeting");
    await click("First user");
    await act(async () => completeMutation());
    expect(session.invalidate).not.toHaveBeenCalled();
    expect(setAdminFeatureFlagForUser).toHaveBeenCalledExactlyOnceWith({
      data: { targetClerkId: second.clerkId, slug: beta.slug, enabled: true },
    });
    expect(container.textContent).not.toContain("Second targeting");
  });

  it("replaces explicit user searches and ignores selected access after a newer search", async () => {
    /** Completes a superseded search result.
     * @param value - Earlier matching users.
     * @returns Nothing. */
    let completeSearch: (value: AdminUserIdentity[]) => void = (value) => {
      void value;
    };
    vi.mocked(searchAdminUsers)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          completeSearch = resolve;
        }),
      )
      .mockResolvedValueOnce([second])
      .mockResolvedValueOnce([]);
    await act(async () => root.render(<AdminUsersPage />));
    await change(container.querySelector("input"), "first");
    await search();
    await change(container.querySelector("input"), "second");
    await search();
    expect(
      vi.mocked(searchAdminUsers).mock.calls[0]?.[0]?.signal?.aborted,
    ).toBe(true);
    await act(async () => completeSearch([first]));
    expect(container.textContent).toContain("Second user");
    expect(container.textContent).not.toContain("First user");
    /** Completes a disposed selected access lookup.
     * @param value - Prior selected user's access.
     * @returns Nothing. */
    let completeAccess: (
      value: Awaited<ReturnType<typeof getAdminUserAccess>>,
    ) => void = (value) => {
      void value;
    };
    vi.mocked(getAdminUserAccess).mockReturnValueOnce(
      new Promise((resolve) => {
        completeAccess = resolve;
      }),
    );
    await click("Second user");
    await change(container.querySelector("input"), "nobody");
    await search();
    await act(async () => completeAccess({ user: second, banState: null }));
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.textContent).not.toContain("Second user");
  });

  it("validates and retains ban reasons after failure, including pending provider retry states", async () => {
    vi.mocked(searchAdminUsers).mockResolvedValue([first]);
    vi.mocked(getAdminUserAccess).mockResolvedValue({
      user: first,
      banState: null,
    });
    const pending = {
      clerkId: first.clerkId,
      reason: "Staff review",
      status: "pending_ban" as const,
      updatedAt: new Date("2026-10-01"),
    };
    vi.mocked(setAdminUserBanState)
      .mockRejectedValueOnce(new Error("Provider offline"))
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce({ ...pending, status: "banned" });
    await act(async () => root.render(<AdminUsersPage />));
    await change(container.querySelector("input"), "first");
    await search();
    await click("First user");
    await click(formatTranslation("web.admin.users.ban", {}, "en-US"));
    expect(setAdminUserBanState).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      formatTranslation("web.resources.moderation.reasonRequired", {}, "en-US"),
    );
    await change(container.querySelector("textarea"), " Staff review ");
    await click(formatTranslation("web.admin.users.ban", {}, "en-US"));
    expect(container.textContent).toContain("Provider offline");
    expect(container.querySelector("textarea")?.value).toBe(" Staff review ");
    await click(formatTranslation("web.admin.users.ban", {}, "en-US"));
    expect(setAdminUserBanState).toHaveBeenLastCalledWith({
      data: {
        banned: true,
        reason: " Staff review ",
        targetClerkId: first.clerkId,
      },
    });
    await click(formatTranslation("web.page.error.retry", {}, "en-US"));
    expect(setAdminUserBanState).toHaveBeenLastCalledWith({
      data: {
        banned: true,
        reason: "Staff review",
        targetClerkId: first.clerkId,
      },
    });
    expect(container.textContent).toContain(
      formatTranslation("web.admin.users.banned", {}, "en-US"),
    );
  });

  it("aborts pending reads while hidden and restarts them on Activity resumption", async () => {
    /** Completes the current resumed read.
     * @param value - Current matching users.
     * @returns Nothing. */
    let complete: (value: AdminUserIdentity[]) => void = (value) => {
      void value;
    };
    vi.mocked(searchAdminUsers).mockImplementation(
      (input) =>
        new Promise((resolve, reject) => {
          complete = resolve;
          input?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    /**
     * Preserves the search consumer's current field through cancellation.
     * @param mode - Activity visibility.
     * @returns Current user-search consumer.
     */
    const tree = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <AdminUsersPage />
      </Activity>
    );
    await act(async () => root.render(tree("visible")));
    await change(container.querySelector("input"), "first");
    await search();
    await act(async () => root.render(tree("hidden")));
    expect(
      vi.mocked(searchAdminUsers).mock.calls[0]?.[0]?.signal?.aborted,
    ).toBe(true);
    await act(async () => root.render(tree("visible")));
    expect(searchAdminUsers).toHaveBeenCalledTimes(2);
    await act(async () => complete([first]));
    expect(container.textContent).toContain("First user");
    expect(container.textContent).not.toContain("Aborted");
    expect(container.querySelector("input")?.value).toBe("first");
  });

  it("retains a pending ban across StrictMode/Activity without replay and drops private state after an account switch", async () => {
    vi.mocked(searchAdminUsers).mockResolvedValue([first]);
    vi.mocked(getAdminUserAccess).mockResolvedValue({
      user: first,
      banState: null,
    });
    /** Completes the captured ban state change.
     * @param value - Canonical provider state.
     * @returns Nothing. */
    let complete: (
      value: Awaited<ReturnType<typeof setAdminUserBanState>>,
    ) => void = (value) => {
      void value;
    };
    vi.mocked(setAdminUserBanState).mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    /**
     * Preserves one user-access consumer across visibility changes.
     * @param mode - Activity visibility.
     * @returns Strict user-access administration.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <AdminUsersPage />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    await change(container.querySelector("input"), "first");
    await search();
    await click("First user");
    await change(container.querySelector("textarea"), "Staff reason");
    await click(formatTranslation("web.admin.users.ban", {}, "en-US"));
    await act(async () => root.render(tree("hidden")));
    await act(async () =>
      complete({
        clerkId: first.clerkId,
        reason: "Staff reason",
        status: "banned",
        updatedAt: new Date(),
      }),
    );
    await act(async () => root.render(tree("visible")));
    expect(setAdminUserBanState).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain(
      formatTranslation("web.admin.users.banned", {}, "en-US"),
    );
    session.userId = "user_b";
    await act(async () => root.render(tree("visible")));
    expect(container.textContent).not.toContain("First user");
    expect(container.querySelector("textarea")).toBeNull();
  });
});
