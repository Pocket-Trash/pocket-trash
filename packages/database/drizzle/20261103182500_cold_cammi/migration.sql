ALTER TABLE "collection_item_ownership_period" ADD COLUMN "price_paid_minor" bigint;--> statement-breakpoint
ALTER TABLE "collection_item_ownership_period" ADD COLUMN "price_paid_currency_code" "currency_code";--> statement-breakpoint
ALTER TABLE "collection_item_ownership_period" ADD COLUMN "price_paid_is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_item_ownership_period" ADD COLUMN "price_sold_minor" bigint;--> statement-breakpoint
ALTER TABLE "collection_item_ownership_period" ADD COLUMN "price_sold_currency_code" "currency_code";--> statement-breakpoint
ALTER TABLE "collection_item_ownership_period" ADD CONSTRAINT "collection_item_price_paid_pair" CHECK (("price_paid_minor" is null) = ("price_paid_currency_code" is null));--> statement-breakpoint
ALTER TABLE "collection_item_ownership_period" ADD CONSTRAINT "collection_item_price_sold_pair" CHECK (("price_sold_minor" is null) = ("price_sold_currency_code" is null));--> statement-breakpoint
ALTER TABLE "collection_item_ownership_period" ADD CONSTRAINT "collection_item_price_paid_nonnegative" CHECK ("price_paid_minor" is null or "price_paid_minor" between 0 and 9007199254740991);--> statement-breakpoint
ALTER TABLE "collection_item_ownership_period" ADD CONSTRAINT "collection_item_price_sold_nonnegative" CHECK ("price_sold_minor" is null or "price_sold_minor" between 0 and 9007199254740991);--> statement-breakpoint
ALTER TABLE "collection_item_ownership_period" ADD CONSTRAINT "collection_item_price_sold_requires_sale" CHECK ("price_sold_minor" is null or "exit_reason" is not distinct from 'sale');