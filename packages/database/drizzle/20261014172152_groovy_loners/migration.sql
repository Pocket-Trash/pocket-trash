CREATE TABLE "public_part_accessory_product_type_trend" (
	"generation_id" bigint,
	"product_type_id" bigint,
	"rounded_item_count" integer NOT NULL,
	CONSTRAINT "public_part_accessory_product_type_trend_pkey" PRIMARY KEY("generation_id","product_type_id"),
	CONSTRAINT "public_part_accessory_product_type_trend_count_valid" CHECK ("rounded_item_count" > 0 and "rounded_item_count" % 5 = 0)
);
--> statement-breakpoint
ALTER TABLE "product_types" ADD COLUMN "include_in_trends" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "public_trends_generation" ADD COLUMN "has_suppressed_part_accessory_values" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "public_part_accessory_product_type_trend" ADD CONSTRAINT "public_part_accessory_product_type_trend_NpiaO5DL99qC_fkey" FOREIGN KEY ("generation_id") REFERENCES "public_trends_generation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "public_part_accessory_product_type_trend" ADD CONSTRAINT "public_part_accessory_product_type_trend_BNA14p2Zt49O_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE RESTRICT;