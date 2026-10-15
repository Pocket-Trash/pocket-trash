CREATE TABLE "collection_item_material" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collection_item_material_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"collection_item_id" bigint NOT NULL,
	"material_specific_id" bigint,
	"material_id" bigint NOT NULL,
	CONSTRAINT "collection_item_material_unique" UNIQUE NULLS NOT DISTINCT("collection_item_id","material_id","material_specific_id")
);
--> statement-breakpoint
CREATE TABLE "product_material_component" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_material_component_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_material_id" bigint NOT NULL,
	"material_specific_id" bigint,
	"material_id" bigint NOT NULL,
	CONSTRAINT "product_material_component_unique" UNIQUE NULLS NOT DISTINCT("product_material_id","material_id","material_specific_id")
);
--> statement-breakpoint
INSERT INTO "product_material_component" (
	"product_material_id",
	"material_id",
	"material_specific_id"
)
SELECT "id", "material_id", "material_specific_id"
FROM "product_material";
--> statement-breakpoint
INSERT INTO "collection_item_material" (
	"collection_item_id",
	"material_id",
	"material_specific_id"
)
SELECT "id", "material_id", "material_specific_id"
FROM "collection_item"
WHERE "material_id" IS NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
	IF (SELECT count(*) FROM "product_material_component") <>
		(SELECT count(*) FROM "product_material") THEN
		RAISE EXCEPTION 'product material component migration count mismatch';
	END IF;

	IF (SELECT count(*) FROM "collection_item_material") <>
		(SELECT count(*) FROM "collection_item" WHERE "material_id" IS NOT NULL) THEN
		RAISE EXCEPTION 'collection item material migration count mismatch';
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "collection_item" DROP CONSTRAINT "collection_item_material_id_materials_id_fkey";--> statement-breakpoint
ALTER TABLE "collection_item" DROP CONSTRAINT "collection_item_specific_parent_fk";--> statement-breakpoint
ALTER TABLE "product_material" DROP CONSTRAINT "product_material_material_id_materials_id_fkey";--> statement-breakpoint
ALTER TABLE "product_material" DROP CONSTRAINT "product_material_specific_parent_fk";--> statement-breakpoint
ALTER TABLE "product_material" DROP CONSTRAINT "product_material_assignment_unique";--> statement-breakpoint
ALTER TABLE "collection_item" DROP CONSTRAINT "collection_item_specific_requires_material";--> statement-breakpoint
DROP INDEX "collection_item_specific_id_idx";--> statement-breakpoint
DROP INDEX "collection_item_material_public_idx";--> statement-breakpoint
DROP INDEX "product_material_specific_id_idx";--> statement-breakpoint
DROP INDEX "product_material_material_id_idx";--> statement-breakpoint
ALTER TABLE "collection_item" DROP COLUMN "material_specific_id";--> statement-breakpoint
ALTER TABLE "collection_item" DROP COLUMN "material_id";--> statement-breakpoint
ALTER TABLE "product_material" DROP COLUMN "material_specific_id";--> statement-breakpoint
ALTER TABLE "product_material" DROP COLUMN "material_id";--> statement-breakpoint
CREATE INDEX "collection_item_material_item_id_idx" ON "collection_item_material" ("collection_item_id");--> statement-breakpoint
CREATE INDEX "collection_item_material_material_id_idx" ON "collection_item_material" ("material_id","material_specific_id");--> statement-breakpoint
CREATE INDEX "product_material_component_assignment_id_idx" ON "product_material_component" ("product_material_id");--> statement-breakpoint
CREATE INDEX "product_material_component_material_id_idx" ON "product_material_component" ("material_id","material_specific_id");--> statement-breakpoint
ALTER TABLE "collection_item_material" ADD CONSTRAINT "collection_item_material_nRw5q34qtgvq_fkey" FOREIGN KEY ("collection_item_id") REFERENCES "collection_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_item_material" ADD CONSTRAINT "collection_item_material_material_id_materials_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_item_material" ADD CONSTRAINT "collection_item_material_specific_parent_fk" FOREIGN KEY ("material_id","material_specific_id") REFERENCES "material_specific"("material_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_material_component" ADD CONSTRAINT "product_material_component_65JlhhsIU6xR_fkey" FOREIGN KEY ("product_material_id") REFERENCES "product_material"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_material_component" ADD CONSTRAINT "product_material_component_material_id_materials_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_material_component" ADD CONSTRAINT "product_material_component_specific_parent_fk" FOREIGN KEY ("material_id","material_specific_id") REFERENCES "material_specific"("material_id","id") ON DELETE RESTRICT;
