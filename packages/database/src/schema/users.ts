import { bigint, pgTable, text } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity({ startWith: 1000 }),
  clerkId: text("clerk_id").notNull().unique(),
});

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
