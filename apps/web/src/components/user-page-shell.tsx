import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import type * as React from "react";
import { AppShell } from "@/components/app-shell";
import { useLocale } from "@/providers/locale-provider";

/**
 * Renders a user-account page inside the shared application shell.
 *
 * @param props - User page shell properties.
 * @param props.children - User page content.
 * @param props.title - Current user page title.
 * @returns The user-account page layout.
 * @throws {Error} If the required locale provider is missing.
 */
export function UserPageShell({
  children,
  title,
}: {
  /** User page content. */
  children: React.ReactNode;
  /** Current user page title. */
  title: string;
}) {
  const { locale } = useLocale();
  /**
   * Formats a user-navigation translation for the active locale.
   *
   * @param key - User-navigation localization key.
   * @returns The localized user-navigation text.
   */
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
