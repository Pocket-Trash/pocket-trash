CREATE TYPE "feature_flag_audience" AS ENUM('global', 'admin', 'user');--> statement-breakpoint
CREATE TYPE "feature_flag_override_source" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TYPE "currency_code" AS ENUM('CAD', 'USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CHF', 'NZD');--> statement-breakpoint
CREATE TYPE "dimension_unit" AS ENUM('in', 'mm');--> statement-breakpoint
CREATE TYPE "measurement_system" AS ENUM('metric', 'imperial');--> statement-breakpoint
CREATE TYPE "theme_mode" AS ENUM('dark', 'light', 'system');--> statement-breakpoint
CREATE TYPE "weight_unit" AS ENUM('g', 'oz');--> statement-breakpoint
CREATE TABLE "audit_delivery" (
	"delivery_key" text PRIMARY KEY,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_delivery_status_valid" CHECK ("status" in ('pending', 'processing', 'needs_attention')),
	CONSTRAINT "audit_delivery_attempts_valid" CHECK ("attempts" between 0 and 5),
	CONSTRAINT "audit_delivery_payload_size_valid" CHECK (octet_length("payload"::text) <= 270000)
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"actor_user_id" bigint,
	"owner_user_id" bigint,
	"actor_username" text,
	"actor_role" text NOT NULL,
	"authorization_type" text NOT NULL,
	"permission" text,
	"reason" text,
	"before_state" jsonb,
	"after_state" jsonb,
	"metadata" jsonb,
	"request_id" text,
	"correlation_id" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_event_actor_role_valid" CHECK ("actor_role" in ('user', 'editor', 'admin', 'system_admin', 'system')),
	CONSTRAINT "audit_event_authorization_valid" CHECK ("authorization_type" in ('owner', 'permission', 'system')),
	CONSTRAINT "audit_event_authorization_metadata_consistent" CHECK ((
        "authorization_type" = 'permission'
        and "permission" is not null
        and "actor_role" <> 'system'
      ) or (
        "authorization_type" = 'owner'
        and "permission" is null
        and "actor_role" <> 'system'
      ) or (
        "authorization_type" = 'system'
        and "permission" is null
        and "actor_role" = 'system'
        and "actor_user_id" is null
        and "actor_username" is null
      )),
	CONSTRAINT "audit_event_payload_shape_valid" CHECK (num_nonnulls("before_state", "after_state", "metadata") > 0
        and ("metadata" is null or ("before_state" is null and "after_state" is null))),
	CONSTRAINT "audit_event_payload_size_valid" CHECK (octet_length(coalesce("before_state"::text, ''))
        + octet_length(coalesce("after_state"::text, ''))
        + octet_length(coalesce("metadata"::text, '')) <= 262144),
	CONSTRAINT "audit_event_reason_nonblank" CHECK ("reason" is null or char_length(trim("reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "audit_export" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"requested_by_user_id" bigint,
	"requested_by_username" text,
	"requested_by_role" text NOT NULL,
	"reason" text NOT NULL,
	"cutoff_at" timestamp with time zone NOT NULL,
	"high_water_event_id" bigint NOT NULL,
	"high_water_recorded_at" timestamp with time zone NOT NULL,
	"event_count" integer NOT NULL,
	"sha256" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "audit_export_requester_role_valid" CHECK ("requested_by_role" in ('editor', 'admin', 'system_admin')),
	CONSTRAINT "audit_export_reason_valid" CHECK (char_length(trim("reason")) between 1 and 500),
	CONSTRAINT "audit_export_event_count_valid" CHECK ("event_count" between 1 and 10000),
	CONSTRAINT "audit_export_checksum_valid" CHECK ("sha256" is null or "sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "audit_export_completion_valid" CHECK (("completed_at" is null and "sha256" is null)
        or ("completed_at" is not null and "sha256" is not null)),
	CONSTRAINT "audit_export_consumption_valid" CHECK ("consumed_at" is null or "completed_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "catalog_manifest_application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
	CONSTRAINT "catalog_manifest_application_hash_valid" CHECK ("manifest_hash" ~ '^[0-9a-f]{64}$' and "approval_payload_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "catalog_manifest_application_counts_valid" CHECK ("record_count" >= 0 and "image_count" >= 0 and "total_bytes" >= 0),
	CONSTRAINT "catalog_manifest_application_outcome_valid" CHECK ("outcome" in ('running', 'succeeded', 'failed', 'rolled_back')),
	CONSTRAINT "catalog_manifest_application_operation_valid" CHECK ("operation" in ('apply', 'rollback')),
	CONSTRAINT "catalog_manifest_application_environment_valid" CHECK ("environment" in ('development', 'preview', 'production')),
	CONSTRAINT "catalog_manifest_application_terminal_consistent" CHECK (("outcome" = 'running' and "finished_at" is null and "error_code" is null)
        or ("outcome" = 'failed' and "finished_at" is not null and "error_code" is not null)
        or ("outcome" in ('succeeded', 'rolled_back') and "finished_at" is not null and "error_code" is null))
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
	CONSTRAINT "catalog_manifest_object_hashes_valid" CHECK ("manifest_hash" ~ '^[0-9a-f]{64}$' and "sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "catalog_manifest_object_size_positive" CHECK ("size" > 0),
	CONSTRAINT "catalog_manifest_object_state_valid" CHECK ("state" in ('active', 'rolled_back')),
	CONSTRAINT "catalog_manifest_object_state_consistent" CHECK (("state" = 'active' and "rolled_back_at" is null)
        or ("state" = 'rolled_back' and "rolled_back_at" is not null))
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
	CONSTRAINT "catalog_manifest_record_hashes_valid" CHECK ("manifest_hash" ~ '^[0-9a-f]{64}$' and "applied_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "catalog_manifest_record_identity_valid" CHECK (char_length(trim("record_key")) between 1 and 200
        and char_length(trim("entity_type")) between 1 and 100
        and char_length(trim("record_id")) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "catalog_terminology_alias" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "catalog_terminology_alias_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"maker_id" bigint NOT NULL,
	"canonical_namespace" text NOT NULL,
	"canonical_key" text NOT NULL,
	"label" text NOT NULL,
	"normalized_value" text NOT NULL,
	"is_preferred" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_terminology_alias_maker_concept_value_unique" UNIQUE("maker_id","canonical_namespace","canonical_key","normalized_value"),
	CONSTRAINT "catalog_terminology_alias_namespace_valid" CHECK ("canonical_namespace" = 'product-type'),
	CONSTRAINT "catalog_terminology_alias_label_valid" CHECK (char_length(trim("label")) between 1 and 80),
	CONSTRAINT "catalog_terminology_alias_normalized_value_valid" CHECK (char_length("normalized_value") between 1 and 80 and "normalized_value" = lower(trim("normalized_value")))
);
--> statement-breakpoint
CREATE TABLE "collection_detail_slider" (
	"id" bigint PRIMARY KEY,
	"product_slider_id" bigint NOT NULL,
	"installed_plate_id" bigint,
	"installed_insert_id" bigint,
	"magnet_configuration" jsonb
);
--> statement-breakpoint
CREATE TABLE "collection_detail_slider_insert" (
	"id" bigint PRIMARY KEY,
	"product_slider_insert_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_detail_slider_plate" (
	"id" bigint PRIMARY KEY,
	"product_slider_plate_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_detail_spinner" (
	"id" bigint PRIMARY KEY,
	"product_spinner_id" bigint NOT NULL,
	"installed_button_id" bigint,
	"bearing" text,
	CONSTRAINT "collection_detail_spinner_bearing_length_valid" CHECK ("bearing" is null or char_length("bearing") <= 200)
);
--> statement-breakpoint
CREATE TABLE "collection_detail_spinner_button" (
	"id" bigint PRIMARY KEY,
	"product_spinner_button_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_image" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collection_image_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"collection_id" bigint NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"storage_provider" text DEFAULT 'bunny' NOT NULL,
	"object_path" text NOT NULL CONSTRAINT "collection_image_object_path_unique" UNIQUE,
	"url" text NOT NULL,
	"uploaded_by_clerk_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_image_collection_hash_unique" UNIQUE("collection_id","sha256"),
	CONSTRAINT "collection_image_position_valid" CHECK ("position" >= 0),
	CONSTRAINT "collection_image_size_positive" CHECK ("size" > 0),
	CONSTRAINT "collection_image_sha256_valid" CHECK ("sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "collection_item" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collection_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"owner_id" bigint NOT NULL,
	"collection_id" bigint NOT NULL,
	"display_name" text,
	"description" text,
	"material_id" bigint,
	"purchased_at" timestamp with time zone,
	"sold_at" timestamp with time zone,
	"purchased_from_user_id" bigint,
	"purchased_from_user" text,
	"sold_to_user_id" bigint,
	"sold_to_user" text,
	"owned" boolean DEFAULT true NOT NULL,
	"approval_status" text DEFAULT 'pending' NOT NULL,
	"approval_decision_reason" text,
	"approval_decided_at" timestamp with time zone,
	"is_private" boolean DEFAULT false NOT NULL,
	"private_reason" text,
	"privated_at" timestamp with time zone,
	"privated_by_clerk_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_item_approval_status_valid" CHECK ("approval_status" in ('pending', 'approved', 'rejected')),
	CONSTRAINT "collection_item_approval_decision_metadata_consistent" CHECK (num_nonnulls("approval_decision_reason", "approval_decided_at") in (0, 2)),
	CONSTRAINT "collection_item_approval_reason_valid" CHECK ("approval_decision_reason" is null or char_length(trim("approval_decision_reason")) between 1 and 1000),
	CONSTRAINT "collection_item_private_metadata_consistent" CHECK ((not "is_private" and num_nonnulls("private_reason", "privated_at", "privated_by_clerk_id") = 0) or ("is_private" and (num_nonnulls("private_reason", "privated_at", "privated_by_clerk_id") = 0 or ("private_reason" is not null and "privated_at" is not null)))),
	CONSTRAINT "collection_item_description_length_valid" CHECK ("description" is null or char_length("description") <= 5000)
);
--> statement-breakpoint
CREATE TABLE "collection_item_image" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collection_item_image_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"collection_item_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"storage_provider" text DEFAULT 'bunny' NOT NULL,
	"object_path" text NOT NULL CONSTRAINT "collection_item_image_object_path_unique" UNIQUE,
	"url" text NOT NULL,
	"uploaded_by_clerk_id" text,
	"deleted_at" timestamp with time zone,
	"deleted_by_clerk_id" text,
	"deleted_by_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_item_image_item_hash_unique" UNIQUE("collection_item_id","sha256"),
	CONSTRAINT "collection_item_image_position_valid" CHECK ("position" >= 0),
	CONSTRAINT "collection_item_image_size_positive" CHECK ("size" > 0),
	CONSTRAINT "collection_item_image_sha256_valid" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "collection_item_image_deletion_metadata_consistent" CHECK (("deleted_at" is null and "deleted_by_clerk_id" is null and "deleted_by_role" is null) or ("deleted_at" is not null and "deleted_by_role" is not null)),
	CONSTRAINT "collection_item_image_deleted_by_role_valid" CHECK ("deleted_by_role" is null or "deleted_by_role" in ('owner', 'admin'))
);
--> statement-breakpoint
CREATE TABLE "color" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "color_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hex" text NOT NULL,
	CONSTRAINT "color_hex_check" CHECK ("hex" ~ '^#[0-9A-Fa-f]{6}$')
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
	"pattern_id" bigint,
	"position" integer NOT NULL,
	CONSTRAINT "finish_option_owner_check" CHECK (("product_id" is not null) <> ("collection_item_id" is not null)),
	CONSTRAINT "finish_option_position_check" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "finish_option_color" (
	"finish_option_id" bigint,
	"color_id" bigint,
	"position" integer NOT NULL,
	CONSTRAINT "finish_option_color_pkey" PRIMARY KEY("finish_option_id","color_id"),
	CONSTRAINT "finish_option_color_position_check" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "finish_option_finish" (
	"finish_option_id" bigint,
	"finish_id" bigint,
	"position" integer NOT NULL,
	CONSTRAINT "finish_option_finish_pkey" PRIMARY KEY("finish_option_id","finish_id"),
	CONSTRAINT "finish_option_finish_position_check" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "maker_image" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "maker_image_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"maker_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"storage_provider" text DEFAULT 'bunny' NOT NULL,
	"object_path" text NOT NULL CONSTRAINT "maker_image_object_path_unique" UNIQUE,
	"url" text NOT NULL,
	"uploaded_by_clerk_id" text,
	"deleted_at" timestamp with time zone,
	"deleted_by_clerk_id" text,
	"deleted_by_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maker_image_maker_hash_unique" UNIQUE("maker_id","sha256"),
	CONSTRAINT "maker_image_position_valid" CHECK ("position" >= 0),
	CONSTRAINT "maker_image_size_positive" CHECK ("size" > 0),
	CONSTRAINT "maker_image_sha256_valid" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "maker_image_deletion_metadata_consistent" CHECK (("deleted_at" is null and "deleted_by_clerk_id" is null and "deleted_by_role" is null) or ("deleted_at" is not null and "deleted_by_role" is not null)),
	CONSTRAINT "maker_image_deleted_by_role_valid" CHECK ("deleted_by_role" is null or "deleted_by_role" = 'admin')
);
--> statement-breakpoint
CREATE TABLE "material_image" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "material_image_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"material_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"storage_provider" text DEFAULT 'bunny' NOT NULL,
	"object_path" text NOT NULL CONSTRAINT "material_image_object_path_unique" UNIQUE,
	"url" text NOT NULL,
	"uploaded_by_clerk_id" text,
	"deleted_at" timestamp with time zone,
	"deleted_by_clerk_id" text,
	"deleted_by_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_image_material_hash_unique" UNIQUE("material_id","sha256"),
	CONSTRAINT "material_image_position_valid" CHECK ("position" >= 0),
	CONSTRAINT "material_image_size_positive" CHECK ("size" > 0),
	CONSTRAINT "material_image_sha256_valid" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "material_image_deletion_metadata_consistent" CHECK (("deleted_at" is null and "deleted_by_clerk_id" is null and "deleted_by_role" is null) or ("deleted_at" is not null and "deleted_by_role" is not null)),
	CONSTRAINT "material_image_deleted_by_role_valid" CHECK ("deleted_by_role" is null or "deleted_by_role" in ('owner', 'admin'))
);
--> statement-breakpoint
CREATE TABLE "pattern" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pattern_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_type_id" bigint NOT NULL,
	"maker_id" bigint NOT NULL,
	"owner_clerk_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"approval_status" text DEFAULT 'pending' NOT NULL,
	"approval_decision_reason" text,
	"approval_decided_at" timestamp with time zone,
	"maker_product_url" text,
	"maker_product_url_valid" boolean DEFAULT true NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"private_reason" text,
	"privated_at" timestamp with time zone,
	"privated_by_clerk_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_approval_status_valid" CHECK ("approval_status" in ('pending', 'approved', 'rejected')),
	CONSTRAINT "product_approval_decision_metadata_consistent" CHECK (num_nonnulls("approval_decision_reason", "approval_decided_at") in (0, 2)),
	CONSTRAINT "product_approval_reason_valid" CHECK ("approval_decision_reason" is null or char_length(trim("approval_decision_reason")) between 1 and 1000),
	CONSTRAINT "product_private_metadata_consistent" CHECK ((not "is_private" and num_nonnulls("private_reason", "privated_at", "privated_by_clerk_id") = 0) or ("is_private" and (num_nonnulls("private_reason", "privated_at", "privated_by_clerk_id") = 0 or ("private_reason" is not null and "privated_at" is not null)))),
	CONSTRAINT "product_description_length_valid" CHECK ("description" is null or char_length("description") <= 5000)
);
--> statement-breakpoint
CREATE TABLE "product_detail_slider" (
	"id" bigint PRIMARY KEY,
	"included_plate_product_id" bigint,
	"uses_inserts" boolean NOT NULL,
	"included_insert_product_id" bigint,
	"magnet_layout" text,
	"magnet_configuration" jsonb,
	"weight_value" numeric,
	"weight_unit" "weight_unit",
	"length_value" numeric,
	"length_unit" "dimension_unit",
	"width_value" numeric,
	"width_unit" "dimension_unit",
	"thickness_value" numeric,
	"thickness_unit" "dimension_unit",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_detail_slider_insert_choice_consistent" CHECK ("uses_inserts" or "included_insert_product_id" is null),
	CONSTRAINT "product_detail_slider_magnet_layout_consistent" CHECK (("included_insert_product_id" is null and "magnet_layout" is not null) or ("included_insert_product_id" is not null and "magnet_layout" is null)),
	CONSTRAINT "product_detail_slider_magnet_layout_valid" CHECK ("magnet_layout" is null or "magnet_layout" in ('2x2', '2x3', '2x4')),
	CONSTRAINT "product_detail_slider_weight_consistent" CHECK (("weight_value" is null and "weight_unit" is null) or ("weight_value" > 0 and "weight_unit" is not null)),
	CONSTRAINT "product_detail_slider_length_consistent" CHECK (("length_value" is null and "length_unit" is null) or ("length_value" > 0 and "length_unit" is not null)),
	CONSTRAINT "product_detail_slider_width_consistent" CHECK (("width_value" is null and "width_unit" is null) or ("width_value" > 0 and "width_unit" is not null)),
	CONSTRAINT "product_detail_slider_thickness_consistent" CHECK (("thickness_value" is null and "thickness_unit" is null) or ("thickness_value" > 0 and "thickness_unit" is not null)),
	CONSTRAINT "product_detail_slider_included_plate_distinct" CHECK ("included_plate_product_id" is null or "included_plate_product_id" <> "id"),
	CONSTRAINT "product_detail_slider_included_insert_distinct" CHECK ("included_insert_product_id" is null or "included_insert_product_id" <> "id")
);
--> statement-breakpoint
CREATE TABLE "product_detail_slider_insert" (
	"id" bigint PRIMARY KEY,
	"magnet_layout" text DEFAULT '2x4' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_detail_slider_plate" (
	"id" bigint PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_detail_spinner" (
	"id" bigint PRIMARY KEY,
	"weight_value" numeric,
	"weight_unit" "weight_unit",
	"length_value" numeric,
	"length_unit" "dimension_unit",
	"width_value" numeric,
	"width_unit" "dimension_unit",
	"thickness_value" numeric,
	"thickness_unit" "dimension_unit",
	"thickness_with_button_value" numeric,
	"thickness_with_button_unit" "dimension_unit",
	"button_diameter_value" numeric,
	"button_diameter_unit" "dimension_unit",
	"spin_diameter_value" numeric,
	"spin_diameter_unit" "dimension_unit",
	"bearing" text,
	"compatible_button_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_detail_spinner_weight_consistent" CHECK (("weight_value" is null and "weight_unit" is null) or ("weight_value" > 0 and "weight_unit" is not null)),
	CONSTRAINT "product_detail_spinner_length_consistent" CHECK (("length_value" is null and "length_unit" is null) or ("length_value" > 0 and "length_unit" is not null)),
	CONSTRAINT "product_detail_spinner_width_consistent" CHECK (("width_value" is null and "width_unit" is null) or ("width_value" > 0 and "width_unit" is not null)),
	CONSTRAINT "product_detail_spinner_thickness_consistent" CHECK (("thickness_value" is null and "thickness_unit" is null) or ("thickness_value" > 0 and "thickness_unit" is not null)),
	CONSTRAINT "product_detail_spinner_thickness_with_button_consistent" CHECK (("thickness_with_button_value" is null and "thickness_with_button_unit" is null) or ("thickness_with_button_value" > 0 and "thickness_with_button_unit" is not null)),
	CONSTRAINT "product_detail_spinner_button_diameter_consistent" CHECK (("button_diameter_value" is null and "button_diameter_unit" is null) or ("button_diameter_value" > 0 and "button_diameter_unit" is not null)),
	CONSTRAINT "product_detail_spinner_spin_diameter_consistent" CHECK (("spin_diameter_value" is null and "spin_diameter_unit" is null) or ("spin_diameter_value" > 0 and "spin_diameter_unit" is not null)),
	CONSTRAINT "product_detail_spinner_bearing_length_valid" CHECK ("bearing" is null or char_length("bearing") <= 200)
);
--> statement-breakpoint
CREATE TABLE "product_detail_spinner_button" (
	"id" bigint PRIMARY KEY,
	"weight_value" numeric,
	"weight_unit" "weight_unit",
	"diameter_value" numeric,
	"diameter_unit" "dimension_unit",
	"thickness_value" numeric,
	"thickness_unit" "dimension_unit",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_detail_spinner_button_weight_consistent" CHECK (("weight_value" is null and "weight_unit" is null) or ("weight_value" > 0 and "weight_unit" is not null)),
	CONSTRAINT "product_detail_spinner_button_diameter_consistent" CHECK (("diameter_value" is null and "diameter_unit" is null) or ("diameter_value" > 0 and "diameter_unit" is not null)),
	CONSTRAINT "product_detail_spinner_button_thickness_consistent" CHECK (("thickness_value" is null and "thickness_unit" is null) or ("thickness_value" > 0 and "thickness_unit" is not null))
);
--> statement-breakpoint
CREATE TABLE "product_image" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_image_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"storage_provider" text DEFAULT 'bunny' NOT NULL,
	"object_path" text NOT NULL CONSTRAINT "product_image_object_path_unique" UNIQUE,
	"storage_owned" boolean DEFAULT true NOT NULL,
	"url" text NOT NULL,
	"uploaded_by_clerk_id" text,
	"deleted_at" timestamp with time zone,
	"deleted_by_clerk_id" text,
	"deleted_by_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_image_product_hash_unique" UNIQUE("product_id","sha256"),
	CONSTRAINT "product_image_position_valid" CHECK ("position" >= 0),
	CONSTRAINT "product_image_size_positive" CHECK ("size" > 0),
	CONSTRAINT "product_image_sha256_valid" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "product_image_deletion_metadata_consistent" CHECK (("deleted_at" is null and "deleted_by_clerk_id" is null and "deleted_by_role" is null) or ("deleted_at" is not null and "deleted_by_role" is not null)),
	CONSTRAINT "product_image_deleted_by_role_valid" CHECK ("deleted_by_role" is null or "deleted_by_role" in ('owner', 'admin'))
);
--> statement-breakpoint
CREATE TABLE "product_material" (
	"product_id" bigint,
	"material_id" bigint,
	CONSTRAINT "product_material_pkey" PRIMARY KEY("product_id","material_id")
);
--> statement-breakpoint
CREATE TABLE "slider_magnet_preset" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "slider_magnet_preset_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"normalized_name" text NOT NULL CONSTRAINT "slider_magnet_preset_normalized_name_unique" UNIQUE,
	"magnet_layout" text NOT NULL,
	"configuration" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slider_magnet_preset_name_valid" CHECK (char_length(trim("name")) between 1 and 100),
	CONSTRAINT "slider_magnet_preset_layout_valid" CHECK ("magnet_layout" in ('2x2', '2x3', '2x4'))
);
--> statement-breakpoint
CREATE TABLE "user_collection" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_collection_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"owner_id" bigint NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"description" text,
	"summary" text,
	"is_private" boolean DEFAULT true NOT NULL,
	"private_reason" text,
	"privated_at" timestamp with time zone,
	"privated_by_clerk_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_collection_id_owner_unique" UNIQUE("id","owner_id"),
	CONSTRAINT "user_collection_owner_name_unique" UNIQUE("owner_id","normalized_name"),
	CONSTRAINT "user_collection_name_length_valid" CHECK (char_length(trim("name")) between 2 and 80),
	CONSTRAINT "user_collection_description_length_valid" CHECK ("description" is null or char_length("description") <= 5000),
	CONSTRAINT "user_collection_summary_length_valid" CHECK ("summary" is null or char_length("summary") <= 200),
	CONSTRAINT "user_collection_private_metadata_consistent" CHECK ((not "is_private" and num_nonnulls("private_reason", "privated_at", "privated_by_clerk_id") = 0) or ("is_private" and (num_nonnulls("private_reason", "privated_at", "privated_by_clerk_id") = 0 or ("private_reason" is not null and "privated_at" is not null))))
);
--> statement-breakpoint
CREATE TABLE "erasure_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"subject_hmac" text NOT NULL UNIQUE,
	"target_clerk_id" text,
	"initiator" text NOT NULL,
	"verification_reference" text,
	"verification_method" text,
	"verified_by_clerk_id" text,
	"verified_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"storage_targets" text[],
	"step_results" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "erasure_request_initiator_valid" CHECK ("initiator" in ('self', 'admin')),
	CONSTRAINT "erasure_request_status_valid" CHECK ("status" in ('pending', 'running', 'completed', 'needs_attention')),
	CONSTRAINT "erasure_request_verification_method_valid" CHECK ("verification_method" is null or "verification_method" in ('clerk_reverification', 'authenticated_request', 'verified_email', 'clerk_webhook')),
	CONSTRAINT "erasure_request_verification_provenance_valid" CHECK ("verified_at" is not null and (
        (
          "initiator" = 'self'
          and "verification_method" = 'clerk_reverification'
          and "verification_reference" is null
          and (
            ("status" = 'completed' and "target_clerk_id" is null and "verified_by_clerk_id" is null)
            or ("status" <> 'completed' and "target_clerk_id" is not null and "verified_by_clerk_id" is not null and "verified_by_clerk_id" = "target_clerk_id")
          )
        )
        or (
          "initiator" = 'admin'
          and "verified_by_clerk_id" is not null
          and (
            ("verification_method" in ('authenticated_request', 'verified_email') and "verification_reference" is not null)
            or ("verification_method" = 'clerk_webhook' and "verification_reference" = 'clerk_webhook' and "verified_by_clerk_id" = 'clerk_webhook')
          )
          and (
            ("status" = 'completed' and "target_clerk_id" is null)
            or ("status" <> 'completed' and "target_clerk_id" is not null)
          )
        )
      )),
	CONSTRAINT "erasure_request_attempts_valid" CHECK ("attempts" >= 0),
	CONSTRAINT "erasure_request_completion_valid" CHECK (("status" = 'completed') = ("completed_at" is not null and "expires_at" is not null and "target_clerk_id" is null))
);
--> statement-breakpoint
CREATE TABLE "feature_flag_user_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"flag_id" uuid NOT NULL,
	"user_id" bigint NOT NULL,
	"source" "feature_flag_override_source" NOT NULL,
	"enabled" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_clerk_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_clerk_id" text,
	CONSTRAINT "feature_flag_user_overrides_flag_user_source_unique" UNIQUE("flag_id","user_id","source")
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"description" text,
	"audience" "feature_flag_audience" NOT NULL,
	"default_enabled" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by_clerk_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_clerk_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_clerk_id" text
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feedback_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"submitter_clerk_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"completed_at" timestamp with time zone,
	"linear_client_uuid" uuid UNIQUE,
	"linear_updated_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_title_length_valid" CHECK (char_length("title") between 1 and 120),
	CONSTRAINT "feedback_description_length_valid" CHECK (char_length("description") between 1 and 5000),
	CONSTRAINT "feedback_category_valid" CHECK ("category" is null or "category" in ('product_type', 'feature', 'improvement', 'bug')),
	CONSTRAINT "feedback_status_valid" CHECK ("status" in ('pending', 'requested', 'planned', 'in_progress', 'completed', 'merged', 'denied', 'canceled')),
	CONSTRAINT "feedback_approved_category_required" CHECK ("status" in ('pending', 'merged', 'denied') or "category" is not null)
);
--> statement-breakpoint
CREATE TABLE "feedback_notifications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feedback_notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"feedback_id" bigint NOT NULL,
	"type" text NOT NULL,
	"read_at" timestamp with time zone,
	"read_by_clerk_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_notifications_read_metadata_consistent" CHECK (num_nonnulls("read_at", "read_by_clerk_id") in (0, 2)),
	CONSTRAINT "feedback_notifications_type_valid" CHECK ("type" in ('submitted', 'completed'))
);
--> statement-breakpoint
CREATE TABLE "feedback_votes" (
	"feedback_id" bigint,
	"voter_clerk_id" text,
	"is_permanent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_votes_pkey" PRIMARY KEY("feedback_id","voter_clerk_id")
);
--> statement-breakpoint
CREATE TABLE "resource_categories" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resource_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"created_by_clerk_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_downloads" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resource_downloads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"version_id" bigint NOT NULL,
	"user_clerk_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_downloads_version_user_unique" UNIQUE("version_id","user_clerk_id")
);
--> statement-breakpoint
CREATE TABLE "resource_files" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resource_files_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"version_id" bigint NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_provider" text DEFAULT 'bunny' NOT NULL,
	"object_path" text NOT NULL CONSTRAINT "resource_files_object_path_unique" UNIQUE,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_files_size_positive" CHECK ("size" > 0)
);
--> statement-breakpoint
CREATE TABLE "resource_images" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resource_images_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"resource_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_provider" text DEFAULT 'bunny' NOT NULL,
	"object_path" text NOT NULL CONSTRAINT "resource_images_object_path_unique" UNIQUE,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_images_resource_position_unique" UNIQUE("resource_id","position"),
	CONSTRAINT "resource_images_position_valid" CHECK ("position" >= 0),
	CONSTRAINT "resource_images_size_positive" CHECK ("size" > 0)
);
--> statement-breakpoint
CREATE TABLE "resource_notifications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resource_notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"type" text NOT NULL,
	"resource_id" bigint NOT NULL,
	"category_id" bigint,
	"uploader_clerk_id" text NOT NULL,
	"read_at" timestamp with time zone,
	"read_by_clerk_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_notifications_type_valid" CHECK ("type" in ('resource_created', 'category_created')),
	CONSTRAINT "resource_notifications_category_matches_type" CHECK (("type" = 'category_created') = ("category_id" is not null)),
	CONSTRAINT "resource_notifications_read_metadata_consistent" CHECK (num_nonnulls("read_at", "read_by_clerk_id") in (0, 2))
);
--> statement-breakpoint
CREATE TABLE "resource_versions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resource_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"resource_id" bigint NOT NULL,
	"version" integer NOT NULL,
	"file_name" text,
	"content_type" text,
	"size" integer,
	"storage_provider" text DEFAULT 'bunny',
	"object_path" text CONSTRAINT "resource_versions_object_path_unique" UNIQUE,
	"url" text,
	"archive_object_path" text CONSTRAINT "resource_versions_archive_object_path_unique" UNIQUE,
	"anonymous_download_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_versions_resource_version_unique" UNIQUE("resource_id","version"),
	CONSTRAINT "resource_versions_version_positive" CHECK ("version" > 0),
	CONSTRAINT "resource_versions_size_positive" CHECK ("size" > 0),
	CONSTRAINT "resource_versions_anonymous_download_count_nonnegative" CHECK ("anonymous_download_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"uploader_clerk_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"private_reason" text,
	"privated_at" timestamp with time zone,
	"privated_by_clerk_id" text,
	"deleted_at" timestamp with time zone,
	"deleted_by_clerk_id" text,
	"deleted_by_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resources_private_metadata_consistent" CHECK ((not "is_private" and num_nonnulls("private_reason", "privated_at", "privated_by_clerk_id") = 0) or ("is_private" and (num_nonnulls("private_reason", "privated_at", "privated_by_clerk_id") = 0 or ("private_reason" is not null and "privated_at" is not null)))),
	CONSTRAINT "resources_deletion_metadata_consistent" CHECK (("deleted_at" is null and "deleted_by_clerk_id" is null and "deleted_by_role" is null) or ("deleted_at" is not null and "deleted_by_role" is not null)),
	CONSTRAINT "resources_deleted_by_role_valid" CHECK ("deleted_by_role" is null or "deleted_by_role" in ('owner', 'admin'))
);
--> statement-breakpoint
CREATE TABLE "resources_to_categories" (
	"resource_id" bigint,
	"category_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resources_to_categories_pkey" PRIMARY KEY("resource_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "makers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "makers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"root_url" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "makers_description_length_check" CHECK ("description" IS NULL OR char_length("description") <= 5000)
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "materials_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "materials_description_length_valid" CHECK ("description" is null or char_length("description") <= 5000)
);
--> statement-breakpoint
CREATE TABLE "mechanisms" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mechanisms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_types" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"image_url" text,
	"image_alt" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraper_runs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "scraper_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"source" text NOT NULL,
	"job_type" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"error_message" text,
	"stats" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tmp_autmog_pen_materials" (
	"pen_id" bigint,
	"material_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tmp_autmog_pen_materials_pk" PRIMARY KEY("pen_id","material_id")
);
--> statement-breakpoint
CREATE TABLE "tmp_autmog_pen_versions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tmp_autmog_pen_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"pen_id" bigint NOT NULL,
	"source_product_id" text NOT NULL,
	"previous_details_hash" text,
	"next_details_hash" text NOT NULL,
	"previous_image_set_hash" text,
	"next_image_set_hash" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_reason" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"replaced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tmp_autmog_pens" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tmp_autmog_pens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_id" bigint NOT NULL,
	"maker_id" bigint NOT NULL,
	"mechanism_id" bigint,
	"source_product_id" text NOT NULL,
	"source_handle" text NOT NULL,
	"title" text NOT NULL,
	"product_url" text NOT NULL,
	"description" text,
	"size" text,
	"refill" text,
	"nose" text,
	"clip" text,
	"grip" text,
	"finish" text,
	"body_details" jsonb DEFAULT '[]' NOT NULL,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"variants" jsonb DEFAULT '[]' NOT NULL,
	"normalized_data" jsonb NOT NULL,
	"details_hash" text NOT NULL,
	"image_set_hash" text NOT NULL,
	"price_min_cents" integer,
	"price_max_cents" integer,
	"currency_code" text DEFAULT 'USD' NOT NULL,
	"available_for_sale" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tmp_grimsmo_knife_variation_versions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tmp_grimsmo_knife_variation_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"variation_id" bigint NOT NULL,
	"source_handle" text NOT NULL,
	"previous_details_hash" text,
	"next_details_hash" text NOT NULL,
	"previous_image_set_hash" text,
	"next_image_set_hash" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_reason" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"replaced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tmp_grimsmo_knife_variations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tmp_grimsmo_knife_variations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_variation_id" bigint NOT NULL,
	"knife_id" bigint NOT NULL,
	"knife_type" text NOT NULL,
	"source_product_id" text NOT NULL,
	"source_handle" text NOT NULL,
	"source_collection" text NOT NULL,
	"title" text NOT NULL,
	"title_full" text NOT NULL,
	"product_url" text NOT NULL,
	"description" text,
	"body_text" text,
	"knife_number" text,
	"bullets" jsonb DEFAULT '[]' NOT NULL,
	"bullets_by_category" jsonb DEFAULT '{}' NOT NULL,
	"handle_finishes" jsonb DEFAULT '[]' NOT NULL,
	"handle_colors" jsonb DEFAULT '[]' NOT NULL,
	"handle_materials" jsonb DEFAULT '[]' NOT NULL,
	"hardware_colors" jsonb DEFAULT '[]' NOT NULL,
	"patterns" jsonb DEFAULT '[]' NOT NULL,
	"blade_steels" jsonb DEFAULT '[]' NOT NULL,
	"blade_finishes" jsonb DEFAULT '[]' NOT NULL,
	"mechanisms" jsonb DEFAULT '[]' NOT NULL,
	"case" text,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"variants" jsonb DEFAULT '[]' NOT NULL,
	"normalized_data" jsonb NOT NULL,
	"details_hash" text NOT NULL,
	"image_set_hash" text NOT NULL,
	"price_min_cents" integer,
	"price_max_cents" integer,
	"currency_code" text DEFAULT 'USD' NOT NULL,
	"available_for_sale" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tmp_grimsmo_knife_versions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tmp_grimsmo_knife_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"knife_id" bigint NOT NULL,
	"knife_type" text NOT NULL,
	"previous_details_hash" text,
	"next_details_hash" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_reason" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"replaced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tmp_grimsmo_knives" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tmp_grimsmo_knives_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_id" bigint NOT NULL,
	"maker_id" bigint NOT NULL,
	"knife_type" text NOT NULL,
	"product_handle" text NOT NULL,
	"title" text NOT NULL,
	"product_url" text NOT NULL,
	"normalized_data" jsonb NOT NULL,
	"details_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tmp_grimsmo_pen_variation_versions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tmp_grimsmo_pen_variation_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"variation_id" bigint NOT NULL,
	"source_handle" text NOT NULL,
	"previous_details_hash" text,
	"next_details_hash" text NOT NULL,
	"previous_image_set_hash" text,
	"next_image_set_hash" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_reason" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"replaced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tmp_grimsmo_pen_variations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tmp_grimsmo_pen_variations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_variation_id" bigint NOT NULL,
	"pen_id" bigint NOT NULL,
	"source_product_id" text NOT NULL,
	"source_handle" text NOT NULL,
	"source_collection" text NOT NULL,
	"title" text NOT NULL,
	"title_full" text NOT NULL,
	"product_url" text NOT NULL,
	"description" text,
	"body_text" text,
	"saga_number" text,
	"bullets" jsonb DEFAULT '[]' NOT NULL,
	"bullets_by_category" jsonb DEFAULT '{}' NOT NULL,
	"visible_bullets" jsonb DEFAULT '[]' NOT NULL,
	"body_finishes" jsonb DEFAULT '[]' NOT NULL,
	"body_colors" jsonb DEFAULT '[]' NOT NULL,
	"body_materials" jsonb DEFAULT '[]' NOT NULL,
	"slider_style" text,
	"slider_materials" jsonb DEFAULT '[]' NOT NULL,
	"slider_colors" jsonb DEFAULT '[]' NOT NULL,
	"refill" text,
	"case" text,
	"engraving" text,
	"tip_logo" text,
	"book" text,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"variants" jsonb DEFAULT '[]' NOT NULL,
	"normalized_data" jsonb NOT NULL,
	"details_hash" text NOT NULL,
	"image_set_hash" text NOT NULL,
	"price_min_cents" integer,
	"price_max_cents" integer,
	"currency_code" text DEFAULT 'USD' NOT NULL,
	"available_for_sale" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tmp_grimsmo_pen_versions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tmp_grimsmo_pen_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"pen_id" bigint NOT NULL,
	"product_handle" text NOT NULL,
	"previous_details_hash" text,
	"next_details_hash" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_reason" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"replaced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tmp_grimsmo_pens" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tmp_grimsmo_pens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_id" bigint NOT NULL,
	"maker_id" bigint NOT NULL,
	"product_handle" text NOT NULL,
	"title" text NOT NULL,
	"product_url" text NOT NULL,
	"normalized_data" jsonb NOT NULL,
	"details_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tmp_images" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tmp_images_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_id" bigint NOT NULL,
	"product_variation_id" bigint,
	"source_image_id" text,
	"source_url" text NOT NULL,
	"position" integer NOT NULL,
	"alt_text" text,
	"width" integer,
	"height" integer,
	"source_hash" text NOT NULL,
	"image_provider" text,
	"image_file_id" text,
	"image_path" text,
	"image_url" text,
	"status" text DEFAULT 'pending_upload' NOT NULL,
	"uploaded_at" timestamp with time zone,
	"pending_delete_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tmp_product_product_types" (
	"product_id" bigint,
	"product_type_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tmp_product_product_types_pk" PRIMARY KEY("product_id","product_type_id")
);
--> statement-breakpoint
CREATE TABLE "tmp_product_variations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tmp_product_variations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_id" bigint NOT NULL,
	"source_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tmp_products" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tmp_products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_object_deletion" (
	"object_path" text PRIMARY KEY,
	"owner_clerk_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_file" (
	"id" uuid PRIMARY KEY,
	"session_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"position" integer NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"object_path" text NOT NULL CONSTRAINT "upload_file_path_reserved" UNIQUE,
	"url" text NOT NULL,
	"uploaded_at" timestamp with time zone,
	CONSTRAINT "upload_file_kind_hash_unique" UNIQUE("session_id","kind","sha256"),
	CONSTRAINT "upload_file_kind_valid" CHECK ("kind" in ('image','file')),
	CONSTRAINT "upload_file_size_valid" CHECK ("size" > 0),
	CONSTRAINT "upload_file_position_valid" CHECK ("position" >= 0),
	CONSTRAINT "upload_file_hash_valid" CHECK ("sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "upload_session" (
	"id" uuid PRIMARY KEY,
	"uploader_clerk_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" bigint NOT NULL,
	"reserved_resource_id" bigint,
	"reserved_version" integer,
	"payload" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "upload_session_target_type_valid" CHECK ("target_type" in ('maker', 'product', 'material', 'collection', 'collection_item', 'resource')),
	CONSTRAINT "upload_session_target_id_valid" CHECK ("target_id" > 0),
	CONSTRAINT "upload_session_version_valid" CHECK ("reserved_version" is null or "reserved_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" bigint PRIMARY KEY,
	"currency_code" "currency_code" DEFAULT 'USD'::"currency_code" NOT NULL,
	"locale" text,
	"measurement_system" "measurement_system" DEFAULT 'metric'::"measurement_system" NOT NULL,
	"theme" "theme_mode" DEFAULT 'system'::"theme_mode" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"clerk_id" text NOT NULL UNIQUE,
	"clerk_updated_at" timestamp with time zone,
	"image_url" text,
	"username" text
);
--> statement-breakpoint
CREATE TABLE "user_ban" (
	"user_id" bigint PRIMARY KEY,
	"status" text NOT NULL,
	"reason" text NOT NULL,
	"pending_before_status" text,
	"pending_request_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_ban_status_valid" CHECK ("status" in ('pending_ban', 'banned', 'pending_unban', 'unbanned')),
	CONSTRAINT "user_ban_reason_nonblank" CHECK (length(btrim("reason")) > 0),
	CONSTRAINT "user_ban_pending_audit_valid" CHECK (("status" in ('pending_ban', 'pending_unban')) = ("pending_request_id" is not null))
);
--> statement-breakpoint
CREATE INDEX "audit_delivery_due_idx" ON "audit_delivery" ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "audit_event_recorded_at_id_idx" ON "audit_event" ("recorded_at","id");--> statement-breakpoint
CREATE INDEX "audit_event_actor_recorded_at_id_idx" ON "audit_event" ("actor_user_id","recorded_at","id") WHERE "actor_user_id" is not null;--> statement-breakpoint
CREATE INDEX "audit_event_owner_user_id_idx" ON "audit_event" ("owner_user_id") WHERE "owner_user_id" is not null;--> statement-breakpoint
CREATE INDEX "audit_event_action_recorded_at_id_idx" ON "audit_event" ("action","recorded_at","id");--> statement-breakpoint
CREATE INDEX "audit_event_target_recorded_at_id_idx" ON "audit_event" ("target_type","target_id","recorded_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_export_one_unconsumed_unique" ON "audit_export" ((1)) WHERE "consumed_at" is null;--> statement-breakpoint
CREATE INDEX "audit_export_requester_idx" ON "audit_export" ("requested_by_user_id") WHERE "requested_by_user_id" is not null;--> statement-breakpoint
CREATE INDEX "catalog_manifest_application_hash_started_idx" ON "catalog_manifest_application" ("manifest_hash","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_manifest_object_hash_key_unique" ON "catalog_manifest_object" ("manifest_hash","image_key");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_manifest_object_path_unique" ON "catalog_manifest_object" ("object_path");--> statement-breakpoint
CREATE INDEX "catalog_manifest_object_application_idx" ON "catalog_manifest_object" ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_manifest_record_hash_key_unique" ON "catalog_manifest_record" ("manifest_hash","record_key");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_manifest_record_active_entity_unique" ON "catalog_manifest_record" ("entity_type","record_id") WHERE "rolled_back_at" is null;--> statement-breakpoint
CREATE INDEX "catalog_manifest_record_application_idx" ON "catalog_manifest_record" ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_terminology_alias_preferred_unique" ON "catalog_terminology_alias" ("maker_id","canonical_namespace","canonical_key") WHERE "is_preferred";--> statement-breakpoint
CREATE INDEX "catalog_terminology_alias_concept_idx" ON "catalog_terminology_alias" ("canonical_namespace","canonical_key");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_detail_slider_installed_plate_unique" ON "collection_detail_slider" ("installed_plate_id") WHERE "installed_plate_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "collection_detail_slider_installed_insert_unique" ON "collection_detail_slider" ("installed_insert_id") WHERE "installed_insert_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "collection_detail_spinner_installed_button_unique" ON "collection_detail_spinner" ("installed_button_id") WHERE "installed_button_id" is not null;--> statement-breakpoint
CREATE INDEX "collection_image_collection_id_idx" ON "collection_image" ("collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_image_current_unique" ON "collection_image" ("collection_id") WHERE "is_current";--> statement-breakpoint
CREATE INDEX "collection_item_collection_visibility_idx" ON "collection_item" ("collection_id","owner_id","approval_status","is_private");--> statement-breakpoint
CREATE INDEX "collection_item_material_public_idx" ON "collection_item" ("material_id","owned","approval_status","is_private");--> statement-breakpoint
CREATE INDEX "collection_item_image_item_id_idx" ON "collection_item_image" ("collection_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "color_name_case_insensitive_unique" ON "color" (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "color_slug_unique" ON "color" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "color_effect_slug_unique" ON "color_effect" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "finish_name_case_insensitive_unique" ON "finish" (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "finish_slug_unique" ON "finish" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "finish_option_collection_item_unique" ON "finish_option" ("collection_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "finish_option_product_position_unique" ON "finish_option" ("product_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "finish_option_color_position_unique" ON "finish_option_color" ("finish_option_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "finish_option_finish_position_unique" ON "finish_option_finish" ("finish_option_id","position");--> statement-breakpoint
CREATE INDEX "maker_image_maker_id_idx" ON "maker_image" ("maker_id");--> statement-breakpoint
CREATE INDEX "material_image_material_id_idx" ON "material_image" ("material_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pattern_name_case_insensitive_unique" ON "pattern" (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "pattern_slug_unique" ON "pattern" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "product_type_slug_unique" ON "product" ("product_type_id","slug");--> statement-breakpoint
CREATE INDEX "product_owner_clerk_id_idx" ON "product" ("owner_clerk_id");--> statement-breakpoint
CREATE INDEX "product_visibility_idx" ON "product" ("approval_status","is_private");--> statement-breakpoint
CREATE INDEX "product_detail_slider_included_insert_idx" ON "product_detail_slider" ("included_insert_product_id");--> statement-breakpoint
CREATE INDEX "product_detail_slider_included_plate_idx" ON "product_detail_slider" ("included_plate_product_id");--> statement-breakpoint
CREATE INDEX "product_image_product_id_idx" ON "product_image" ("product_id");--> statement-breakpoint
CREATE INDEX "product_material_material_id_idx" ON "product_material" ("material_id");--> statement-breakpoint
CREATE INDEX "user_collection_owner_visibility_idx" ON "user_collection" ("owner_id","is_private");--> statement-breakpoint
CREATE UNIQUE INDEX "erasure_request_target_clerk_id_unique" ON "erasure_request" ("target_clerk_id") WHERE "target_clerk_id" is not null;--> statement-breakpoint
CREATE INDEX "erasure_request_due_idx" ON "erasure_request" ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "erasure_request_expiry_idx" ON "erasure_request" ("expires_at");--> statement-breakpoint
CREATE INDEX "feedback_submitter_status_idx" ON "feedback" ("submitter_clerk_id","status");--> statement-breakpoint
CREATE INDEX "feedback_status_created_at_idx" ON "feedback" ("status","created_at");--> statement-breakpoint
CREATE INDEX "feedback_status_completed_at_idx" ON "feedback" ("status","completed_at");--> statement-breakpoint
CREATE INDEX "feedback_notifications_created_at_idx" ON "feedback_notifications" ("created_at");--> statement-breakpoint
CREATE INDEX "feedback_votes_voter_idx" ON "feedback_votes" ("voter_clerk_id");--> statement-breakpoint
CREATE INDEX "resource_downloads_version_id_idx" ON "resource_downloads" ("version_id");--> statement-breakpoint
CREATE INDEX "resource_files_version_id_idx" ON "resource_files" ("version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_files_version_file_name_unique" ON "resource_files" ("version_id",lower("file_name"));--> statement-breakpoint
CREATE INDEX "resource_images_resource_id_idx" ON "resource_images" ("resource_id");--> statement-breakpoint
CREATE INDEX "resource_notifications_created_at_idx" ON "resource_notifications" ("created_at");--> statement-breakpoint
CREATE INDEX "resource_versions_resource_id_idx" ON "resource_versions" ("resource_id");--> statement-breakpoint
CREATE INDEX "resources_created_at_idx" ON "resources" ("created_at");--> statement-breakpoint
CREATE INDEX "resources_deleted_at_idx" ON "resources" ("deleted_at");--> statement-breakpoint
CREATE INDEX "resources_uploader_clerk_id_idx" ON "resources" ("uploader_clerk_id");--> statement-breakpoint
CREATE INDEX "resources_to_categories_category_id_idx" ON "resources_to_categories" ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "makers_name_case_insensitive_unique" ON "makers" (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "makers_root_url_unique" ON "makers" ("root_url");--> statement-breakpoint
CREATE UNIQUE INDEX "makers_slug_unique" ON "makers" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "materials_name_case_insensitive_unique" ON "materials" (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "materials_slug_unique" ON "materials" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "mechanisms_slug_unique" ON "mechanisms" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "product_types_slug_unique" ON "product_types" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "scraper_runs_active_source_job_unique" ON "scraper_runs" ("source","job_type") WHERE "status" = 'running';--> statement-breakpoint
CREATE INDEX "scraper_runs_started_at_idx" ON "scraper_runs" ("started_at");--> statement-breakpoint
CREATE INDEX "tmp_autmog_pen_materials_material_id_idx" ON "tmp_autmog_pen_materials" ("material_id");--> statement-breakpoint
CREATE INDEX "tmp_autmog_pen_versions_pen_id_idx" ON "tmp_autmog_pen_versions" ("pen_id");--> statement-breakpoint
CREATE INDEX "tmp_autmog_pen_versions_source_product_id_idx" ON "tmp_autmog_pen_versions" ("source_product_id");--> statement-breakpoint
CREATE INDEX "tmp_autmog_pens_maker_id_idx" ON "tmp_autmog_pens" ("maker_id");--> statement-breakpoint
CREATE INDEX "tmp_autmog_pens_mechanism_id_idx" ON "tmp_autmog_pens" ("mechanism_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tmp_autmog_pens_product_id_unique" ON "tmp_autmog_pens" ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tmp_autmog_pens_source_product_id_unique" ON "tmp_autmog_pens" ("source_product_id");--> statement-breakpoint
CREATE INDEX "tmp_grimsmo_knife_variation_versions_source_handle_idx" ON "tmp_grimsmo_knife_variation_versions" ("source_handle");--> statement-breakpoint
CREATE INDEX "tmp_grimsmo_knife_variation_versions_variation_id_idx" ON "tmp_grimsmo_knife_variation_versions" ("variation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tmp_grimsmo_knife_variations_knife_handle_unique" ON "tmp_grimsmo_knife_variations" ("knife_id","source_handle");--> statement-breakpoint
CREATE INDEX "tmp_grimsmo_knife_variations_knife_id_idx" ON "tmp_grimsmo_knife_variations" ("knife_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tmp_grimsmo_knife_variations_product_variation_id_unique" ON "tmp_grimsmo_knife_variations" ("product_variation_id");--> statement-breakpoint
CREATE INDEX "tmp_grimsmo_knife_variations_source_product_id_idx" ON "tmp_grimsmo_knife_variations" ("source_product_id");--> statement-breakpoint
CREATE INDEX "tmp_grimsmo_knife_versions_knife_id_idx" ON "tmp_grimsmo_knife_versions" ("knife_id");--> statement-breakpoint
CREATE INDEX "tmp_grimsmo_knife_versions_knife_type_idx" ON "tmp_grimsmo_knife_versions" ("knife_type");--> statement-breakpoint
CREATE UNIQUE INDEX "tmp_grimsmo_knives_knife_type_unique" ON "tmp_grimsmo_knives" ("knife_type");--> statement-breakpoint
CREATE INDEX "tmp_grimsmo_knives_maker_id_idx" ON "tmp_grimsmo_knives" ("maker_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tmp_grimsmo_knives_product_id_unique" ON "tmp_grimsmo_knives" ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tmp_grimsmo_knives_product_handle_unique" ON "tmp_grimsmo_knives" ("product_handle");--> statement-breakpoint
CREATE INDEX "tmp_grimsmo_pen_variation_versions_source_handle_idx" ON "tmp_grimsmo_pen_variation_versions" ("source_handle");--> statement-breakpoint
CREATE INDEX "tmp_grimsmo_pen_variation_versions_variation_id_idx" ON "tmp_grimsmo_pen_variation_versions" ("variation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tmp_grimsmo_pen_variations_pen_handle_unique" ON "tmp_grimsmo_pen_variations" ("pen_id","source_handle");--> statement-breakpoint
CREATE INDEX "tmp_grimsmo_pen_variations_pen_id_idx" ON "tmp_grimsmo_pen_variations" ("pen_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tmp_grimsmo_pen_variations_product_variation_id_unique" ON "tmp_grimsmo_pen_variations" ("product_variation_id");--> statement-breakpoint
CREATE INDEX "tmp_grimsmo_pen_variations_source_product_id_idx" ON "tmp_grimsmo_pen_variations" ("source_product_id");--> statement-breakpoint
CREATE INDEX "tmp_grimsmo_pen_versions_pen_id_idx" ON "tmp_grimsmo_pen_versions" ("pen_id");--> statement-breakpoint
CREATE INDEX "tmp_grimsmo_pen_versions_product_handle_idx" ON "tmp_grimsmo_pen_versions" ("product_handle");--> statement-breakpoint
CREATE INDEX "tmp_grimsmo_pens_maker_id_idx" ON "tmp_grimsmo_pens" ("maker_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tmp_grimsmo_pens_product_id_unique" ON "tmp_grimsmo_pens" ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tmp_grimsmo_pens_product_handle_unique" ON "tmp_grimsmo_pens" ("product_handle");--> statement-breakpoint
CREATE INDEX "tmp_images_product_id_idx" ON "tmp_images" ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tmp_images_product_source_hash_unique" ON "tmp_images" ("product_id","source_hash") WHERE "product_variation_id" is null;--> statement-breakpoint
CREATE INDEX "tmp_images_product_variation_id_idx" ON "tmp_images" ("product_variation_id");--> statement-breakpoint
CREATE INDEX "tmp_images_status_idx" ON "tmp_images" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "tmp_images_variation_source_hash_unique" ON "tmp_images" ("product_variation_id","source_hash") WHERE "product_variation_id" is not null;--> statement-breakpoint
CREATE INDEX "tmp_product_product_types_product_type_id_idx" ON "tmp_product_product_types" ("product_type_id");--> statement-breakpoint
CREATE INDEX "tmp_product_variations_product_id_idx" ON "tmp_product_variations" ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tmp_product_variations_product_source_key_unique" ON "tmp_product_variations" ("product_id","source_key");--> statement-breakpoint
CREATE UNIQUE INDEX "tmp_product_variations_id_product_id_unique" ON "tmp_product_variations" ("id","product_id");--> statement-breakpoint
CREATE INDEX "tmp_products_source_idx" ON "tmp_products" ("source");--> statement-breakpoint
CREATE INDEX "storage_object_deletion_created_idx" ON "storage_object_deletion" ("created_at");--> statement-breakpoint
CREATE INDEX "storage_object_deletion_owner_idx" ON "storage_object_deletion" ("owner_clerk_id");--> statement-breakpoint
CREATE INDEX "upload_file_session_idx" ON "upload_file" ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "upload_file_name_unique" ON "upload_file" ("session_id","kind",lower("file_name"));--> statement-breakpoint
CREATE INDEX "upload_session_expiry_idx" ON "upload_session" ("expires_at");--> statement-breakpoint
CREATE INDEX "upload_session_owner_idx" ON "upload_session" ("uploader_clerk_id");--> statement-breakpoint
CREATE UNIQUE INDEX "upload_session_resource_version_reserved" ON "upload_session" ("target_id","reserved_version") WHERE "target_type" = 'resource' and "completed_at" is null;--> statement-breakpoint
ALTER TABLE "catalog_manifest_object" ADD CONSTRAINT "catalog_manifest_object_BkuqkWCLosPN_fkey" FOREIGN KEY ("application_id") REFERENCES "catalog_manifest_application"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "catalog_manifest_record" ADD CONSTRAINT "catalog_manifest_record_LmU4jvCzk0RV_fkey" FOREIGN KEY ("application_id") REFERENCES "catalog_manifest_application"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "catalog_terminology_alias" ADD CONSTRAINT "catalog_terminology_alias_maker_id_makers_id_fkey" FOREIGN KEY ("maker_id") REFERENCES "makers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "catalog_terminology_alias" ADD CONSTRAINT "catalog_terminology_alias_canonical_key_product_types_slug_fkey" FOREIGN KEY ("canonical_key") REFERENCES "product_types"("slug") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_slider" ADD CONSTRAINT "collection_detail_slider_id_collection_item_id_fkey" FOREIGN KEY ("id") REFERENCES "collection_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_detail_slider" ADD CONSTRAINT "collection_detail_slider_5hyYybfFqXZK_fkey" FOREIGN KEY ("product_slider_id") REFERENCES "product_detail_slider"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_slider" ADD CONSTRAINT "collection_detail_slider_zZDUsWuiK66e_fkey" FOREIGN KEY ("installed_plate_id") REFERENCES "collection_detail_slider_plate"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "collection_detail_slider" ADD CONSTRAINT "collection_detail_slider_tmMDHo31Esby_fkey" FOREIGN KEY ("installed_insert_id") REFERENCES "collection_detail_slider_insert"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "collection_detail_slider_insert" ADD CONSTRAINT "collection_detail_slider_insert_id_collection_item_id_fkey" FOREIGN KEY ("id") REFERENCES "collection_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_detail_slider_insert" ADD CONSTRAINT "collection_detail_slider_insert_Z2PxHSPb2oaw_fkey" FOREIGN KEY ("product_slider_insert_id") REFERENCES "product_detail_slider_insert"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_slider_plate" ADD CONSTRAINT "collection_detail_slider_plate_id_collection_item_id_fkey" FOREIGN KEY ("id") REFERENCES "collection_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_detail_slider_plate" ADD CONSTRAINT "collection_detail_slider_plate_H7sTBURf1LFN_fkey" FOREIGN KEY ("product_slider_plate_id") REFERENCES "product_detail_slider_plate"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_spinner" ADD CONSTRAINT "collection_detail_spinner_id_collection_item_id_fkey" FOREIGN KEY ("id") REFERENCES "collection_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_detail_spinner" ADD CONSTRAINT "collection_detail_spinner_Q35ikA2aePWo_fkey" FOREIGN KEY ("product_spinner_id") REFERENCES "product_detail_spinner"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_spinner" ADD CONSTRAINT "collection_detail_spinner_8Zcb53NDOCOe_fkey" FOREIGN KEY ("installed_button_id") REFERENCES "collection_detail_spinner_button"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "collection_detail_spinner_button" ADD CONSTRAINT "collection_detail_spinner_button_id_collection_item_id_fkey" FOREIGN KEY ("id") REFERENCES "collection_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_detail_spinner_button" ADD CONSTRAINT "collection_detail_spinner_button_oDWcd5KZqTiR_fkey" FOREIGN KEY ("product_spinner_button_id") REFERENCES "product_detail_spinner_button"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_image" ADD CONSTRAINT "collection_image_collection_id_user_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "user_collection"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_material_id_materials_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_purchased_from_user_id_users_id_fkey" FOREIGN KEY ("purchased_from_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_sold_to_user_id_users_id_fkey" FOREIGN KEY ("sold_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_collection_owner_fk" FOREIGN KEY ("collection_id","owner_id") REFERENCES "user_collection"("id","owner_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_item_image" ADD CONSTRAINT "collection_item_image_VxOvKunkxIeg_fkey" FOREIGN KEY ("collection_item_id") REFERENCES "collection_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "finish_option" ADD CONSTRAINT "finish_option_product_id_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "finish_option" ADD CONSTRAINT "finish_option_collection_item_id_collection_item_id_fkey" FOREIGN KEY ("collection_item_id") REFERENCES "collection_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "finish_option" ADD CONSTRAINT "finish_option_SSTvIxxFutYb_fkey" FOREIGN KEY ("source_product_finish_option_id") REFERENCES "finish_option"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "finish_option" ADD CONSTRAINT "finish_option_color_effect_id_color_effect_id_fkey" FOREIGN KEY ("color_effect_id") REFERENCES "color_effect"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finish_option" ADD CONSTRAINT "finish_option_pattern_id_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "pattern"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finish_option_color" ADD CONSTRAINT "finish_option_color_finish_option_id_finish_option_id_fkey" FOREIGN KEY ("finish_option_id") REFERENCES "finish_option"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "finish_option_color" ADD CONSTRAINT "finish_option_color_color_id_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "color"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finish_option_finish" ADD CONSTRAINT "finish_option_finish_finish_option_id_finish_option_id_fkey" FOREIGN KEY ("finish_option_id") REFERENCES "finish_option"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "finish_option_finish" ADD CONSTRAINT "finish_option_finish_finish_id_finish_id_fkey" FOREIGN KEY ("finish_id") REFERENCES "finish"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "maker_image" ADD CONSTRAINT "maker_image_maker_id_makers_id_fkey" FOREIGN KEY ("maker_id") REFERENCES "makers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "material_image" ADD CONSTRAINT "material_image_material_id_materials_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_product_type_id_product_types_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_maker_id_makers_id_fkey" FOREIGN KEY ("maker_id") REFERENCES "makers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_detail_slider" ADD CONSTRAINT "product_detail_slider_id_product_id_fkey" FOREIGN KEY ("id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_detail_slider" ADD CONSTRAINT "product_detail_slider_included_plate_product_id_product_id_fkey" FOREIGN KEY ("included_plate_product_id") REFERENCES "product"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_detail_slider" ADD CONSTRAINT "product_detail_slider_C5V3qAsPkpvY_fkey" FOREIGN KEY ("included_insert_product_id") REFERENCES "product"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_detail_slider_insert" ADD CONSTRAINT "product_detail_slider_insert_id_product_id_fkey" FOREIGN KEY ("id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_detail_slider_plate" ADD CONSTRAINT "product_detail_slider_plate_id_product_id_fkey" FOREIGN KEY ("id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_detail_spinner" ADD CONSTRAINT "product_detail_spinner_id_product_id_fkey" FOREIGN KEY ("id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_detail_spinner" ADD CONSTRAINT "product_detail_spinner_5EB9NQgdQ6cM_fkey" FOREIGN KEY ("compatible_button_id") REFERENCES "product_detail_spinner_button"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "product_detail_spinner_button" ADD CONSTRAINT "product_detail_spinner_button_id_product_id_fkey" FOREIGN KEY ("id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_product_id_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_material" ADD CONSTRAINT "product_material_product_id_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_material" ADD CONSTRAINT "product_material_material_id_materials_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "user_collection" ADD CONSTRAINT "user_collection_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "feature_flag_user_overrides" ADD CONSTRAINT "feature_flag_user_overrides_flag_id_feature_flags_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "feature_flags"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "feature_flag_user_overrides" ADD CONSTRAINT "feature_flag_user_overrides_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "feedback_notifications" ADD CONSTRAINT "feedback_notifications_feedback_id_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "feedback"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "feedback_votes" ADD CONSTRAINT "feedback_votes_feedback_id_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "feedback"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resource_downloads" ADD CONSTRAINT "resource_downloads_version_id_resource_versions_id_fkey" FOREIGN KEY ("version_id") REFERENCES "resource_versions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resource_files" ADD CONSTRAINT "resource_files_version_id_resource_versions_id_fkey" FOREIGN KEY ("version_id") REFERENCES "resource_versions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resource_images" ADD CONSTRAINT "resource_images_resource_id_resources_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resource_notifications" ADD CONSTRAINT "resource_notifications_resource_id_resources_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resource_notifications" ADD CONSTRAINT "resource_notifications_category_id_resource_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "resource_categories"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "resource_versions" ADD CONSTRAINT "resource_versions_resource_id_resources_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resources_to_categories" ADD CONSTRAINT "resources_to_categories_resource_id_resources_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resources_to_categories" ADD CONSTRAINT "resources_to_categories_category_id_resource_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "resource_categories"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tmp_autmog_pen_materials" ADD CONSTRAINT "tmp_autmog_pen_materials_pen_id_tmp_autmog_pens_id_fkey" FOREIGN KEY ("pen_id") REFERENCES "tmp_autmog_pens"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tmp_autmog_pen_materials" ADD CONSTRAINT "tmp_autmog_pen_materials_material_id_materials_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tmp_autmog_pen_versions" ADD CONSTRAINT "tmp_autmog_pen_versions_pen_id_tmp_autmog_pens_id_fkey" FOREIGN KEY ("pen_id") REFERENCES "tmp_autmog_pens"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tmp_autmog_pens" ADD CONSTRAINT "tmp_autmog_pens_product_id_tmp_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "tmp_products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tmp_autmog_pens" ADD CONSTRAINT "tmp_autmog_pens_maker_id_makers_id_fkey" FOREIGN KEY ("maker_id") REFERENCES "makers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tmp_autmog_pens" ADD CONSTRAINT "tmp_autmog_pens_mechanism_id_mechanisms_id_fkey" FOREIGN KEY ("mechanism_id") REFERENCES "mechanisms"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tmp_grimsmo_knife_variation_versions" ADD CONSTRAINT "tmp_grimsmo_knife_variation_versions_Sfw2vcf2HSlG_fkey" FOREIGN KEY ("variation_id") REFERENCES "tmp_grimsmo_knife_variations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tmp_grimsmo_knife_variations" ADD CONSTRAINT "tmp_grimsmo_knife_variations_HAdtJPHU7GXo_fkey" FOREIGN KEY ("product_variation_id") REFERENCES "tmp_product_variations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tmp_grimsmo_knife_variations" ADD CONSTRAINT "tmp_grimsmo_knife_variations_GkWd118zgXEL_fkey" FOREIGN KEY ("knife_id") REFERENCES "tmp_grimsmo_knives"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tmp_grimsmo_knife_versions" ADD CONSTRAINT "tmp_grimsmo_knife_versions_knife_id_tmp_grimsmo_knives_id_fkey" FOREIGN KEY ("knife_id") REFERENCES "tmp_grimsmo_knives"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tmp_grimsmo_knives" ADD CONSTRAINT "tmp_grimsmo_knives_product_id_tmp_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "tmp_products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tmp_grimsmo_knives" ADD CONSTRAINT "tmp_grimsmo_knives_maker_id_makers_id_fkey" FOREIGN KEY ("maker_id") REFERENCES "makers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tmp_grimsmo_pen_variation_versions" ADD CONSTRAINT "tmp_grimsmo_pen_variation_versions_wd16MtMy7jPK_fkey" FOREIGN KEY ("variation_id") REFERENCES "tmp_grimsmo_pen_variations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tmp_grimsmo_pen_variations" ADD CONSTRAINT "tmp_grimsmo_pen_variations_1ti7OOX2KSFu_fkey" FOREIGN KEY ("product_variation_id") REFERENCES "tmp_product_variations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tmp_grimsmo_pen_variations" ADD CONSTRAINT "tmp_grimsmo_pen_variations_pen_id_tmp_grimsmo_pens_id_fkey" FOREIGN KEY ("pen_id") REFERENCES "tmp_grimsmo_pens"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tmp_grimsmo_pen_versions" ADD CONSTRAINT "tmp_grimsmo_pen_versions_pen_id_tmp_grimsmo_pens_id_fkey" FOREIGN KEY ("pen_id") REFERENCES "tmp_grimsmo_pens"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tmp_grimsmo_pens" ADD CONSTRAINT "tmp_grimsmo_pens_product_id_tmp_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "tmp_products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tmp_grimsmo_pens" ADD CONSTRAINT "tmp_grimsmo_pens_maker_id_makers_id_fkey" FOREIGN KEY ("maker_id") REFERENCES "makers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tmp_images" ADD CONSTRAINT "tmp_images_product_id_tmp_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "tmp_products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tmp_images" ADD CONSTRAINT "tmp_images_product_variation_id_tmp_product_variations_id_fkey" FOREIGN KEY ("product_variation_id") REFERENCES "tmp_product_variations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tmp_images" ADD CONSTRAINT "tmp_images_product_variation_product_fk" FOREIGN KEY ("product_variation_id","product_id") REFERENCES "tmp_product_variations"("id","product_id");--> statement-breakpoint
ALTER TABLE "tmp_product_product_types" ADD CONSTRAINT "tmp_product_product_types_product_id_tmp_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "tmp_products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tmp_product_product_types" ADD CONSTRAINT "tmp_product_product_types_product_type_id_product_types_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tmp_product_variations" ADD CONSTRAINT "tmp_product_variations_product_id_tmp_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "tmp_products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "upload_file" ADD CONSTRAINT "upload_file_session_id_upload_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "upload_session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_ban" ADD CONSTRAINT "user_ban_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;