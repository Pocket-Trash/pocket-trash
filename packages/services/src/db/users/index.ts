import type { Database, User } from "@package/database";
import { schema } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import { eq } from "drizzle-orm";
import { hashLogIdentifier } from "../../logging.js";

export type EnsureUserInput = {
  clerkId: string;
};

export type UsersService = {
  ensure(input: EnsureUserInput): Promise<User>;
  getByClerkId(clerkId: string): Promise<User | null>;
};

function assertClerkId(clerkId: string): void {
  if (!clerkId.trim()) {
    throw new Error("clerkId is required.");
  }
}

export function createUsersService(db: Database, logger: Logger): UsersService {
  return {
    async ensure({ clerkId }) {
      return await logger.operation(
        loggerMessages.database.users.ensure,
        async () => {
          assertClerkId(clerkId);

          const [user] = await db
            .insert(schema.user)
            .values({ clerkId })
            .onConflictDoUpdate({
              set: { clerkId },
              target: schema.user.clerkId,
            })
            .returning();

          if (!user) {
            throw new Error("Failed to ensure user.");
          }

          return user;
        },
        {
          attributes: {
            clerkIdHash: hashLogIdentifier(clerkId),
          },
        },
      );
    },
    async getByClerkId(clerkId) {
      return await logger.operation(
        loggerMessages.database.users.getByClerkId,
        async () => {
          assertClerkId(clerkId);

          const [user] = await db
            .select()
            .from(schema.user)
            .where(eq(schema.user.clerkId, clerkId))
            .limit(1);

          return user ?? null;
        },
        {
          attributes: {
            clerkIdHash: hashLogIdentifier(clerkId),
          },
        },
      );
    },
  };
}
