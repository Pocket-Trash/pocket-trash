import type { UsersService } from "@package/services";

/** Paginated Clerk user lookup used by orphan reconciliation. */
type ClerkUsers = {
  /**
   * Lists one page of Clerk users.
   *
   * @param input - Page size and zero-based offset.
   * @returns Clerk identifiers and total user count.
   * @rejects When Clerk cannot list users.
   */
  getUserList(input: {
    /** Maximum users requested for the page. */
    limit: number;
    /** Number of users skipped before the page. */
    offset: number;
  }): Promise<{
    /** Clerk users in the requested page. */
    data: {
      /** Clerk user identifier. */
      id: string;
    }[];
    /** Total Clerk users across all pages. */
    totalCount: number;
  }>;
};

/**
 * Finds database users whose Clerk identities no longer exist.
 *
 * @param clerk - Paginated Clerk user client.
 * @param users - Database user service.
 * @returns Database Clerk identifiers absent from Clerk.
 * @rejects When Clerk or database user lookup fails.
 */
export async function findClerkOrphans(
  clerk: ClerkUsers,
  users: Pick<UsersService, "listClerkIds">,
): Promise<string[]> {
  const clerkIds = new Set<string>();
  const limit = 100;
  for (let offset = 0; ; ) {
    const page = await clerk.getUserList({ limit, offset });
    for (const user of page.data) clerkIds.add(user.id);
    offset += page.data.length;
    if (page.data.length === 0 || offset >= page.totalCount) break;
  }
  return (await users.listClerkIds()).filter((id) => !clerkIds.has(id));
}
