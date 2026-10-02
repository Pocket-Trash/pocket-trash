import { bigint, pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import {
  currencyCodes,
  dimensionUnits,
  themeModes,
  weightUnits,
} from "./enums.js";
import { user } from "./users.js";

/** PostgreSQL enum for supported currency codes. */
export const currencyCodeEnum = pgEnum("currency_code", currencyCodes);
/** PostgreSQL enum for supported dimension units. */
export const dimensionUnitEnum = pgEnum("dimension_unit", dimensionUnits);
/** PostgreSQL enum for supported theme modes. */
export const themeModeEnum = pgEnum("theme_mode", themeModes);
/** PostgreSQL enum for supported weight units. */
export const weightUnitEnum = pgEnum("weight_unit", weightUnits);

/** Display and localization preferences for one application user. */
export const userSettings = pgTable("user_settings", {
  userId: bigint("user_id", { mode: "number" })
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  currencyCode: currencyCodeEnum("currency_code").notNull().default("USD"),
  dimensionUnit: dimensionUnitEnum("dimension_unit").notNull().default("in"),
  /** Explicit supported locale for localized application text. */
  locale: text("locale"),
  theme: themeModeEnum("theme").notNull().default("system"),
  weightUnit: weightUnitEnum("weight_unit").notNull().default("g"),
});

/** Stored user settings row. */
export type UserSettings = typeof userSettings.$inferSelect;
/** Values accepted when creating a user settings row. */
export type NewUserSettings = typeof userSettings.$inferInsert;
