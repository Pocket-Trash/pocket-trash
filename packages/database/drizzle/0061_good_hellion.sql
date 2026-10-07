CREATE TABLE "magnet_configuration_template" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "magnet_configuration_template_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"scope" text NOT NULL,
	"maker_id" bigint,
	"compatibility_family_id" bigint,
	"configuration" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "magnet_configuration_template_scope_name_unique" UNIQUE NULLS NOT DISTINCT("scope","maker_id","compatibility_family_id","normalized_name"),
	CONSTRAINT "magnet_configuration_template_name_valid" CHECK (char_length(trim("magnet_configuration_template"."name")) between 1 and 100),
	CONSTRAINT "magnet_configuration_template_scope_valid" CHECK (("magnet_configuration_template"."scope" = 'global' and num_nonnulls("magnet_configuration_template"."maker_id", "magnet_configuration_template"."compatibility_family_id") = 0) or ("magnet_configuration_template"."scope" = 'maker' and "magnet_configuration_template"."maker_id" is not null and "magnet_configuration_template"."compatibility_family_id" is null) or ("magnet_configuration_template"."scope" = 'family' and "magnet_configuration_template"."maker_id" is null and "magnet_configuration_template"."compatibility_family_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "product_insert_click_option" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_insert_click_option_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"insert_product_id" bigint NOT NULL,
	"click_count" integer NOT NULL,
	"insertion_position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_insert_click_option_id_product_unique" UNIQUE("id","insert_product_id"),
	CONSTRAINT "product_insert_click_option_product_count_unique" UNIQUE("insert_product_id","click_count"),
	CONSTRAINT "product_insert_click_option_product_position_unique" UNIQUE("insert_product_id","insertion_position"),
	CONSTRAINT "product_insert_click_option_click_count_positive" CHECK ("product_insert_click_option"."click_count" > 0),
	CONSTRAINT "product_insert_click_option_position_nonnegative" CHECK ("product_insert_click_option"."insertion_position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_insert_magnet_group" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_insert_magnet_group_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"offer_id" bigint NOT NULL,
	"group_key" text NOT NULL,
	"group_label_id" bigint NOT NULL,
	"diameter_mm" numeric NOT NULL,
	"thickness_mm" numeric NOT NULL,
	"grade" text NOT NULL,
	"display_order" integer NOT NULL,
	CONSTRAINT "product_insert_magnet_group_id_offer_unique" UNIQUE("id","offer_id"),
	CONSTRAINT "product_insert_magnet_group_offer_key_unique" UNIQUE("offer_id","group_key"),
	CONSTRAINT "product_insert_magnet_group_offer_order_unique" UNIQUE("offer_id","display_order"),
	CONSTRAINT "product_insert_magnet_group_key_valid" CHECK (char_length(trim("product_insert_magnet_group"."group_key")) between 1 and 100),
	CONSTRAINT "product_insert_magnet_group_dimensions_positive" CHECK ("product_insert_magnet_group"."diameter_mm" > 0 and "product_insert_magnet_group"."thickness_mm" > 0),
	CONSTRAINT "product_insert_magnet_group_grade_normalized" CHECK ("product_insert_magnet_group"."grade" ~ '^[A-Z0-9][A-Z0-9+_-]{0,19}$'),
	CONSTRAINT "product_insert_magnet_group_display_order_nonnegative" CHECK ("product_insert_magnet_group"."display_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_insert_magnet_offer" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_insert_magnet_offer_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"insert_product_id" bigint NOT NULL,
	"configuration_label_id" bigint NOT NULL,
	"click_option_id" bigint,
	"is_advertised_default" boolean DEFAULT false NOT NULL,
	"copied_from_template_id" bigint,
	"source_label" text,
	"source_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_insert_magnet_offer_id_product_unique" UNIQUE("id","insert_product_id"),
	CONSTRAINT "product_insert_magnet_offer_source_label_valid" CHECK ("product_insert_magnet_offer"."source_label" is null or char_length(trim("product_insert_magnet_offer"."source_label")) between 1 and 200),
	CONSTRAINT "product_insert_magnet_offer_source_notes_valid" CHECK ("product_insert_magnet_offer"."source_notes" is null or char_length(trim("product_insert_magnet_offer"."source_notes")) between 1 and 5000)
);
--> statement-breakpoint
CREATE TABLE "product_insert_magnet_slot" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_insert_magnet_slot_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"offer_id" bigint NOT NULL,
	"slot_key" text NOT NULL,
	"half" text NOT NULL,
	"state" text NOT NULL,
	"group_id" bigint,
	"documented_row" integer,
	"documented_column" integer,
	"display_order" integer NOT NULL,
	CONSTRAINT "product_insert_magnet_slot_offer_key_unique" UNIQUE("offer_id","slot_key"),
	CONSTRAINT "product_insert_magnet_slot_offer_order_unique" UNIQUE("offer_id","display_order"),
	CONSTRAINT "product_insert_magnet_slot_key_valid" CHECK (char_length(trim("product_insert_magnet_slot"."slot_key")) between 1 and 100),
	CONSTRAINT "product_insert_magnet_slot_half_valid" CHECK ("product_insert_magnet_slot"."half" in ('half-a', 'half-b')),
	CONSTRAINT "product_insert_magnet_slot_state_valid" CHECK ("product_insert_magnet_slot"."state" in ('occupied', 'empty')),
	CONSTRAINT "product_insert_magnet_slot_state_group_consistent" CHECK (("product_insert_magnet_slot"."state" = 'occupied' and "product_insert_magnet_slot"."group_id" is not null) or ("product_insert_magnet_slot"."state" = 'empty' and "product_insert_magnet_slot"."group_id" is null)),
	CONSTRAINT "product_insert_magnet_slot_documented_position_positive" CHECK (("product_insert_magnet_slot"."documented_row" is null or "product_insert_magnet_slot"."documented_row" > 0) and ("product_insert_magnet_slot"."documented_column" is null or "product_insert_magnet_slot"."documented_column" > 0)),
	CONSTRAINT "product_insert_magnet_slot_display_order_nonnegative" CHECK ("product_insert_magnet_slot"."display_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_slider_insert_offer" (
	"slider_product_id" bigint NOT NULL,
	"insert_offer_id" bigint NOT NULL,
	"insert_product_id" bigint NOT NULL,
	"is_advertised_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_slider_insert_offer_slider_product_id_insert_offer_id_pk" PRIMARY KEY("slider_product_id","insert_offer_id")
);
--> statement-breakpoint
ALTER TABLE "magnet_configuration_template" ADD CONSTRAINT "magnet_configuration_template_maker_id_makers_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."makers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magnet_configuration_template" ADD CONSTRAINT "magnet_configuration_template_compatibility_family_id_compatibility_family_id_fk" FOREIGN KEY ("compatibility_family_id") REFERENCES "public"."compatibility_family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_insert_click_option" ADD CONSTRAINT "product_insert_click_option_insert_product_id_product_slider_insert_id_fk" FOREIGN KEY ("insert_product_id") REFERENCES "public"."product_slider_insert"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_insert_magnet_group" ADD CONSTRAINT "product_insert_magnet_group_offer_id_product_insert_magnet_offer_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."product_insert_magnet_offer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_insert_magnet_group" ADD CONSTRAINT "product_insert_magnet_group_group_label_id_magnet_group_label_id_fk" FOREIGN KEY ("group_label_id") REFERENCES "public"."magnet_group_label"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_insert_magnet_offer" ADD CONSTRAINT "product_insert_magnet_offer_insert_product_id_product_slider_insert_id_fk" FOREIGN KEY ("insert_product_id") REFERENCES "public"."product_slider_insert"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_insert_magnet_offer" ADD CONSTRAINT "product_insert_magnet_offer_configuration_label_id_magnet_configuration_label_id_fk" FOREIGN KEY ("configuration_label_id") REFERENCES "public"."magnet_configuration_label"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_insert_magnet_offer" ADD CONSTRAINT "product_insert_magnet_offer_copied_from_template_id_magnet_configuration_template_id_fk" FOREIGN KEY ("copied_from_template_id") REFERENCES "public"."magnet_configuration_template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_insert_magnet_offer" ADD CONSTRAINT "product_insert_magnet_offer_click_option_product_fk" FOREIGN KEY ("click_option_id","insert_product_id") REFERENCES "public"."product_insert_click_option"("id","insert_product_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_insert_magnet_slot" ADD CONSTRAINT "product_insert_magnet_slot_offer_id_product_insert_magnet_offer_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."product_insert_magnet_offer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_insert_magnet_slot" ADD CONSTRAINT "product_insert_magnet_slot_group_offer_fk" FOREIGN KEY ("group_id","offer_id") REFERENCES "public"."product_insert_magnet_group"("id","offer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_slider_insert_offer" ADD CONSTRAINT "product_slider_insert_offer_slider_product_id_product_slider_id_fk" FOREIGN KEY ("slider_product_id") REFERENCES "public"."product_slider"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_slider_insert_offer" ADD CONSTRAINT "product_slider_insert_offer_exact_offer_fk" FOREIGN KEY ("insert_offer_id","insert_product_id") REFERENCES "public"."product_insert_magnet_offer"("id","insert_product_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_insert_magnet_offer_advertised_default_unique" ON "product_insert_magnet_offer" USING btree ("insert_product_id") WHERE "product_insert_magnet_offer"."is_advertised_default";--> statement-breakpoint
CREATE UNIQUE INDEX "product_slider_insert_offer_advertised_default_unique" ON "product_slider_insert_offer" USING btree ("slider_product_id") WHERE "product_slider_insert_offer"."is_advertised_default";