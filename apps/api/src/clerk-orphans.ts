import type { UsersService } from "@package/services";

type ClerkUsers = {
  getUserList(input: { limit: number; offset: number }): Promise<{
    data: { id: string }[];
    totalCount: number;
  }>;
};

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
