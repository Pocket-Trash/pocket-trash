import { createHash } from "node:crypto";
import type { Logger } from "@package/logger";

export function hashLogIdentifier(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

// Database errors may embed SQL parameters. Log a stable failure while preserving
// the original exception for the caller's existing protocol/error handling.
export async function loggedMutation<T>(
  logger: Logger,
  name: string,
  action: () => Promise<T>,
  data?: Parameters<Logger["operation"]>[2],
): Promise<T> {
  let failure: { error: unknown } | undefined;
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
