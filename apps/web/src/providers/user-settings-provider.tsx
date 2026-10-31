import { useAuth } from "@clerk/tanstack-react-start";
import { useEffect } from "react";
import { useUserSettingsStore } from "@/lib/user-settings-store";

/**
 * Adapts Clerk identity to the isolated preference owner.
 *
 * @returns No UI.
 * @throws When used outside LocaleProvider.
 */
export function UserSettingsProvider() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const store = useUserSettingsStore();
  useEffect(() => {
    if (!isLoaded) return;
    return store.connect(isSignedIn && userId ? userId : null);
  }, [isLoaded, isSignedIn, userId, store]);
  return null;
}
