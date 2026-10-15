CREATE TABLE "collection_item_installed_pen_part" (
	"pen_collection_item_id" bigint,
	"part_collection_item_id" bigint CONSTRAINT "collection_item_installed_pen_part_part_unique" UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_item_installed_pen_part_pkey" PRIMARY KEY("pen_collection_item_id","part_collection_item_id")
);
--> statement-breakpoint
CREATE TABLE "pen_compatible_part" (
	"pen_product_id" bigint,
	"part_product_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pen_compatible_part_pkey" PRIMARY KEY("pen_product_id","part_product_id"),
	CONSTRAINT "pen_compatible_part_distinct" CHECK ("pen_product_id" <> "part_product_id")
);
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "collection_item_configuration_selection" AS selection
		INNER JOIN "product_configuration_choice" AS choice
			ON choice."id" = selection."choice_id"
		WHERE selection."installed_part_collection_item_id" IS NOT NULL
			AND (
				choice."part_product_id" IS NULL
				OR collection_catalog_product(selection."collection_item_id")
					IS DISTINCT FROM choice."product_id"
				OR collection_catalog_product(selection."installed_part_collection_item_id")
					IS DISTINCT FROM choice."part_product_id"
				OR EXISTS (
					SELECT 1
					FROM "collection_item" AS pen_item
					INNER JOIN "collection_item" AS part_item
						ON part_item."id" = selection."installed_part_collection_item_id"
					WHERE pen_item."id" = selection."collection_item_id"
						AND pen_item."owner_id" <> part_item."owner_id"
				)
			)
	) THEN
		RAISE EXCEPTION 'Installed Pen part configuration cannot be converted.';
	END IF;
END $$;
--> statement-breakpoint
INSERT INTO "pen_compatible_part" ("pen_product_id", "part_product_id")
SELECT DISTINCT choice."product_id", choice."part_product_id"
FROM "product_configuration_choice" AS choice
WHERE choice."part_product_id" IS NOT NULL;
--> statement-breakpoint
INSERT INTO "collection_item_installed_pen_part" (
	"pen_collection_item_id",
	"part_collection_item_id"
)
SELECT
	selection."collection_item_id",
	selection."installed_part_collection_item_id"
FROM "collection_item_configuration_selection" AS selection
INNER JOIN "product_configuration_choice" AS choice
	ON choice."id" = selection."choice_id"
WHERE selection."installed_part_collection_item_id" IS NOT NULL
	AND choice."part_product_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "catalog_source_listing_choice" DROP CONSTRAINT "catalog_source_listing_choice_jJCqZEwCNXfR_fkey";--> statement-breakpoint
ALTER TABLE "collection_item_configuration_selection" DROP CONSTRAINT "collection_item_configuration_selection_choice_slot_fk";--> statement-breakpoint
ALTER TABLE "product_configuration_choice" DROP CONSTRAINT "product_configuration_choice_slot_product_fk";--> statement-breakpoint
ALTER TABLE "product_configuration_choice_requirement" DROP CONSTRAINT "product_configuration_choice_requirement_rule_fk";--> statement-breakpoint
ALTER TABLE "product_configuration_choice_requirement" DROP CONSTRAINT "product_configuration_choice_requirement_choice_fk";--> statement-breakpoint
ALTER TABLE "product_configuration_choice_rule" DROP CONSTRAINT "product_configuration_choice_rule_target_fk";--> statement-breakpoint
ALTER TABLE "product_configuration_slot" DROP CONSTRAINT "product_configuration_slot_EzUs81IwNNXU_fkey";--> statement-breakpoint
DROP TRIGGER "pen_part_role_configuration_valid" ON "pen_part_role_assignment";--> statement-breakpoint
DROP TABLE "catalog_source_listing_choice";--> statement-breakpoint
DROP TABLE "collection_item_configuration_selection";--> statement-breakpoint
DROP TABLE "configuration_slot_kind";--> statement-breakpoint
DROP TABLE "product_configuration_choice";--> statement-breakpoint
DROP TABLE "product_configuration_choice_requirement";--> statement-breakpoint
DROP TABLE "product_configuration_choice_rule";--> statement-breakpoint
DROP TABLE "product_configuration_slot";--> statement-breakpoint
DROP FUNCTION "validate_collection_configuration_selections"();--> statement-breakpoint
DROP FUNCTION "validate_product_configuration_rules"();--> statement-breakpoint
DROP FUNCTION "validate_product_configuration"();--> statement-breakpoint
CREATE INDEX "pen_compatible_part_part_idx" ON "pen_compatible_part" ("part_product_id");--> statement-breakpoint
ALTER TABLE "collection_item_installed_pen_part" ADD CONSTRAINT "collection_item_installed_pen_part_CGi8wslt5s3T_fkey" FOREIGN KEY ("pen_collection_item_id") REFERENCES "collection_detail_pen"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_item_installed_pen_part" ADD CONSTRAINT "collection_item_installed_pen_part_LKaIkal5vM31_fkey" FOREIGN KEY ("part_collection_item_id") REFERENCES "collection_item"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "pen_compatible_part" ADD CONSTRAINT "pen_compatible_part_pen_product_id_product_detail_pen_id_fkey" FOREIGN KEY ("pen_product_id") REFERENCES "product_detail_pen"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pen_compatible_part" ADD CONSTRAINT "pen_compatible_part_rISxx5oKy7nM_fkey" FOREIGN KEY ("part_product_id") REFERENCES "product_detail_pen_part"("id") ON DELETE RESTRICT;--> statement-breakpoint
CREATE FUNCTION validate_installed_pen_parts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM collection_item_installed_pen_part installed
		JOIN collection_detail_pen pen
			ON pen.id = installed.pen_collection_item_id
		JOIN collection_item pen_item
			ON pen_item.id = installed.pen_collection_item_id
		JOIN collection_item part_item
			ON part_item.id = installed.part_collection_item_id
		LEFT JOIN pen_compatible_part compatible
			ON compatible.pen_product_id = pen.product_pen_id
			AND compatible.part_product_id = collection_catalog_product(part_item.id)
		WHERE pen_item.owner_id <> part_item.owner_id
			OR compatible.pen_product_id IS NULL
	) THEN
		RAISE EXCEPTION 'Installed Pen parts must be directly compatible and have the same owner';
	END IF;
	RETURN NULL;
END $$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER collection_item_installed_pen_part_valid AFTER INSERT OR UPDATE OR DELETE ON collection_item_installed_pen_part DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_installed_pen_parts();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER pen_compatible_part_installation_valid AFTER INSERT OR UPDATE OR DELETE ON pen_compatible_part DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_installed_pen_parts();
