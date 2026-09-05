import { esMX } from "@clerk/localizations";
import { ClerkProvider as TanStackClerkProvider } from "@clerk/tanstack-react-start";
import { shadcn } from "@clerk/ui/themes";
import type { SupportedLocale } from "@pocket-trash/localizations";
import type * as React from "react";
import { clientEnv } from "@/env/client";
import { useLocale } from "./locale-provider";

export function ClerkProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();

  return (
    <TanStackClerkProvider
      appearance={{ theme: shadcn }}
      localization={clerkLocalization(locale)}
      publishableKey={clientEnv.VITE_CLERK_PUBLISHABLE_KEY}
      signUpUrl={clientEnv.VITE_CLERK_SIGN_UP_URL}
    >
      {children}
    </TanStackClerkProvider>
  );
}

function clerkLocalization(locale: SupportedLocale) {
  return locale === "es-MX" ? esMX : undefined;
}
