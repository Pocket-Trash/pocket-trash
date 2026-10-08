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
CREATE TABLE "slider_magnet_preset" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "slider_magnet_preset_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"magnet_layout" text NOT NULL,
	"configuration" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slider_magnet_preset_normalized_name_unique" UNIQUE("normalized_name"),
	CONSTRAINT "slider_magnet_preset_name_valid" CHECK (char_length(trim("slider_magnet_preset"."name")) between 1 and 100),
	CONSTRAINT "slider_magnet_preset_layout_valid" CHECK ("slider_magnet_preset"."magnet_layout" in ('2x2', '2x3', '2x4'))
);
--> statement-breakpoint
INSERT INTO "slider_magnet_preset" ("name", "normalized_name", "magnet_layout", "configuration") VALUES
	('Hybrid', 'hybrid', '2x4', '{"sideA":["N48","N52","N52","N48","N48","N52","N52","N48"],"sideB":null}'),
	('Strong', 'strong', '2x4', '{"sideA":["N52","N52","N52","N52","N52","N52","N52","N52"],"sideB":null}'),
	('Medium Hybrid', 'mediumhybrid', '2x4', '{"sideA":["N52","N35","N35","N52","N52","N35","N35","N52"],"sideB":null}'),
	('Weak', 'weak', '2x4', '{"sideA":["N52","N35","N35","N52","N52","N35","N35","N52"],"sideB":["N42","N35","N35","N42","N42","N35","N35","N42"]}'),
	('Weakest', 'weakest', '2x4', '{"sideA":["N42","N35","N35","N42","N42","N35","N35","N42"],"sideB":null}');--> statement-breakpoint
DROP TABLE "magnet_configuration_label" CASCADE;--> statement-breakpoint
DROP TABLE "magnet_group_label" CASCADE;--> statement-breakpoint
DROP TABLE "product_magnet_configuration" CASCADE;--> statement-breakpoint
DROP TABLE "product_magnet_group" CASCADE;--> statement-breakpoint
DROP TABLE "product_magnet_slot" CASCADE;--> statement-breakpoint
ALTER TABLE "collection_slider" ADD COLUMN "magnet_configuration" jsonb;--> statement-breakpoint
ALTER TABLE "product_slider" ADD COLUMN "magnet_configuration" jsonb;--> statement-breakpoint
ALTER TABLE "product_slider_insert" ADD COLUMN "magnet_layout" text DEFAULT '2x4' NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_slider_insert" DROP COLUMN "setup";
