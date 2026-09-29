import { ClerkLoaded, ClerkLoading, SignIn } from "@clerk/tanstack-react-start";
import { AuthPageSkeleton } from "@/components/skeletons/auth-page-skeleton";
import { clientEnv } from "@/env/client";

export function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4 py-10 text-foreground">
      <ClerkLoading>
        <AuthPageSkeleton />
      </ClerkLoading>
      <ClerkLoaded>
        <SignIn signUpUrl={clientEnv.VITE_CLERK_SIGN_UP_URL} />
      </ClerkLoaded>
    </main>
  );
}
