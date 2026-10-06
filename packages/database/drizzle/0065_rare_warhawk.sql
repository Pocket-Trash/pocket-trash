CREATE TABLE "catalog_manifest_application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manifest_version" text NOT NULL,
	"manifest_hash" text NOT NULL,
	"approval_payload_hash" text NOT NULL,
	"operation" text NOT NULL,
	"environment" text NOT NULL,
	"owner_clerk_id" text NOT NULL,
	"actor_clerk_id" text NOT NULL,
	"record_count" bigint NOT NULL,
	"image_count" bigint NOT NULL,
	"total_bytes" bigint NOT NULL,
	"outcome" text DEFAULT 'running' NOT NULL,
	"error_code" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "catalog_manifest_application_hash_valid" CHECK ("catalog_manifest_application"."manifest_hash" ~ '^[0-9a-f]{64}$' and "catalog_manifest_application"."approval_payload_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "catalog_manifest_application_counts_valid" CHECK ("catalog_manifest_application"."record_count" >= 0 and "catalog_manifest_application"."image_count" >= 0 and "catalog_manifest_application"."total_bytes" >= 0),
	CONSTRAINT "catalog_manifest_application_outcome_valid" CHECK ("catalog_manifest_application"."outcome" in ('running', 'succeeded', 'failed', 'rolled_back')),
	CONSTRAINT "catalog_manifest_application_operation_valid" CHECK ("catalog_manifest_application"."operation" in ('apply', 'rollback')),
	CONSTRAINT "catalog_manifest_application_environment_valid" CHECK ("catalog_manifest_application"."environment" in ('development', 'preview', 'production')),
	CONSTRAINT "catalog_manifest_application_terminal_consistent" CHECK (("catalog_manifest_application"."outcome" = 'running' and "catalog_manifest_application"."finished_at" is null and "catalog_manifest_application"."error_code" is null)
        or ("catalog_manifest_application"."outcome" = 'failed' and "catalog_manifest_application"."finished_at" is not null and "catalog_manifest_application"."error_code" is not null)
        or ("catalog_manifest_application"."outcome" in ('succeeded', 'rolled_back') and "catalog_manifest_application"."finished_at" is not null and "catalog_manifest_application"."error_code" is null))
);
--> statement-breakpoint
CREATE TABLE "catalog_manifest_object" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "catalog_manifest_object_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"application_id" uuid NOT NULL,
	"manifest_hash" text NOT NULL,
	"image_key" text NOT NULL,
	"owner_record_key" text NOT NULL,
	"object_path" text NOT NULL,
	"url" text NOT NULL,
	"sha256" text NOT NULL,
	"size" bigint NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rolled_back_at" timestamp with time zone,
	CONSTRAINT "catalog_manifest_object_hashes_valid" CHECK ("catalog_manifest_object"."manifest_hash" ~ '^[0-9a-f]{64}$' and "catalog_manifest_object"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "catalog_manifest_object_size_positive" CHECK ("catalog_manifest_object"."size" > 0),
	CONSTRAINT "catalog_manifest_object_state_valid" CHECK ("catalog_manifest_object"."state" in ('active', 'rolled_back')),
	CONSTRAINT "catalog_manifest_object_state_consistent" CHECK (("catalog_manifest_object"."state" = 'active' and "catalog_manifest_object"."rolled_back_at" is null)
        or ("catalog_manifest_object"."state" = 'rolled_back' and "catalog_manifest_object"."rolled_back_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "catalog_manifest_record" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "catalog_manifest_record_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"application_id" uuid NOT NULL,
	"manifest_hash" text NOT NULL,
	"record_key" text NOT NULL,
	"entity_type" text NOT NULL,
	"record_id" text NOT NULL,
	"applied_fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rolled_back_at" timestamp with time zone,
	CONSTRAINT "catalog_manifest_record_hashes_valid" CHECK ("catalog_manifest_record"."manifest_hash" ~ '^[0-9a-f]{64}$' and "catalog_manifest_record"."applied_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "catalog_manifest_record_identity_valid" CHECK (char_length(trim("catalog_manifest_record"."record_key")) between 1 and 200
        and char_length(trim("catalog_manifest_record"."entity_type")) between 1 and 100
        and char_length(trim("catalog_manifest_record"."record_id")) between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "catalog_manifest_object" ADD CONSTRAINT "catalog_manifest_object_application_id_catalog_manifest_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."catalog_manifest_application"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_manifest_record" ADD CONSTRAINT "catalog_manifest_record_application_id_catalog_manifest_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."catalog_manifest_application"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_manifest_application_hash_started_idx" ON "catalog_manifest_application" USING btree ("manifest_hash","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_manifest_object_hash_key_unique" ON "catalog_manifest_object" USING btree ("manifest_hash","image_key");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_manifest_object_path_unique" ON "catalog_manifest_object" USING btree ("object_path");--> statement-breakpoint
CREATE INDEX "catalog_manifest_object_application_idx" ON "catalog_manifest_object" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_manifest_record_hash_key_unique" ON "catalog_manifest_record" USING btree ("manifest_hash","record_key");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_manifest_record_active_entity_unique" ON "catalog_manifest_record" USING btree ("entity_type","record_id") WHERE "catalog_manifest_record"."rolled_back_at" is null;--> statement-breakpoint
CREATE INDEX "catalog_manifest_record_application_idx" ON "catalog_manifest_record" USING btree ("application_id");--> statement-breakpoint
CREATE FUNCTION "protect_terminal_catalog_manifest_application"() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'DELETE'
		OR OLD."finished_at" IS NOT NULL
		OR NEW."id" IS DISTINCT FROM OLD."id"
		OR NEW."manifest_version" IS DISTINCT FROM OLD."manifest_version"
		OR NEW."manifest_hash" IS DISTINCT FROM OLD."manifest_hash"
		OR NEW."approval_payload_hash" IS DISTINCT FROM OLD."approval_payload_hash"
		OR NEW."operation" IS DISTINCT FROM OLD."operation"
		OR NEW."environment" IS DISTINCT FROM OLD."environment"
		OR NEW."owner_clerk_id" IS DISTINCT FROM OLD."owner_clerk_id"
		OR NEW."actor_clerk_id" IS DISTINCT FROM OLD."actor_clerk_id"
		OR NEW."record_count" IS DISTINCT FROM OLD."record_count"
		OR NEW."image_count" IS DISTINCT FROM OLD."image_count"
		OR NEW."total_bytes" IS DISTINCT FROM OLD."total_bytes"
		OR NEW."started_at" IS DISTINCT FROM OLD."started_at"
		OR NEW."outcome" = 'running'
	THEN
		RAISE EXCEPTION 'catalog manifest application history is immutable';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "catalog_manifest_application_immutable"
BEFORE UPDATE OR DELETE ON "catalog_manifest_application"
FOR EACH ROW EXECUTE FUNCTION "protect_terminal_catalog_manifest_application"();
