ALTER TABLE "collection_slider" RENAME TO "collection_detail_slider";--> statement-breakpoint
ALTER TABLE "collection_slider_insert" RENAME TO "collection_detail_slider_insert";--> statement-breakpoint
ALTER TABLE "collection_slider_plate" RENAME TO "collection_detail_slider_plate";--> statement-breakpoint
ALTER TABLE "collection_spinner" RENAME TO "collection_detail_spinner";--> statement-breakpoint
ALTER TABLE "collection_spinner_button" RENAME TO "collection_detail_spinner_button";--> statement-breakpoint
ALTER TABLE "product_slider" RENAME TO "product_detail_slider";--> statement-breakpoint
ALTER TABLE "product_slider_insert" RENAME TO "product_detail_slider_insert";--> statement-breakpoint
ALTER TABLE "product_slider_plate" RENAME TO "product_detail_slider_plate";--> statement-breakpoint
ALTER TABLE "product_spinner" RENAME TO "product_detail_spinner";--> statement-breakpoint
ALTER TABLE "product_spinner_button" RENAME TO "product_detail_spinner_button";--> statement-breakpoint

ALTER TABLE "collection_detail_slider" RENAME CONSTRAINT "collection_slider_pkey" TO "collection_detail_slider_pkey";--> statement-breakpoint
ALTER TABLE "collection_detail_slider_insert" RENAME CONSTRAINT "collection_slider_insert_pkey" TO "collection_detail_slider_insert_pkey";--> statement-breakpoint
ALTER TABLE "collection_detail_slider_plate" RENAME CONSTRAINT "collection_slider_plate_pkey" TO "collection_detail_slider_plate_pkey";--> statement-breakpoint
ALTER TABLE "collection_detail_spinner" RENAME CONSTRAINT "collection_spinner_pkey" TO "collection_detail_spinner_pkey";--> statement-breakpoint
ALTER TABLE "collection_detail_spinner_button" RENAME CONSTRAINT "collection_spinner_button_pkey" TO "collection_detail_spinner_button_pkey";--> statement-breakpoint
ALTER TABLE "product_detail_slider" RENAME CONSTRAINT "product_slider_pkey" TO "product_detail_slider_pkey";--> statement-breakpoint
ALTER TABLE "product_detail_slider_insert" RENAME CONSTRAINT "product_slider_insert_pkey" TO "product_detail_slider_insert_pkey";--> statement-breakpoint
ALTER TABLE "product_detail_slider_plate" RENAME CONSTRAINT "product_slider_plate_pkey" TO "product_detail_slider_plate_pkey";--> statement-breakpoint
ALTER TABLE "product_detail_spinner" RENAME CONSTRAINT "product_spinner_pkey" TO "product_detail_spinner_pkey";--> statement-breakpoint
ALTER TABLE "product_detail_spinner_button" RENAME CONSTRAINT "product_spinner_button_pkey" TO "product_detail_spinner_button_pkey";--> statement-breakpoint

ALTER TABLE "collection_detail_slider" RENAME CONSTRAINT "collection_slider_id_collection_item_id_fk" TO "collection_detail_slider_id_collection_item_id_fk";--> statement-breakpoint
ALTER TABLE "collection_detail_slider" RENAME CONSTRAINT "collection_slider_product_slider_id_product_slider_id_fk" TO "collection_detail_slider_product_slider_id_product_detail_slider_id_fk";--> statement-breakpoint
ALTER TABLE "collection_detail_slider" RENAME CONSTRAINT "collection_slider_installed_plate_id_collection_slider_plate_id_fk" TO "collection_detail_slider_installed_plate_id_collection_detail_slider_plate_id_fk";--> statement-breakpoint
ALTER TABLE "collection_detail_slider" RENAME CONSTRAINT "collection_slider_installed_insert_id_collection_slider_insert_id_fk" TO "collection_detail_slider_installed_insert_id_collection_detail_slider_insert_id_fk";--> statement-breakpoint
ALTER TABLE "collection_detail_slider_insert" RENAME CONSTRAINT "collection_slider_insert_id_collection_item_id_fk" TO "collection_detail_slider_insert_id_collection_item_id_fk";--> statement-breakpoint
ALTER TABLE "collection_detail_slider_insert" RENAME CONSTRAINT "collection_slider_insert_product_slider_insert_id_product_slider_insert_id_fk" TO "collection_detail_slider_insert_product_slider_insert_id_product_detail_slider_insert_id_fk";--> statement-breakpoint
ALTER TABLE "collection_detail_slider_plate" RENAME CONSTRAINT "collection_slider_plate_id_collection_item_id_fk" TO "collection_detail_slider_plate_id_collection_item_id_fk";--> statement-breakpoint
ALTER TABLE "collection_detail_slider_plate" RENAME CONSTRAINT "collection_slider_plate_product_slider_plate_id_product_slider_plate_id_fk" TO "collection_detail_slider_plate_product_slider_plate_id_product_detail_slider_plate_id_fk";--> statement-breakpoint
ALTER TABLE "collection_detail_spinner" RENAME CONSTRAINT "collection_spinner_id_collection_item_id_fk" TO "collection_detail_spinner_id_collection_item_id_fk";--> statement-breakpoint
ALTER TABLE "collection_detail_spinner" RENAME CONSTRAINT "collection_spinner_product_spinner_id_product_spinner_id_fk" TO "collection_detail_spinner_product_spinner_id_product_detail_spinner_id_fk";--> statement-breakpoint
ALTER TABLE "collection_detail_spinner" RENAME CONSTRAINT "collection_spinner_installed_button_id_collection_spinner_button_id_fk" TO "collection_detail_spinner_installed_button_id_collection_detail_spinner_button_id_fk";--> statement-breakpoint
ALTER TABLE "collection_detail_spinner_button" RENAME CONSTRAINT "collection_spinner_button_id_collection_item_id_fk" TO "collection_detail_spinner_button_id_collection_item_id_fk";--> statement-breakpoint
ALTER TABLE "collection_detail_spinner_button" RENAME CONSTRAINT "collection_spinner_button_product_spinner_button_id_product_spinner_button_id_fk" TO "collection_detail_spinner_button_product_spinner_button_id_product_detail_spinner_button_id_fk";--> statement-breakpoint
ALTER TABLE "product_detail_slider" RENAME CONSTRAINT "product_slider_id_product_id_fk" TO "product_detail_slider_id_product_id_fk";--> statement-breakpoint
ALTER TABLE "product_detail_slider" RENAME CONSTRAINT "product_slider_included_plate_product_id_product_id_fk" TO "product_detail_slider_included_plate_product_id_product_id_fk";--> statement-breakpoint
ALTER TABLE "product_detail_slider" RENAME CONSTRAINT "product_slider_included_insert_product_id_product_id_fk" TO "product_detail_slider_included_insert_product_id_product_id_fk";--> statement-breakpoint
ALTER TABLE "product_detail_slider_insert" RENAME CONSTRAINT "product_slider_insert_id_product_id_fk" TO "product_detail_slider_insert_id_product_id_fk";--> statement-breakpoint
ALTER TABLE "product_detail_slider_plate" RENAME CONSTRAINT "product_slider_plate_id_product_id_fk" TO "product_detail_slider_plate_id_product_id_fk";--> statement-breakpoint
ALTER TABLE "product_detail_spinner" RENAME CONSTRAINT "product_spinner_id_product_id_fk" TO "product_detail_spinner_id_product_id_fk";--> statement-breakpoint
ALTER TABLE "product_detail_spinner" RENAME CONSTRAINT "product_spinner_compatible_button_id_product_spinner_button_id_fk" TO "product_detail_spinner_compatible_button_id_product_detail_spinner_button_id_fk";--> statement-breakpoint
ALTER TABLE "product_detail_spinner_button" RENAME CONSTRAINT "product_spinner_button_id_product_id_fk" TO "product_detail_spinner_button_id_product_id_fk";--> statement-breakpoint

ALTER TABLE "collection_detail_spinner" RENAME CONSTRAINT "collection_spinner_bearing_length_valid" TO "collection_detail_spinner_bearing_length_valid";--> statement-breakpoint
ALTER TABLE "product_detail_slider" RENAME CONSTRAINT "product_slider_insert_choice_consistent" TO "product_detail_slider_insert_choice_consistent";--> statement-breakpoint
ALTER TABLE "product_detail_slider" RENAME CONSTRAINT "product_slider_magnet_layout_consistent" TO "product_detail_slider_magnet_layout_consistent";--> statement-breakpoint
ALTER TABLE "product_detail_slider" RENAME CONSTRAINT "product_slider_magnet_layout_valid" TO "product_detail_slider_magnet_layout_valid";--> statement-breakpoint
ALTER TABLE "product_detail_slider" RENAME CONSTRAINT "product_slider_weight_consistent" TO "product_detail_slider_weight_consistent";--> statement-breakpoint
ALTER TABLE "product_detail_slider" RENAME CONSTRAINT "product_slider_length_consistent" TO "product_detail_slider_length_consistent";--> statement-breakpoint
ALTER TABLE "product_detail_slider" RENAME CONSTRAINT "product_slider_width_consistent" TO "product_detail_slider_width_consistent";--> statement-breakpoint
ALTER TABLE "product_detail_slider" RENAME CONSTRAINT "product_slider_thickness_consistent" TO "product_detail_slider_thickness_consistent";--> statement-breakpoint
ALTER TABLE "product_detail_slider" RENAME CONSTRAINT "product_slider_included_plate_distinct" TO "product_detail_slider_included_plate_distinct";--> statement-breakpoint
ALTER TABLE "product_detail_slider" RENAME CONSTRAINT "product_slider_included_insert_distinct" TO "product_detail_slider_included_insert_distinct";--> statement-breakpoint
ALTER TABLE "product_detail_spinner" RENAME CONSTRAINT "product_spinner_weight_consistent" TO "product_detail_spinner_weight_consistent";--> statement-breakpoint
ALTER TABLE "product_detail_spinner" RENAME CONSTRAINT "product_spinner_length_consistent" TO "product_detail_spinner_length_consistent";--> statement-breakpoint
ALTER TABLE "product_detail_spinner" RENAME CONSTRAINT "product_spinner_width_consistent" TO "product_detail_spinner_width_consistent";--> statement-breakpoint
ALTER TABLE "product_detail_spinner" RENAME CONSTRAINT "product_spinner_thickness_consistent" TO "product_detail_spinner_thickness_consistent";--> statement-breakpoint
ALTER TABLE "product_detail_spinner" RENAME CONSTRAINT "product_spinner_thickness_with_button_consistent" TO "product_detail_spinner_thickness_with_button_consistent";--> statement-breakpoint
ALTER TABLE "product_detail_spinner" RENAME CONSTRAINT "product_spinner_button_diameter_consistent" TO "product_detail_spinner_button_diameter_consistent";--> statement-breakpoint
ALTER TABLE "product_detail_spinner" RENAME CONSTRAINT "product_spinner_spin_diameter_consistent" TO "product_detail_spinner_spin_diameter_consistent";--> statement-breakpoint
ALTER TABLE "product_detail_spinner" RENAME CONSTRAINT "product_spinner_bearing_length_valid" TO "product_detail_spinner_bearing_length_valid";--> statement-breakpoint
ALTER TABLE "product_detail_spinner_button" RENAME CONSTRAINT "product_spinner_button_weight_consistent" TO "product_detail_spinner_button_weight_consistent";--> statement-breakpoint
ALTER TABLE "product_detail_spinner_button" RENAME CONSTRAINT "product_spinner_button_diameter_consistent" TO "product_detail_spinner_button_diameter_consistent";--> statement-breakpoint
ALTER TABLE "product_detail_spinner_button" RENAME CONSTRAINT "product_spinner_button_thickness_consistent" TO "product_detail_spinner_button_thickness_consistent";--> statement-breakpoint

ALTER INDEX "collection_slider_installed_plate_unique" RENAME TO "collection_detail_slider_installed_plate_unique";--> statement-breakpoint
ALTER INDEX "collection_slider_installed_insert_unique" RENAME TO "collection_detail_slider_installed_insert_unique";--> statement-breakpoint
ALTER INDEX "collection_spinner_installed_button_unique" RENAME TO "collection_detail_spinner_installed_button_unique";--> statement-breakpoint
ALTER INDEX "product_slider_included_insert_idx" RENAME TO "product_detail_slider_included_insert_idx";--> statement-breakpoint
ALTER INDEX "product_slider_included_plate_idx" RENAME TO "product_detail_slider_included_plate_idx";--> statement-breakpoint

CREATE VIEW "collection_slider" AS SELECT * FROM "collection_detail_slider";--> statement-breakpoint
CREATE VIEW "collection_slider_insert" AS SELECT * FROM "collection_detail_slider_insert";--> statement-breakpoint
CREATE VIEW "collection_slider_plate" AS SELECT * FROM "collection_detail_slider_plate";--> statement-breakpoint
CREATE VIEW "collection_spinner" AS SELECT * FROM "collection_detail_spinner";--> statement-breakpoint
CREATE VIEW "collection_spinner_button" AS SELECT * FROM "collection_detail_spinner_button";--> statement-breakpoint
CREATE VIEW "product_slider" AS SELECT * FROM "product_detail_slider";--> statement-breakpoint
CREATE VIEW "product_slider_insert" AS SELECT * FROM "product_detail_slider_insert";--> statement-breakpoint
CREATE VIEW "product_slider_plate" AS SELECT * FROM "product_detail_slider_plate";--> statement-breakpoint
CREATE VIEW "product_spinner" AS SELECT * FROM "product_detail_spinner";--> statement-breakpoint
CREATE VIEW "product_spinner_button" AS SELECT * FROM "product_detail_spinner_button";
