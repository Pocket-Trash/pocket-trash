ALTER TABLE "product_types" ADD COLUMN "is_part_or_accessory" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "product_types"
SET "is_part_or_accessory" = true,
    "updated_at" = now()
WHERE "slug" IN ('spinner-button', 'slider-plate', 'slider-insert');
