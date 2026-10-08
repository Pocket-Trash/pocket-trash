CREATE TYPE "public"."measurement_system" AS ENUM('metric', 'imperial');--> statement-breakpoint
ALTER TABLE "product_slider" RENAME COLUMN "weight_g" TO "weight_value";--> statement-breakpoint
ALTER TABLE "product_slider" RENAME COLUMN "length_mm" TO "length_value";--> statement-breakpoint
ALTER TABLE "product_slider" RENAME COLUMN "width_mm" TO "width_value";--> statement-breakpoint
ALTER TABLE "product_slider" RENAME COLUMN "thickness_mm" TO "thickness_value";--> statement-breakpoint
ALTER TABLE "product_spinner" RENAME COLUMN "weight_g" TO "weight_value";--> statement-breakpoint
ALTER TABLE "product_spinner" RENAME COLUMN "length_mm" TO "length_value";--> statement-breakpoint
ALTER TABLE "product_spinner" RENAME COLUMN "width_mm" TO "width_value";--> statement-breakpoint
ALTER TABLE "product_spinner" RENAME COLUMN "thickness_mm" TO "thickness_value";--> statement-breakpoint
ALTER TABLE "product_spinner" RENAME COLUMN "thickness_with_button_mm" TO "thickness_with_button_value";--> statement-breakpoint
ALTER TABLE "product_spinner" RENAME COLUMN "button_diameter_mm" TO "button_diameter_value";--> statement-breakpoint
ALTER TABLE "product_spinner" RENAME COLUMN "spin_diameter_mm" TO "spin_diameter_value";--> statement-breakpoint
ALTER TABLE "product_spinner_button" RENAME COLUMN "weight_g" TO "weight_value";--> statement-breakpoint
ALTER TABLE "product_spinner_button" RENAME COLUMN "diameter_mm" TO "diameter_value";--> statement-breakpoint
ALTER TABLE "product_spinner_button" RENAME COLUMN "thickness_mm" TO "thickness_value";--> statement-breakpoint
ALTER TABLE "product_slider" DROP CONSTRAINT "product_slider_measurements_positive";--> statement-breakpoint
ALTER TABLE "product_spinner" DROP CONSTRAINT "product_spinner_measurements_positive";--> statement-breakpoint
ALTER TABLE "product_spinner_button" DROP CONSTRAINT "product_spinner_button_measurements_positive";--> statement-breakpoint
ALTER TABLE "product_slider" ADD COLUMN "weight_unit" "weight_unit";--> statement-breakpoint
ALTER TABLE "product_slider" ADD COLUMN "length_unit" "dimension_unit";--> statement-breakpoint
ALTER TABLE "product_slider" ADD COLUMN "width_unit" "dimension_unit";--> statement-breakpoint
ALTER TABLE "product_slider" ADD COLUMN "thickness_unit" "dimension_unit";--> statement-breakpoint
ALTER TABLE "product_spinner" ADD COLUMN "weight_unit" "weight_unit";--> statement-breakpoint
ALTER TABLE "product_spinner" ADD COLUMN "length_unit" "dimension_unit";--> statement-breakpoint
ALTER TABLE "product_spinner" ADD COLUMN "width_unit" "dimension_unit";--> statement-breakpoint
ALTER TABLE "product_spinner" ADD COLUMN "thickness_unit" "dimension_unit";--> statement-breakpoint
ALTER TABLE "product_spinner" ADD COLUMN "thickness_with_button_unit" "dimension_unit";--> statement-breakpoint
ALTER TABLE "product_spinner" ADD COLUMN "button_diameter_unit" "dimension_unit";--> statement-breakpoint
ALTER TABLE "product_spinner" ADD COLUMN "spin_diameter_unit" "dimension_unit";--> statement-breakpoint
ALTER TABLE "product_spinner_button" ADD COLUMN "weight_unit" "weight_unit";--> statement-breakpoint
ALTER TABLE "product_spinner_button" ADD COLUMN "diameter_unit" "dimension_unit";--> statement-breakpoint
ALTER TABLE "product_spinner_button" ADD COLUMN "thickness_unit" "dimension_unit";--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "measurement_system" "measurement_system" DEFAULT 'metric' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN "dimension_unit";--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN "weight_unit";--> statement-breakpoint
UPDATE "product_slider" SET "weight_unit" = 'g' WHERE "weight_value" IS NOT NULL;--> statement-breakpoint
UPDATE "product_slider" SET "length_unit" = 'mm' WHERE "length_value" IS NOT NULL;--> statement-breakpoint
UPDATE "product_slider" SET "width_unit" = 'mm' WHERE "width_value" IS NOT NULL;--> statement-breakpoint
UPDATE "product_slider" SET "thickness_unit" = 'mm' WHERE "thickness_value" IS NOT NULL;--> statement-breakpoint
UPDATE "product_spinner" SET "weight_unit" = 'g' WHERE "weight_value" IS NOT NULL;--> statement-breakpoint
UPDATE "product_spinner" SET "length_unit" = 'mm' WHERE "length_value" IS NOT NULL;--> statement-breakpoint
UPDATE "product_spinner" SET "width_unit" = 'mm' WHERE "width_value" IS NOT NULL;--> statement-breakpoint
UPDATE "product_spinner" SET "thickness_unit" = 'mm' WHERE "thickness_value" IS NOT NULL;--> statement-breakpoint
UPDATE "product_spinner" SET "thickness_with_button_unit" = 'mm' WHERE "thickness_with_button_value" IS NOT NULL;--> statement-breakpoint
UPDATE "product_spinner" SET "button_diameter_unit" = 'mm' WHERE "button_diameter_value" IS NOT NULL;--> statement-breakpoint
UPDATE "product_spinner" SET "spin_diameter_unit" = 'mm' WHERE "spin_diameter_value" IS NOT NULL;--> statement-breakpoint
UPDATE "product_spinner_button" SET "weight_unit" = 'g' WHERE "weight_value" IS NOT NULL;--> statement-breakpoint
UPDATE "product_spinner_button" SET "diameter_unit" = 'mm' WHERE "diameter_value" IS NOT NULL;--> statement-breakpoint
UPDATE "product_spinner_button" SET "thickness_unit" = 'mm' WHERE "thickness_value" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "product_slider" ADD CONSTRAINT "product_slider_weight_consistent" CHECK (("product_slider"."weight_value" is null and "product_slider"."weight_unit" is null) or ("product_slider"."weight_value" > 0 and "product_slider"."weight_unit" is not null));--> statement-breakpoint
ALTER TABLE "product_slider" ADD CONSTRAINT "product_slider_length_consistent" CHECK (("product_slider"."length_value" is null and "product_slider"."length_unit" is null) or ("product_slider"."length_value" > 0 and "product_slider"."length_unit" is not null));--> statement-breakpoint
ALTER TABLE "product_slider" ADD CONSTRAINT "product_slider_width_consistent" CHECK (("product_slider"."width_value" is null and "product_slider"."width_unit" is null) or ("product_slider"."width_value" > 0 and "product_slider"."width_unit" is not null));--> statement-breakpoint
ALTER TABLE "product_slider" ADD CONSTRAINT "product_slider_thickness_consistent" CHECK (("product_slider"."thickness_value" is null and "product_slider"."thickness_unit" is null) or ("product_slider"."thickness_value" > 0 and "product_slider"."thickness_unit" is not null));--> statement-breakpoint
ALTER TABLE "product_spinner" ADD CONSTRAINT "product_spinner_weight_consistent" CHECK (("product_spinner"."weight_value" is null and "product_spinner"."weight_unit" is null) or ("product_spinner"."weight_value" > 0 and "product_spinner"."weight_unit" is not null));--> statement-breakpoint
ALTER TABLE "product_spinner" ADD CONSTRAINT "product_spinner_length_consistent" CHECK (("product_spinner"."length_value" is null and "product_spinner"."length_unit" is null) or ("product_spinner"."length_value" > 0 and "product_spinner"."length_unit" is not null));--> statement-breakpoint
ALTER TABLE "product_spinner" ADD CONSTRAINT "product_spinner_width_consistent" CHECK (("product_spinner"."width_value" is null and "product_spinner"."width_unit" is null) or ("product_spinner"."width_value" > 0 and "product_spinner"."width_unit" is not null));--> statement-breakpoint
ALTER TABLE "product_spinner" ADD CONSTRAINT "product_spinner_thickness_consistent" CHECK (("product_spinner"."thickness_value" is null and "product_spinner"."thickness_unit" is null) or ("product_spinner"."thickness_value" > 0 and "product_spinner"."thickness_unit" is not null));--> statement-breakpoint
ALTER TABLE "product_spinner" ADD CONSTRAINT "product_spinner_thickness_with_button_consistent" CHECK (("product_spinner"."thickness_with_button_value" is null and "product_spinner"."thickness_with_button_unit" is null) or ("product_spinner"."thickness_with_button_value" > 0 and "product_spinner"."thickness_with_button_unit" is not null));--> statement-breakpoint
ALTER TABLE "product_spinner" ADD CONSTRAINT "product_spinner_button_diameter_consistent" CHECK (("product_spinner"."button_diameter_value" is null and "product_spinner"."button_diameter_unit" is null) or ("product_spinner"."button_diameter_value" > 0 and "product_spinner"."button_diameter_unit" is not null));--> statement-breakpoint
ALTER TABLE "product_spinner" ADD CONSTRAINT "product_spinner_spin_diameter_consistent" CHECK (("product_spinner"."spin_diameter_value" is null and "product_spinner"."spin_diameter_unit" is null) or ("product_spinner"."spin_diameter_value" > 0 and "product_spinner"."spin_diameter_unit" is not null));--> statement-breakpoint
ALTER TABLE "product_spinner_button" ADD CONSTRAINT "product_spinner_button_weight_consistent" CHECK (("product_spinner_button"."weight_value" is null and "product_spinner_button"."weight_unit" is null) or ("product_spinner_button"."weight_value" > 0 and "product_spinner_button"."weight_unit" is not null));--> statement-breakpoint
ALTER TABLE "product_spinner_button" ADD CONSTRAINT "product_spinner_button_diameter_consistent" CHECK (("product_spinner_button"."diameter_value" is null and "product_spinner_button"."diameter_unit" is null) or ("product_spinner_button"."diameter_value" > 0 and "product_spinner_button"."diameter_unit" is not null));--> statement-breakpoint
ALTER TABLE "product_spinner_button" ADD CONSTRAINT "product_spinner_button_thickness_consistent" CHECK (("product_spinner_button"."thickness_value" is null and "product_spinner_button"."thickness_unit" is null) or ("product_spinner_button"."thickness_value" > 0 and "product_spinner_button"."thickness_unit" is not null));
