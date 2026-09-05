import type * as React from "react";
import { Toaster } from "sonner";
import type { UserSettingsState } from "@/lib/user-settings";
import { ClerkProvider } from "./clerk-provider";
import { AuthenticatedLocaleSync, LocaleProvider } from "./locale-provider";
import { ThemeProvider } from "./theme-provider";
import { TooltipProvider } from "./tooltip-provider";

export function AppProviders({
  children,
  initialSettingsState,
}: {
  children: React.ReactNode;
  initialSettingsState: UserSettingsState | null;
}) {
  return (
    <LocaleProvider initialSettingsState={initialSettingsState}>
      <ClerkProvider>
        <AuthenticatedLocaleSync />
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
    </LocaleProvider>
  );
}
