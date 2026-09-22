import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
