CREATE TABLE "pattern" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pattern_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finish_option" ADD COLUMN "pattern_id" bigint;--> statement-breakpoint
CREATE UNIQUE INDEX "pattern_name_case_insensitive_unique" ON "pattern" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "pattern_slug_unique" ON "pattern" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "finish_option" ADD CONSTRAINT "finish_option_pattern_id_pattern_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."pattern"("id") ON DELETE restrict ON UPDATE no action;