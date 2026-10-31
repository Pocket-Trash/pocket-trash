import type * as React from "react";
import { Toaster } from "sonner";
import {
  InitialUiPreferencesContext,
  type UiPreferences,
} from "@/lib/ui-preferences";
import type { UserSettingsState } from "@/lib/user-settings";
import { ClerkProvider } from "./clerk-provider";
import { AuthenticatedLocaleSync } from "./locale-provider";
import { ThemeProvider } from "./theme-provider";
import { TooltipProvider } from "./tooltip-provider";

/**
 * Composes authentication, theme, tooltip, and toast providers under the document locale owner.
 *
 * @param props - Application content and server-loaded user settings.
 * @returns Application provider tree.
 */
export function AppProviders({
  children,
  initialSettingsState,
  initialUiPreferences,
}: {
  /** Application content. */
  children: React.ReactNode;
  /** Server-loaded settings, or `null` for anonymous or unavailable state. */
  initialSettingsState: UserSettingsState | null;
  /** Server-loaded browser interface preferences. */
  initialUiPreferences: UiPreferences;
}) {
  return (
    <InitialUiPreferencesContext.Provider value={initialUiPreferences}>
      <ClerkProvider>
        <AuthenticatedLocaleSync initialSettingsState={initialSettingsState} />
        <ThemeProvider initialSettingsState={initialSettingsState}>
          <TooltipProvider>
            {children}
            <Toaster
              closeButton
              position="bottom-right"
              theme="system"
              toastOptions={{
                classNames: {
                  closeButton:
                    "border-border bg-popover text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  error: "border-destructive",
                  toast:
                    "border-border bg-popover text-popover-foreground shadow-lg",
                },
              }}
            />
          </TooltipProvider>
        </ThemeProvider>
      </ClerkProvider>
    </InitialUiPreferencesContext.Provider>
  );
}
