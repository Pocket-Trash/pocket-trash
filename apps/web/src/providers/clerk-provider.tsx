import { esMX } from "@clerk/localizations";
import { ClerkProvider as TanStackClerkProvider } from "@clerk/tanstack-react-start";
import type { SupportedLocale } from "@pocket-trash/localizations";
import type * as React from "react";
import { clientEnv } from "@/env/client";
import { useLocale } from "./locale-provider";

/**
 * Configures Clerk with the active locale and application design tokens.
 *
 * @param props - Application content requiring Clerk context.
 * @returns Configured Clerk provider.
 * @throws When rendered outside `LocaleProvider`.
 */
export function ClerkProvider({
  children,
}: {
  /** Application content. */
  children: React.ReactNode;
}) {
  const { locale } = useLocale();

  return (
    <TanStackClerkProvider
      appearance={{
        theme: "simple",
        variables: {
          borderRadius: "var(--radius)",
          colorBackground: "var(--card)",
          colorBorder: "var(--border)",
          colorDanger: "var(--destructive)",
          colorForeground: "var(--card-foreground)",
          colorInput: "var(--input)",
          colorInputForeground: "var(--foreground)",
          colorModalBackdrop: "rgb(0 0 0 / 55%)",
          colorMuted: "var(--muted)",
          colorMutedForeground: "var(--muted-foreground)",
          colorNeutral: "var(--foreground)",
          colorPrimary: "var(--primary)",
          colorPrimaryForeground: "var(--primary-foreground)",
          colorRing: "var(--ring)",
          colorShadow: "var(--shadow-color)",
          fontFamily: "var(--font-sans)",
          fontFamilyButtons: "var(--font-sans)",
          fontFamilyMono: "var(--font-mono)",
        },
      }}
      localization={clerkLocalization(locale)}
      publishableKey={clientEnv.VITE_CLERK_PUBLISHABLE_KEY}
      signUpUrl={clientEnv.VITE_CLERK_SIGN_UP_URL}
    >
      {children}
    </TanStackClerkProvider>
  );
}

/**
 * Maps an application locale to Clerk's optional translation bundle.
 *
 * @param locale - Active application locale.
 * @returns Spanish Clerk translations, or `undefined` for Clerk's English default.
 */
function clerkLocalization(locale: SupportedLocale) {
  return locale === "es-MX" ? esMX : undefined;
}
