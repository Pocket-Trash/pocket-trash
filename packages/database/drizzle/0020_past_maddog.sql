CREATE TABLE "color" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "color_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "color_effect" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "color_effect_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finish" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "finish_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finish_option" (
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
CREATE TABLE "finish_option_color" (
	"finish_option_id" bigint NOT NULL,
	"color_id" bigint NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "finish_option_color_finish_option_id_color_id_pk" PRIMARY KEY("finish_option_id","color_id"),
	CONSTRAINT "finish_option_color_position_check" CHECK ("finish_option_color"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "finish_option_finish" (
	"finish_option_id" bigint NOT NULL,
	"finish_id" bigint NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "finish_option_finish_finish_option_id_finish_id_pk" PRIMARY KEY("finish_option_id","finish_id"),
	CONSTRAINT "finish_option_finish_position_check" CHECK ("finish_option_finish"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "finish_option" ADD CONSTRAINT "finish_option_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finish_option" ADD CONSTRAINT "finish_option_collection_item_id_collection_item_id_fk" FOREIGN KEY ("collection_item_id") REFERENCES "public"."collection_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finish_option" ADD CONSTRAINT "finish_option_source_product_finish_option_id_finish_option_id_fk" FOREIGN KEY ("source_product_finish_option_id") REFERENCES "public"."finish_option"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finish_option" ADD CONSTRAINT "finish_option_color_effect_id_color_effect_id_fk" FOREIGN KEY ("color_effect_id") REFERENCES "public"."color_effect"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finish_option_color" ADD CONSTRAINT "finish_option_color_finish_option_id_finish_option_id_fk" FOREIGN KEY ("finish_option_id") REFERENCES "public"."finish_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finish_option_color" ADD CONSTRAINT "finish_option_color_color_id_color_id_fk" FOREIGN KEY ("color_id") REFERENCES "public"."color"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finish_option_finish" ADD CONSTRAINT "finish_option_finish_finish_option_id_finish_option_id_fk" FOREIGN KEY ("finish_option_id") REFERENCES "public"."finish_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finish_option_finish" ADD CONSTRAINT "finish_option_finish_finish_id_finish_id_fk" FOREIGN KEY ("finish_id") REFERENCES "public"."finish"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "color_slug_unique" ON "color" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "color_effect_slug_unique" ON "color_effect" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "finish_slug_unique" ON "finish" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "finish_option_collection_item_unique" ON "finish_option" USING btree ("collection_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "finish_option_product_position_unique" ON "finish_option" USING btree ("product_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "finish_option_color_position_unique" ON "finish_option_color" USING btree ("finish_option_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "finish_option_finish_position_unique" ON "finish_option_finish" USING btree ("finish_option_id","position");