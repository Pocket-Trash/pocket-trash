CREATE TABLE "search_documents" (
	"kind" text,
	"source_id" bigint,
	"search_group" text NOT NULL,
	"parent_id" bigint,
	"title" text NOT NULL,
	"href" text NOT NULL,
	"image_url" text,
	"context" text,
	"description" text,
	"search_text_a" text DEFAULT '' NOT NULL,
	"search_text_b" text DEFAULT '' NOT NULL,
	"search_text_c" text DEFAULT '' NOT NULL,
	"search_vector" tsvector NOT NULL,
	CONSTRAINT "search_documents_pkey" PRIMARY KEY("kind","source_id"),
	CONSTRAINT "search_documents_kind_valid" CHECK ("kind" in ('product', 'collection', 'collection_item', 'maker', 'person', 'material', 'material_detail', 'resource')),
	CONSTRAINT "search_documents_group_valid" CHECK ("search_group" in ('products', 'collections', 'makers', 'people', 'materials', 'resources')),
	CONSTRAINT "search_documents_kind_group_valid" CHECK (("kind" = 'product' and "search_group" = 'products') or ("kind" in ('collection', 'collection_item') and "search_group" = 'collections') or ("kind" = 'maker' and "search_group" = 'makers') or ("kind" = 'person' and "search_group" = 'people') or ("kind" in ('material', 'material_detail') and "search_group" = 'materials') or ("kind" = 'resource' and "search_group" = 'resources'))
);
--> statement-breakpoint
CREATE INDEX "search_documents_group_idx" ON "search_documents" ("search_group");