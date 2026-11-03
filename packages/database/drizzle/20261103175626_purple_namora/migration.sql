CREATE TABLE "collection_item_status" (
	"collection_item_id" bigint,
	"status" text,
	"is_public" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_item_status_pkey" PRIMARY KEY("collection_item_id","status","is_public"),
	CONSTRAINT "collection_item_status_valid" CHECK ("status" in ('grail', 'favorite', 'want_to_sell', 'want_to_trade', 'sold'))
);
--> statement-breakpoint
ALTER TABLE "collection_item_status" ADD CONSTRAINT "collection_item_status_otVYIU9zAfGV_fkey" FOREIGN KEY ("collection_item_id") REFERENCES "collection_item"("id") ON DELETE CASCADE;