CREATE TABLE "collection_item_note" (
	"id" text PRIMARY KEY,
	"collection_item_id" bigint NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"content" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_item_note_name_unique" UNIQUE("collection_item_id","normalized_name"),
	CONSTRAINT "collection_item_note_name_length" CHECK (char_length(trim("name")) between 1 and 100),
	CONSTRAINT "collection_item_note_content_length" CHECK (char_length(trim("content")) between 5 and 2000),
	CONSTRAINT "collection_item_note_position_valid" CHECK ("position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "collection_item_note" ADD CONSTRAINT "collection_item_note_collection_item_id_collection_item_id_fkey" FOREIGN KEY ("collection_item_id") REFERENCES "collection_item"("id") ON DELETE CASCADE;