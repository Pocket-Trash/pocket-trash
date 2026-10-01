import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Runtime environment values consumed by the database package.
 *
 * @internal
 */
export type DatabaseRuntimeEnv = {
  /** Optional PostgreSQL connection URL. */
  DATABASE_URL?: string;
};

/**
 * Validates database environment values supplied by a server runtime.
 *
 * @param runtimeEnv - Raw runtime environment values.
 * @returns Validated database environment values.
 * @throws When a supplied environment value is invalid.
 * @internal
 */
export function createDatabaseEnv(runtimeEnv: DatabaseRuntimeEnv) {
  return createEnv({
    emptyStringAsUndefined: true,
    isServer: true,
    runtimeEnvStrict: {
      DATABASE_URL: runtimeEnv.DATABASE_URL,
    },
    server: {
      DATABASE_URL: z.string().min(1).url().optional(),
    },
  });
}
