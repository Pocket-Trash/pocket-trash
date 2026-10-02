import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Durable lifecycle states for administrator-managed user access. */
export const userBanStatuses = [
  "pending_ban",
  "banned",
  "pending_unban",
  "unbanned",
] as const;

/** Durable user-ban lifecycle state. */
export type UserBanStatus = (typeof userBanStatuses)[number];

/** Application users mirrored from Clerk identity records. */
export const user = pgTable("users", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity({ startWith: 1000 }),
  clerkId: text("clerk_id").notNull().unique(),
  /** Provider timestamp used to ignore stale Clerk profile updates. */
  clerkUpdatedAt: timestamp("clerk_updated_at", {
    mode: "date",
    withTimezone: true,
  }),
  username: text("username"),
});

/** Current administrator-managed ban state for a user. */
export const userBan = pgTable(
  "user_ban",
  {
    userId: bigint("user_id", { mode: "number" })
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: userBanStatuses }).notNull(),
    reason: text("reason").notNull(),
    pendingBeforeStatus: text("pending_before_status", {
      enum: ["banned", "unbanned"],
    }),
    pendingRequestId: uuid("pending_request_id"),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "user_ban_status_valid",
      sql`${table.status} in ('pending_ban', 'banned', 'pending_unban', 'unbanned')`,
    ),
    check("user_ban_reason_nonblank", sql`length(btrim(${table.reason})) > 0`),
    check(
      "user_ban_pending_audit_valid",
      sql`(${table.status} in ('pending_ban', 'pending_unban')) = (${table.pendingRequestId} is not null)`,
    ),
  ],
);

/** Stored user row. */
export type User = typeof user.$inferSelect;
/** Values accepted when creating a user row. */
export type NewUser = typeof user.$inferInsert;
/** Stored user-ban row. */
export type UserBan = typeof userBan.$inferSelect;
/** Values accepted when creating a user-ban row. */
export type NewUserBan = typeof userBan.$inferInsert;
