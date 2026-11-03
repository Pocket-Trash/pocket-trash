import { Client, type ClientConfig, Pool } from "@neondatabase/serverless";
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

  const url = new URL(databaseUrl);
  const local =
    url.hostname === "127.0.0.1" &&
    url.port === "54330" &&
    url.pathname === "/pocket_trash_e2e";
  const pool = new Pool({ connectionString: databaseUrl });
  // Neon overrides the constructor option, so select the local client on the pool.
  if (local) Object.assign(pool, { Client: LocalTestClient });
  return drizzle({
    client: pool,
    relations: schema.relations,
  });
}

/** Schema-aware database client returned by {@link createDb}. */
export type Database = ReturnType<typeof createDb>;

/** Neon transport for the disposable CI Postgres service through its loopback proxy. */
class LocalTestClient extends Client {
  /**
   * Keeps test transport settings on this connection, leaving remote pools unchanged.
   * @param config - Pool connection settings.
   */
  constructor(config?: ClientConfig) {
    super(config);
    /** Routes only to the disposable Compose Postgres service. */
    this.neonConfig.wsProxy = () => "127.0.0.1:54330/v1?address=postgres:5432";
    this.neonConfig.useSecureWebSocket = false;
    this.neonConfig.pipelineConnect = false;
  }
}
