import { loggerMessages } from "@package/logger";
import {
  DEFAULT_LOCALE,
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { atom } from "nanostores";
import { createContext, useContext } from "react";
import { toast } from "sonner";
import {
  readStoredLocale,
  resolveAuthenticatedLocale,
  resolveBrowserLocale,
  writeStoredLocale,
} from "./locale";
import { logger } from "./logger";
import { currencies } from "./pen-formatters";
import {
  applyTheme,
  isThemeMode,
  type ThemeMode,
  themeStorageKey,
} from "./theme";
import { resolveThemeBootstrap } from "./theme-bootstrap";
import {
  defaultUserSettings,
  getCurrentUserSettingsState,
  patchCurrentUserSettings,
  type UserSettingsPatch,
  type UserSettingsPreferences,
  type UserSettingsState,
  userSettingsStorageKey,
} from "./user-settings";

/** Shared preferences and account loading state within one provider tree. */
export type SettingsSnapshot = {
  /** Resolved display and account preferences. */
  settings: UserSettingsPreferences;
  /** Resolved display locale even when the saved preference is automatic. */
  locale: SupportedLocale;
  /** Account whose private preferences are currently loaded. */
  accountId: string | null;
  /** Whether authenticated preferences finished loading. */
  accountSettingsLoaded: boolean;
  /** Whether authenticated preferences could not be loaded. */
  accountSettingsLoadFailed: boolean;
  /** Whether a pen/account preference save is pending. */
  saving: boolean;
  /** Whether a theme preference save is pending. */
  themeSaving: boolean;
};

/** Preference keys whose mutation generations are tracked independently. */
type PreferenceKey = keyof UserSettingsPreferences;

/**
 * Creates an isolated settings owner without browser or network I/O.
 *
 * @param initialSettingsState - Settings loaded for this server request.
 * @returns The request-local store and explicit preference operations.
 */
export function createUserSettingsStore(
  initialSettingsState: UserSettingsState | null,
) {
  const initial: SettingsSnapshot = {
    settings: { ...defaultUserSettings, ...initialSettingsState?.settings },
    locale: initialSettingsState?.settings.locale ?? DEFAULT_LOCALE,
    accountId: null,
    accountSettingsLoaded: false,
    accountSettingsLoadFailed: false,
    saving: false,
    themeSaving: false,
  };
  const state = atom(initial);
  const versions = new Map<PreferenceKey, number>();
  const controllers = new Set<AbortController>();
  const pending = new Map<number, "theme" | "settings" | "locale">();
  const earlySelections = new Map<PreferenceKey, number>();
  let epoch = 0;
  let sequence = 0;
  let connected = false;
  let browserReady = false;
  let accountId: string | null = null;

  /** Restores browser preferences after commit while keeping server snapshots pure. */
  function initializeBrowser() {
    if (browserReady) return;
    browserReady = true;
    const cached = readBrowserSettings();
    const settings = initialSettingsState
      ? {
          ...initial.settings,
          theme: initialSettingsState.hasSavedSettings
            ? initial.settings.theme
            : cached.settings.theme,
        }
      : cached.settings;
    state.set({
      ...state.get(),
      settings,
      locale: settings.locale ?? cached.locale,
    });
  }

  /**
   * Publishes updated preferences and their resolved locale.
   *
   * @param patch - Preference fields to replace.
   */
  function apply(patch: UserSettingsPatch) {
    const current = state.get();
    state.set({
      ...current,
      settings: { ...current.settings, ...patch },
      locale: patch.locale ?? current.locale,
    });
  }

  /**
   * Persists affected browser keys without caching profile visibility or derived locale.
   * @param patch - Preference fields whose browser keys changed.
   */
  function persist(patch: UserSettingsPatch) {
    const { settings, locale } = state.get();
    try {
      if (patch.locale != null) writeStoredLocale(locale);
      if (patch.theme !== undefined)
        window.localStorage.setItem(themeStorageKey, settings.theme);
      if (
        "currencyCode" in patch ||
        "measurementSystem" in patch ||
        "publishTrends" in patch ||
        "isProfilePublic" in patch
      )
        window.localStorage.setItem(
          userSettingsStorageKey,
          JSON.stringify({
            currencyCode: settings.currencyCode,
            measurementSystem: settings.measurementSystem,
            publishTrends: settings.publishTrends,
          }),
        );
    } catch {
      // Browser persistence is best-effort; account saves still report failures.
    }
  }

  /**
   * Applies a local preference selection and invalidates older reads for its fields.
   *
   * @param patch - Explicitly selected preference fields.
   */
  function select(patch: UserSettingsPatch) {
    for (const key of Object.keys(patch) as PreferenceKey[])
      versions.set(key, ++sequence);
    apply(patch);
    persist(patch);
  }

  /**
   * Reports an account request failure using the current display locale.
   *
   * @param kind - Whether preferences were being loaded or saved.
   * @param error - Failure supplied by the API, when available.
   */
  function reportFailure(kind: "load" | "save", error?: unknown) {
    const locale = state.get().locale;
    /**
     * Formats feedback using the current preference owner's locale.
     * @param key - Existing settings feedback key.
     * @returns Localized settings feedback.
     */
    const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
    if (error)
      logger.warn(
        kind === "load"
          ? loggerMessages.web.userSettingsFetchFailed
          : loggerMessages.web.userSettingsSaveFailed,
        { error },
      );
    toast.error(
      t(kind === "load" ? "error.generic" : "web.error.settingsSaveFailed"),
    );
  }

  /** Updates save indicators from the outstanding operations for this account. */
  function publishPending() {
    state.set({
      ...state.get(),
      saving: [...pending.values()].includes("settings"),
      themeSaving: [...pending.values()].includes("theme"),
    });
  }

  /**
   * Persists a user action once, guarding each field against superseded responses.
   * Locale failures retain the local selection; other failed fields roll back.
   *
   * @param patch - Existing settings API patch selected by the user.
   * @returns Whether an authenticated save succeeded for the current account.
   */
  async function save(patch: UserSettingsPatch): Promise<boolean> {
    const previous = state.get().settings;
    select(patch);
    if (!accountId) return false;
    const generation = epoch;
    const selectedVersions = new Map(versions);
    const fields = Object.keys(patch) as PreferenceKey[];
    if ("isProfilePublic" in patch && !fields.includes("publishTrends"))
      fields.push("publishTrends");
    const operation = ++sequence;
    pending.set(
      operation,
      "theme" in patch ? "theme" : "locale" in patch ? "locale" : "settings",
    );
    publishPending();
    const controller = new AbortController();
    controllers.add(controller);
    try {
      const settings = await patchCurrentUserSettings({
        data: patch,
        signal: controller.signal,
      });
      if (generation !== epoch || controller.signal.aborted) return false;
      if (!settings) throw new Error("Settings request returned no account.");
      apply(
        Object.fromEntries(
          fields
            .filter((key) => versions.get(key) === selectedVersions.get(key))
            .map((key) => [key, settings[key]]),
        ),
      );
      persist(patch);
      return true;
    } catch (error) {
      if (generation !== epoch || controller.signal.aborted) return false;
      const currentFields = fields.filter(
        (key) => versions.get(key) === selectedVersions.get(key),
      );
      if (!currentFields.length) return false;
      apply(
        Object.fromEntries(
          currentFields
            .filter((key) => key !== "locale")
            .map((key) => [key, previous[key]]),
        ),
      );
      persist(patch);
      reportFailure("save", error);
      return false;
    } finally {
      controllers.delete(controller);
      if (generation === epoch) {
        pending.delete(operation);
        publishPending();
      }
    }
  }

  /**
   * Reconciles one account snapshot without replacing newer local selections.
   *
   * @param loaded - Server settings or defaults for the active account.
   * @param readVersions - Field generations captured when the request started.
   */
  function accept(
    loaded: UserSettingsState,
    readVersions: Map<PreferenceKey, number>,
  ) {
    let storedLocale: SupportedLocale | null = null;
    let localTheme: ThemeMode | null = null;
    try {
      storedLocale = readStoredLocale();
      const storedTheme = window.localStorage.getItem(themeStorageKey);
      localTheme = isThemeMode(storedTheme) ? storedTheme : null;
    } catch {
      // Saved account preferences remain usable when browser storage is blocked.
    }
    const locale = resolveAuthenticatedLocale(loaded, storedLocale);
    const theme = resolveThemeBootstrap(loaded, localTheme);
    const preferences = {
      ...loaded.settings,
      locale: locale.locale,
      theme: theme.theme,
    };
    apply(
      Object.fromEntries(
        (Object.keys(preferences) as PreferenceKey[])
          .filter((key) => versions.get(key) === readVersions.get(key))
          .map((key) => [key, preferences[key]]),
      ),
    );
    state.set({
      ...state.get(),
      accountSettingsLoaded: true,
      accountSettingsLoadFailed: false,
    });
    persist({
      ...loaded.settings,
      locale: locale.locale,
      theme: loaded.hasSavedSettings || localTheme ? theme.theme : undefined,
    });
    const promotion: UserSettingsPatch = Object.fromEntries(
      [...earlySelections]
        .filter(([key, version]) => versions.get(key) === version)
        .map(([key]) => [key, state.get().settings[key]]),
    );
    earlySelections.clear();
    if (
      locale.shouldPersist &&
      locale.locale &&
      versions.get("locale") === readVersions.get("locale")
    )
      promotion.locale = locale.locale;
    if (
      theme.shouldPersist &&
      versions.get("theme") === readVersions.get("theme")
    )
      promotion.theme = theme.theme;
    if (Object.keys(promotion).length) void save(promotion);
  }

  /**
   * Starts committed browser/account synchronization and invalidates disposed work.
   *
   * @param nextAccountId - Loaded Clerk identity, or `null` for an anonymous visitor.
   * @returns Cleanup that aborts reads/writes without replaying mutations.
   */
  function connect(nextAccountId: string | null) {
    const first = !connected;
    const changed = connected && nextAccountId !== accountId;
    connected = true;
    accountId = nextAccountId;
    const generation = ++epoch;
    if (first)
      for (const [key, version] of versions) earlySelections.set(key, version);
    if (changed) {
      versions.clear();
      earlySelections.clear();
      const cached = readBrowserSettings();
      const settings = {
        ...cached.settings,
        isProfilePublic: false,
        publishTrends: false,
      };
      state.set({
        ...initial,
        accountId,
        settings,
        locale: settings.locale ?? cached.locale,
      });
    } else {
      const current = state.get();
      state.set({
        ...current,
        accountId,
        settings:
          !first && accountId
            ? current.settings
            : {
                ...current.settings,
                isProfilePublic: false,
                publishTrends: false,
              },
      });
    }
    if (accountId && !state.get().accountSettingsLoaded) {
      const readVersions = first
        ? new Map<PreferenceKey, number>()
        : new Map(versions);
      for (const key of earlySelections.keys()) readVersions.delete(key);
      const controller = new AbortController();
      controllers.add(controller);
      void getCurrentUserSettingsState({ signal: controller.signal })
        .then((loaded) => {
          if (generation !== epoch || controller.signal.aborted) return;
          if (loaded) accept(loaded, readVersions);
          else {
            state.set({ ...state.get(), accountSettingsLoadFailed: true });
            reportFailure("load");
          }
        })
        .catch((error: unknown) => {
          if (generation !== epoch || controller.signal.aborted) return;
          state.set({ ...state.get(), accountSettingsLoadFailed: true });
          reportFailure("load", error);
        })
        .finally(() => controllers.delete(controller));
    }
    return () => {
      epoch++;
      for (const controller of controllers) controller.abort();
      controllers.clear();
      const hadPendingSave = pending.size > 0;
      pending.clear();
      state.set({
        ...state.get(),
        saving: false,
        themeSaving: false,
        accountSettingsLoaded:
          state.get().accountSettingsLoaded && !hadPendingSave,
      });
    };
  }

  return { state, initial, select, save, connect, initializeBrowser };
}

/** Request-local settings owner shared by the existing provider and hook contracts. */
export type UserSettingsStore = ReturnType<typeof createUserSettingsStore>;
/** Settings context is immutable on the server; each provider supplies its own owner. */
export const UserSettingsContext = createContext<UserSettingsStore | null>(
  null,
);

/**
 * Reads the required request-local settings owner.
 *
 * @returns The current provider's settings owner.
 * @throws When used outside LocaleProvider.
 */
export function useUserSettingsStore() {
  const store = useContext(UserSettingsContext);
  if (!store) throw new Error("useLocale must be used within LocaleProvider.");
  return store;
}

/**
 * Reads existing browser preference keys only after a committed mount.
 *
 * @returns Valid display preferences with private account fields reset.
 */
function readBrowserSettings() {
  let settings = { ...defaultUserSettings };
  let locale: SupportedLocale = DEFAULT_LOCALE;
  try {
    locale = resolveBrowserLocale();
    const stored = JSON.parse(
      window.localStorage.getItem(userSettingsStorageKey) ?? "null",
    ) as Partial<UserSettingsPreferences> | null;
    const theme = window.localStorage.getItem(themeStorageKey);
    settings = {
      ...settings,
      currencyCode:
        stored?.currencyCode && currencies.includes(stored.currencyCode)
          ? stored.currencyCode
          : settings.currencyCode,
      measurementSystem:
        stored?.measurementSystem === "imperial" ? "imperial" : "metric",
      publishTrends:
        typeof stored?.publishTrends === "boolean"
          ? stored.publishTrends
          : settings.publishTrends,
      theme: isThemeMode(theme) ? theme : "system",
    };
  } catch {
    // Invalid or unavailable browser settings retain defaults.
  }
  return { settings, locale };
}

/**
 * Binds document language to the current browser preference owner.
 *
 * @param store - Request-local preference owner.
 * @param notify - React external-store subscription notification.
 * @returns Cleanup for the store subscription.
 */
export function subscribeSettingsDocument(
  store: UserSettingsStore,
  notify: () => void,
) {
  store.initializeBrowser();
  /** Applies the current document-facing preferences after a committed change. */
  const applyDocument = () => {
    const snapshot = store.state.get();
    document.documentElement.lang = snapshot.locale;
  };
  applyDocument();
  const unsubscribe = store.state.listen(() => {
    applyDocument();
    notify();
  });
  return unsubscribe;
}

/**
 * Binds the theme to preference updates and browser system-theme changes.
 * @param store - Request-local preference owner.
 * @param notify - React external-store notification.
 * @returns Cleanup for the store and media subscription.
 */
export function subscribeSettingsTheme(
  store: UserSettingsStore,
  notify: () => void,
) {
  store.initializeBrowser();
  /** Applies the active preference to the current document. */
  const applyDocument = () => {
    applyTheme(store.state.get().settings.theme);
  };
  applyDocument();
  const unsubscribe = store.state.listen(() => {
    applyDocument();
    notify();
  });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", applyDocument);
  return () => {
    unsubscribe();
    media.removeEventListener("change", applyDocument);
  };
}
