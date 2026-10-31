/** @vitest-environment jsdom */

import { Activity, act, StrictMode } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePenSettings } from "@/hooks/use-pen-settings";
import type {
  UserSettingsPreferences,
  UserSettingsState,
} from "@/lib/user-settings";
import {
  AuthenticatedLocaleSync,
  LocaleProvider,
  useLocale,
} from "./locale-provider";
import { ThemeProvider, useTheme } from "./theme-provider";

/** Account and API fixtures shared by the real provider tree. */
const mocks = vi.hoisted(() => ({
  auth: { isLoaded: true, isSignedIn: true, userId: "account-one" },
  fetch: vi.fn(),
  patch: vi.fn(),
  invalidate: vi.fn(),
  error: vi.fn(),
  media: {
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  defaults: {
    currencyCode: "USD",
    isProfilePublic: false,
    locale: null,
    measurementSystem: "metric",
    publishTrends: false,
    theme: "system",
  } as const,
}));
vi.mock("@clerk/tanstack-react-start", () => ({
  /**
   * Reads this test's current Clerk identity.
   * @returns Mutable account fixture.
   */
  useAuth: () => mocks.auth,
}));
vi.mock("@tanstack/react-router", () => ({
  /**
   * Supplies the route invalidation boundary.
   * @returns Router fixture.
   */
  useRouter: () => ({ invalidate: mocks.invalidate }),
}));
vi.mock("@/lib/user-settings", () => ({
  defaultUserSettings: mocks.defaults,
  getCurrentUserSettingsState: mocks.fetch,
  patchCurrentUserSettings: mocks.patch,
  userSettingsStorageKey: "pocket-trash.settings",
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/**
 * Exposes the public settings hook through a stable button.
 *
 * @returns Current account preference state and one user action.
 */
function SettingsProbe() {
  const settings = usePenSettings();
  return (
    <button
      type="button"
      onClick={() => settings.setCurrency("CAD")}
    >{`${settings.currency}:${settings.isProfilePublic}:${settings.accountSettingsLoaded}:${settings.saving}`}</button>
  );
}

/**
 * Exposes locale and theme operations through the existing public contexts.
 * @returns Current document-facing preferences and controls.
 */
function AppearanceProbe() {
  const { locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  return (
    <>
      <output>{`${locale}:${theme}`}</output>
      <button
        type="button"
        aria-label="Theme"
        onClick={() => setTheme("dark")}
      />
      <button
        type="button"
        aria-label="Light"
        onClick={() => setTheme("light")}
      />
      <button
        type="button"
        aria-label="Locale"
        onClick={() => setLocale("es-MX")}
      />
    </>
  );
}

/**
 * Builds the real provider tree with multiple consumers of the same account.
 * @param initial - Server snapshot supplied to the provider tree.
 * @returns The settings providers and probes.
 */
function settingsTree(initial: UserSettingsState | null = null) {
  return (
    <LocaleProvider initialSettingsState={initial}>
      <AuthenticatedLocaleSync initialSettingsState={initial} />
      <ThemeProvider>
        <SettingsProbe />
        <SettingsProbe />
        <AppearanceProbe />
      </ThemeProvider>
    </LocaleProvider>
  );
}

describe("shared account settings providers", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.auth.userId = "account-one";
    mocks.auth.isSignedIn = true;
    mocks.auth.isLoaded = true;
    mocks.fetch.mockResolvedValue({
      hasSavedSettings: true,
      settings: mocks.defaults,
    });
    mocks.patch.mockResolvedValue(mocks.defaults);
    mocks.media.matches = false;
    vi.stubGlobal("matchMedia", () => mocks.media);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("shares one account lookup across multiple settings consumers", async () => {
    await act(async () => root.render(settingsTree()));
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll("button")[0]?.textContent).toBe(
      "USD:false:true:false",
    );
  });

  it("restores browser preferences before authentication finishes loading", async () => {
    mocks.auth.isLoaded = false;
    window.localStorage.setItem("field-log.locale", "es-MX");
    window.localStorage.setItem("pocket-trash.theme", "dark");
    await act(async () => root.render(settingsTree()));
    expect(container.querySelector("output")?.textContent).toBe("es-MX:dark");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("keeps ownerless server-private preferences hidden until the current account responds", async () => {
    let resolve: ((value: UserSettingsState) => void) | undefined;
    mocks.fetch.mockReturnValue(
      new Promise<UserSettingsState>((done) => {
        resolve = done;
      }),
    );
    const initial = {
      hasSavedSettings: true,
      settings: {
        ...mocks.defaults,
        isProfilePublic: true,
        publishTrends: true,
      },
    };
    await act(async () => root.render(settingsTree(initial)));
    expect(container.querySelector("button")?.textContent).toBe(
      "USD:false:false:false",
    );
    await act(async () =>
      resolve?.({ hasSavedSettings: true, settings: mocks.defaults }),
    );
    expect(container.querySelector("button")?.textContent).toBe(
      "USD:false:true:false",
    );
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("retains pre-auth selections when Activity replaces the initial account read", async () => {
    mocks.auth.isLoaded = false;
    mocks.fetch
      .mockReturnValueOnce(new Promise(() => {}))
      .mockResolvedValue({ hasSavedSettings: true, settings: mocks.defaults });
    mocks.patch.mockResolvedValue({ ...mocks.defaults, theme: "dark" });
    await act(async () =>
      root.render(<Activity mode="visible">{settingsTree()}</Activity>),
    );
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Theme"]')
        ?.click(),
    );
    mocks.auth.isLoaded = true;
    await act(async () =>
      root.render(<Activity mode="visible">{settingsTree()}</Activity>),
    );
    await act(async () =>
      root.render(<Activity mode="hidden">{settingsTree()}</Activity>),
    );
    expect(mocks.fetch.mock.calls[0]?.[0].signal.aborted).toBe(true);
    await act(async () =>
      root.render(<Activity mode="visible">{settingsTree()}</Activity>),
    );
    expect(container.querySelector("output")?.textContent).toBe("en-US:dark");
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    expect(mocks.patch).toHaveBeenCalledWith({
      data: { theme: "dark" },
      signal: expect.any(AbortSignal),
    });
  });

  it("preserves a selection made before the first authentication connection", async () => {
    mocks.auth.isLoaded = false;
    mocks.patch.mockResolvedValue({ ...mocks.defaults, theme: "dark" });
    const initial: UserSettingsState = {
      hasSavedSettings: true,
      settings: { ...mocks.defaults, theme: "light" },
    };
    await act(async () => root.render(settingsTree(initial)));
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Theme"]')
        ?.click(),
    );
    expect(container.querySelector("output")?.textContent).toBe("en-US:dark");
    mocks.auth.isLoaded = true;
    await act(async () => root.render(settingsTree(initial)));
    expect(container.querySelector("output")?.textContent).toBe("en-US:dark");
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    expect(mocks.patch.mock.calls[0]?.[0].data).toEqual({ theme: "dark" });
  });

  it("discards an old account read even when the API ignores its aborted signal", async () => {
    let resolveOld: ((settings: UserSettingsState) => void) | undefined;
    mocks.fetch
      .mockReturnValueOnce(
        new Promise<UserSettingsState>((resolve) => {
          resolveOld = resolve;
        }),
      )
      .mockResolvedValueOnce({
        hasSavedSettings: true,
        settings: {
          ...mocks.defaults,
          currencyCode: "EUR",
          isProfilePublic: true,
        },
      });
    await act(async () => root.render(settingsTree()));
    const signal = mocks.fetch.mock.calls[0]?.[0].signal as AbortSignal;
    mocks.auth.userId = "account-two";
    await act(async () => root.render(settingsTree()));
    await act(async () =>
      resolveOld?.({ hasSavedSettings: true, settings: mocks.defaults }),
    );
    expect(signal.aborted).toBe(true);
    expect(container.querySelector("button")?.textContent).toBe(
      "EUR:true:true:false",
    );
  });

  it("loads account preferences when browser storage is unavailable", async () => {
    const storage = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage blocked");
      });
    mocks.fetch.mockResolvedValue({
      hasSavedSettings: true,
      settings: {
        ...mocks.defaults,
        currencyCode: "CAD",
        locale: "es-MX",
        theme: "dark",
      },
    });
    try {
      await act(async () => root.render(settingsTree()));
      expect(container.querySelector("button")?.textContent).toBe(
        "CAD:false:true:false",
      );
      expect(container.querySelector("output")?.textContent).toBe("es-MX:dark");
      expect(mocks.error).not.toHaveBeenCalled();
    } finally {
      storage.mockRestore();
    }
  });

  it("updates every consumer optimistically and rolls back a failed save", async () => {
    let rejectSave: ((error: Error) => void) | undefined;
    mocks.patch.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectSave = reject;
      }),
    );
    await act(async () => root.render(settingsTree()));
    const button = container.querySelector("button");
    await act(async () => button?.click());
    expect(container.querySelectorAll("button")[1]?.textContent).toBe(
      "CAD:false:true:true",
    );
    expect(container.querySelector("button")).toBe(button);
    await act(async () => rejectSave?.(new Error("offline")));
    expect(container.querySelectorAll("button")[1]?.textContent).toBe(
      "USD:false:true:false",
    );
    expect(mocks.error).toHaveBeenCalledTimes(1);
  });

  it("ignores late reads and saves after an account switch or logout", async () => {
    let resolveSave: ((settings: UserSettingsPreferences) => void) | undefined;
    mocks.patch.mockReturnValue(
      new Promise<UserSettingsPreferences>((resolve) => {
        resolveSave = resolve;
      }),
    );
    await act(async () => root.render(settingsTree()));
    await act(async () => container.querySelector("button")?.click());
    const signal = mocks.patch.mock.calls[0]?.[0].signal as AbortSignal;
    mocks.auth.userId = "account-two";
    mocks.fetch.mockResolvedValue({
      hasSavedSettings: true,
      settings: {
        ...mocks.defaults,
        currencyCode: "EUR",
        isProfilePublic: true,
      },
    });
    await act(async () => root.render(settingsTree()));
    expect(signal.aborted).toBe(true);
    await act(async () =>
      resolveSave?.({ ...mocks.defaults, currencyCode: "CAD" }),
    );
    expect(container.querySelector("button")?.textContent).toBe(
      "EUR:true:true:false",
    );
    mocks.auth.isSignedIn = false;
    await act(async () => root.render(settingsTree()));
    expect(container.querySelector("button")?.textContent).toBe(
      "EUR:false:false:false",
    );
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it("keeps newer selections when an older request completes last", async () => {
    let resolveFirst: ((settings: UserSettingsPreferences) => void) | undefined;
    mocks.patch
      .mockReturnValueOnce(
        new Promise<UserSettingsPreferences>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce({ ...mocks.defaults, theme: "light" });
    await act(async () => root.render(settingsTree()));
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Theme"]')
        ?.click(),
    );
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Light"]')
        ?.click(),
    );
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Locale"]')
        ?.click(),
    );
    await act(async () => resolveFirst?.({ ...mocks.defaults, theme: "dark" }));
    expect(container.querySelector("output")?.textContent).toBe("es-MX:light");
  });

  it("renders request-isolated SSR snapshots without storage or network I/O and hydrates them", async () => {
    const initial: UserSettingsState = {
      hasSavedSettings: true,
      settings: { ...mocks.defaults, locale: "es-MX", theme: "dark" },
    };
    const readStorage = vi.spyOn(Storage.prototype, "getItem");
    const first = renderToString(settingsTree(initial));
    const second = renderToString(
      settingsTree({
        ...initial,
        settings: { ...mocks.defaults, locale: "en-US", theme: "light" },
      }),
    );
    expect(first).toContain("es-MX:dark");
    expect(second).toContain("en-US:light");
    expect(readStorage).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    readStorage.mockRestore();
    act(() => root.unmount());
    container.innerHTML = first;
    const recover = vi.fn();
    mocks.fetch.mockResolvedValue(initial);
    await act(async () => {
      root = hydrateRoot(container, settingsTree(initial), {
        onRecoverableError: recover,
      });
    });
    expect(recover).not.toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(container.querySelector("output")?.textContent).toBe("es-MX:dark");
  });

  it("retains cached browser preferences when account loading fails", async () => {
    window.localStorage.setItem("field-log.locale", "es-MX");
    window.localStorage.setItem("pocket-trash.theme", "dark");
    window.localStorage.setItem(
      "pocket-trash.settings",
      JSON.stringify({ currencyCode: "CAD", measurementSystem: "imperial" }),
    );
    mocks.fetch.mockRejectedValue(new Error("offline"));
    await act(async () => root.render(settingsTree()));
    expect(container.querySelector("button")?.textContent).toBe(
      "CAD:false:false:false",
    );
    expect(container.querySelector("output")?.textContent).toBe("es-MX:dark");
  });

  it("does not replay a completed preference mutation through StrictMode and Activity", async () => {
    mocks.patch.mockResolvedValue({ ...mocks.defaults, currencyCode: "CAD" });
    await act(async () =>
      root.render(
        <StrictMode>
          <Activity mode="visible">{settingsTree()}</Activity>
        </StrictMode>,
      ),
    );
    await act(async () => container.querySelector("button")?.click());
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    await act(async () =>
      root.render(
        <StrictMode>
          <Activity mode="hidden">{settingsTree()}</Activity>
        </StrictMode>,
      ),
    );
    await act(async () =>
      root.render(
        <StrictMode>
          <Activity mode="visible">{settingsTree()}</Activity>
        </StrictMode>,
      ),
    );
    expect(mocks.patch).toHaveBeenCalledTimes(1);
  });

  it("observes system theme changes and disposes the browser subscription", async () => {
    await act(async () => root.render(settingsTree()));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    mocks.media.matches = true;
    const onChange = mocks.media.addEventListener.mock.calls[0]?.[1];
    await act(async () => onChange?.());
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    await act(async () => root.render(null));
    expect(mocks.media.removeEventListener).toHaveBeenCalledWith(
      "change",
      onChange,
    );
  });
});
