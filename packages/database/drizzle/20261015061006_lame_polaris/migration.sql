ALTER TABLE "product_material" ADD COLUMN "weight_value" numeric;--> statement-breakpoint
ALTER TABLE "product_material" ADD COLUMN "weight_unit" "weight_unit";--> statement-breakpoint
ALTER TABLE "product_material" ADD CONSTRAINT "product_material_weight_consistent" CHECK (("weight_value" is null and "weight_unit" is null) or ("weight_value" > 0 and "weight_unit" is not null));