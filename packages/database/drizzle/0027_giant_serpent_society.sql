DO $$
BEGIN
	IF to_regclass('public.users') IS NULL AND to_regclass('public."user"') IS NOT NULL THEN
		ALTER TABLE "user" RENAME TO "users";
	END IF;
	IF to_regclass('public.makers') IS NULL AND to_regclass('public.maker') IS NOT NULL THEN
		ALTER TABLE "maker" RENAME TO "makers";
	END IF;
	IF to_regclass('public.materials') IS NULL AND to_regclass('public.material') IS NOT NULL THEN
		ALTER TABLE "material" RENAME TO "materials";
	END IF;
	IF to_regclass('public.mechanisms') IS NULL AND to_regclass('public.mechanism') IS NOT NULL THEN
		ALTER TABLE "mechanism" RENAME TO "mechanisms";
	END IF;
	IF to_regclass('public.product_types') IS NULL AND to_regclass('public.product_type') IS NOT NULL THEN
		ALTER TABLE "product_type" RENAME TO "product_types";
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF to_regclass('public.users_id_seq') IS NULL AND to_regclass('public.user_id_seq') IS NOT NULL THEN
		ALTER SEQUENCE "user_id_seq" RENAME TO "users_id_seq";
	END IF;
	IF to_regclass('public.makers_id_seq') IS NULL AND to_regclass('public.maker_id_seq') IS NOT NULL THEN
		ALTER SEQUENCE "maker_id_seq" RENAME TO "makers_id_seq";
	END IF;
	IF to_regclass('public.materials_id_seq') IS NULL AND to_regclass('public.material_id_seq') IS NOT NULL THEN
		ALTER SEQUENCE "material_id_seq" RENAME TO "materials_id_seq";
	END IF;
	IF to_regclass('public.mechanisms_id_seq') IS NULL AND to_regclass('public.mechanism_id_seq') IS NOT NULL THEN
		ALTER SEQUENCE "mechanism_id_seq" RENAME TO "mechanisms_id_seq";
	END IF;
	IF to_regclass('public.product_types_id_seq') IS NULL AND to_regclass('public.product_type_id_seq') IS NOT NULL THEN
		ALTER SEQUENCE "product_type_id_seq" RENAME TO "product_types_id_seq";
	END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_item" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collection_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"owner_id" bigint NOT NULL,
	"material_id" bigint,
	"purchased_at" timestamp with time zone,
	"sold_at" timestamp with time zone,
	"purchased_from_user_id" bigint,
	"purchased_from_user" text,
	"sold_to_user_id" bigint,
	"sold_to_user" text,
	"owned" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_spinner" (
	"id" bigint PRIMARY KEY NOT NULL,
	"product_spinner_id" bigint NOT NULL,
	"installed_button_id" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_spinner_button" (
	"id" bigint PRIMARY KEY NOT NULL,
	"product_spinner_button_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "color" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "color_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hex" text NOT NULL,
	CONSTRAINT "color_hex_check" CHECK ("color"."hex" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "color_effect" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "color_effect_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finish" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "finish_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finish_option" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "finish_option_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_id" bigint,
	"collection_item_id" bigint,
	"source_product_finish_option_id" bigint,
	"color_effect_id" bigint,
	"position" integer NOT NULL,
	CONSTRAINT "finish_option_owner_check" CHECK (("finish_option"."product_id" is not null) <> ("finish_option"."collection_item_id" is not null)),
	CONSTRAINT "finish_option_position_check" CHECK ("finish_option"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finish_option_color" (
	"finish_option_id" bigint NOT NULL,
	"color_id" bigint NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "finish_option_color_finish_option_id_color_id_pk" PRIMARY KEY("finish_option_id","color_id"),
	CONSTRAINT "finish_option_color_position_check" CHECK ("finish_option_color"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finish_option_finish" (
	"finish_option_id" bigint NOT NULL,
	"finish_id" bigint NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "finish_option_finish_finish_option_id_finish_id_pk" PRIMARY KEY("finish_option_id","finish_id"),
	CONSTRAINT "finish_option_finish_position_check" CHECK ("finish_option_finish"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_type_id" bigint NOT NULL,
	"maker_id" bigint NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_material" (
	"product_id" bigint NOT NULL,
	"material_id" bigint NOT NULL,
	CONSTRAINT "product_material_product_id_material_id_pk" PRIMARY KEY("product_id","material_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_spinner" (
	"id" bigint PRIMARY KEY NOT NULL,
	"weight_g" numeric,
	"length_mm" numeric,
	"width_mm" numeric,
	"thickness_mm" numeric,
	"thickness_with_button_mm" numeric,
	"button_diameter_mm" numeric,
	"compatible_button_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_spinner_button" (
	"id" bigint PRIMARY KEY NOT NULL,
	"weight_g" numeric,
	"diameter_mm" numeric,
	"thickness_mm" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "makers" ALTER COLUMN "root_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_types" ADD COLUMN IF NOT EXISTS "image_url" text;--> statement-breakpoint
ALTER TABLE "product_types" ADD COLUMN IF NOT EXISTS "image_alt" text;--> statement-breakpoint
ALTER TABLE "collection_item" ADD COLUMN IF NOT EXISTS "material_id" bigint;--> statement-breakpoint
ALTER TABLE "color" ADD COLUMN IF NOT EXISTS "hex" text;--> statement-breakpoint
UPDATE "color" SET "hex" = CASE lower("slug")
	WHEN 'black' THEN '#000000'
	WHEN 'white' THEN '#FFFFFF'
	WHEN 'grey' THEN '#808080'
	WHEN 'silver' THEN '#C0C0C0'
	WHEN 'red' THEN '#DC2626'
	WHEN 'orange' THEN '#F97316'
	WHEN 'yellow' THEN '#EAB308'
	WHEN 'green' THEN '#16A34A'
	WHEN 'blue' THEN '#2563EB'
	WHEN 'purple' THEN '#9333EA'
	WHEN 'pink' THEN '#EC4899'
	WHEN 'brown' THEN '#92400E'
	WHEN 'bronze' THEN '#CD7F32'
	WHEN 'gold' THEN '#D4AF37'
	WHEN 'teal' THEN '#0D9488'
	WHEN 'cyan' THEN '#06B6D4'
	ELSE '#808080'
END WHERE "hex" IS NULL;--> statement-breakpoint
ALTER TABLE "color" ALTER COLUMN "hex" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "color" DROP CONSTRAINT IF EXISTS "color_hex_check";--> statement-breakpoint
ALTER TABLE "color" ADD CONSTRAINT "color_hex_check" CHECK ("color"."hex" ~ '^#[0-9A-Fa-f]{6}$');--> statement-breakpoint
ALTER TABLE "collection_item" DROP CONSTRAINT IF EXISTS "collection_item_owner_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "collection_item" DROP CONSTRAINT IF EXISTS "collection_item_owner_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "collection_item" DROP CONSTRAINT IF EXISTS "collection_item_material_id_material_id_fk";--> statement-breakpoint
ALTER TABLE "collection_item" DROP CONSTRAINT IF EXISTS "collection_item_material_id_materials_id_fk";--> statement-breakpoint
ALTER TABLE "collection_item" DROP CONSTRAINT IF EXISTS "collection_item_purchased_from_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "collection_item" DROP CONSTRAINT IF EXISTS "collection_item_purchased_from_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "collection_item" DROP CONSTRAINT IF EXISTS "collection_item_sold_to_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "collection_item" DROP CONSTRAINT IF EXISTS "collection_item_sold_to_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "collection_spinner" DROP CONSTRAINT IF EXISTS "collection_spinner_id_collection_item_id_fk";--> statement-breakpoint
ALTER TABLE "collection_spinner" DROP CONSTRAINT IF EXISTS "collection_spinner_product_spinner_id_product_spinner_id_fk";--> statement-breakpoint
ALTER TABLE "collection_spinner" DROP CONSTRAINT IF EXISTS "collection_spinner_installed_button_id_collection_spinner_button_id_fk";--> statement-breakpoint
ALTER TABLE "collection_spinner_button" DROP CONSTRAINT IF EXISTS "collection_spinner_button_id_collection_item_id_fk";--> statement-breakpoint
ALTER TABLE "collection_spinner_button" DROP CONSTRAINT IF EXISTS "collection_spinner_button_product_spinner_button_id_product_spinner_button_id_fk";--> statement-breakpoint
ALTER TABLE "finish_option" DROP CONSTRAINT IF EXISTS "finish_option_product_id_product_id_fk";--> statement-breakpoint
ALTER TABLE "finish_option" DROP CONSTRAINT IF EXISTS "finish_option_collection_item_id_collection_item_id_fk";--> statement-breakpoint
ALTER TABLE "finish_option" DROP CONSTRAINT IF EXISTS "finish_option_source_product_finish_option_id_finish_option_id_fk";--> statement-breakpoint
ALTER TABLE "finish_option" DROP CONSTRAINT IF EXISTS "finish_option_color_effect_id_color_effect_id_fk";--> statement-breakpoint
ALTER TABLE "finish_option_color" DROP CONSTRAINT IF EXISTS "finish_option_color_finish_option_id_finish_option_id_fk";--> statement-breakpoint
ALTER TABLE "finish_option_color" DROP CONSTRAINT IF EXISTS "finish_option_color_color_id_color_id_fk";--> statement-breakpoint
ALTER TABLE "finish_option_finish" DROP CONSTRAINT IF EXISTS "finish_option_finish_finish_option_id_finish_option_id_fk";--> statement-breakpoint
ALTER TABLE "finish_option_finish" DROP CONSTRAINT IF EXISTS "finish_option_finish_finish_id_finish_id_fk";--> statement-breakpoint
ALTER TABLE "product" DROP CONSTRAINT IF EXISTS "product_product_type_id_product_type_id_fk";--> statement-breakpoint
ALTER TABLE "product" DROP CONSTRAINT IF EXISTS "product_product_type_id_product_types_id_fk";--> statement-breakpoint
ALTER TABLE "product" DROP CONSTRAINT IF EXISTS "product_maker_id_maker_id_fk";--> statement-breakpoint
ALTER TABLE "product" DROP CONSTRAINT IF EXISTS "product_maker_id_makers_id_fk";--> statement-breakpoint
ALTER TABLE "product_material" DROP CONSTRAINT IF EXISTS "product_material_product_id_product_id_fk";--> statement-breakpoint
ALTER TABLE "product_material" DROP CONSTRAINT IF EXISTS "product_material_material_id_material_id_fk";--> statement-breakpoint
ALTER TABLE "product_material" DROP CONSTRAINT IF EXISTS "product_material_material_id_materials_id_fk";--> statement-breakpoint
ALTER TABLE "product_spinner" DROP CONSTRAINT IF EXISTS "product_spinner_id_product_id_fk";--> statement-breakpoint
ALTER TABLE "product_spinner" DROP CONSTRAINT IF EXISTS "product_spinner_compatible_button_id_product_spinner_button_id_fk";--> statement-breakpoint
ALTER TABLE "product_spinner_button" DROP CONSTRAINT IF EXISTS "product_spinner_button_id_product_id_fk";--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_purchased_from_user_id_users_id_fk" FOREIGN KEY ("purchased_from_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_sold_to_user_id_users_id_fk" FOREIGN KEY ("sold_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_spinner" ADD CONSTRAINT "collection_spinner_id_collection_item_id_fk" FOREIGN KEY ("id") REFERENCES "public"."collection_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_spinner" ADD CONSTRAINT "collection_spinner_product_spinner_id_product_spinner_id_fk" FOREIGN KEY ("product_spinner_id") REFERENCES "public"."product_spinner"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_spinner" ADD CONSTRAINT "collection_spinner_installed_button_id_collection_spinner_button_id_fk" FOREIGN KEY ("installed_button_id") REFERENCES "public"."collection_spinner_button"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_spinner_button" ADD CONSTRAINT "collection_spinner_button_id_collection_item_id_fk" FOREIGN KEY ("id") REFERENCES "public"."collection_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_spinner_button" ADD CONSTRAINT "collection_spinner_button_product_spinner_button_id_product_spinner_button_id_fk" FOREIGN KEY ("product_spinner_button_id") REFERENCES "public"."product_spinner_button"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finish_option" ADD CONSTRAINT "finish_option_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finish_option" ADD CONSTRAINT "finish_option_collection_item_id_collection_item_id_fk" FOREIGN KEY ("collection_item_id") REFERENCES "public"."collection_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finish_option" ADD CONSTRAINT "finish_option_source_product_finish_option_id_finish_option_id_fk" FOREIGN KEY ("source_product_finish_option_id") REFERENCES "public"."finish_option"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finish_option" ADD CONSTRAINT "finish_option_color_effect_id_color_effect_id_fk" FOREIGN KEY ("color_effect_id") REFERENCES "public"."color_effect"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finish_option_color" ADD CONSTRAINT "finish_option_color_finish_option_id_finish_option_id_fk" FOREIGN KEY ("finish_option_id") REFERENCES "public"."finish_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finish_option_color" ADD CONSTRAINT "finish_option_color_color_id_color_id_fk" FOREIGN KEY ("color_id") REFERENCES "public"."color"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finish_option_finish" ADD CONSTRAINT "finish_option_finish_finish_option_id_finish_option_id_fk" FOREIGN KEY ("finish_option_id") REFERENCES "public"."finish_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finish_option_finish" ADD CONSTRAINT "finish_option_finish_finish_id_finish_id_fk" FOREIGN KEY ("finish_id") REFERENCES "public"."finish"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_product_type_id_product_types_id_fk" FOREIGN KEY ("product_type_id") REFERENCES "public"."product_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_maker_id_makers_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."makers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_material" ADD CONSTRAINT "product_material_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_material" ADD CONSTRAINT "product_material_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_spinner" ADD CONSTRAINT "product_spinner_id_product_id_fk" FOREIGN KEY ("id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_spinner" ADD CONSTRAINT "product_spinner_compatible_button_id_product_spinner_button_id_fk" FOREIGN KEY ("compatible_button_id") REFERENCES "public"."product_spinner_button"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_spinner_button" ADD CONSTRAINT "product_spinner_button_id_product_id_fk" FOREIGN KEY ("id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "color_slug_unique" ON "color" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "color_effect_slug_unique" ON "color_effect" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "finish_slug_unique" ON "finish" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "finish_option_collection_item_unique" ON "finish_option" USING btree ("collection_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "finish_option_product_position_unique" ON "finish_option" USING btree ("product_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "finish_option_color_position_unique" ON "finish_option_color" USING btree ("finish_option_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "finish_option_finish_position_unique" ON "finish_option_finish" USING btree ("finish_option_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_type_slug_unique" ON "product" USING btree ("product_type_id","slug");
