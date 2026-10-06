CREATE TABLE "collection_slider" (
	"id" bigint PRIMARY KEY NOT NULL,
	"product_slider_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_slider_insert" (
	"id" bigint PRIMARY KEY NOT NULL,
	"product_slider_insert_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_slider_plate" (
	"id" bigint PRIMARY KEY NOT NULL,
	"product_slider_plate_id" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_slider" ADD CONSTRAINT "collection_slider_id_collection_item_id_fk" FOREIGN KEY ("id") REFERENCES "public"."collection_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_slider" ADD CONSTRAINT "collection_slider_product_slider_id_product_slider_id_fk" FOREIGN KEY ("product_slider_id") REFERENCES "public"."product_slider"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_slider_insert" ADD CONSTRAINT "collection_slider_insert_id_collection_item_id_fk" FOREIGN KEY ("id") REFERENCES "public"."collection_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_slider_insert" ADD CONSTRAINT "collection_slider_insert_product_slider_insert_id_product_slider_insert_id_fk" FOREIGN KEY ("product_slider_insert_id") REFERENCES "public"."product_slider_insert"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_slider_plate" ADD CONSTRAINT "collection_slider_plate_id_collection_item_id_fk" FOREIGN KEY ("id") REFERENCES "public"."collection_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_slider_plate" ADD CONSTRAINT "collection_slider_plate_product_slider_plate_id_product_slider_plate_id_fk" FOREIGN KEY ("product_slider_plate_id") REFERENCES "public"."product_slider_plate"("id") ON DELETE restrict ON UPDATE no action;