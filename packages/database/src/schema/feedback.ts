import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const feedbackCategories = [
  "product_type",
  "feature",
  "improvement",
  "bug",
] as const;

export const feedbackStatuses = [
  "pending",
  "requested",
  "planned",
  "in_progress",
  "completed",
  "merged",
  "denied",
  "canceled",
] as const;

export const feedbackNotificationTypes = ["submitted", "completed"] as const;

export type FeedbackCategory = (typeof feedbackCategories)[number];
export type FeedbackStatus = (typeof feedbackStatuses)[number];

export const feedback = pgTable(
  "feedback",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    submitterClerkId: text("submitter_clerk_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category", { enum: feedbackCategories }),
    status: text("status", { enum: feedbackStatuses })
      .default("pending")
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("feedback_submitter_status_idx").on(
      table.submitterClerkId,
      table.status,
    ),
    index("feedback_status_created_at_idx").on(table.status, table.createdAt),
    check(
      "feedback_title_length_valid",
      sql`char_length(${table.title}) between 1 and 120`,
    ),
    check(
      "feedback_description_length_valid",
      sql`char_length(${table.description}) between 1 and 5000`,
    ),
    check(
      "feedback_approved_category_required",
      sql`${table.status} in ('pending', 'denied') or ${table.category} is not null`,
    ),
  ],
);

export const feedbackVotes = pgTable(
  "feedback_votes",
  {
    feedbackId: bigint("feedback_id", { mode: "number" })
      .notNull()
      .references(() => feedback.id, { onDelete: "cascade" }),
    voterClerkId: text("voter_clerk_id").notNull(),
    isPermanent: boolean("is_permanent").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.feedbackId, table.voterClerkId] }),
    index("feedback_votes_voter_idx").on(table.voterClerkId),
  ],
);

export const feedbackNotifications = pgTable(
  "feedback_notifications",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    feedbackId: bigint("feedback_id", { mode: "number" })
      .notNull()
      .references(() => feedback.id, { onDelete: "cascade" }),
    type: text("type", { enum: feedbackNotificationTypes }).notNull(),
    readAt: timestamp("read_at", { mode: "date", withTimezone: true }),
    readByClerkId: text("read_by_clerk_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("feedback_notifications_created_at_idx").on(table.createdAt),
    check(
      "feedback_notifications_read_metadata_consistent",
      sql`num_nonnulls(${table.readAt}, ${table.readByClerkId}) in (0, 2)`,
    ),
  ],
);
