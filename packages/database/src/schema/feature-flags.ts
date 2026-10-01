import {
  bigint,
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { featureFlagAudiences, featureFlagOverrideSources } from "./enums.js";
import { user } from "./users.js";

/** PostgreSQL enum for supported feature-flag audiences. */
export const featureFlagAudienceEnum = pgEnum(
  "feature_flag_audience",
  featureFlagAudiences,
);
/** PostgreSQL enum for supported feature-flag override sources. */
export const featureFlagOverrideSourceEnum = pgEnum(
  "feature_flag_override_source",
  featureFlagOverrideSources,
);

/** Feature-flag defaults and audience targeting rules. */
export const featureFlags = pgTable("feature_flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  audience: featureFlagAudienceEnum("audience").notNull(),
  defaultEnabled: boolean("default_enabled").notNull().default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archivedByClerkId: text("archived_by_clerk_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdByClerkId: text("created_by_clerk_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedByClerkId: text("updated_by_clerk_id"),
});

/** Per-user feature-flag decisions with provenance. */
export const featureFlagUserOverrides = pgTable(
  "feature_flag_user_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    flagId: uuid("flag_id")
      .notNull()
      .references(() => featureFlags.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    source: featureFlagOverrideSourceEnum("source").notNull(),
    enabled: boolean("enabled").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdByClerkId: text("created_by_clerk_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedByClerkId: text("updated_by_clerk_id"),
  },
  (table) => [
    unique("feature_flag_user_overrides_flag_user_source_unique").on(
      table.flagId,
      table.userId,
      table.source,
    ),
  ],
);

/** Stored feature flag row. */
export type FeatureFlag = typeof featureFlags.$inferSelect;
/** Values accepted when creating a feature flag row. */
export type NewFeatureFlag = typeof featureFlags.$inferInsert;
/** Stored feature flag user override row. */
export type FeatureFlagUserOverride =
  typeof featureFlagUserOverrides.$inferSelect;
/** Values accepted when creating a feature flag user override row. */
export type NewFeatureFlagUserOverride =
  typeof featureFlagUserOverrides.$inferInsert;
