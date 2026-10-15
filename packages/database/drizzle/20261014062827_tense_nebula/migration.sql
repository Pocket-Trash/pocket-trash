CREATE TABLE "collection_item_ownership_period" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collection_item_ownership_period_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"collection_item_id" bigint NOT NULL,
	"effective_start_date" date NOT NULL,
	"start_date_imputed" boolean DEFAULT false NOT NULL,
	"entry_reason" text NOT NULL,
	"effective_end_date" date,
	"exit_reason" text,
	"started_recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_recorded_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_item_ownership_period_entry_reason_valid" CHECK ("entry_reason" in ('purchase', 'gift', 'trade', 'made', 'other', 'unknown')),
	CONSTRAINT "collection_item_ownership_period_exit_reason_valid" CHECK ("exit_reason" is null or "exit_reason" in ('sale', 'gift', 'trade', 'lost', 'disposed', 'other')),
	CONSTRAINT "collection_item_ownership_period_end_metadata_consistent" CHECK (num_nonnulls("effective_end_date", "exit_reason", "ended_recorded_at") in (0, 3)),
	CONSTRAINT "collection_item_ownership_period_dates_ordered" CHECK ("effective_end_date" is null or "effective_end_date" >= "effective_start_date"),
	CONSTRAINT "collection_item_ownership_period_recorded_times_ordered" CHECK ("ended_recorded_at" is null or "ended_recorded_at" >= "started_recorded_at")
);
--> statement-breakpoint
INSERT INTO "collection_item_ownership_period" (
	"collection_item_id",
	"effective_start_date",
	"start_date_imputed",
	"entry_reason",
	"effective_end_date",
	"exit_reason",
	"started_recorded_at",
	"ended_recorded_at",
	"updated_at"
)
SELECT
	"id",
	(coalesce("purchased_at", "created_at") at time zone 'UTC')::date,
	"purchased_at" is null,
	case when "purchased_at" is null then 'unknown' else 'purchase' end,
	case when not "owned" or "sold_at" is not null then (greatest(coalesce("sold_at", "updated_at"), coalesce("purchased_at", "created_at")) at time zone 'UTC')::date end,
	case when not "owned" or "sold_at" is not null then case when "sold_at" is null then 'other' else 'sale' end end,
	"created_at",
	case when not "owned" or "sold_at" is not null then greatest("created_at", coalesce("sold_at", "updated_at")) end,
	greatest("created_at", "updated_at", coalesce("purchased_at", '-infinity'::timestamptz), coalesce("sold_at", '-infinity'::timestamptz))
FROM "collection_item";
--> statement-breakpoint
CREATE INDEX "collection_item_ownership_period_item_date_idx" ON "collection_item_ownership_period" ("collection_item_id","effective_start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_item_ownership_period_open_unique" ON "collection_item_ownership_period" ("collection_item_id") WHERE "effective_end_date" is null;--> statement-breakpoint
ALTER TABLE "collection_item_ownership_period" ADD CONSTRAINT "collection_item_ownership_period_5HCjo1xxywPQ_fkey" FOREIGN KEY ("collection_item_id") REFERENCES "collection_item"("id") ON DELETE CASCADE;
