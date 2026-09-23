import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import type * as React from "react";
import { AppShell } from "@/components/app-shell";
import { useLocale } from "@/providers/locale-provider";

export function UserPageShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);

  return (
    <AppShell
      breadcrumbItems={[{ label: t("web.navigation.user"), to: "/user" }]}
      title={title}
    >
      <section className="w-full max-w-5xl px-4 py-6 md:px-6">
        {children}
      </section>
    </AppShell>
  );
}
