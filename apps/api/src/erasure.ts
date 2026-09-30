import { isClerkAPIResponseError } from "@clerk/backend/errors";
import {
  ErasureOperationError,
  type ErasureOperations,
  type ErasureService,
  type StorageService,
} from "@package/services";

const DAY_MS = 24 * 60 * 60 * 1000;

type ClerkUsers = {
  deleteUser(userId: string): Promise<unknown>;
  getUser(userId: string): Promise<unknown>;
};

export function createErasureOperations(input: {
  clerk: ClerkUsers;
  erasure: Pick<ErasureService, "eraseDatabase" | "makeAccountInaccessible">;
  now?: () => Date;
  storage: Pick<
    StorageService,
    "eraseAccountObjects" | "snapshotErasureTargets"
  >;
}): ErasureOperations {
  const now = input.now ?? (() => new Date());
  return {
    snapshot: async (request) => {
      await input.storage.snapshotErasureTargets(
        request.id,
        targetClerkId(request.targetClerkId),
      );
    },
    inaccessible: async (request) => {
      await input.erasure.makeAccountInaccessible(
        targetClerkId(request.targetClerkId),
      );
    },
    storage: async (request) =>
      await input.storage.eraseAccountObjects(
        request.id,
        targetClerkId(request.targetClerkId),
      ),
    database: async (request) => {
      await input.erasure.eraseDatabase(targetClerkId(request.targetClerkId));
    },
    providers: async (request) => {
      await deleteClerkUser(input.clerk, targetClerkId(request.targetClerkId));
      const deletedAt = now();
      return {
        exceptions: [
          exception("axiom_30_days", deletedAt, 30),
          exception("clerk_logs_30_days", deletedAt, 30),
          exception("cloudflare_logs_7_days", deletedAt, 7),
          exception("neon_history_6_hours", deletedAt, 0.25),
          exception("vercel_logs_1_hour", deletedAt, 1 / 24),
        ],
      };
    },
    verify: async (request) => {
      await assertClerkUserAbsent(
        input.clerk,
        targetClerkId(request.targetClerkId),
      );
    },
  };
}

export async function drainErasureQueue(
  erasure: Pick<ErasureService, "processDue">,
  operations: ErasureOperations,
  maximum = 25,
): Promise<number> {
  let processed = 0;
  while (processed < maximum && (await erasure.processDue(operations))) {
    processed += 1;
  }
  return processed;
}

async function deleteClerkUser(clerk: ClerkUsers, clerkId: string) {
  try {
    await clerk.deleteUser(clerkId);
  } catch (error) {
    if (isMissing(error)) return;
    throw new ErasureOperationError("clerk_delete_failed");
  }
}

async function assertClerkUserAbsent(clerk: ClerkUsers, clerkId: string) {
  try {
    await clerk.getUser(clerkId);
  } catch (error) {
    if (isMissing(error)) return;
    throw new ErasureOperationError("clerk_verification_failed");
  }
  throw new ErasureOperationError("clerk_verification_failed");
}

function isMissing(error: unknown) {
  return isClerkAPIResponseError(error) && error.status === 404;
}

function targetClerkId(value: string | null): string {
  if (!value) throw new ErasureOperationError("missing_erasure_subject", false);
  return value;
}

function exception(code: string, startedAt: Date, days: number) {
  return {
    code,
    expiresAt: new Date(startedAt.getTime() + days * DAY_MS).toISOString(),
  };
}
