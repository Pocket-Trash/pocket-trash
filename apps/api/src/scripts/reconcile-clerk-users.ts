import { pathToFileURL } from "node:url";
import { createClerkClient } from "@clerk/backend";
import {
  createConsoleTransport,
  createLogger,
  loggerValues,
} from "@package/logger";
import { createServices, type UsersService } from "@package/services";

type ClerkUser = {
  id: string;
  updatedAt: number;
  username: string | null;
};

type ClerkUsersClient = {
  getUserList(input: { limit: number; offset: number }): Promise<{
    data: ClerkUser[];
    totalCount: number;
  }>;
};

export type ReconciliationCounts = {
  examined: number;
  failed: number;
  inserted: number;
  unchanged: number;
  updated: number;
};

export async function reconcileClerkUsers(
  clerk: ClerkUsersClient,
  users: Pick<UsersService, "syncFromClerk">,
): Promise<ReconciliationCounts> {
  const counts: ReconciliationCounts = {
    examined: 0,
    failed: 0,
    inserted: 0,
    unchanged: 0,
    updated: 0,
  };
  const limit = 100;

  for (let offset = 0; ; ) {
    const page = await clerk.getUserList({ limit, offset });
    for (const user of page.data) {
      counts.examined += 1;
      try {
        if (!user.username) throw new Error("Clerk user has no username.");
        const result = await users.syncFromClerk({
          clerkId: user.id,
          clerkUpdatedAt: new Date(user.updatedAt),
          username: user.username,
        });
        counts[result] += 1;
      } catch {
        counts.failed += 1;
      }
    }
    offset += page.data.length;
    if (page.data.length === 0 || offset >= page.totalCount) break;
  }

  return counts;
}

async function main() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  if (!secretKey || !databaseUrl) {
    throw new Error("CLERK_SECRET_KEY and DATABASE_URL are required.");
  }

  const logger = createLogger({
    app: loggerValues.apps.api,
    environment: process.env.APP_ENV ?? "reconciliation",
    transports: [createConsoleTransport()],
  });
  const services = createServices();
  services.configure({ db: { databaseUrl }, logger });
  const clerk = createClerkClient({ secretKey });
  const counts = await reconcileClerkUsers(clerk.users, services.db.users);
  process.stdout.write(`${JSON.stringify(counts)}\n`);
  if (counts.failed > 0) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
