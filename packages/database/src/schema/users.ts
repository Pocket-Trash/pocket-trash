import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Application users mirrored from Clerk identity records. */
export const user = pgTable("users", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity({ startWith: 1000 }),
  clerkId: text("clerk_id").notNull().unique(),
  clerkUpdatedAt: timestamp("clerk_updated_at", {
    mode: "date",
    withTimezone: true,
  }),
  username: text("username"),
});

/** Stored user row. */
export type User = typeof user.$inferSelect;
/** Values accepted when creating a user row. */
export type NewUser = typeof user.$inferInsert;
