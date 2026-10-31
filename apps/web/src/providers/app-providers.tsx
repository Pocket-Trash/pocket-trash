import type React from "react";
import { Toaster } from "sonner";
import {
  InitialUiPreferencesContext,
  type UiPreferences,
} from "@/lib/ui-preferences";
import { ClerkProvider } from "./clerk-provider";
import { ThemeProvider } from "./theme-provider";
import { TooltipProvider } from "./tooltip-provider";
import { UserSettingsProvider } from "./user-settings-provider";

/**
 * Composes authentication, isolated settings synchronization, theme, tooltips, and toasts under the document locale owner.
 *
 * @param props - Application content and server-loaded user settings.
 * @returns Application provider tree.
 */
export function AppProviders({
  children,
  initialUiPreferences,
}: {
  /** Application content. */
  children: React.ReactNode;
  /** Server-loaded browser interface preferences. */
  initialUiPreferences: UiPreferences;
}) {
  return (
    <InitialUiPreferencesContext.Provider value={initialUiPreferences}>
      <ClerkProvider>
        <UserSettingsProvider />
        <ThemeProvider>
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
