CREATE TABLE "public_collection_item_status_trend" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "public_collection_item_status_trend_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"generation_id" bigint NOT NULL,
	"status" text NOT NULL,
	"product_id" bigint,
	"approximate_item_count" integer NOT NULL,
	"contributor_count_band" integer NOT NULL,
	CONSTRAINT "public_collection_item_status_trend_status_valid" CHECK ("status" in ('grail','favorite','want-to-sell','want-to-trade','sold','unstatused')),
	CONSTRAINT "public_collection_item_status_trend_counts_valid" CHECK ("approximate_item_count" >= 5 and "approximate_item_count" % 5 = 0 and "contributor_count_band" >= 5 and "contributor_count_band" % 5 = 0 and "contributor_count_band" <= "approximate_item_count")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "public_collection_item_status_trend_scope_unique" ON "public_collection_item_status_trend" ("generation_id","status",coalesce("product_id",0));--> statement-breakpoint
ALTER TABLE "public_collection_item_status_trend" ADD CONSTRAINT "public_collection_item_status_trend_8Oc8258x25ck_fkey" FOREIGN KEY ("generation_id") REFERENCES "public_trends_generation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "public_collection_item_status_trend" ADD CONSTRAINT "public_collection_item_status_trend_product_id_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE;