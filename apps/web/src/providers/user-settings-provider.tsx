import { useAuth } from "@clerk/tanstack-react-start";
import { useEffect, useRef } from "react";
import type { UserSettingsState } from "@/lib/user-settings";
import { useUserSettingsStore } from "@/lib/user-settings-store";

/**
 * Adapts Clerk identity and loader bootstrap to the isolated preference owner.
 *
 * @param props - Server-loaded preferences used on the initial committed mount.
 * @returns No UI.
 * @throws When used outside LocaleProvider.
 */
export function UserSettingsProvider(props: {
  /** Initial loader preferences; later preference changes use store actions. */
  initialSettingsState: UserSettingsState | null;
}) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const store = useUserSettingsStore();
  const initial = useRef(props.initialSettingsState);
  useEffect(() => {
    if (!isLoaded) return;
    return store.connect(isSignedIn && userId ? userId : null, initial.current);
  }, [isLoaded, isSignedIn, userId, store]);
  return null;
}
