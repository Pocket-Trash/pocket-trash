import { ClerkLoaded, ClerkLoading, SignUp } from "@clerk/tanstack-react-start";
import { AuthPageSkeleton } from "@/components/skeletons/auth-page-skeleton";
import { clientEnv } from "@/env/client";

/**
 * Renders Clerk's sign-up flow with its loading placeholder.
 *
 * @returns The sign-up page.
 */
export function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4 py-10 text-foreground">
      <ClerkLoading>
        <AuthPageSkeleton />
      </ClerkLoading>
      <ClerkLoaded>
        <SignUp signInUrl={clientEnv.VITE_CLERK_SIGN_IN_URL} />
      </ClerkLoaded>
    </main>
  );
}
