CREATE TABLE "material_specific" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "material_specific_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"material_id" bigint NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_specific_parent_id_unique" UNIQUE("material_id","id"),
	CONSTRAINT "material_specific_parent_slug_unique" UNIQUE("material_id","slug"),
	CONSTRAINT "material_specific_name_valid" CHECK (char_length(btrim("name", E' \t\n\r\f\013\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff')) > 0),
	CONSTRAINT "material_specific_description_length_valid" CHECK ("description" is null or char_length("description") <= 5000)
);
--> statement-breakpoint
ALTER TABLE "material_image" DROP CONSTRAINT "material_image_material_hash_unique";--> statement-breakpoint
DROP INDEX "material_image_material_id_idx";--> statement-breakpoint
ALTER TABLE "collection_item" ADD COLUMN "material_specific_id" bigint;--> statement-breakpoint
ALTER TABLE "material_image" ADD COLUMN "material_specific_id" bigint;--> statement-breakpoint
ALTER TABLE "product_material" ADD COLUMN "id" bigint GENERATED ALWAYS AS IDENTITY (sequence name "product_material_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1);--> statement-breakpoint
ALTER TABLE "product_material" ADD COLUMN "material_specific_id" bigint;--> statement-breakpoint
ALTER TABLE "product_material" DROP CONSTRAINT "product_material_pkey";--> statement-breakpoint
ALTER TABLE "product_material" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "material_image" ADD CONSTRAINT "material_image_scope_hash_unique" UNIQUE NULLS NOT DISTINCT("material_id","material_specific_id","sha256");--> statement-breakpoint
ALTER TABLE "product_material" ADD CONSTRAINT "product_material_assignment_unique" UNIQUE NULLS NOT DISTINCT("product_id","material_id","material_specific_id");--> statement-breakpoint
CREATE INDEX "collection_item_specific_id_idx" ON "collection_item" ("material_specific_id");--> statement-breakpoint
CREATE INDEX "material_image_specific_id_idx" ON "material_image" ("material_specific_id");--> statement-breakpoint
CREATE INDEX "material_image_scope_position_idx" ON "material_image" ("material_id","material_specific_id","position");--> statement-breakpoint
CREATE INDEX "product_material_specific_id_idx" ON "product_material" ("material_specific_id");--> statement-breakpoint
CREATE UNIQUE INDEX "material_specific_parent_name_unique" ON "material_specific" ("material_id",lower(btrim("name", E' \t\n\r\f\013\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff')));--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_specific_parent_fk" FOREIGN KEY ("material_id","material_specific_id") REFERENCES "material_specific"("material_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "material_image" ADD CONSTRAINT "material_image_specific_parent_fk" FOREIGN KEY ("material_id","material_specific_id") REFERENCES "material_specific"("material_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_material" ADD CONSTRAINT "product_material_specific_parent_fk" FOREIGN KEY ("material_id","material_specific_id") REFERENCES "material_specific"("material_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "material_specific" ADD CONSTRAINT "material_specific_material_id_materials_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_specific_requires_material" CHECK ("material_specific_id" is null or "material_id" is not null);