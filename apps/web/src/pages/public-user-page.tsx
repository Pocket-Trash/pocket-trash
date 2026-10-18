import { AppShell } from "@/components/app-shell";

/** Public user profile properties. */
type PublicUserPageProps = {
  /** Username shown as the page title. */
  username: string;
};

/**
 * Renders the intentionally empty initial public user profile.
 *
 * @param props - Public profile properties.
 * @param props.username - Username shown as the page title.
 * @returns The public user profile shell.
 */
export function PublicUserPage({ username }: PublicUserPageProps) {
  return (
    <AppShell title={username}>
      <main />
    </AppShell>
  );
}
