CREATE TABLE "collection_detail_fountain_pen" (
	"id" bigint PRIMARY KEY,
	"product_fountain_pen_id" bigint NOT NULL,
	"section_option_id" bigint,
	"finial_option_id" bigint,
	"nib_mode" text DEFAULT 'none' NOT NULL,
	"default_nib_width_id" bigint,
	"installed_nib_collection_item_id" bigint UNIQUE,
	"customized_nib" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_detail_fountain_pen_nib_state_valid" CHECK (("nib_mode" = 'default' and "installed_nib_collection_item_id" is null and not "customized_nib") or ("nib_mode" = 'owned' and "installed_nib_collection_item_id" is not null and "default_nib_width_id" is null) or ("nib_mode" = 'none' and "installed_nib_collection_item_id" is null and "default_nib_width_id" is null and not "customized_nib"))
);
--> statement-breakpoint
CREATE TABLE "collection_detail_nib" (
	"id" bigint PRIMARY KEY,
	"product_nib_id" bigint NOT NULL,
	"width_id" bigint,
	"feed_material" text DEFAULT 'plastic' NOT NULL,
	"housing_material" text DEFAULT 'plastic' NOT NULL,
	"plating_style" text DEFAULT 'unplated' NOT NULL,
	"coating_metal_id" bigint,
	"body_coating_metal_id" bigint,
	"tines_coating_metal_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_detail_nib_feed_valid" CHECK ("feed_material" in ('plastic', 'ebonite', 'metal', 'other', 'unknown')),
	CONSTRAINT "collection_detail_nib_housing_valid" CHECK ("housing_material" in ('plastic', 'ebonite', 'metal', 'other', 'unknown')),
	CONSTRAINT "collection_detail_nib_plating_valid" CHECK (("plating_style" = 'unplated' and "coating_metal_id" is null and "body_coating_metal_id" is null and "tines_coating_metal_id" is null) or ("plating_style" = 'full' and "coating_metal_id" is not null and "body_coating_metal_id" is null and "tines_coating_metal_id" is null) or ("plating_style" in ('partial', 'two-tone', 'reverse-two-tone') and "coating_metal_id" is null and ("body_coating_metal_id" is not null or "tines_coating_metal_id" is not null) and ("plating_style" = 'partial' or "body_coating_metal_id" is distinct from "tines_coating_metal_id")))
);
--> statement-breakpoint
CREATE TABLE "fountain_pen_compatible_nib" (
	"pen_product_id" bigint,
	"nib_product_id" bigint,
	CONSTRAINT "fountain_pen_compatible_nib_pkey" PRIMARY KEY("pen_product_id","nib_product_id")
);
--> statement-breakpoint
CREATE TABLE "fountain_pen_connector_family" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fountain_pen_connector_family_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fountain_pen_converter" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fountain_pen_converter_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"maker_id" bigint NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"description" text,
	"connector_family_id" bigint,
	"length_class" text,
	"closed_length_mm" numeric,
	"extended_length_mm" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fountain_pen_converter_length_valid" CHECK ("length_class" is null or "length_class" in ('short', 'long')),
	CONSTRAINT "fountain_pen_converter_measurements_valid" CHECK (("closed_length_mm" is null or "closed_length_mm" > 0) and ("extended_length_mm" is null or "extended_length_mm" > 0) and ("closed_length_mm" is null or "extended_length_mm" is null or "extended_length_mm" >= "closed_length_mm"))
);
--> statement-breakpoint
CREATE TABLE "fountain_pen_filling_mechanism" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fountain_pen_filling_mechanism_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fountain_pen_filling_mechanism_assignment" (
	"pen_product_id" bigint,
	"mechanism_id" bigint,
	CONSTRAINT "fountain_pen_filling_mechanism_assignment_pkey" PRIMARY KEY("pen_product_id","mechanism_id")
);
--> statement-breakpoint
CREATE TABLE "fountain_pen_finial_option" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fountain_pen_finial_option_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"pen_product_id" bigint NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fountain_pen_finial_option_id_pen_unique" UNIQUE("id","pen_product_id"),
	CONSTRAINT "fountain_pen_finial_option_name_valid" CHECK (char_length(trim("name")) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "fountain_pen_section_compatible_nib" (
	"section_option_id" bigint,
	"nib_product_id" bigint,
	CONSTRAINT "fountain_pen_section_compatible_nib_pkey" PRIMARY KEY("section_option_id","nib_product_id")
);
--> statement-breakpoint
CREATE TABLE "fountain_pen_section_option" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fountain_pen_section_option_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"pen_product_id" bigint NOT NULL,
	"name" text NOT NULL,
	"mount_id" bigint,
	"default_nib_product_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fountain_pen_section_option_id_pen_unique" UNIQUE("id","pen_product_id"),
	CONSTRAINT "fountain_pen_section_option_name_valid" CHECK (char_length(trim("name")) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "nib_mount" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nib_mount_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nib_mount_compatibility" (
	"nib_product_id" bigint,
	"mount_id" bigint,
	CONSTRAINT "nib_mount_compatibility_pkey" PRIMARY KEY("nib_product_id","mount_id")
);
--> statement-breakpoint
CREATE TABLE "nib_plating_metal" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nib_plating_metal_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nib_plating_metal_offering" (
	"nib_product_id" bigint,
	"metal_id" bigint,
	CONSTRAINT "nib_plating_metal_offering_pkey" PRIMARY KEY("nib_product_id","metal_id")
);
--> statement-breakpoint
CREATE TABLE "nib_plating_style" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nib_plating_style_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nib_plating_style_slug_valid" CHECK ("slug" in ('unplated', 'full', 'partial', 'two-tone', 'reverse-two-tone'))
);
--> statement-breakpoint
CREATE TABLE "nib_plating_style_offering" (
	"nib_product_id" bigint,
	"style" text,
	CONSTRAINT "nib_plating_style_offering_pkey" PRIMARY KEY("nib_product_id","style")
);
--> statement-breakpoint
CREATE TABLE "nib_width" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nib_width_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nib_width_offering" (
	"nib_product_id" bigint,
	"width_id" bigint,
	CONSTRAINT "nib_width_offering_pkey" PRIMARY KEY("nib_product_id","width_id")
);
--> statement-breakpoint
CREATE TABLE "product_detail_fountain_pen" (
	"id" bigint PRIMARY KEY,
	"postable" boolean,
	"owner_replaceable_nib" boolean,
	"has_clip" boolean,
	"has_ink_window" boolean,
	"capability_notes" text,
	"connector_family_id" bigint,
	"cartridge_converter_length" text,
	"nib_construction_id" bigint,
	"body_silhouette_id" bigint,
	"cross_section_id" bigint,
	"facet_count" integer,
	"form_factor_id" bigint,
	"cap_closure_id" bigint,
	"nib_deployment_id" bigint,
	"default_nib_product_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_detail_fountain_pen_length_valid" CHECK ("cartridge_converter_length" is null or "cartridge_converter_length" in ('short', 'long', 'short-and-long')),
	CONSTRAINT "product_detail_fountain_pen_facets_valid" CHECK ("facet_count" is null or "facet_count" between 3 and 100)
);
--> statement-breakpoint
CREATE TABLE "product_detail_nib" (
	"id" bigint PRIMARY KEY,
	"form" text DEFAULT 'standard' NOT NULL,
	"manufacturer_size_code" text NOT NULL,
	"size_family_id" bigint,
	"default_feed_material" text DEFAULT 'plastic' NOT NULL,
	"default_housing_material" text DEFAULT 'plastic' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_detail_nib_form_valid" CHECK ("form" in ('standard', 'complete-unit')),
	CONSTRAINT "product_detail_nib_code_valid" CHECK (char_length(trim("manufacturer_size_code")) between 1 and 200),
	CONSTRAINT "product_detail_nib_feed_valid" CHECK ("default_feed_material" in ('plastic', 'ebonite', 'metal', 'other', 'unknown')),
	CONSTRAINT "product_detail_nib_housing_valid" CHECK ("default_housing_material" in ('plastic', 'ebonite', 'metal', 'other', 'unknown'))
);
--> statement-breakpoint
CREATE INDEX "collection_detail_fountain_pen_product_idx" ON "collection_detail_fountain_pen" ("product_fountain_pen_id");--> statement-breakpoint
CREATE INDEX "collection_detail_fountain_pen_section_idx" ON "collection_detail_fountain_pen" ("section_option_id");--> statement-breakpoint
CREATE INDEX "collection_detail_fountain_pen_finial_idx" ON "collection_detail_fountain_pen" ("finial_option_id");--> statement-breakpoint
CREATE INDEX "collection_detail_fountain_pen_width_idx" ON "collection_detail_fountain_pen" ("default_nib_width_id");--> statement-breakpoint
CREATE INDEX "collection_detail_nib_product_idx" ON "collection_detail_nib" ("product_nib_id");--> statement-breakpoint
CREATE INDEX "collection_detail_nib_width_idx" ON "collection_detail_nib" ("width_id");--> statement-breakpoint
CREATE INDEX "collection_detail_nib_style_idx" ON "collection_detail_nib" ("plating_style");--> statement-breakpoint
CREATE INDEX "collection_detail_nib_coating_idx" ON "collection_detail_nib" ("coating_metal_id");--> statement-breakpoint
CREATE INDEX "collection_detail_nib_body_coating_idx" ON "collection_detail_nib" ("body_coating_metal_id");--> statement-breakpoint
CREATE INDEX "collection_detail_nib_tines_coating_idx" ON "collection_detail_nib" ("tines_coating_metal_id");--> statement-breakpoint
CREATE INDEX "fountain_pen_compatible_nib_nib_idx" ON "fountain_pen_compatible_nib" ("nib_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fountain_pen_connector_family_name_unique" ON "fountain_pen_connector_family" (lower(trim("name")));--> statement-breakpoint
CREATE INDEX "fountain_pen_converter_maker_idx" ON "fountain_pen_converter" ("maker_id");--> statement-breakpoint
CREATE INDEX "fountain_pen_converter_connector_idx" ON "fountain_pen_converter" ("connector_family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fountain_pen_converter_maker_name_unique" ON "fountain_pen_converter" ("maker_id",lower(trim("name")));--> statement-breakpoint
CREATE UNIQUE INDEX "fountain_pen_filling_mechanism_name_unique" ON "fountain_pen_filling_mechanism" (lower(trim("name")));--> statement-breakpoint
CREATE INDEX "fountain_pen_filling_mechanism_assignment_mechanism_idx" ON "fountain_pen_filling_mechanism_assignment" ("mechanism_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fountain_pen_finial_option_name_unique" ON "fountain_pen_finial_option" ("pen_product_id",lower(trim("name")));--> statement-breakpoint
CREATE INDEX "fountain_pen_section_compatible_nib_nib_idx" ON "fountain_pen_section_compatible_nib" ("nib_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fountain_pen_section_option_name_unique" ON "fountain_pen_section_option" ("pen_product_id",lower(trim("name")));--> statement-breakpoint
CREATE INDEX "fountain_pen_section_option_mount_idx" ON "fountain_pen_section_option" ("mount_id");--> statement-breakpoint
CREATE INDEX "fountain_pen_section_option_nib_idx" ON "fountain_pen_section_option" ("default_nib_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "nib_mount_name_unique" ON "nib_mount" (lower(trim("name")));--> statement-breakpoint
CREATE INDEX "nib_mount_compatibility_mount_idx" ON "nib_mount_compatibility" ("mount_id");--> statement-breakpoint
CREATE UNIQUE INDEX "nib_plating_metal_name_unique" ON "nib_plating_metal" (lower(trim("name")));--> statement-breakpoint
CREATE INDEX "nib_plating_metal_offering_metal_idx" ON "nib_plating_metal_offering" ("metal_id");--> statement-breakpoint
CREATE INDEX "nib_plating_style_offering_style_idx" ON "nib_plating_style_offering" ("style");--> statement-breakpoint
CREATE UNIQUE INDEX "nib_width_name_unique" ON "nib_width" (lower(trim("name")));--> statement-breakpoint
CREATE INDEX "nib_width_offering_width_idx" ON "nib_width_offering" ("width_id");--> statement-breakpoint
CREATE INDEX "product_detail_fountain_pen_connector_idx" ON "product_detail_fountain_pen" ("connector_family_id");--> statement-breakpoint
CREATE INDEX "product_detail_fountain_pen_default_nib_idx" ON "product_detail_fountain_pen" ("default_nib_product_id");--> statement-breakpoint
CREATE INDEX "product_detail_fountain_pen_construction_idx" ON "product_detail_fountain_pen" ("nib_construction_id");--> statement-breakpoint
CREATE INDEX "product_detail_fountain_pen_silhouette_idx" ON "product_detail_fountain_pen" ("body_silhouette_id");--> statement-breakpoint
CREATE INDEX "product_detail_fountain_pen_cross_section_idx" ON "product_detail_fountain_pen" ("cross_section_id");--> statement-breakpoint
CREATE INDEX "product_detail_fountain_pen_form_factor_idx" ON "product_detail_fountain_pen" ("form_factor_id");--> statement-breakpoint
CREATE INDEX "product_detail_fountain_pen_closure_idx" ON "product_detail_fountain_pen" ("cap_closure_id");--> statement-breakpoint
CREATE INDEX "product_detail_fountain_pen_deployment_idx" ON "product_detail_fountain_pen" ("nib_deployment_id");--> statement-breakpoint
CREATE INDEX "product_detail_nib_size_family_idx" ON "product_detail_nib" ("size_family_id");--> statement-breakpoint
ALTER TABLE "collection_detail_fountain_pen" ADD CONSTRAINT "collection_detail_fountain_pen_id_collection_item_id_fkey" FOREIGN KEY ("id") REFERENCES "collection_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_detail_fountain_pen" ADD CONSTRAINT "collection_detail_fountain_pen_dDtyl9AuCErj_fkey" FOREIGN KEY ("product_fountain_pen_id") REFERENCES "product_detail_fountain_pen"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_fountain_pen" ADD CONSTRAINT "collection_detail_fountain_pen_OiC4IbLcd6TQ_fkey" FOREIGN KEY ("section_option_id") REFERENCES "fountain_pen_section_option"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_fountain_pen" ADD CONSTRAINT "collection_detail_fountain_pen_MKocGOSBZIHY_fkey" FOREIGN KEY ("finial_option_id") REFERENCES "fountain_pen_finial_option"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_fountain_pen" ADD CONSTRAINT "collection_detail_fountain_pen_PdiJDVUwBW6n_fkey" FOREIGN KEY ("default_nib_width_id") REFERENCES "nib_width"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_fountain_pen" ADD CONSTRAINT "collection_detail_fountain_pen_tynPkOLFgZx8_fkey" FOREIGN KEY ("installed_nib_collection_item_id") REFERENCES "collection_detail_nib"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_nib" ADD CONSTRAINT "collection_detail_nib_id_collection_item_id_fkey" FOREIGN KEY ("id") REFERENCES "collection_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_detail_nib" ADD CONSTRAINT "collection_detail_nib_product_nib_id_product_detail_nib_id_fkey" FOREIGN KEY ("product_nib_id") REFERENCES "product_detail_nib"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_nib" ADD CONSTRAINT "collection_detail_nib_width_id_nib_width_id_fkey" FOREIGN KEY ("width_id") REFERENCES "nib_width"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_nib" ADD CONSTRAINT "collection_detail_nib_plating_style_nib_plating_style_slug_fkey" FOREIGN KEY ("plating_style") REFERENCES "nib_plating_style"("slug") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_nib" ADD CONSTRAINT "collection_detail_nib_mztdO955Lgro_fkey" FOREIGN KEY ("coating_metal_id") REFERENCES "nib_plating_metal"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_nib" ADD CONSTRAINT "collection_detail_nib_55KjmANOlAcb_fkey" FOREIGN KEY ("body_coating_metal_id") REFERENCES "nib_plating_metal"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_nib" ADD CONSTRAINT "collection_detail_nib_SVWUBi1a3OAo_fkey" FOREIGN KEY ("tines_coating_metal_id") REFERENCES "nib_plating_metal"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fountain_pen_compatible_nib" ADD CONSTRAINT "fountain_pen_compatible_nib_Q9WipBYyKeUg_fkey" FOREIGN KEY ("pen_product_id") REFERENCES "product_detail_fountain_pen"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fountain_pen_compatible_nib" ADD CONSTRAINT "fountain_pen_compatible_nib_9HtCBYly9KZf_fkey" FOREIGN KEY ("nib_product_id") REFERENCES "product_detail_nib"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fountain_pen_converter" ADD CONSTRAINT "fountain_pen_converter_maker_id_makers_id_fkey" FOREIGN KEY ("maker_id") REFERENCES "makers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fountain_pen_converter" ADD CONSTRAINT "fountain_pen_converter_3S34NNQf2a8e_fkey" FOREIGN KEY ("connector_family_id") REFERENCES "fountain_pen_connector_family"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fountain_pen_filling_mechanism_assignment" ADD CONSTRAINT "fountain_pen_filling_mechanism_assignment_OZD76YeOftKB_fkey" FOREIGN KEY ("pen_product_id") REFERENCES "product_detail_fountain_pen"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fountain_pen_filling_mechanism_assignment" ADD CONSTRAINT "fountain_pen_filling_mechanism_assignment_On3qXekyl3tP_fkey" FOREIGN KEY ("mechanism_id") REFERENCES "fountain_pen_filling_mechanism"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fountain_pen_finial_option" ADD CONSTRAINT "fountain_pen_finial_option_LWsTpKdk1SMz_fkey" FOREIGN KEY ("pen_product_id") REFERENCES "product_detail_fountain_pen"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fountain_pen_section_compatible_nib" ADD CONSTRAINT "fountain_pen_section_compatible_nib_TqHVaM9gbPpS_fkey" FOREIGN KEY ("section_option_id") REFERENCES "fountain_pen_section_option"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fountain_pen_section_compatible_nib" ADD CONSTRAINT "fountain_pen_section_compatible_nib_rRAWlyWzKOot_fkey" FOREIGN KEY ("nib_product_id") REFERENCES "product_detail_nib"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fountain_pen_section_option" ADD CONSTRAINT "fountain_pen_section_option_iTW5vFf4c0Ct_fkey" FOREIGN KEY ("pen_product_id") REFERENCES "product_detail_fountain_pen"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fountain_pen_section_option" ADD CONSTRAINT "fountain_pen_section_option_mount_id_nib_mount_id_fkey" FOREIGN KEY ("mount_id") REFERENCES "nib_mount"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fountain_pen_section_option" ADD CONSTRAINT "fountain_pen_section_option_z2Omr2sYLxJA_fkey" FOREIGN KEY ("default_nib_product_id") REFERENCES "product_detail_nib"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "nib_mount_compatibility" ADD CONSTRAINT "nib_mount_compatibility_aYWYGPLQhQyA_fkey" FOREIGN KEY ("nib_product_id") REFERENCES "product_detail_nib"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "nib_mount_compatibility" ADD CONSTRAINT "nib_mount_compatibility_mount_id_nib_mount_id_fkey" FOREIGN KEY ("mount_id") REFERENCES "nib_mount"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "nib_plating_metal_offering" ADD CONSTRAINT "nib_plating_metal_offering_uSltKL3u515q_fkey" FOREIGN KEY ("nib_product_id") REFERENCES "product_detail_nib"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "nib_plating_metal_offering" ADD CONSTRAINT "nib_plating_metal_offering_metal_id_nib_plating_metal_id_fkey" FOREIGN KEY ("metal_id") REFERENCES "nib_plating_metal"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "nib_plating_style_offering" ADD CONSTRAINT "nib_plating_style_offering_sFgztRcAfxF8_fkey" FOREIGN KEY ("nib_product_id") REFERENCES "product_detail_nib"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "nib_plating_style_offering" ADD CONSTRAINT "nib_plating_style_offering_style_nib_plating_style_slug_fkey" FOREIGN KEY ("style") REFERENCES "nib_plating_style"("slug") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "nib_width_offering" ADD CONSTRAINT "nib_width_offering_nib_product_id_product_detail_nib_id_fkey" FOREIGN KEY ("nib_product_id") REFERENCES "product_detail_nib"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "nib_width_offering" ADD CONSTRAINT "nib_width_offering_width_id_nib_width_id_fkey" FOREIGN KEY ("width_id") REFERENCES "nib_width"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_detail_fountain_pen" ADD CONSTRAINT "product_detail_fountain_pen_id_product_id_fkey" FOREIGN KEY ("id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_detail_fountain_pen" ADD CONSTRAINT "product_detail_fountain_pen_jbfvlXEw2BZP_fkey" FOREIGN KEY ("connector_family_id") REFERENCES "fountain_pen_connector_family"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_detail_fountain_pen" ADD CONSTRAINT "product_detail_fountain_pen_VjassrslMn8J_fkey" FOREIGN KEY ("nib_construction_id") REFERENCES "catalog_terminology_concept"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_detail_fountain_pen" ADD CONSTRAINT "product_detail_fountain_pen_eXLrrVHsWQZr_fkey" FOREIGN KEY ("body_silhouette_id") REFERENCES "catalog_terminology_concept"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_detail_fountain_pen" ADD CONSTRAINT "product_detail_fountain_pen_rdtfm8hqWUmc_fkey" FOREIGN KEY ("cross_section_id") REFERENCES "catalog_terminology_concept"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_detail_fountain_pen" ADD CONSTRAINT "product_detail_fountain_pen_IB9MmzSpuOUs_fkey" FOREIGN KEY ("form_factor_id") REFERENCES "catalog_terminology_concept"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_detail_fountain_pen" ADD CONSTRAINT "product_detail_fountain_pen_EqrvDemmNWuG_fkey" FOREIGN KEY ("cap_closure_id") REFERENCES "catalog_terminology_concept"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_detail_fountain_pen" ADD CONSTRAINT "product_detail_fountain_pen_OlBA3wCj8MtB_fkey" FOREIGN KEY ("nib_deployment_id") REFERENCES "catalog_terminology_concept"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_detail_fountain_pen" ADD CONSTRAINT "product_detail_fountain_pen_tcd9L72hbQpy_fkey" FOREIGN KEY ("default_nib_product_id") REFERENCES "product_detail_nib"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_detail_nib" ADD CONSTRAINT "product_detail_nib_id_product_id_fkey" FOREIGN KEY ("id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_detail_nib" ADD CONSTRAINT "product_detail_nib_O7vuAPMVkTtb_fkey" FOREIGN KEY ("size_family_id") REFERENCES "catalog_terminology_concept"("id") ON DELETE RESTRICT;