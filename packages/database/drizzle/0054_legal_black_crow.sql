CREATE TABLE "compatibility_family" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "compatibility_family_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"maker_id" bigint NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_compatibility_advisory" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_compatibility_advisory_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_id" bigint NOT NULL,
	"related_product_id" bigint NOT NULL,
	"text" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by_clerk_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_compatibility_advisory_product_related_text_unique" UNIQUE("product_id","related_product_id","text"),
	CONSTRAINT "product_compatibility_advisory_distinct_products" CHECK ("product_compatibility_advisory"."product_id" <> "product_compatibility_advisory"."related_product_id"),
	CONSTRAINT "product_compatibility_advisory_text_valid" CHECK (char_length(trim("product_compatibility_advisory"."text")) between 1 and 1000)
);
--> statement-breakpoint
CREATE TABLE "product_compatibility_family" (
	"product_id" bigint NOT NULL,
	"compatibility_family_id" bigint NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by_clerk_id" text NOT NULL,
	CONSTRAINT "product_compatibility_family_product_id_compatibility_family_id_pk" PRIMARY KEY("product_id","compatibility_family_id")
);
--> statement-breakpoint
CREATE TABLE "product_included_component" (
	"product_id" bigint NOT NULL,
	"component_product_id" bigint NOT NULL,
	CONSTRAINT "product_included_component_product_id_component_product_id_pk" PRIMARY KEY("product_id","component_product_id"),
	CONSTRAINT "product_included_component_distinct_products" CHECK ("product_included_component"."product_id" <> "product_included_component"."component_product_id")
);
--> statement-breakpoint
CREATE TABLE "product_slider" (
	"id" bigint PRIMARY KEY NOT NULL,
	"magnet_system" text NOT NULL,
	"weight_g" numeric,
	"weight_basis" text,
	"length_mm" numeric,
	"width_mm" numeric,
	"thickness_mm" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_slider_magnet_system_valid" CHECK ("product_slider"."magnet_system" in ('body-hosted', 'insert-driven')),
	CONSTRAINT "product_slider_weight_basis_consistent" CHECK (num_nonnulls("product_slider"."weight_g", "product_slider"."weight_basis") in (0, 2)),
	CONSTRAINT "product_slider_weight_basis_valid" CHECK ("product_slider"."weight_basis" is null or "product_slider"."weight_basis" in ('body-only', 'complete-build')),
	CONSTRAINT "product_slider_measurements_positive" CHECK ("product_slider"."weight_g" > 0 and "product_slider"."length_mm" > 0 and "product_slider"."width_mm" > 0 and "product_slider"."thickness_mm" > 0)
);
--> statement-breakpoint
CREATE TABLE "product_slider_insert" (
	"id" bigint PRIMARY KEY NOT NULL,
	"weight_g" numeric,
	"length_mm" numeric,
	"width_mm" numeric,
	"thickness_mm" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_slider_insert_measurements_positive" CHECK ("product_slider_insert"."weight_g" > 0 and "product_slider_insert"."length_mm" > 0 and "product_slider_insert"."width_mm" > 0 and "product_slider_insert"."thickness_mm" > 0)
);
--> statement-breakpoint
CREATE TABLE "product_slider_plate" (
	"id" bigint PRIMARY KEY NOT NULL,
	"weight_g" numeric,
	"length_mm" numeric,
	"width_mm" numeric,
	"thickness_mm" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_slider_plate_measurements_positive" CHECK ("product_slider_plate"."weight_g" > 0 and "product_slider_plate"."length_mm" > 0 and "product_slider_plate"."width_mm" > 0 and "product_slider_plate"."thickness_mm" > 0)
);
--> statement-breakpoint
ALTER TABLE "compatibility_family" ADD CONSTRAINT "compatibility_family_maker_id_makers_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."makers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_compatibility_advisory" ADD CONSTRAINT "product_compatibility_advisory_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_compatibility_advisory" ADD CONSTRAINT "product_compatibility_advisory_related_product_id_product_id_fk" FOREIGN KEY ("related_product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_compatibility_family" ADD CONSTRAINT "product_compatibility_family_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_compatibility_family" ADD CONSTRAINT "product_compatibility_family_compatibility_family_id_compatibility_family_id_fk" FOREIGN KEY ("compatibility_family_id") REFERENCES "public"."compatibility_family"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_included_component" ADD CONSTRAINT "product_included_component_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_included_component" ADD CONSTRAINT "product_included_component_component_product_id_product_id_fk" FOREIGN KEY ("component_product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_slider" ADD CONSTRAINT "product_slider_id_product_id_fk" FOREIGN KEY ("id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_slider_insert" ADD CONSTRAINT "product_slider_insert_id_product_id_fk" FOREIGN KEY ("id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_slider_plate" ADD CONSTRAINT "product_slider_plate_id_product_id_fk" FOREIGN KEY ("id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "compatibility_family_maker_name_unique" ON "compatibility_family" USING btree ("maker_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "compatibility_family_maker_slug_unique" ON "compatibility_family" USING btree ("maker_id","slug");--> statement-breakpoint
CREATE INDEX "product_compatibility_advisory_related_idx" ON "product_compatibility_advisory" USING btree ("related_product_id");--> statement-breakpoint
CREATE INDEX "product_compatibility_family_family_idx" ON "product_compatibility_family" USING btree ("compatibility_family_id");--> statement-breakpoint
CREATE INDEX "product_included_component_component_idx" ON "product_included_component" USING btree ("component_product_id");