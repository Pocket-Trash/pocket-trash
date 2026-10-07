ALTER TABLE "product_insert_magnet_offer" DROP CONSTRAINT "product_insert_magnet_offer_copied_from_template_id_magnet_configuration_template_id_fk";
--> statement-breakpoint
ALTER TABLE "product_insert_magnet_offer" DROP COLUMN "copied_from_template_id";--> statement-breakpoint
DROP TABLE "magnet_configuration_template";--> statement-breakpoint
DROP TABLE "product_compatibility_advisory";--> statement-breakpoint
DROP TABLE "product_compatibility_family";--> statement-breakpoint
DROP TABLE "compatibility_family";
