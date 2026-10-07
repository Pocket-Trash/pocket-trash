import { defineConfig } from "drizzle-kit";
import { createDatabaseEnv } from "./src/env.schema.js";

/** Validated environment available to Drizzle Kit. */
const env = createDatabaseEnv({
  DATABASE_URL: process.env.DATABASE_URL,
});

export default defineConfig({
  dialect: "postgresql",
  out: process.env.MIGRATION_REPAIR_FOLDER ?? "./drizzle",
  schema: "./src/schema/index.ts",
  ...(env.DATABASE_URL
    ? {
        dbCredentials: {
          url: env.DATABASE_URL,
        },
      }
    : {}),
});
