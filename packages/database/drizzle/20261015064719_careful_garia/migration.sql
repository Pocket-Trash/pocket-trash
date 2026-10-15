CREATE TABLE "product_link" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_link_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"url" text NOT NULL,
	"is_valid" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_link_product_url_unique" UNIQUE("product_id","url"),
	CONSTRAINT "product_link_position_valid" CHECK ("position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "product_link" ADD CONSTRAINT "product_link_product_id_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
INSERT INTO "product_link" ("product_id", "position", "url", "is_valid")
SELECT "id", 0, "maker_product_url", "maker_product_url_valid"
FROM "product"
WHERE "maker_product_url" IS NOT NULL;--> statement-breakpoint
DO $$
BEGIN
	IF (SELECT count(*) FROM "product_link") <> (SELECT count(*) FROM "product" WHERE "maker_product_url" IS NOT NULL) THEN
		RAISE EXCEPTION 'product link migration count mismatch';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "product" DROP COLUMN "maker_product_url";--> statement-breakpoint
ALTER TABLE "product" DROP COLUMN "maker_product_url_valid";--> statement-breakpoint
CREATE INDEX "product_link_product_position_idx" ON "product_link" ("product_id","position");
