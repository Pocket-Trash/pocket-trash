import { pathToFileURL } from "node:url";
import { createClerkClient } from "@clerk/backend";
import {
  createConsoleTransport,
  createLogger,
  loggerValues,
} from "@package/logger";
import { createServices, type UsersService } from "@package/services";

/** Clerk user fields synchronized into the application database. */
type ClerkUser = {
  /** Clerk user identifier. */
  id: string;
  /** Whether Clerk hosts a user-selected picture. */
  hasImage: boolean;
  /** Current Clerk-hosted picture or generated avatar URL. */
  imageUrl: string;
  /** Clerk update timestamp in Unix milliseconds. */
  updatedAt: number;
  /** Public username, or `null` when unset. */
  username: string | null;
};

/** Paginated Clerk user client used by reconciliation. */
type ClerkUsersClient = {
  /**
   * Lists one page of Clerk users.
   *
   * @param input - Page size and zero-based offset.
   * @returns Clerk users and total user count.
   * @rejects When Clerk cannot list users.
   */
  getUserList(input: {
    /** Maximum users requested for the page. */
    limit: number;
    /** Number of users skipped before the page. */
    offset: number;
  }): Promise<{
    /** Clerk users in the requested page. */
    data: ClerkUser[];
    /** Total Clerk users across all pages. */
    totalCount: number;
  }>;
};

/** Outcome counts for a complete Clerk-to-database reconciliation pass. */
export type ReconciliationCounts = {
  /** Clerk users examined. */
  examined: number;
  /** Users skipped after validation or synchronization failure. */
  failed: number;
  /** Database users inserted. */
  inserted: number;
  /** Database users already current. */
  unchanged: number;
  /** Existing database users updated. */
  updated: number;
};

/**
 * Reconciles every Clerk user into the application database in 100-user pages.
 *
 * Individual user failures are counted without stopping the remaining pass.
 *
 * @param clerk - Paginated Clerk user client.
 * @param users - Database user synchronization service.
 * @returns Aggregate reconciliation outcomes.
 * @rejects When Clerk page retrieval fails.
 */
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
          imageUrl: user.hasImage ? user.imageUrl : null,
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

/**
 * Runs the Clerk reconciliation CLI and prints its outcome counts.
 *
 * Individual synchronization failures set a nonzero process exit code.
 *
 * @rejects When required environment variables, service setup, Clerk page retrieval, or output fails.
 */
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
