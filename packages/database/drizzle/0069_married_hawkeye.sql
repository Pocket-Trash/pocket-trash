DELETE FROM "collection_item"
WHERE "id" IN (
	SELECT "id" FROM "collection_slider"
	UNION SELECT "id" FROM "collection_slider_plate"
	UNION SELECT "id" FROM "collection_slider_insert"
);--> statement-breakpoint
ALTER TABLE "product_included_component" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_insert_click_option" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_insert_magnet_group" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_insert_magnet_offer" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_insert_magnet_slot" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_slider_insert_offer" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "product_included_component" CASCADE;--> statement-breakpoint
DROP TABLE "product_insert_click_option" CASCADE;--> statement-breakpoint
DROP TABLE "product_insert_magnet_group" CASCADE;--> statement-breakpoint
DROP TABLE "product_insert_magnet_offer" CASCADE;--> statement-breakpoint
DROP TABLE "product_insert_magnet_slot" CASCADE;--> statement-breakpoint
DROP TABLE "product_slider_insert_offer" CASCADE;--> statement-breakpoint
DELETE FROM "product"
USING "product_types"
WHERE "product"."product_type_id" = "product_types"."id"
AND "product_types"."slug" IN ('slider', 'slider-plate', 'slider-insert');--> statement-breakpoint
ALTER TABLE "product_slider" DROP CONSTRAINT "product_slider_magnet_system_valid";--> statement-breakpoint
ALTER TABLE "product_slider_insert" DROP CONSTRAINT "product_slider_insert_measurements_positive";--> statement-breakpoint
ALTER TABLE "product_slider" ADD COLUMN "uses_inserts" boolean NOT NULL;--> statement-breakpoint
ALTER TABLE "product_slider" ADD COLUMN "included_insert_product_id" bigint;--> statement-breakpoint
ALTER TABLE "product_slider" ADD CONSTRAINT "product_slider_included_insert_product_id_product_id_fk" FOREIGN KEY ("included_insert_product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_slider_included_insert_idx" ON "product_slider" USING btree ("included_insert_product_id");--> statement-breakpoint
ALTER TABLE "product_slider" DROP COLUMN "magnet_system";--> statement-breakpoint
ALTER TABLE "product_slider_insert" DROP COLUMN "weight_g";--> statement-breakpoint
ALTER TABLE "product_slider_insert" DROP COLUMN "length_mm";--> statement-breakpoint
ALTER TABLE "product_slider_insert" DROP COLUMN "width_mm";--> statement-breakpoint
ALTER TABLE "product_slider_insert" DROP COLUMN "thickness_mm";--> statement-breakpoint
ALTER TABLE "product_slider" ADD CONSTRAINT "product_slider_insert_choice_consistent" CHECK ("product_slider"."uses_inserts" or "product_slider"."included_insert_product_id" is null);--> statement-breakpoint
ALTER TABLE "product_slider" ADD CONSTRAINT "product_slider_included_insert_distinct" CHECK ("product_slider"."included_insert_product_id" is null or "product_slider"."included_insert_product_id" <> "product_slider"."id");
