CREATE TABLE "public_collection_item_product_type_trend" (
	"generation_id" bigint,
	"product_type_id" bigint,
	"rounded_item_count" integer NOT NULL,
	CONSTRAINT "public_collection_item_product_type_trend_pkey" PRIMARY KEY("generation_id","product_type_id"),
	CONSTRAINT "public_collection_item_product_type_trend_count_valid" CHECK ("rounded_item_count" > 0 and "rounded_item_count" % 5 = 0)
);
--> statement-breakpoint
CREATE TABLE "public_trends_generation" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "public_trends_generation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"active" boolean DEFAULT false NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"has_suppressed_values" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "public_trends_generation_active_unique" ON "public_trends_generation" ("active") WHERE "active";--> statement-breakpoint
ALTER TABLE "public_collection_item_product_type_trend" ADD CONSTRAINT "public_collection_item_product_type_trend_FpBU2EZvlJ3Q_fkey" FOREIGN KEY ("generation_id") REFERENCES "public_trends_generation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "public_collection_item_product_type_trend" ADD CONSTRAINT "public_collection_item_product_type_trend_KaRzZfyKndH6_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE RESTRICT;