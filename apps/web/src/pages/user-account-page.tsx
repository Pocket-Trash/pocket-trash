import { ClerkLoaded, ClerkLoading } from "@clerk/tanstack-react-start";
import {
  UserProfileAccountPanel,
  UserProfileProvider,
  UserProfileSecurityPanel,
} from "@clerk/ui/experimental";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPageShell } from "@/components/user-page-shell";
import { DeleteAccountSection } from "@/pages/delete-account-section";
import { useLocale } from "@/providers/locale-provider";

/**
 * Renders Clerk account controls and Pocket Trash account deletion.
 *
 * @returns The user account page.
 */
export function UserAccountPage() {
  const { locale } = useLocale();
  /**
   * Formats localized account copy.
   *
   * @param key - Translation key.
   * @returns The localized message.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);

  return (
    <UserPageShell section="account" title={t("web.navigation.account")}>
      <ClerkLoading>
        <UserProfileSkeleton />
      </ClerkLoading>
      <ClerkLoaded>
        <div className="[&_[id=linear]]:hidden">
          <UserProfileProvider>
            <UserProfileAccountPanel />
            <UserProfileSecurityPanel />
          </UserProfileProvider>
        </div>
        <DeleteAccountSection />
      </ClerkLoaded>
    </UserPageShell>
  );
}

/**
 * Renders the placeholder shown while Clerk loads the user profile.
 *
 * @returns The user-profile loading skeleton.
 */
function UserProfileSkeleton() {
  return (
    <div className="w-full max-w-4xl rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <div className="mt-8 grid gap-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
