CREATE TABLE "public_collection_item_material_trend" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "public_collection_item_material_trend_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"generation_id" bigint NOT NULL,
	"product_type_id" bigint,
	"material_id" bigint,
	"material_specific_id" bigint,
	"is_specific_breakdown" boolean DEFAULT false NOT NULL,
	"rounded_item_count" integer NOT NULL,
	"rounded_collector_count" integer NOT NULL,
	CONSTRAINT "public_collection_item_material_trend_count_valid" CHECK ("rounded_item_count" > 0 and "rounded_item_count" % 5 = 0 and "rounded_collector_count" > 0 and "rounded_collector_count" % 5 = 0),
	CONSTRAINT "public_collection_item_material_trend_scope_valid" CHECK ("material_specific_id" is null or "material_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "public_trends_generation" ADD COLUMN "has_suppressed_material_values" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "public_collection_item_material_trend_scope_unique" ON "public_collection_item_material_trend" ("generation_id",coalesce("product_type_id", 0),coalesce("material_id", 0),coalesce("material_specific_id", 0),"is_specific_breakdown");--> statement-breakpoint
ALTER TABLE "public_collection_item_material_trend" ADD CONSTRAINT "public_collection_item_material_trend_sn5exnLpymwD_fkey" FOREIGN KEY ("generation_id") REFERENCES "public_trends_generation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "public_collection_item_material_trend" ADD CONSTRAINT "public_collection_item_material_trend_krpLSMDjjvxf_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "public_collection_item_material_trend" ADD CONSTRAINT "public_collection_item_material_trend_SechbZRIGqMb_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "public_collection_item_material_trend" ADD CONSTRAINT "public_collection_item_material_trend_specific_parent_fk" FOREIGN KEY ("material_id","material_specific_id") REFERENCES "material_specific"("material_id","id") ON DELETE RESTRICT;