ALTER TABLE "refill_compatibility_assertion" DROP CONSTRAINT "refill_compatibility_assertion_3E47qd1G38S0_fkey";--> statement-breakpoint
ALTER INDEX "refill_compatibility_assertion_refill_tip_idx" RENAME TO "refill_compatibility_assertion_refill_idx";--> statement-breakpoint
ALTER INDEX "refill_compatibility_assertion_group_tip_idx" RENAME TO "refill_compatibility_assertion_group_idx";--> statement-breakpoint
DROP INDEX "refill_compatibility_assertion_required_tip_idx";--> statement-breakpoint
ALTER TABLE "refill_compatibility_assertion" DROP COLUMN "required_tip_product_id";--> statement-breakpoint
DELETE FROM "refill_compatibility_assertion" AS duplicate USING "refill_compatibility_assertion" AS keeper WHERE duplicate."id" > keeper."id" AND duplicate."pen_product_id" = keeper."pen_product_id" AND duplicate."target_group_id" IS NOT DISTINCT FROM keeper."target_group_id" AND duplicate."target_refill_product_id" IS NOT DISTINCT FROM keeper."target_refill_product_id";--> statement-breakpoint
DROP INDEX "refill_compatibility_assertion_refill_idx";--> statement-breakpoint
CREATE INDEX "refill_compatibility_assertion_refill_idx" ON "refill_compatibility_assertion" ("pen_product_id","target_refill_product_id");--> statement-breakpoint
DROP INDEX "refill_compatibility_assertion_group_idx";--> statement-breakpoint
CREATE INDEX "refill_compatibility_assertion_group_idx" ON "refill_compatibility_assertion" ("pen_product_id","target_group_id");--> statement-breakpoint
ALTER TABLE "refill_compatibility_assertion" DROP CONSTRAINT "refill_compatibility_assertion_scope_unique";--> statement-breakpoint
ALTER TABLE "refill_compatibility_assertion" ADD CONSTRAINT "refill_compatibility_assertion_scope_unique" UNIQUE NULLS NOT DISTINCT("pen_product_id","target_group_id","target_refill_product_id");
