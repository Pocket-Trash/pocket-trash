ALTER TABLE "users" RENAME TO "user";--> statement-breakpoint
ALTER TABLE "makers" RENAME TO "maker";--> statement-breakpoint
ALTER TABLE "materials" RENAME TO "material";--> statement-breakpoint
ALTER TABLE "mechanisms" RENAME TO "mechanism";--> statement-breakpoint
ALTER TABLE "product_types" RENAME TO "product_type";--> statement-breakpoint
ALTER SEQUENCE IF EXISTS "users_id_seq" RENAME TO "user_id_seq";--> statement-breakpoint
ALTER SEQUENCE IF EXISTS "makers_id_seq" RENAME TO "maker_id_seq";--> statement-breakpoint
ALTER SEQUENCE IF EXISTS "materials_id_seq" RENAME TO "material_id_seq";--> statement-breakpoint
ALTER SEQUENCE IF EXISTS "mechanisms_id_seq" RENAME TO "mechanism_id_seq";--> statement-breakpoint
ALTER SEQUENCE IF EXISTS "product_types_id_seq" RENAME TO "product_type_id_seq";--> statement-breakpoint
CREATE TABLE "collection_item" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collection_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"owner_id" bigint NOT NULL,
	"purchased_at" timestamp with time zone,
	"sold_at" timestamp with time zone,
	"purchased_from_user_id" bigint,
	"purchased_from_user" text,
	"sold_to_user_id" bigint,
	"sold_to_user" text,
	"owned" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_spinner" (
	"id" bigint PRIMARY KEY NOT NULL,
	"product_spinner_id" bigint NOT NULL,
	"installed_button_id" bigint
);
--> statement-breakpoint
CREATE TABLE "collection_spinner_button" (
	"id" bigint PRIMARY KEY NOT NULL,
	"product_spinner_button_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_spinner" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_spinner_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"maker_id" bigint NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"product_type_id" bigint NOT NULL,
	"material_id" bigint,
	"weight_g" numeric,
	"length_mm" numeric,
	"width_mm" numeric,
	"thickness_mm" numeric,
	"thickness_with_button_mm" numeric,
	"button_diameter_mm" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_spinner_button" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_spinner_button_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"maker_id" bigint NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"product_type_id" bigint NOT NULL,
	"material_id" bigint,
	"weight_g" numeric,
	"diameter_mm" numeric,
	"thickness_mm" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "users_clerk_id_unique";--> statement-breakpoint
ALTER TABLE "feature_flag_user_overrides" DROP CONSTRAINT "feature_flag_user_overrides_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tmp_autmog_pen_materials" DROP CONSTRAINT "tmp_autmog_pen_materials_material_id_materials_id_fk";
--> statement-breakpoint
ALTER TABLE "tmp_autmog_pens" DROP CONSTRAINT "tmp_autmog_pens_maker_id_makers_id_fk";
--> statement-breakpoint
ALTER TABLE "tmp_autmog_pens" DROP CONSTRAINT "tmp_autmog_pens_mechanism_id_mechanisms_id_fk";
--> statement-breakpoint
ALTER TABLE "tmp_grimsmo_knives" DROP CONSTRAINT "tmp_grimsmo_knives_maker_id_makers_id_fk";
--> statement-breakpoint
ALTER TABLE "tmp_grimsmo_pens" DROP CONSTRAINT "tmp_grimsmo_pens_maker_id_makers_id_fk";
--> statement-breakpoint
ALTER TABLE "tmp_product_product_types" DROP CONSTRAINT "tmp_product_product_types_product_type_id_product_types_id_fk";
--> statement-breakpoint
ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_purchased_from_user_id_user_id_fk" FOREIGN KEY ("purchased_from_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_sold_to_user_id_user_id_fk" FOREIGN KEY ("sold_to_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_spinner" ADD CONSTRAINT "collection_spinner_id_collection_item_id_fk" FOREIGN KEY ("id") REFERENCES "public"."collection_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_spinner" ADD CONSTRAINT "collection_spinner_product_spinner_id_product_spinner_id_fk" FOREIGN KEY ("product_spinner_id") REFERENCES "public"."product_spinner"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_spinner" ADD CONSTRAINT "collection_spinner_installed_button_id_collection_spinner_button_id_fk" FOREIGN KEY ("installed_button_id") REFERENCES "public"."collection_spinner_button"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_spinner_button" ADD CONSTRAINT "collection_spinner_button_id_collection_item_id_fk" FOREIGN KEY ("id") REFERENCES "public"."collection_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_spinner_button" ADD CONSTRAINT "collection_spinner_button_product_spinner_button_id_product_spinner_button_id_fk" FOREIGN KEY ("product_spinner_button_id") REFERENCES "public"."product_spinner_button"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_spinner" ADD CONSTRAINT "product_spinner_maker_id_maker_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."maker"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_spinner" ADD CONSTRAINT "product_spinner_product_type_id_product_type_id_fk" FOREIGN KEY ("product_type_id") REFERENCES "public"."product_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_spinner" ADD CONSTRAINT "product_spinner_material_id_material_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."material"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_spinner_button" ADD CONSTRAINT "product_spinner_button_maker_id_maker_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."maker"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_spinner_button" ADD CONSTRAINT "product_spinner_button_product_type_id_product_type_id_fk" FOREIGN KEY ("product_type_id") REFERENCES "public"."product_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_spinner_button" ADD CONSTRAINT "product_spinner_button_material_id_material_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."material"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_spinner_slug_unique" ON "product_spinner" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "product_spinner_button_slug_unique" ON "product_spinner_button" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "feature_flag_user_overrides" ADD CONSTRAINT "feature_flag_user_overrides_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tmp_autmog_pen_materials" ADD CONSTRAINT "tmp_autmog_pen_materials_material_id_material_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."material"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tmp_autmog_pens" ADD CONSTRAINT "tmp_autmog_pens_maker_id_maker_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."maker"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tmp_autmog_pens" ADD CONSTRAINT "tmp_autmog_pens_mechanism_id_mechanism_id_fk" FOREIGN KEY ("mechanism_id") REFERENCES "public"."mechanism"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tmp_grimsmo_knives" ADD CONSTRAINT "tmp_grimsmo_knives_maker_id_maker_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."maker"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tmp_grimsmo_pens" ADD CONSTRAINT "tmp_grimsmo_pens_maker_id_maker_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."maker"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tmp_product_product_types" ADD CONSTRAINT "tmp_product_product_types_product_type_id_product_type_id_fk" FOREIGN KEY ("product_type_id") REFERENCES "public"."product_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_clerk_id_unique" UNIQUE("clerk_id");
