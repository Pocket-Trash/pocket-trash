ALTER TABLE "collection_item" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "collection_spinner" ADD COLUMN "bearing" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "maker_product_url" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "maker_product_url_valid" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "product_spinner" ADD COLUMN "spin_diameter_mm" numeric;--> statement-breakpoint
ALTER TABLE "product_spinner" ADD COLUMN "bearing" text;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_description_length_valid" CHECK ("collection_item"."description" is null or char_length("collection_item"."description") <= 5000);--> statement-breakpoint
ALTER TABLE "collection_spinner" ADD CONSTRAINT "collection_spinner_bearing_length_valid" CHECK ("collection_spinner"."bearing" is null or char_length("collection_spinner"."bearing") <= 200);--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_description_length_valid" CHECK ("product"."description" is null or char_length("product"."description") <= 5000);--> statement-breakpoint
ALTER TABLE "product_spinner" ADD CONSTRAINT "product_spinner_bearing_length_valid" CHECK ("product_spinner"."bearing" is null or char_length("product_spinner"."bearing") <= 200);