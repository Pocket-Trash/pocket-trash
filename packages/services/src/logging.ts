import { createHash } from "node:crypto";
import type { Logger } from "@package/logger";

/**
 * Hashes a sensitive identifier for safe log correlation.
 *
 * @param value - Sensitive identifier to hash.
 * @returns SHA-256 digest prefixed with its algorithm name.
 * @internal
 */
export function hashLogIdentifier(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

/**
 * Logs a database mutation without exposing database error details.
 * The original failure is rethrown after the logger records a stable replacement.
 *
 * @param logger - Application logger used to record the operation.
 * @param name - Stable logger operation name.
 * @param action - Database mutation to execute.
 * @param data - Optional structured logger context.
 * @returns Mutation result.
 * @template T - Mutation result type.
 * @rejects With the original mutation or logger failure.
 * @internal
 */
export async function loggedMutation<T>(
  logger: Logger,
  name: string,
  action: () => Promise<T>,
  data?: Parameters<Logger["operation"]>[2],
): Promise<T> {
  let failure:
    | {
        /** Original mutation failure hidden from structured logs. */
        error: unknown;
      }
    | undefined;
  try {
    return await logger.operation(
      name,
      async () => {
        try {
          return await action();
        } catch (error) {
          failure = { error };
          // eslint-disable-next-line preserve-caught-error -- The original is rethrown below; attaching it here leaks SQL parameters into logs.
          throw new Error("Database mutation failed.");
        }
      },
      data,
    );
  } catch (error) {
    throw failure ? failure.error : error;
  }
}
