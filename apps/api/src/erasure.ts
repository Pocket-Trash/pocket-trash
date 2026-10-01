import { isClerkAPIResponseError } from "@clerk/backend/errors";
import {
  ErasureOperationError,
  type ErasureOperations,
  type ErasureService,
  type StorageService,
} from "@package/services";

/** Milliseconds in a 24-hour retention day. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Clerk user operations needed by account erasure. */
type ClerkUsers = {
  /**
   * Deletes a Clerk user.
   *
   * @param userId - Clerk user identifier.
   * @returns Clerk deletion result.
   * @rejects When Clerk cannot delete the user.
   */
  deleteUser(userId: string): Promise<unknown>;
  /**
   * Loads a Clerk user for absence verification.
   *
   * @param userId - Clerk user identifier.
   * @returns Clerk user result when present.
   * @rejects When Clerk cannot load the user, including not-found responses.
   */
  getUser(userId: string): Promise<unknown>;
};

/**
 * Creates the ordered external operations used by the erasure state machine.
 *
 * @param input - Clerk, database, storage, and clock dependencies.
 * @returns Erasure operations for snapshot, inaccessibility, deletion, and verification steps.
 */
export function createErasureOperations(input: {
  /** Clerk user client. */
  clerk: ClerkUsers;
  /** Database erasure service. */
  erasure: Pick<ErasureService, "eraseDatabase" | "makeAccountInaccessible">;
  /**
   * Returns the current time for retention expirations.
   *
   * @returns Current wall-clock time.
   */
  now?: () => Date;
  /** Storage erasure service. */
  storage: Pick<
    StorageService,
    "eraseAccountObjects" | "snapshotErasureTargets"
  >;
}): ErasureOperations {
  const now = input.now ?? (() => new Date());
  return {
    /**
     * Captures account-owned storage paths before destructive steps.
     *
     * @param request - Active erasure request.
     * @rejects When the target identity is missing or snapshotting fails.
     */
    snapshot: async (request) => {
      await input.storage.snapshotErasureTargets(
        request.id,
        targetClerkId(request.targetClerkId),
      );
    },
    /**
     * Makes the account inaccessible in the application database.
     *
     * @param request - Active erasure request.
     * @rejects When the target identity is missing or the database update fails.
     */
    inaccessible: async (request) => {
      await input.erasure.makeAccountInaccessible(
        targetClerkId(request.targetClerkId),
      );
    },
    /**
     * Erases captured account-owned storage objects.
     *
     * @param request - Active erasure request.
     * @returns Provider retention exceptions from storage erasure.
     * @rejects When the target identity is missing or storage erasure fails.
     */
    storage: async (request) =>
      await input.storage.eraseAccountObjects(
        request.id,
        targetClerkId(request.targetClerkId),
      ),
    /**
     * Erases the account's application database records.
     *
     * @param request - Active erasure request.
     * @rejects When the target identity is missing or database erasure fails.
     */
    database: async (request) => {
      await input.erasure.eraseDatabase(targetClerkId(request.targetClerkId));
    },
    /**
     * Deletes the Clerk identity and returns known provider retention windows.
     *
     * @param request - Active erasure request.
     * @returns External-provider retention exceptions with expiration timestamps.
     * @rejects When the target identity is missing or Clerk deletion fails.
     */
    providers: async (request) => {
      await deleteClerkUser(input.clerk, targetClerkId(request.targetClerkId));
      const deletedAt = now();
      return {
        exceptions: [
          exception("axiom_30_days", deletedAt, 30),
          exception("clerk_deletion_3_days", deletedAt, 3),
          exception("clerk_logs_30_days", deletedAt, 30),
          exception("cloudflare_logs_7_days", deletedAt, 7),
          exception("neon_history_6_hours", deletedAt, 0.25),
          exception("vercel_logs_1_hour", deletedAt, 1 / 24),
        ],
      };
    },
    /**
     * Verifies that the Clerk identity remains absent.
     *
     * @param request - Active erasure request.
     * @rejects When the target identity is missing or Clerk still returns the user.
     */
    verify: async (request) => {
      await assertClerkUserAbsent(
        input.clerk,
        targetClerkId(request.targetClerkId),
      );
    },
  };
}

/**
 * Processes due erasure requests until the queue empties or the batch limit is reached.
 *
 * @param erasure - Erasure queue service.
 * @param operations - Runtime operations for each erasure step.
 * @param maximum - Maximum requests processed in this invocation.
 * @returns Number of requests advanced.
 * @rejects When queue processing fails.
 * @default 25
 */
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

/**
 * Deletes a Clerk user while treating an already-missing identity as success.
 *
 * @param clerk - Clerk user client.
 * @param clerkId - Clerk user identifier.
 * @rejects {ErasureOperationError} When Clerk deletion fails for a reason other than not found.
 */
async function deleteClerkUser(clerk: ClerkUsers, clerkId: string) {
  try {
    await clerk.deleteUser(clerkId);
  } catch (error) {
    if (isMissing(error)) return;
    throw new ErasureOperationError("clerk_delete_failed");
  }
}

/**
 * Requires a Clerk user to be absent.
 *
 * @param clerk - Clerk user client.
 * @param clerkId - Clerk user identifier.
 * @rejects {ErasureOperationError} When Clerk returns the user or verification otherwise fails.
 */
async function assertClerkUserAbsent(clerk: ClerkUsers, clerkId: string) {
  try {
    await clerk.getUser(clerkId);
  } catch (error) {
    if (isMissing(error)) return;
    throw new ErasureOperationError("clerk_verification_failed");
  }
  throw new ErasureOperationError("clerk_verification_failed");
}

/**
 * Identifies Clerk API not-found failures.
 *
 * @param error - Candidate error.
 * @returns Whether the error is a Clerk 404 response.
 */
function isMissing(error: unknown) {
  return isClerkAPIResponseError(error) && error.status === 404;
}

/**
 * Requires an erasure request to retain its target Clerk identifier.
 *
 * @param value - Stored target Clerk identifier.
 * @returns Non-null Clerk identifier.
 * @throws {ErasureOperationError} When the request has no erasure subject.
 */
function targetClerkId(value: string | null): string {
  if (!value) throw new ErasureOperationError("missing_erasure_subject", false);
  return value;
}

/**
 * Builds a provider retention exception from a fractional-day duration.
 *
 * @param code - Stable retention exception code.
 * @param startedAt - Time deletion began.
 * @param days - Retention duration in days.
 * @returns Exception code and ISO expiration timestamp.
 */
function exception(code: string, startedAt: Date, days: number) {
  return {
    code,
    expiresAt: new Date(startedAt.getTime() + days * DAY_MS).toISOString(),
  };
}
