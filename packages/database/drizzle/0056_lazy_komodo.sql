CREATE TABLE "magnet_configuration_label" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "magnet_configuration_label_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "magnet_configuration_label_normalized_name_unique" UNIQUE("normalized_name"),
	CONSTRAINT "magnet_configuration_label_name_valid" CHECK (char_length(trim("magnet_configuration_label"."name")) between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "magnet_group_label" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "magnet_group_label_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "magnet_group_label_normalized_name_unique" UNIQUE("normalized_name"),
	CONSTRAINT "magnet_group_label_name_valid" CHECK (char_length(trim("magnet_group_label"."name")) between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "product_magnet_configuration" (
	"product_id" bigint PRIMARY KEY NOT NULL,
	"configuration_label_id" bigint NOT NULL,
	"source_label" text,
	"source_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_magnet_configuration_source_label_valid" CHECK ("product_magnet_configuration"."source_label" is null or char_length(trim("product_magnet_configuration"."source_label")) between 1 and 200),
	CONSTRAINT "product_magnet_configuration_source_notes_valid" CHECK ("product_magnet_configuration"."source_notes" is null or char_length(trim("product_magnet_configuration"."source_notes")) between 1 and 5000)
);
--> statement-breakpoint
CREATE TABLE "product_magnet_group" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_magnet_group_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"configuration_product_id" bigint NOT NULL,
	"group_key" text NOT NULL,
	"group_label_id" bigint NOT NULL,
	"diameter_mm" numeric NOT NULL,
	"thickness_mm" numeric NOT NULL,
	"grade" text NOT NULL,
	"display_order" integer NOT NULL,
	CONSTRAINT "product_magnet_group_id_configuration_unique" UNIQUE("id","configuration_product_id"),
	CONSTRAINT "product_magnet_group_configuration_key_unique" UNIQUE("configuration_product_id","group_key"),
	CONSTRAINT "product_magnet_group_configuration_order_unique" UNIQUE("configuration_product_id","display_order"),
	CONSTRAINT "product_magnet_group_key_valid" CHECK (char_length(trim("product_magnet_group"."group_key")) between 1 and 100),
	CONSTRAINT "product_magnet_group_dimensions_positive" CHECK ("product_magnet_group"."diameter_mm" > 0 and "product_magnet_group"."thickness_mm" > 0),
	CONSTRAINT "product_magnet_group_grade_normalized" CHECK ("product_magnet_group"."grade" ~ '^[A-Z0-9][A-Z0-9+_-]{0,19}$'),
	CONSTRAINT "product_magnet_group_display_order_nonnegative" CHECK ("product_magnet_group"."display_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_magnet_slot" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_magnet_slot_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"configuration_product_id" bigint NOT NULL,
	"slot_key" text NOT NULL,
	"half" text NOT NULL,
	"state" text NOT NULL,
	"group_id" bigint,
	"documented_row" integer,
	"documented_column" integer,
	"display_order" integer NOT NULL,
	CONSTRAINT "product_magnet_slot_configuration_key_unique" UNIQUE("configuration_product_id","slot_key"),
	CONSTRAINT "product_magnet_slot_configuration_order_unique" UNIQUE("configuration_product_id","display_order"),
	CONSTRAINT "product_magnet_slot_key_valid" CHECK (char_length(trim("product_magnet_slot"."slot_key")) between 1 and 100),
	CONSTRAINT "product_magnet_slot_half_valid" CHECK ("product_magnet_slot"."half" in ('half-a', 'half-b')),
	CONSTRAINT "product_magnet_slot_state_valid" CHECK ("product_magnet_slot"."state" in ('occupied', 'empty')),
	CONSTRAINT "product_magnet_slot_state_group_consistent" CHECK (("product_magnet_slot"."state" = 'occupied' and "product_magnet_slot"."group_id" is not null) or ("product_magnet_slot"."state" = 'empty' and "product_magnet_slot"."group_id" is null)),
	CONSTRAINT "product_magnet_slot_documented_position_positive" CHECK (("product_magnet_slot"."documented_row" is null or "product_magnet_slot"."documented_row" > 0) and ("product_magnet_slot"."documented_column" is null or "product_magnet_slot"."documented_column" > 0)),
	CONSTRAINT "product_magnet_slot_display_order_nonnegative" CHECK ("product_magnet_slot"."display_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "product_slider" ADD COLUMN "inherent_click_count" integer;--> statement-breakpoint
ALTER TABLE "product_slider" ADD COLUMN "magnet_setup_source_note" text;--> statement-breakpoint
ALTER TABLE "product_magnet_configuration" ADD CONSTRAINT "product_magnet_configuration_product_id_product_slider_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product_slider"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_magnet_configuration" ADD CONSTRAINT "product_magnet_configuration_configuration_label_id_magnet_configuration_label_id_fk" FOREIGN KEY ("configuration_label_id") REFERENCES "public"."magnet_configuration_label"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_magnet_group" ADD CONSTRAINT "product_magnet_group_configuration_product_id_product_magnet_configuration_product_id_fk" FOREIGN KEY ("configuration_product_id") REFERENCES "public"."product_magnet_configuration"("product_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_magnet_group" ADD CONSTRAINT "product_magnet_group_group_label_id_magnet_group_label_id_fk" FOREIGN KEY ("group_label_id") REFERENCES "public"."magnet_group_label"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_magnet_slot" ADD CONSTRAINT "product_magnet_slot_configuration_product_id_product_magnet_configuration_product_id_fk" FOREIGN KEY ("configuration_product_id") REFERENCES "public"."product_magnet_configuration"("product_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_magnet_slot" ADD CONSTRAINT "product_magnet_slot_group_configuration_fk" FOREIGN KEY ("group_id","configuration_product_id") REFERENCES "public"."product_magnet_group"("id","configuration_product_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_slider" ADD CONSTRAINT "product_slider_inherent_click_count_positive" CHECK ("product_slider"."inherent_click_count" is null or "product_slider"."inherent_click_count" > 0);--> statement-breakpoint
ALTER TABLE "product_slider" ADD CONSTRAINT "product_slider_setup_source_note_valid" CHECK ("product_slider"."magnet_setup_source_note" is null or char_length(trim("product_slider"."magnet_setup_source_note")) between 1 and 5000);