import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema/index.js";

export type DatabaseConfig = {
  databaseUrl: string;
};

export function createDb({ databaseUrl }: DatabaseConfig) {
  if (!databaseUrl) {
    throw new Error("Database configuration requires databaseUrl.");
  }

  return drizzle({
    connection: databaseUrl,
    schema,
  });
}

export type Database = ReturnType<typeof createDb>;
