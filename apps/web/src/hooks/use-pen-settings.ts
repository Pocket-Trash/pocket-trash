import { useAuth } from "@clerk/tanstack-react-start";
import { useStore } from "@nanostores/react";
import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import type { CurrencyCode, MeasurementSystem } from "@/lib/pen-formatters";
import type { UserSettingsPatch } from "@/lib/user-settings";
import { useUserSettingsStore } from "@/lib/user-settings-store";

/**
 * Exposes shared, account-scoped preferences and optimistic save operations.
 *
 * @returns Existing pen/account settings contract backed by the shared owner.
 * @throws When used outside LocaleProvider.
 */
export function usePenSettings() {
  const { userId, isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const store = useUserSettingsStore();
  const snapshot = useStore(store.state, {
    /**
     * Returns the immutable request snapshot during hydration.
     * @returns Initial request preferences.
     */
    ssr: () => store.initial,
  });
  const currentAccount = snapshot.accountId === (isSignedIn ? userId : null);
  /**
   * Saves a user action and invalidates route data only for a current account response.
   * @param patch - Selected preference fields.
   */
  const saveSettings = useCallback(
    (patch: UserSettingsPatch) => {
      if (isLoaded && !currentAccount) return;
      void store.save(patch).then((saved) => {
        if (saved) void router.invalidate();
      });
    },
    [currentAccount, isLoaded, router, store],
  );
  return {
    accountSettingsLoadFailed:
      currentAccount && snapshot.accountSettingsLoadFailed,
    accountSettingsLoaded: currentAccount && snapshot.accountSettingsLoaded,
    currency: snapshot.settings.currencyCode,
    isProfilePublic:
      isSignedIn === true &&
      currentAccount &&
      snapshot.accountSettingsLoaded &&
      snapshot.settings.isProfilePublic,
    measurementSystem: snapshot.settings.measurementSystem,
    publishTrends:
      isSignedIn === true &&
      currentAccount &&
      snapshot.accountSettingsLoaded &&
      snapshot.settings.publishTrends,
    saving: currentAccount && snapshot.saving,
    /**
     * Selects the display currency.
     * @param currencyCode - Currency selected by the user.
     */
    setCurrency: (currencyCode: CurrencyCode) => {
      saveSettings({ currencyCode });
    },
    /**
     * Selects profile visibility.
     * @param isProfilePublic - Whether to publish the profile.
     */
    setIsProfilePublic: (isProfilePublic: boolean) => {
      saveSettings({ isProfilePublic });
    },
    /**
     * Selects measurement display units.
     * @param measurementSystem - Metric or imperial units.
     */
    setMeasurementSystem: (measurementSystem: MeasurementSystem) => {
      saveSettings({ measurementSystem });
    },
    /**
     * Selects public trend visibility.
     * @param publishTrends - Whether to publish trends.
     */
    setPublishTrends: (publishTrends: boolean) => {
      saveSettings({ publishTrends });
    },
  };
}
