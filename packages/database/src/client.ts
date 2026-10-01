import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema/index.js";

/** Configuration required to create the shared database client. */
export type DatabaseConfig = {
  /** PostgreSQL connection URL. */
  databaseUrl: string;
};

/**
 * Creates a Drizzle client with the Pocket Trash schema attached.
 *
 * @param config - Database connection configuration.
 * @returns A schema-aware Drizzle database client.
 * @throws When the database URL is empty.
 */
export function createDb({ databaseUrl }: DatabaseConfig) {
  if (!databaseUrl) {
    throw new Error("Database configuration requires databaseUrl.");
  }

  return drizzle({
    connection: databaseUrl,
    schema,
  });
}

/** Schema-aware database client returned by {@link createDb}. */
export type Database = ReturnType<typeof createDb>;
