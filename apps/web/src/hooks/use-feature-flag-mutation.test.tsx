/** @vitest-environment jsdom */

import { Activity, act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type FeatureFlagOperation,
  useFeatureFlagMutation,
} from "./use-feature-flag-mutation";

/** Account and durable service/refresh observers. */
const session = vi.hoisted(() => ({
  userId: "user_a",
  invalidate: vi.fn(),
  committed: vi.fn(),
}));
/** Existing mutation endpoints observed independently. */
const api = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  beta: vi.fn(),
  target: vi.fn(),
}));
vi.mock("@clerk/tanstack-react-start", () => ({
  /** Supplies the current mutation account.
   * @returns Current account identity. */
  useAuth: () => ({ userId: session.userId }),
}));
vi.mock("@tanstack/react-router", () => ({
  /** Supplies the route refresh boundary.
   * @returns Current Router invalidation observer. */
  useRouter: () => ({ invalidate: session.invalidate }),
}));
vi.mock("@/providers/locale-provider", () => ({
  /** Supplies the active feedback locale.
   * @returns English locale context. */
  useLocale: () => ({ locale: "en-US" }),
}));
vi.mock("@/lib/feature-flags", () => ({
  createAdminFeatureFlag: api.create,
  updateAdminFeatureFlag: api.update,
  archiveAdminFeatureFlag: api.archive,
  setUserBetaFeatureFlag: api.beta,
  setAdminFeatureFlagForUser: api.target,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
/** Current captured beta intent. */
const beta: FeatureFlagOperation = {
  kind: "beta",
  slug: "new-feature",
  enabled: true,
};

/**
 * Drives the public semantic mutation command.
 * @param props - Captured existing flag operation.
 * @returns Pending/error feedback and a confirmed mutation command.
 */
function Mutation({
  operation = beta,
}: {
  /** Captured mutation input. */
  operation?: FeatureFlagOperation;
} = {}) {
  const state = useFeatureFlagMutation(session.committed);
  return (
    <>
      <button disabled={state.pending} onClick={() => state.mutate(operation)}>
        Save
      </button>
      <output>{state.error}</output>
    </>
  );
}

describe("feature-flag mutation lifetimes", () => {
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

  it("reattaches a pending write after StrictMode/Activity and never replays terminal mutations", async () => {
    /** Completes the pending preference write. */
    let complete = () => {};
    api.beta.mockReturnValue(
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
    );
    /**
     * Preserves the current mutation consumer.
     * @param mode - Activity visibility.
     * @returns Strict flag consumer.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <Mutation />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    await act(async () => container.querySelector("button")?.click());
    await act(async () => root.render(tree("hidden")));
    await act(async () => root.render(tree("visible")));
    expect(api.beta).toHaveBeenCalledTimes(1);
    await act(async () => root.render(tree("hidden")));
    await act(async () => complete());
    expect(session.invalidate).not.toHaveBeenCalled();
    expect(session.committed).not.toHaveBeenCalled();
    await act(async () => root.render(tree("visible")));
    expect(session.invalidate).toHaveBeenCalledTimes(1);
    expect(session.committed).toHaveBeenCalledExactlyOnceWith(beta);
    await act(async () => root.render(tree("hidden")));
    await act(async () => root.render(tree("visible")));
    expect(api.beta).toHaveBeenCalledTimes(1);
    expect(session.committed).toHaveBeenCalledTimes(1);
    await act(async () => container.querySelector("button")?.click());
    expect(api.beta).toHaveBeenCalledTimes(2);
  });

  it("retries only failed loader refreshes after a successful write", async () => {
    session.invalidate
      .mockRejectedValueOnce(new Error("refresh offline"))
      .mockResolvedValueOnce(undefined);
    await act(async () => root.render(<Mutation />));
    await act(async () => container.querySelector("button")?.click());
    expect(container.querySelector("output")?.textContent).toBe(
      "refresh offline",
    );
    expect(session.committed).not.toHaveBeenCalled();
    await act(async () => container.querySelector("button")?.click());
    expect(api.beta).toHaveBeenCalledTimes(1);
    expect(session.invalidate).toHaveBeenCalledTimes(2);
    expect(session.committed).toHaveBeenCalledTimes(1);
    expect(container.querySelector("output")?.textContent).toBe("");
  });

  it("keeps failed writes retryable and scopes identical intents to the current account", async () => {
    api.beta.mockRejectedValueOnce(new Error("write offline"));
    await act(async () => root.render(<Mutation />));
    await act(async () => container.querySelector("button")?.click());
    expect(container.querySelector("output")?.textContent).toBe(
      "write offline",
    );
    expect(session.invalidate).not.toHaveBeenCalled();
    await act(async () => container.querySelector("button")?.click());
    expect(api.beta).toHaveBeenCalledTimes(2);
    session.userId = "user_b";
    await act(async () => root.render(<Mutation />));
    await act(async () => container.querySelector("button")?.click());
    expect(api.beta).toHaveBeenCalledTimes(3);
    expect(session.committed).toHaveBeenCalledTimes(2);
  });

  it("ignores old-account completions before invalidating routes or publishing callbacks", async () => {
    /** Completes a disposed account's preference write. */
    let complete = () => {};
    api.beta.mockReturnValue(
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
    );
    await act(async () => root.render(<Mutation />));
    await act(async () => container.querySelector("button")?.click());
    session.userId = "user_b";
    await act(async () => root.render(<Mutation />));
    await act(async () => complete());
    expect(session.invalidate).not.toHaveBeenCalled();
    expect(session.committed).not.toHaveBeenCalled();
    expect(container.querySelector("button")?.disabled).toBe(false);
  });

  it("preserves create/update audience and targeting wire contracts", async () => {
    const value = {
      audience: "admin" as const,
      defaultEnabled: false,
      description: "",
      name: "Feature",
      slug: "feature",
    };
    await act(async () =>
      root.render(<Mutation operation={{ kind: "create", value }} />),
    );
    await act(async () => container.querySelector("button")?.click());
    expect(api.create).toHaveBeenCalledExactlyOnceWith({
      data: { ...value, description: null },
    });
    await act(async () =>
      root.render(<Mutation operation={{ kind: "update", value }} />),
    );
    await act(async () => container.querySelector("button")?.click());
    expect(api.update).toHaveBeenCalledExactlyOnceWith({
      data: {
        defaultEnabled: false,
        description: null,
        name: "Feature",
        slug: "feature",
      },
    });
    await act(async () =>
      root.render(
        <Mutation
          operation={{
            kind: "target",
            slug: "feature",
            targetClerkId: "target_user",
            enabled: true,
          }}
        />,
      ),
    );
    await act(async () => container.querySelector("button")?.click());
    expect(api.target).toHaveBeenCalledExactlyOnceWith({
      data: { slug: "feature", targetClerkId: "target_user", enabled: true },
    });
    await act(async () =>
      root.render(
        <Mutation operation={{ kind: "archive", slug: "feature" }} />,
      ),
    );
    await act(async () => container.querySelector("button")?.click());
    expect(api.archive).toHaveBeenCalledExactlyOnceWith({
      data: { slug: "feature" },
    });
    expect(session.invalidate).toHaveBeenCalledTimes(4);
  });
});
