import { loggerMessages } from "@package/logger";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/lib/user-settings", () => ({
  defaultUserSettings: {
    currencyCode: "USD",
    dimensionUnit: "in",
    locale: null,
    theme: "system",
    weightUnit: "g",
  },
  getCurrentUserSettingsState: mocks.getSettings,
  patchCurrentUserSettings: vi.fn(),
  userSettingsStorageKey: "pocket-trash.settings",
}));

vi.mock("@/lib/services", () => ({
  s: { logger: { warn: mocks.warn } },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: mocks.warn },
}));

vi.mock("@/components/page-footer", () => ({
  PageFooter: ({ year }: { year: number }) => <footer>{year}</footer>,
}));

vi.mock("@/providers/app-providers", () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Outlet: () => <main>route content</main>,
}));

import { Route } from "./__root";

describe("root route loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails open when optional user settings cannot load", async () => {
    const error = new Error("settings unavailable");
    mocks.getSettings.mockRejectedValue(error);
    const loader = Route.options.loader;

    expect(typeof loader).toBe("function");
    if (typeof loader !== "function")
      throw new Error("Root loader is missing.");

    await expect(loader({} as never)).resolves.toMatchObject({
      settingsState: null,
      themeBootstrap: {
        serverTheme: null,
        shouldUseServerTheme: false,
      },
    });
    expect(mocks.warn).toHaveBeenCalledWith(
      loggerMessages.web.userSettingsFetchFailed,
      { error },
    );
  });

  it("still fails open when reporting the settings failure also fails", async () => {
    mocks.getSettings.mockRejectedValue(new Error("settings unavailable"));
    mocks.warn.mockImplementation(() => {
      throw new Error("logger unavailable");
    });
    const loader = Route.options.loader;

    expect(typeof loader).toBe("function");
    if (typeof loader !== "function")
      throw new Error("Root loader is missing.");

    await expect(loader({} as never)).resolves.toMatchObject({
      settingsState: null,
    });
  });

  it("captures the current year in loader data", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2031-06-15T12:00:00Z"));
    mocks.getSettings.mockResolvedValue(null);
    const loader = Route.options.loader;

    expect(typeof loader).toBe("function");
    if (typeof loader !== "function")
      throw new Error("Root loader is missing.");

    await expect(loader({} as never)).resolves.toMatchObject({
      copyrightYear: 2031,
    });
    vi.useRealTimers();
  });

  it("owns exactly one footer around routed content", () => {
    vi.spyOn(Route, "useLoaderData").mockReturnValue({
      copyrightYear: 2031,
      settingsState: null,
      themeBootstrap: {
        serverTheme: null,
        shouldUseServerTheme: false,
      },
    });
    const RootComponent = Route.options.component;

    expect(RootComponent).toBeTypeOf("function");
    if (!RootComponent) throw new Error("Root component is missing.");

    const html = renderToStaticMarkup(<RootComponent />);

    expect(html).toContain("route content");
    expect(html.match(/<footer>/g)).toHaveLength(1);
    expect(html).toContain("<footer>2031</footer>");
  });
});
