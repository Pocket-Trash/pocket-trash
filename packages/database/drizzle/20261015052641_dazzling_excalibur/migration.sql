CREATE TABLE "public_collection_lifecycle_trend" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "public_collection_lifecycle_trend_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"generation_id" bigint NOT NULL,
	"bucket_start" date NOT NULL,
	"granularity" text NOT NULL,
	"event_type" text NOT NULL,
	"product_type_id" bigint,
	"maker_id" bigint,
	"material_id" bigint,
	"rounded_count" integer,
	"suppressed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "public_collection_lifecycle_trend_granularity_valid" CHECK ("granularity" in ('day', 'week', 'month')),
	CONSTRAINT "public_collection_lifecycle_trend_event_type_valid" CHECK ("event_type" in ('acquisition', 'departure')),
	CONSTRAINT "public_collection_lifecycle_trend_count_valid" CHECK (("suppressed" and "rounded_count" is null) or (not "suppressed" and "rounded_count" > 0 and "rounded_count" % 5 = 0))
);
--> statement-breakpoint
ALTER TABLE "public_trends_generation" ADD COLUMN "has_suppressed_lifecycle_values" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "public_collection_lifecycle_trend_scope_unique" ON "public_collection_lifecycle_trend" ("generation_id","bucket_start","granularity","event_type",coalesce("product_type_id", 0),coalesce("maker_id", 0),coalesce("material_id", 0));--> statement-breakpoint
ALTER TABLE "public_collection_lifecycle_trend" ADD CONSTRAINT "public_collection_lifecycle_trend_B21zEUrOikfo_fkey" FOREIGN KEY ("generation_id") REFERENCES "public_trends_generation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "public_collection_lifecycle_trend" ADD CONSTRAINT "public_collection_lifecycle_trend_lg67Fh7o2UUY_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "public_collection_lifecycle_trend" ADD CONSTRAINT "public_collection_lifecycle_trend_maker_id_makers_id_fkey" FOREIGN KEY ("maker_id") REFERENCES "makers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "public_collection_lifecycle_trend" ADD CONSTRAINT "public_collection_lifecycle_trend_material_id_materials_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT;