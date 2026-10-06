CREATE TABLE "catalog_terminology_alias" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "catalog_terminology_alias_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"maker_id" bigint NOT NULL,
	"canonical_namespace" text NOT NULL,
	"canonical_key" text NOT NULL,
	"label" text NOT NULL,
	"normalized_value" text NOT NULL,
	"is_preferred" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_terminology_alias_maker_concept_value_unique" UNIQUE("maker_id","canonical_namespace","canonical_key","normalized_value"),
	CONSTRAINT "catalog_terminology_alias_namespace_valid" CHECK ("catalog_terminology_alias"."canonical_namespace" = 'product-type'),
	CONSTRAINT "catalog_terminology_alias_label_valid" CHECK (char_length(trim("catalog_terminology_alias"."label")) between 1 and 80),
	CONSTRAINT "catalog_terminology_alias_normalized_value_valid" CHECK (char_length("catalog_terminology_alias"."normalized_value") between 1 and 80 and "catalog_terminology_alias"."normalized_value" = lower(trim("catalog_terminology_alias"."normalized_value")))
);
--> statement-breakpoint
ALTER TABLE "catalog_terminology_alias" ADD CONSTRAINT "catalog_terminology_alias_maker_id_makers_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."makers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_terminology_alias" ADD CONSTRAINT "catalog_terminology_alias_canonical_key_product_types_slug_fk" FOREIGN KEY ("canonical_key") REFERENCES "public"."product_types"("slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_terminology_alias_preferred_unique" ON "catalog_terminology_alias" USING btree ("maker_id","canonical_namespace","canonical_key") WHERE "catalog_terminology_alias"."is_preferred";--> statement-breakpoint
CREATE INDEX "catalog_terminology_alias_concept_idx" ON "catalog_terminology_alias" USING btree ("canonical_namespace","canonical_key");