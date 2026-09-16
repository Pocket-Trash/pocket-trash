CREATE TABLE "product" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_type_id" bigint NOT NULL,
	"maker_id" bigint NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_material" (
	"product_id" bigint NOT NULL,
	"material_id" bigint NOT NULL,
	CONSTRAINT "product_material_product_id_material_id_pk" PRIMARY KEY("product_id","material_id")
);
--> statement-breakpoint
ALTER TABLE "product_spinner" DROP CONSTRAINT "product_spinner_maker_id_maker_id_fk";
--> statement-breakpoint
ALTER TABLE "product_spinner" DROP CONSTRAINT "product_spinner_product_type_id_product_type_id_fk";
--> statement-breakpoint
ALTER TABLE "product_spinner" DROP CONSTRAINT "product_spinner_material_id_material_id_fk";
--> statement-breakpoint
ALTER TABLE "product_spinner_button" DROP CONSTRAINT "product_spinner_button_maker_id_maker_id_fk";
--> statement-breakpoint
ALTER TABLE "product_spinner_button" DROP CONSTRAINT "product_spinner_button_product_type_id_product_type_id_fk";
--> statement-breakpoint
ALTER TABLE "product_spinner_button" DROP CONSTRAINT "product_spinner_button_material_id_material_id_fk";
--> statement-breakpoint
DROP INDEX "product_spinner_slug_unique";--> statement-breakpoint
DROP INDEX "product_spinner_button_slug_unique";--> statement-breakpoint
ALTER TABLE "product_spinner" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "product_spinner_button" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "maker" ALTER COLUMN "root_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_type" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "product_type" ADD COLUMN "image_alt" text;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_product_type_id_product_type_id_fk" FOREIGN KEY ("product_type_id") REFERENCES "public"."product_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_maker_id_maker_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."maker"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_material" ADD CONSTRAINT "product_material_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_material" ADD CONSTRAINT "product_material_material_id_material_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."material"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_type_slug_unique" ON "product" USING btree ("product_type_id","slug");--> statement-breakpoint
ALTER TABLE "product_spinner" ADD CONSTRAINT "product_spinner_id_product_id_fk" FOREIGN KEY ("id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_spinner_button" ADD CONSTRAINT "product_spinner_button_id_product_id_fk" FOREIGN KEY ("id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_spinner" DROP COLUMN "maker_id";--> statement-breakpoint
ALTER TABLE "product_spinner" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "product_spinner" DROP COLUMN "slug";--> statement-breakpoint
ALTER TABLE "product_spinner" DROP COLUMN "product_type_id";--> statement-breakpoint
ALTER TABLE "product_spinner" DROP COLUMN "material_id";--> statement-breakpoint
ALTER TABLE "product_spinner_button" DROP COLUMN "maker_id";--> statement-breakpoint
ALTER TABLE "product_spinner_button" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "product_spinner_button" DROP COLUMN "slug";--> statement-breakpoint
ALTER TABLE "product_spinner_button" DROP COLUMN "product_type_id";--> statement-breakpoint
ALTER TABLE "product_spinner_button" DROP COLUMN "material_id";