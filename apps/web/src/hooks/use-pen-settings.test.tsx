/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Hoisted account-settings dependencies shared by hook tests. */
const mocks = vi.hoisted(() => ({
  auth: { isLoaded: true, isSignedIn: true, userId: "user_one" },
  fetch: vi.fn(),
  invalidate: vi.fn(),
  patch: vi.fn(),
  setMeasurementSystem: vi.fn(),
}));

vi.mock("@clerk/tanstack-react-start", () => ({
  /**
   * Returns the mutable authentication fixture.
   *
   * @returns The mutable test authentication state.
   */
  useAuth: () => mocks.auth,
}));
vi.mock("@tanstack/react-router", () => ({
  /**
   * Returns the router fixture.
   *
   * @returns The test router invalidation callback.
   */
  useRouter: () => ({ invalidate: mocks.invalidate }),
}));
vi.mock("@pocket-trash/localizations", () => ({
  /**
   * Returns untranslated copy for assertions.
   *
   * @param key - Requested translation key.
   * @returns The requested key for assertions.
   */
  formatTranslation: (key: string) => key,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns stable locale state.
   *
   * @returns Stable locale state for the hook under test.
   */
  useLocale: () => ({
    locale: "en-US",
    measurementSystem: "metric",
    setMeasurementSystem: mocks.setMeasurementSystem,
  }),
}));
vi.mock("@/lib/user-settings", () => ({
  defaultUserSettings: {
    currencyCode: "USD",
    isProfilePublic: false,
    measurementSystem: "metric",
    publishTrends: false,
  },
  getCurrentUserSettingsState: mocks.fetch,
  patchCurrentUserSettings: mocks.patch,
  userSettingsStorageKey: "pocket-trash:user-settings",
}));

import { usePenSettings } from "./use-pen-settings";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/** Deferred account-settings response used by race tests. */
type SettingsResponse = {
  /** Loaded account settings. */
  settings: {
    /** Loaded currency. */
    currencyCode: "USD";
    /** Loaded profile visibility. */
    isProfilePublic: boolean;
    /** Loaded measurement system. */
    measurementSystem: "metric";
    /** Loaded trends visibility. */
    publishTrends: boolean;
  };
};

/**
 * Exposes hook state and one optimistic display-setting mutation.
 *
 * @returns A button containing serialized hook state.
 */
function Probe() {
  const settings = usePenSettings();
  return (
    <button type="button" onClick={() => settings.setCurrency("CAD")}>
      {`${settings.accountSettingsLoaded}:${settings.accountSettingsLoadFailed}:${settings.currency}:${settings.isProfilePublic}:${settings.saving}`}
    </button>
  );
}

describe("usePenSettings", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.userId = "user_one";
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("finishes account loading without overwriting a newer display mutation", async () => {
    let resolveFetch: ((value: SettingsResponse) => void) | undefined;
    mocks.fetch.mockReturnValue(
      new Promise<SettingsResponse>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    mocks.patch.mockReturnValue(new Promise(() => undefined));

    await act(async () => root.render(<Probe />));
    await act(async () => container.querySelector("button")?.click());
    await act(async () =>
      resolveFetch?.({
        settings: {
          currencyCode: "USD",
          isProfilePublic: true,
          measurementSystem: "metric",
          publishTrends: false,
        },
      }),
    );

    expect(container.textContent).toBe("true:false:CAD:true:true");
  });

  it("clears stale save state when the signed-in account changes", async () => {
    mocks.fetch.mockResolvedValue({
      settings: {
        currencyCode: "USD",
        isProfilePublic: false,
        measurementSystem: "metric",
        publishTrends: false,
      },
    });
    mocks.patch.mockReturnValue(new Promise(() => undefined));

    await act(async () => root.render(<Probe />));
    await act(async () => container.querySelector("button")?.click());
    expect(container.textContent).toContain(":true");

    mocks.auth.userId = "user_two";
    await act(async () => root.render(<Probe />));

    expect(container.textContent).toBe("true:false:USD:false:false");
  });

  it("reports a raced load failure after a display mutation", async () => {
    let rejectFetch: ((reason: Error) => void) | undefined;
    mocks.fetch.mockReturnValue(
      new Promise<SettingsResponse>((_resolve, reject) => {
        rejectFetch = reject;
      }),
    );
    mocks.patch.mockReturnValue(new Promise(() => undefined));

    await act(async () => root.render(<Probe />));
    await act(async () => container.querySelector("button")?.click());
    await act(async () => rejectFetch?.(new Error("offline")));

    expect(container.textContent).toBe("false:true:CAD:false:true");
  });
});
