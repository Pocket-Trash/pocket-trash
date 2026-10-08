DELETE FROM "collection_item"
WHERE "id" IN (
	SELECT "id" FROM "collection_slider"
	UNION SELECT "id" FROM "collection_slider_plate"
	UNION SELECT "id" FROM "collection_slider_insert"
);--> statement-breakpoint
DELETE FROM "product"
USING "product_types"
WHERE "product"."product_type_id" = "product_types"."id"
AND "product_types"."slug" IN ('slider', 'slider-plate', 'slider-insert');--> statement-breakpoint
ALTER TABLE "product_slider" DROP CONSTRAINT "product_slider_inherent_click_count_positive";--> statement-breakpoint
ALTER TABLE "product_slider" DROP CONSTRAINT "product_slider_setup_source_note_valid";--> statement-breakpoint
ALTER TABLE "product_slider" ADD COLUMN "magnet_layout" text;--> statement-breakpoint
ALTER TABLE "product_slider" DROP COLUMN "inherent_click_count";--> statement-breakpoint
ALTER TABLE "product_slider" DROP COLUMN "magnet_setup_source_note";--> statement-breakpoint
ALTER TABLE "product_slider" ADD CONSTRAINT "product_slider_magnet_layout_consistent" CHECK (("product_slider"."included_insert_product_id" is null and "product_slider"."magnet_layout" is not null) or ("product_slider"."included_insert_product_id" is not null and "product_slider"."magnet_layout" is null));--> statement-breakpoint
ALTER TABLE "product_slider" ADD CONSTRAINT "product_slider_magnet_layout_valid" CHECK ("product_slider"."magnet_layout" is null or "product_slider"."magnet_layout" in ('2x2', '2x3', '2x4'));
