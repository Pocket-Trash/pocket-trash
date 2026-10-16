DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "product_types"
		WHERE "slug" NOT IN (
			'pen', 'pen-actuator', 'pen-clip', 'pen-mechanism', 'pen-tip',
			'pen-top-cap', 'refill', 'spinner', 'spinner-button', 'slider',
			'slider-plate', 'slider-insert', 'fountain-pen'
		)
	) THEN
		RAISE EXCEPTION 'Unexpected product type prevents image metadata backfill.';
	END IF;
END $$;--> statement-breakpoint
UPDATE "product_types"
SET
	"image_url" = 'https://cdn.pocket-trash.app/assets/static/no-image.png',
	"image_alt" = 'No image set'
WHERE "slug" IN (
	'pen', 'pen-actuator', 'pen-clip', 'pen-mechanism', 'pen-tip',
	'pen-top-cap', 'refill', 'spinner', 'spinner-button', 'slider',
	'slider-plate', 'slider-insert', 'fountain-pen'
);--> statement-breakpoint
ALTER TABLE "product_types" ALTER COLUMN "image_url" SET DEFAULT 'https://cdn.pocket-trash.app/assets/static/no-image.png';--> statement-breakpoint
ALTER TABLE "product_types" ALTER COLUMN "image_url" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "product_types" ALTER COLUMN "image_alt" SET DEFAULT 'No image set';--> statement-breakpoint
ALTER TABLE "product_types" ALTER COLUMN "image_alt" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "product_types" ADD CONSTRAINT "product_types_image_alt_valid" CHECK (char_length(trim("image_alt")) between 1 and 500);--> statement-breakpoint
ALTER TABLE "product_types" ADD CONSTRAINT "product_types_image_url_valid" CHECK ("image_url" ~ '^https://[^[:space:]]+$');
