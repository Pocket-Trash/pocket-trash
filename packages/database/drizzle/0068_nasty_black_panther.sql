DELETE FROM "collection_item"
WHERE "id" IN (
	SELECT "id" FROM "collection_slider"
	UNION SELECT "id" FROM "collection_slider_plate"
	UNION SELECT "id" FROM "collection_slider_insert"
);--> statement-breakpoint
DELETE FROM "product_included_component"
WHERE "product_id" IN (
	SELECT "product"."id" FROM "product"
	INNER JOIN "product_types" ON "product"."product_type_id" = "product_types"."id"
	WHERE "product_types"."slug" IN ('slider', 'slider-plate', 'slider-insert')
)
OR "component_product_id" IN (
	SELECT "product"."id" FROM "product"
	INNER JOIN "product_types" ON "product"."product_type_id" = "product_types"."id"
	WHERE "product_types"."slug" IN ('slider', 'slider-plate', 'slider-insert')
);--> statement-breakpoint
DELETE FROM "product"
USING "product_types"
WHERE "product"."product_type_id" = "product_types"."id"
AND "product_types"."slug" IN ('slider', 'slider-plate', 'slider-insert');--> statement-breakpoint
ALTER TABLE "product_slider_plate" DROP CONSTRAINT "product_slider_plate_measurements_positive";--> statement-breakpoint
ALTER TABLE "product_slider" ADD COLUMN "included_plate_product_id" bigint;--> statement-breakpoint
ALTER TABLE "product_slider" ADD CONSTRAINT "product_slider_included_plate_product_id_product_id_fk" FOREIGN KEY ("included_plate_product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_slider_included_plate_idx" ON "product_slider" USING btree ("included_plate_product_id");--> statement-breakpoint
ALTER TABLE "product_slider_plate" DROP COLUMN "weight_g";--> statement-breakpoint
ALTER TABLE "product_slider_plate" DROP COLUMN "length_mm";--> statement-breakpoint
ALTER TABLE "product_slider_plate" DROP COLUMN "width_mm";--> statement-breakpoint
ALTER TABLE "product_slider_plate" DROP COLUMN "thickness_mm";--> statement-breakpoint
ALTER TABLE "product_slider" ADD CONSTRAINT "product_slider_included_plate_distinct" CHECK ("product_slider"."included_plate_product_id" is null or "product_slider"."included_plate_product_id" <> "product_slider"."id");
