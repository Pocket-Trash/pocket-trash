CREATE TABLE "catalog_market" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "catalog_market_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"kind" text NOT NULL,
	"code" text NOT NULL CONSTRAINT "catalog_market_code_unique" UNIQUE,
	"display_name" text NOT NULL,
	"display_name_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_market_kind_valid" CHECK ("kind" in ('global', 'country', 'region')),
	CONSTRAINT "catalog_market_code_valid" CHECK (("kind" = 'global' and "code" = 'GLOBAL') or ("kind" = 'country' and "code" ~ '^[A-Z]{2}$') or ("kind" = 'region' and char_length(trim("code")) between 2 and 40 and "code" <> 'GLOBAL'))
);
--> statement-breakpoint
CREATE TABLE "catalog_market_containment" (
	"parent_market_id" bigint,
	"child_market_id" bigint,
	CONSTRAINT "catalog_market_containment_pkey" PRIMARY KEY("parent_market_id","child_market_id"),
	CONSTRAINT "catalog_market_containment_distinct" CHECK ("parent_market_id" <> "child_market_id")
);
--> statement-breakpoint
CREATE TABLE "catalog_source_evidence" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "catalog_source_evidence_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"listing_id" bigint,
	"publisher" text NOT NULL,
	"source_kind" text NOT NULL,
	"original_url" text NOT NULL,
	"capture_date" date NOT NULL,
	"publication_date" date,
	"catalog_edition" text,
	"preserved_source_identity" text,
	"preserved_source_checksum" text,
	"claim" text NOT NULL,
	"market_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_source_evidence_checksum_valid" CHECK ("preserved_source_checksum" is null or "preserved_source_checksum" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "catalog_source_evidence_claim_valid" CHECK (char_length(trim("claim")) between 1 and 5000)
);
--> statement-breakpoint
CREATE TABLE "catalog_source_image" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "catalog_source_image_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"listing_id" bigint NOT NULL,
	"product_image_id" bigint NOT NULL,
	"source_image_id" text NOT NULL,
	"source_url" text NOT NULL,
	"source_hash" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_source_image_listing_identity_unique" UNIQUE("listing_id","source_image_id"),
	CONSTRAINT "catalog_source_image_listing_product_image_unique" UNIQUE("listing_id","product_image_id"),
	CONSTRAINT "catalog_source_image_position_valid" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "catalog_source_listing" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "catalog_source_listing_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"maker_id" bigint NOT NULL,
	"source_system" text NOT NULL,
	"source_record_id" text NOT NULL,
	"listing_url" text NOT NULL,
	"source_handle" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_source_listing_identity_unique" UNIQUE("maker_id","source_system","source_record_id","listing_url")
);
--> statement-breakpoint
CREATE TABLE "catalog_source_listing_choice" (
	"listing_id" bigint,
	"choice_id" bigint,
	CONSTRAINT "catalog_source_listing_choice_pkey" PRIMARY KEY("listing_id","choice_id")
);
--> statement-breakpoint
CREATE TABLE "catalog_terminology_concept" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "catalog_terminology_concept_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"namespace" text NOT NULL,
	"key" text NOT NULL,
	"canonical_label_key" text NOT NULL,
	"canonical_label_fallback" text NOT NULL,
	"normalized_canonical_label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_terminology_concept_id_namespace_unique" UNIQUE("id","namespace"),
	CONSTRAINT "catalog_terminology_concept_namespace_key_unique" UNIQUE("namespace","key"),
	CONSTRAINT "catalog_terminology_concept_namespace_label_unique" UNIQUE("namespace","normalized_canonical_label"),
	CONSTRAINT "catalog_terminology_concept_namespace_valid" CHECK (char_length(trim("namespace")) between 1 and 80),
	CONSTRAINT "catalog_terminology_concept_key_valid" CHECK (char_length(trim("key")) between 1 and 80),
	CONSTRAINT "catalog_terminology_concept_label_key_valid" CHECK (char_length(trim("canonical_label_key")) between 1 and 200),
	CONSTRAINT "catalog_terminology_concept_label_valid" CHECK (char_length(trim("canonical_label_fallback")) between 1 and 80),
	CONSTRAINT "catalog_terminology_concept_normalized_label_valid" CHECK (char_length("normalized_canonical_label") between 1 and 80 and "normalized_canonical_label" = lower(trim("normalized_canonical_label")))
);
--> statement-breakpoint
CREATE TABLE "collection_detail_pen" (
	"id" bigint PRIMARY KEY,
	"product_pen_id" bigint NOT NULL,
	"installed_refill_product_id" bigint,
	"installed_refill_offering_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_detail_pen_offering_requires_refill" CHECK ("installed_refill_offering_id" is null or "installed_refill_product_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "collection_detail_pen_actuator" (
	"id" bigint PRIMARY KEY,
	"product_pen_actuator_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_detail_pen_clip" (
	"id" bigint PRIMARY KEY,
	"product_pen_clip_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_detail_pen_mechanism" (
	"id" bigint PRIMARY KEY,
	"product_pen_mechanism_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_detail_pen_tip" (
	"id" bigint PRIMARY KEY,
	"product_pen_tip_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_detail_pen_top_cap" (
	"id" bigint PRIMARY KEY,
	"product_pen_top_cap_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_item_configuration_selection" (
	"collection_item_id" bigint,
	"slot_id" bigint,
	"choice_id" bigint NOT NULL,
	"installed_part_collection_item_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_item_configuration_selection_pkey" PRIMARY KEY("collection_item_id","slot_id")
);
--> statement-breakpoint
CREATE TABLE "configuration_slot_kind" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "configuration_slot_kind_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"slug" text NOT NULL CONSTRAINT "configuration_slot_kind_slug_unique" UNIQUE,
	"label_key" text NOT NULL,
	"label_fallback" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "configuration_slot_kind_slug_valid" CHECK (char_length(trim("slug")) between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "pen_nose_profile_assignment" (
	"product_id" bigint PRIMARY KEY,
	"concept_id" bigint NOT NULL,
	"namespace" text DEFAULT 'pen-nose-profile' NOT NULL,
	CONSTRAINT "pen_nose_profile_assignment_namespace_valid" CHECK ("namespace" = 'pen-nose-profile')
);
--> statement-breakpoint
CREATE TABLE "pen_part_role_assignment" (
	"part_product_id" bigint,
	"concept_id" bigint,
	"namespace" text DEFAULT 'pen-part-role' NOT NULL,
	CONSTRAINT "pen_part_role_assignment_pkey" PRIMARY KEY("part_product_id","concept_id"),
	CONSTRAINT "pen_part_role_assignment_namespace_valid" CHECK ("namespace" = 'pen-part-role')
);
--> statement-breakpoint
CREATE TABLE "product_alias" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_alias_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_id" bigint NOT NULL,
	"label" text NOT NULL,
	"normalized_value" text NOT NULL,
	"authored_by_clerk_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_alias_product_value_unique" UNIQUE("product_id","normalized_value"),
	CONSTRAINT "product_alias_label_valid" CHECK (char_length(trim("label")) between 1 and 80),
	CONSTRAINT "product_alias_normalized_value_valid" CHECK (char_length("normalized_value") between 1 and 80 and "normalized_value" = lower(trim("normalized_value")))
);
--> statement-breakpoint
CREATE TABLE "product_configuration_choice" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_configuration_choice_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_id" bigint NOT NULL,
	"slot_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"product_material_id" bigint,
	"finish_option_id" bigint,
	"part_product_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_configuration_choice_slot_position_unique" UNIQUE("slot_id","position"),
	CONSTRAINT "product_configuration_choice_id_slot_product_unique" UNIQUE("id","slot_id","product_id"),
	CONSTRAINT "product_configuration_choice_id_slot_unique" UNIQUE("id","slot_id"),
	CONSTRAINT "product_configuration_choice_id_product_unique" UNIQUE("id","product_id"),
	CONSTRAINT "product_configuration_choice_carrier_valid" CHECK (num_nonnulls("product_material_id", "finish_option_id", "part_product_id") = 1),
	CONSTRAINT "product_configuration_choice_part_distinct" CHECK ("part_product_id" is null or "part_product_id" <> "product_id"),
	CONSTRAINT "product_configuration_choice_position_valid" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_configuration_choice_requirement" (
	"rule_id" bigint,
	"product_id" bigint NOT NULL,
	"required_choice_id" bigint,
	CONSTRAINT "product_configuration_choice_requirement_pkey" PRIMARY KEY("rule_id","required_choice_id")
);
--> statement-breakpoint
CREATE TABLE "product_configuration_choice_rule" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_configuration_choice_rule_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_id" bigint NOT NULL,
	"target_choice_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_configuration_choice_rule_target_position_unique" UNIQUE("target_choice_id","position"),
	CONSTRAINT "product_configuration_choice_rule_id_target_product_unique" UNIQUE("id","target_choice_id","product_id"),
	CONSTRAINT "product_configuration_choice_rule_id_product_unique" UNIQUE("id","product_id"),
	CONSTRAINT "product_configuration_choice_rule_position_valid" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_configuration_slot" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_configuration_slot_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"product_id" bigint NOT NULL,
	"slot_kind_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_configuration_slot_product_kind_unique" UNIQUE("product_id","slot_kind_id"),
	CONSTRAINT "product_configuration_slot_product_position_unique" UNIQUE("product_id","position"),
	CONSTRAINT "product_configuration_slot_id_product_unique" UNIQUE("id","product_id"),
	CONSTRAINT "product_configuration_slot_position_valid" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_detail_pen" (
	"id" bigint PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_detail_pen_actuator" (
	"id" bigint PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_detail_pen_clip" (
	"id" bigint PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_detail_pen_mechanism" (
	"id" bigint PRIMARY KEY,
	"mechanism_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_detail_pen_part" (
	"id" bigint PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_detail_pen_tip" (
	"id" bigint PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_detail_pen_top_cap" (
	"id" bigint PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_detail_refill" (
	"id" bigint PRIMARY KEY,
	"maker_id" bigint NOT NULL,
	"model" text NOT NULL,
	"normalized_model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_detail_refill_maker_model_unique" UNIQUE("maker_id","normalized_model"),
	CONSTRAINT "product_detail_refill_model_valid" CHECK (char_length(trim("model")) between 1 and 200),
	CONSTRAINT "product_detail_refill_normalized_model_valid" CHECK (char_length("normalized_model") between 1 and 200 and "normalized_model" = lower(trim("normalized_model")))
);
--> statement-breakpoint
CREATE TABLE "product_source_listing" (
	"product_id" bigint NOT NULL,
	"listing_id" bigint PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE "refill_compatibility_assertion" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "refill_compatibility_assertion_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"pen_product_id" bigint NOT NULL,
	"required_tip_product_id" bigint,
	"target_group_id" bigint,
	"target_refill_product_id" bigint,
	"outcome" text NOT NULL,
	"explanation" text,
	"remedy" text,
	"warning" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refill_compatibility_assertion_scope_unique" UNIQUE NULLS NOT DISTINCT("pen_product_id","required_tip_product_id","target_group_id","target_refill_product_id"),
	CONSTRAINT "refill_compatibility_assertion_target_valid" CHECK (num_nonnulls("target_group_id", "target_refill_product_id") = 1),
	CONSTRAINT "refill_compatibility_assertion_outcome_valid" CHECK ("outcome" in ('compatible', 'incompatible', 'conditional', 'variable')),
	CONSTRAINT "refill_compatibility_assertion_explanation_required" CHECK ("outcome" not in ('incompatible', 'variable') or char_length(trim("explanation")) between 1 and 2000),
	CONSTRAINT "refill_compatibility_assertion_remedy_required" CHECK ("outcome" <> 'conditional' or char_length(trim("remedy")) between 1 and 2000),
	CONSTRAINT "refill_compatibility_assertion_text_valid" CHECK (("explanation" is null or char_length(trim("explanation")) between 1 and 2000) and ("remedy" is null or char_length(trim("remedy")) between 1 and 2000) and ("warning" is null or char_length(trim("warning")) between 1 and 2000))
);
--> statement-breakpoint
CREATE TABLE "refill_compatibility_assertion_evidence" (
	"assertion_id" bigint,
	"evidence_id" bigint,
	"stance" text NOT NULL,
	CONSTRAINT "refill_compatibility_assertion_evidence_pkey" PRIMARY KEY("assertion_id","evidence_id"),
	CONSTRAINT "refill_compatibility_assertion_evidence_stance_valid" CHECK ("stance" in ('supports', 'contradicts'))
);
--> statement-breakpoint
CREATE TABLE "refill_compatibility_evidence" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "refill_compatibility_evidence_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"notes" text,
	"source_url" text,
	"source_date" date,
	"catalog_edition" text,
	"first_measured_format_label" text,
	"second_measured_format_label" text,
	"first_source_url" text,
	"second_source_url" text,
	"pen_product_id" bigint,
	"required_tip_product_id" bigint,
	"refill_product_id" bigint,
	"test_date" date,
	"result" text,
	"procedure" text,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refill_compatibility_evidence_kind_valid" CHECK ("kind" in ('manufacturer-statement', 'dimensional-comparison', 'physical-fit-test', 'curated-observation')),
	CONSTRAINT "refill_compatibility_evidence_summary_valid" CHECK (char_length(trim("summary")) between 1 and 2000),
	CONSTRAINT "refill_compatibility_evidence_fields_valid" CHECK ((
        "kind" in ('manufacturer-statement', 'curated-observation')
        and "source_url" is not null
        and num_nonnulls("source_date", "catalog_edition") >= 1
        and num_nonnulls("first_measured_format_label", "second_measured_format_label", "first_source_url", "second_source_url", "pen_product_id", "required_tip_product_id", "refill_product_id", "test_date", "result", "procedure") = 0
      ) or (
        "kind" = 'dimensional-comparison'
        and num_nonnulls("first_measured_format_label", "second_measured_format_label", "first_source_url", "second_source_url") = 4
        and num_nonnulls("source_url", "source_date", "catalog_edition", "pen_product_id", "required_tip_product_id", "refill_product_id", "test_date", "result", "procedure") = 0
      ) or (
        "kind" = 'physical-fit-test'
        and num_nonnulls("pen_product_id", "refill_product_id", "test_date", "result", "procedure") = 5
        and num_nonnulls("source_url", "source_date", "catalog_edition", "first_measured_format_label", "second_measured_format_label", "first_source_url", "second_source_url") = 0
      ))
);
--> statement-breakpoint
CREATE TABLE "refill_compatibility_group" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "refill_compatibility_group_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"concept_id" bigint NOT NULL CONSTRAINT "refill_compatibility_group_concept_unique" UNIQUE,
	"namespace" text DEFAULT 'refill-compatibility-group' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refill_compatibility_group_namespace_valid" CHECK ("namespace" = 'refill-compatibility-group')
);
--> statement-breakpoint
CREATE TABLE "refill_compatibility_group_membership" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "refill_compatibility_group_membership_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"group_id" bigint NOT NULL,
	"refill_product_id" bigint NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refill_compatibility_group_membership_unique" UNIQUE("group_id","refill_product_id")
);
--> statement-breakpoint
CREATE TABLE "refill_compatibility_group_membership_evidence" (
	"membership_id" bigint,
	"evidence_id" bigint,
	"stance" text NOT NULL,
	CONSTRAINT "refill_compatibility_group_membership_evidence_pkey" PRIMARY KEY("membership_id","evidence_id"),
	CONSTRAINT "refill_compatibility_group_membership_evidence_stance_valid" CHECK ("stance" in ('supports', 'contradicts'))
);
--> statement-breakpoint
CREATE TABLE "refill_ink_color" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "refill_ink_color_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL CONSTRAINT "refill_ink_color_slug_unique" UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refill_offering" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "refill_offering_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"refill_product_id" bigint NOT NULL,
	"tip_style_id" bigint NOT NULL,
	"tip_size" text NOT NULL,
	"normalized_tip_size" text NOT NULL,
	"ink_color_id" bigint NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refill_offering_identity_unique" UNIQUE("refill_product_id","tip_style_id","normalized_tip_size","ink_color_id"),
	CONSTRAINT "refill_offering_id_refill_unique" UNIQUE("id","refill_product_id"),
	CONSTRAINT "refill_offering_tip_size_valid" CHECK (char_length(trim("tip_size")) between 1 and 80),
	CONSTRAINT "refill_offering_normalized_tip_size_valid" CHECK (char_length("normalized_tip_size") between 1 and 80 and "normalized_tip_size" = lower(trim("normalized_tip_size")))
);
--> statement-breakpoint
CREATE TABLE "refill_offering_evidence" (
	"offering_id" bigint,
	"evidence_id" bigint,
	"stance" text NOT NULL,
	CONSTRAINT "refill_offering_evidence_pkey" PRIMARY KEY("offering_id","evidence_id"),
	CONSTRAINT "refill_offering_evidence_stance_valid" CHECK ("stance" in ('supports', 'contradicts'))
);
--> statement-breakpoint
CREATE TABLE "refill_offering_identifier" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "refill_offering_identifier_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"offering_id" bigint NOT NULL,
	"maker_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"source_value" text NOT NULL,
	"comparison_value" text NOT NULL,
	"comparison_rule" text DEFAULT 'trim' NOT NULL,
	"market_id" bigint NOT NULL,
	"effective_date" date,
	"approved_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"successor_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refill_offering_identifier_id_scope_unique" UNIQUE("id","maker_id","kind","market_id"),
	CONSTRAINT "refill_offering_identifier_kind_valid" CHECK ("kind" in ('maker-code', 'sku')),
	CONSTRAINT "refill_offering_identifier_value_valid" CHECK (char_length(trim("source_value")) between 1 and 200 and char_length(trim("comparison_value")) between 1 and 200),
	CONSTRAINT "refill_offering_identifier_default_comparison_valid" CHECK ("comparison_rule" <> 'trim' or "comparison_value" = trim("source_value")),
	CONSTRAINT "refill_offering_identifier_successor_valid" CHECK (("superseded_at" is null and "successor_id" is null) or ("superseded_at" is not null and "successor_id" is not null and "successor_id" <> "id"))
);
--> statement-breakpoint
CREATE TABLE "refill_offering_identifier_evidence" (
	"identifier_id" bigint,
	"evidence_id" bigint,
	"stance" text NOT NULL,
	CONSTRAINT "refill_offering_identifier_evidence_pkey" PRIMARY KEY("identifier_id","evidence_id"),
	CONSTRAINT "refill_offering_identifier_evidence_stance_valid" CHECK ("stance" in ('supports', 'contradicts'))
);
--> statement-breakpoint
CREATE TABLE "refill_offering_market_status" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "refill_offering_market_status_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"offering_id" bigint NOT NULL,
	"market_id" bigint NOT NULL,
	"lifecycle" text NOT NULL,
	"effective_date" date,
	"approved_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"successor_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refill_offering_market_status_id_scope_unique" UNIQUE("id","offering_id","market_id"),
	CONSTRAINT "refill_offering_market_status_lifecycle_valid" CHECK ("lifecycle" in ('current', 'discontinued', 'historical')),
	CONSTRAINT "refill_offering_market_status_successor_valid" CHECK (("superseded_at" is null and "successor_id" is null) or ("superseded_at" is not null and "successor_id" is not null and "successor_id" <> "id"))
);
--> statement-breakpoint
CREATE TABLE "refill_offering_market_status_evidence" (
	"status_id" bigint,
	"evidence_id" bigint,
	"stance" text NOT NULL,
	CONSTRAINT "refill_offering_market_status_evidence_pkey" PRIMARY KEY("status_id","evidence_id"),
	CONSTRAINT "refill_offering_market_status_evidence_stance_valid" CHECK ("stance" in ('supports', 'contradicts'))
);
--> statement-breakpoint
CREATE TABLE "refill_tip_style" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "refill_tip_style_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL CONSTRAINT "refill_tip_style_slug_unique" UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_terminology_alias" DROP CONSTRAINT "catalog_terminology_alias_canonical_key_product_types_slug_fkey";--> statement-breakpoint
ALTER TABLE "catalog_terminology_alias" DROP CONSTRAINT "catalog_terminology_alias_maker_concept_value_unique";--> statement-breakpoint
ALTER TABLE "catalog_terminology_alias" DROP CONSTRAINT "catalog_terminology_alias_namespace_valid";--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "catalog_terminology_alias"
    GROUP BY "maker_id", "canonical_namespace", "normalized_value"
    HAVING count(DISTINCT "canonical_key") > 1
  ) THEN
    RAISE EXCEPTION 'catalog terminology alias collision audit failed';
  END IF;
END $$;--> statement-breakpoint
INSERT INTO "product_types" ("name", "slug", "is_part_or_accessory") VALUES
  ('Pen', 'pen', false),
  ('Pen Clip', 'pen-clip', true),
  ('Pen Tip', 'pen-tip', true),
  ('Pen Top Cap', 'pen-top-cap', true),
  ('Pen Mechanism', 'pen-mechanism', true),
  ('Pen Actuator', 'pen-actuator', true),
  ('Refill', 'refill', true)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "is_part_or_accessory" = EXCLUDED."is_part_or_accessory",
  "updated_at" = now();--> statement-breakpoint
INSERT INTO "mechanisms" ("name", "slug") VALUES
  ('Click', 'click'),
  ('Bolt Action', 'bolt-action'),
  ('Twist', 'twist')
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name", "updated_at" = now();--> statement-breakpoint
INSERT INTO "catalog_terminology_concept"
  ("namespace", "key", "canonical_label_key", "canonical_label_fallback", "normalized_canonical_label")
SELECT
  'product-type', "slug", 'catalog.productTypes.' || "slug", "name", lower(trim("name"))
FROM "product_types"
ON CONFLICT ("namespace", "key") DO UPDATE SET
  "canonical_label_key" = EXCLUDED."canonical_label_key",
  "canonical_label_fallback" = EXCLUDED."canonical_label_fallback",
  "normalized_canonical_label" = EXCLUDED."normalized_canonical_label",
  "updated_at" = now();--> statement-breakpoint
INSERT INTO "catalog_terminology_concept"
  ("namespace", "key", "canonical_label_key", "canonical_label_fallback", "normalized_canonical_label") VALUES
  ('pen-part-role', 'tip', 'catalog.penPartRoles.tip', 'Tip', 'tip'),
  ('pen-part-role', 'top-cap', 'catalog.penPartRoles.topCap', 'Top Cap', 'top cap'),
  ('pen-part-role', 'clip', 'catalog.penPartRoles.clip', 'Clip', 'clip'),
  ('pen-part-role', 'mechanism', 'catalog.penPartRoles.mechanism', 'Mechanism', 'mechanism'),
  ('pen-part-role', 'actuator', 'catalog.penPartRoles.actuator', 'Actuator', 'actuator'),
  ('pen-nose-profile', 'round', 'catalog.penNoseProfiles.round', 'Round', 'round'),
  ('pen-nose-profile', 'step', 'catalog.penNoseProfiles.step', 'Step', 'step'),
  ('pen-nose-profile', 'cone', 'catalog.penNoseProfiles.cone', 'Cone', 'cone'),
  ('refill-compatibility-group', 'parker-g2', 'catalog.refillCompatibilityGroups.parkerG2', 'Parker-style G2', 'parker-style g2'),
  ('refill-compatibility-group', 'pilot-g2', 'catalog.refillCompatibilityGroups.pilotG2', 'Pilot G2', 'pilot g2'),
  ('refill-compatibility-group', 'energel', 'catalog.refillCompatibilityGroups.energel', 'EnerGel', 'energel')
ON CONFLICT ("namespace", "key") DO NOTHING;--> statement-breakpoint
INSERT INTO "configuration_slot_kind" ("slug", "label_key", "label_fallback") VALUES
  ('material', 'catalog.configurationSlots.material', 'Material'),
  ('appearance', 'catalog.configurationSlots.appearance', 'Appearance'),
  ('tip', 'catalog.configurationSlots.tip', 'Tip'),
  ('top-cap', 'catalog.configurationSlots.topCap', 'Top Cap'),
  ('clip', 'catalog.configurationSlots.clip', 'Clip'),
  ('mechanism', 'catalog.configurationSlots.mechanism', 'Mechanism'),
  ('actuator', 'catalog.configurationSlots.actuator', 'Actuator')
ON CONFLICT ("slug") DO UPDATE SET
  "label_key" = EXCLUDED."label_key",
  "label_fallback" = EXCLUDED."label_fallback",
  "updated_at" = now();--> statement-breakpoint
INSERT INTO "catalog_market" ("kind", "code", "display_name", "display_name_key")
VALUES ('global', 'GLOBAL', 'Global', 'catalog.markets.global')
ON CONFLICT ("code") DO UPDATE SET
  "kind" = EXCLUDED."kind",
  "display_name" = EXCLUDED."display_name",
  "display_name_key" = EXCLUDED."display_name_key",
  "updated_at" = now();--> statement-breakpoint
ALTER TABLE "catalog_terminology_alias" ADD COLUMN "concept_id" bigint;--> statement-breakpoint
UPDATE "catalog_terminology_alias" alias
SET "concept_id" = concept."id"
FROM "catalog_terminology_concept" concept
WHERE concept."namespace" = alias."canonical_namespace"
  AND concept."key" = alias."canonical_key";--> statement-breakpoint
ALTER TABLE "catalog_terminology_alias" ALTER COLUMN "concept_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_item" ADD COLUMN "serial_number" text;--> statement-breakpoint
ALTER TABLE "catalog_terminology_alias" DROP COLUMN "canonical_key";--> statement-breakpoint
ALTER TABLE "catalog_terminology_alias" ALTER COLUMN "maker_id" DROP NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "catalog_terminology_alias_preferred_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_terminology_alias_preferred_unique" ON "catalog_terminology_alias" ("maker_id","concept_id") WHERE "is_preferred";--> statement-breakpoint
DROP INDEX IF EXISTS "catalog_terminology_alias_concept_idx";--> statement-breakpoint
CREATE INDEX "catalog_terminology_alias_concept_idx" ON "catalog_terminology_alias" ("concept_id");--> statement-breakpoint
ALTER TABLE "catalog_terminology_alias" ADD CONSTRAINT "catalog_terminology_alias_scope_value_unique" UNIQUE NULLS NOT DISTINCT("maker_id","canonical_namespace","normalized_value");--> statement-breakpoint
ALTER TABLE "finish_option" ADD CONSTRAINT "finish_option_id_product_unique" UNIQUE("id","product_id");--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_id_maker_unique" UNIQUE("id","maker_id");--> statement-breakpoint
ALTER TABLE "product_material" ADD CONSTRAINT "product_material_id_product_unique" UNIQUE("id","product_id");--> statement-breakpoint
CREATE INDEX "catalog_terminology_alias_lookup_idx" ON "catalog_terminology_alias" ("canonical_namespace","normalized_value","maker_id");--> statement-breakpoint
CREATE INDEX "catalog_market_containment_child_idx" ON "catalog_market_containment" ("child_market_id");--> statement-breakpoint
CREATE INDEX "catalog_source_evidence_listing_idx" ON "catalog_source_evidence" ("listing_id");--> statement-breakpoint
CREATE INDEX "catalog_source_evidence_market_idx" ON "catalog_source_evidence" ("market_id");--> statement-breakpoint
CREATE INDEX "catalog_source_image_product_image_idx" ON "catalog_source_image" ("product_image_id");--> statement-breakpoint
CREATE INDEX "catalog_source_image_url_idx" ON "catalog_source_image" ("source_url");--> statement-breakpoint
CREATE INDEX "catalog_source_image_hash_idx" ON "catalog_source_image" ("source_hash");--> statement-breakpoint
CREATE INDEX "catalog_source_listing_source_idx" ON "catalog_source_listing" ("maker_id","source_system","source_record_id");--> statement-breakpoint
CREATE INDEX "catalog_source_listing_url_idx" ON "catalog_source_listing" ("listing_url");--> statement-breakpoint
CREATE INDEX "catalog_source_listing_choice_choice_idx" ON "catalog_source_listing_choice" ("choice_id");--> statement-breakpoint
CREATE INDEX "collection_detail_pen_product_idx" ON "collection_detail_pen" ("product_pen_id");--> statement-breakpoint
CREATE INDEX "collection_detail_pen_refill_idx" ON "collection_detail_pen" ("installed_refill_product_id");--> statement-breakpoint
CREATE INDEX "collection_detail_pen_offering_idx" ON "collection_detail_pen" ("installed_refill_offering_id");--> statement-breakpoint
CREATE INDEX "collection_item_configuration_selection_choice_idx" ON "collection_item_configuration_selection" ("choice_id");--> statement-breakpoint
CREATE INDEX "collection_item_configuration_selection_installed_part_idx" ON "collection_item_configuration_selection" ("installed_part_collection_item_id");--> statement-breakpoint
CREATE INDEX "pen_nose_profile_assignment_concept_idx" ON "pen_nose_profile_assignment" ("concept_id");--> statement-breakpoint
CREATE INDEX "pen_part_role_assignment_concept_idx" ON "pen_part_role_assignment" ("concept_id");--> statement-breakpoint
CREATE INDEX "product_alias_product_id_idx" ON "product_alias" ("product_id");--> statement-breakpoint
CREATE INDEX "product_alias_normalized_value_idx" ON "product_alias" ("normalized_value");--> statement-breakpoint
CREATE INDEX "product_configuration_choice_material_idx" ON "product_configuration_choice" ("product_material_id");--> statement-breakpoint
CREATE INDEX "product_configuration_choice_finish_idx" ON "product_configuration_choice" ("finish_option_id");--> statement-breakpoint
CREATE INDEX "product_configuration_choice_part_idx" ON "product_configuration_choice" ("part_product_id");--> statement-breakpoint
CREATE INDEX "product_configuration_choice_requirement_choice_idx" ON "product_configuration_choice_requirement" ("required_choice_id");--> statement-breakpoint
CREATE INDEX "product_configuration_slot_kind_idx" ON "product_configuration_slot" ("slot_kind_id");--> statement-breakpoint
CREATE INDEX "product_detail_pen_mechanism_type_idx" ON "product_detail_pen_mechanism" ("mechanism_id");--> statement-breakpoint
CREATE INDEX "product_detail_refill_maker_id_idx" ON "product_detail_refill" ("maker_id");--> statement-breakpoint
CREATE INDEX "product_source_listing_product_idx" ON "product_source_listing" ("product_id");--> statement-breakpoint
CREATE INDEX "refill_compatibility_assertion_refill_tip_idx" ON "refill_compatibility_assertion" ("pen_product_id","required_tip_product_id","target_refill_product_id");--> statement-breakpoint
CREATE INDEX "refill_compatibility_assertion_group_tip_idx" ON "refill_compatibility_assertion" ("pen_product_id","required_tip_product_id","target_group_id");--> statement-breakpoint
CREATE INDEX "refill_compatibility_assertion_evidence_evidence_idx" ON "refill_compatibility_assertion_evidence" ("evidence_id");--> statement-breakpoint
CREATE INDEX "refill_compatibility_evidence_pen_idx" ON "refill_compatibility_evidence" ("pen_product_id");--> statement-breakpoint
CREATE INDEX "refill_compatibility_evidence_tip_idx" ON "refill_compatibility_evidence" ("required_tip_product_id");--> statement-breakpoint
CREATE INDEX "refill_compatibility_evidence_refill_idx" ON "refill_compatibility_evidence" ("refill_product_id");--> statement-breakpoint
CREATE INDEX "refill_compatibility_group_membership_refill_idx" ON "refill_compatibility_group_membership" ("refill_product_id");--> statement-breakpoint
CREATE INDEX "refill_compatibility_group_membership_evidence_evidence_idx" ON "refill_compatibility_group_membership_evidence" ("evidence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refill_ink_color_name_unique" ON "refill_ink_color" (lower("name"));--> statement-breakpoint
CREATE INDEX "refill_offering_refill_idx" ON "refill_offering" ("refill_product_id");--> statement-breakpoint
CREATE INDEX "refill_offering_tip_style_idx" ON "refill_offering" ("tip_style_id");--> statement-breakpoint
CREATE INDEX "refill_offering_ink_color_idx" ON "refill_offering" ("ink_color_id");--> statement-breakpoint
CREATE INDEX "refill_offering_evidence_evidence_idx" ON "refill_offering_evidence" ("evidence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refill_offering_identifier_active_unique" ON "refill_offering_identifier" ("maker_id","kind","comparison_value","market_id") WHERE "superseded_at" is null;--> statement-breakpoint
CREATE INDEX "refill_offering_identifier_offering_idx" ON "refill_offering_identifier" ("offering_id");--> statement-breakpoint
CREATE INDEX "refill_offering_identifier_market_value_idx" ON "refill_offering_identifier" ("market_id","comparison_value");--> statement-breakpoint
CREATE INDEX "refill_offering_identifier_evidence_evidence_idx" ON "refill_offering_identifier_evidence" ("evidence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refill_offering_market_status_active_unique" ON "refill_offering_market_status" ("offering_id","market_id") WHERE "superseded_at" is null;--> statement-breakpoint
CREATE INDEX "refill_offering_market_status_market_idx" ON "refill_offering_market_status" ("market_id");--> statement-breakpoint
CREATE INDEX "refill_offering_market_status_active_lookup_idx" ON "refill_offering_market_status" ("offering_id","market_id","superseded_at");--> statement-breakpoint
CREATE INDEX "refill_offering_market_status_evidence_evidence_idx" ON "refill_offering_market_status_evidence" ("evidence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refill_tip_style_name_unique" ON "refill_tip_style" (lower("name"));--> statement-breakpoint
ALTER TABLE "catalog_terminology_alias" ADD CONSTRAINT "catalog_terminology_alias_concept_namespace_fk" FOREIGN KEY ("concept_id","canonical_namespace") REFERENCES "catalog_terminology_concept"("id","namespace") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "catalog_market_containment" ADD CONSTRAINT "catalog_market_containment_Dw9PSoxWY7Xm_fkey" FOREIGN KEY ("parent_market_id") REFERENCES "catalog_market"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "catalog_market_containment" ADD CONSTRAINT "catalog_market_containment_TKnmrKwRESdg_fkey" FOREIGN KEY ("child_market_id") REFERENCES "catalog_market"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "catalog_source_evidence" ADD CONSTRAINT "catalog_source_evidence_MNYGvGbi2Cp9_fkey" FOREIGN KEY ("listing_id") REFERENCES "catalog_source_listing"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "catalog_source_evidence" ADD CONSTRAINT "catalog_source_evidence_market_id_catalog_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "catalog_market"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "catalog_source_image" ADD CONSTRAINT "catalog_source_image_listing_id_catalog_source_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "catalog_source_listing"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "catalog_source_image" ADD CONSTRAINT "catalog_source_image_product_image_id_product_image_id_fkey" FOREIGN KEY ("product_image_id") REFERENCES "product_image"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "catalog_source_listing" ADD CONSTRAINT "catalog_source_listing_maker_id_makers_id_fkey" FOREIGN KEY ("maker_id") REFERENCES "makers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "catalog_source_listing_choice" ADD CONSTRAINT "catalog_source_listing_choice_zRYFwX34Xu0o_fkey" FOREIGN KEY ("listing_id") REFERENCES "catalog_source_listing"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "catalog_source_listing_choice" ADD CONSTRAINT "catalog_source_listing_choice_jJCqZEwCNXfR_fkey" FOREIGN KEY ("choice_id") REFERENCES "product_configuration_choice"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_pen" ADD CONSTRAINT "collection_detail_pen_id_collection_item_id_fkey" FOREIGN KEY ("id") REFERENCES "collection_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_detail_pen" ADD CONSTRAINT "collection_detail_pen_product_pen_id_product_detail_pen_id_fkey" FOREIGN KEY ("product_pen_id") REFERENCES "product_detail_pen"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_pen" ADD CONSTRAINT "collection_detail_pen_gLja9tHDjTkh_fkey" FOREIGN KEY ("installed_refill_product_id") REFERENCES "product_detail_refill"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_pen" ADD CONSTRAINT "collection_detail_pen_refill_offering_fk" FOREIGN KEY ("installed_refill_offering_id","installed_refill_product_id") REFERENCES "refill_offering"("id","refill_product_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_pen_actuator" ADD CONSTRAINT "collection_detail_pen_actuator_id_collection_item_id_fkey" FOREIGN KEY ("id") REFERENCES "collection_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_detail_pen_actuator" ADD CONSTRAINT "collection_detail_pen_actuator_1Ale4qgO8Cyq_fkey" FOREIGN KEY ("product_pen_actuator_id") REFERENCES "product_detail_pen_actuator"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_pen_clip" ADD CONSTRAINT "collection_detail_pen_clip_id_collection_item_id_fkey" FOREIGN KEY ("id") REFERENCES "collection_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_detail_pen_clip" ADD CONSTRAINT "collection_detail_pen_clip_qy6JTuYmxTRv_fkey" FOREIGN KEY ("product_pen_clip_id") REFERENCES "product_detail_pen_clip"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_pen_mechanism" ADD CONSTRAINT "collection_detail_pen_mechanism_id_collection_item_id_fkey" FOREIGN KEY ("id") REFERENCES "collection_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_detail_pen_mechanism" ADD CONSTRAINT "collection_detail_pen_mechanism_jHCg1qoXrOpC_fkey" FOREIGN KEY ("product_pen_mechanism_id") REFERENCES "product_detail_pen_mechanism"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_pen_tip" ADD CONSTRAINT "collection_detail_pen_tip_id_collection_item_id_fkey" FOREIGN KEY ("id") REFERENCES "collection_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_detail_pen_tip" ADD CONSTRAINT "collection_detail_pen_tip_KzzSAJZd2vpu_fkey" FOREIGN KEY ("product_pen_tip_id") REFERENCES "product_detail_pen_tip"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_detail_pen_top_cap" ADD CONSTRAINT "collection_detail_pen_top_cap_id_collection_item_id_fkey" FOREIGN KEY ("id") REFERENCES "collection_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_detail_pen_top_cap" ADD CONSTRAINT "collection_detail_pen_top_cap_toxH7B6xxsun_fkey" FOREIGN KEY ("product_pen_top_cap_id") REFERENCES "product_detail_pen_top_cap"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_item_configuration_selection" ADD CONSTRAINT "collection_item_configuration_selection_aMOeDvihAApI_fkey" FOREIGN KEY ("collection_item_id") REFERENCES "collection_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_item_configuration_selection" ADD CONSTRAINT "collection_item_configuration_selection_uOLvLO1zziWb_fkey" FOREIGN KEY ("installed_part_collection_item_id") REFERENCES "collection_item"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_item_configuration_selection" ADD CONSTRAINT "collection_item_configuration_selection_choice_slot_fk" FOREIGN KEY ("choice_id","slot_id") REFERENCES "product_configuration_choice"("id","slot_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "pen_nose_profile_assignment" ADD CONSTRAINT "pen_nose_profile_assignment_product_id_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pen_nose_profile_assignment" ADD CONSTRAINT "pen_nose_profile_assignment_concept_fk" FOREIGN KEY ("concept_id","namespace") REFERENCES "catalog_terminology_concept"("id","namespace") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "pen_part_role_assignment" ADD CONSTRAINT "pen_part_role_assignment_rssYabBnuNXK_fkey" FOREIGN KEY ("part_product_id") REFERENCES "product_detail_pen_part"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "pen_part_role_assignment" ADD CONSTRAINT "pen_part_role_assignment_concept_fk" FOREIGN KEY ("concept_id","namespace") REFERENCES "catalog_terminology_concept"("id","namespace") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_alias" ADD CONSTRAINT "product_alias_product_id_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_configuration_choice" ADD CONSTRAINT "product_configuration_choice_IYuhiYRQiuIE_fkey" FOREIGN KEY ("part_product_id") REFERENCES "product_detail_pen_part"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_configuration_choice" ADD CONSTRAINT "product_configuration_choice_slot_product_fk" FOREIGN KEY ("slot_id","product_id") REFERENCES "product_configuration_slot"("id","product_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_configuration_choice" ADD CONSTRAINT "product_configuration_choice_material_product_fk" FOREIGN KEY ("product_material_id","product_id") REFERENCES "product_material"("id","product_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_configuration_choice" ADD CONSTRAINT "product_configuration_choice_finish_product_fk" FOREIGN KEY ("finish_option_id","product_id") REFERENCES "finish_option"("id","product_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_configuration_choice_requirement" ADD CONSTRAINT "product_configuration_choice_requirement_rule_fk" FOREIGN KEY ("rule_id","product_id") REFERENCES "product_configuration_choice_rule"("id","product_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_configuration_choice_requirement" ADD CONSTRAINT "product_configuration_choice_requirement_choice_fk" FOREIGN KEY ("required_choice_id","product_id") REFERENCES "product_configuration_choice"("id","product_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_configuration_choice_rule" ADD CONSTRAINT "product_configuration_choice_rule_target_fk" FOREIGN KEY ("target_choice_id","product_id") REFERENCES "product_configuration_choice"("id","product_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_configuration_slot" ADD CONSTRAINT "product_configuration_slot_product_id_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_configuration_slot" ADD CONSTRAINT "product_configuration_slot_EzUs81IwNNXU_fkey" FOREIGN KEY ("slot_kind_id") REFERENCES "configuration_slot_kind"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_detail_pen" ADD CONSTRAINT "product_detail_pen_id_product_id_fkey" FOREIGN KEY ("id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_detail_pen_actuator" ADD CONSTRAINT "product_detail_pen_actuator_id_product_id_fkey" FOREIGN KEY ("id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_detail_pen_actuator" ADD CONSTRAINT "product_detail_pen_actuator_id_product_detail_pen_part_id_fkey" FOREIGN KEY ("id") REFERENCES "product_detail_pen_part"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_detail_pen_clip" ADD CONSTRAINT "product_detail_pen_clip_id_product_id_fkey" FOREIGN KEY ("id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_detail_pen_clip" ADD CONSTRAINT "product_detail_pen_clip_id_product_detail_pen_part_id_fkey" FOREIGN KEY ("id") REFERENCES "product_detail_pen_part"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_detail_pen_mechanism" ADD CONSTRAINT "product_detail_pen_mechanism_id_product_id_fkey" FOREIGN KEY ("id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_detail_pen_mechanism" ADD CONSTRAINT "product_detail_pen_mechanism_id_product_detail_pen_part_id_fkey" FOREIGN KEY ("id") REFERENCES "product_detail_pen_part"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_detail_pen_mechanism" ADD CONSTRAINT "product_detail_pen_mechanism_mechanism_id_mechanisms_id_fkey" FOREIGN KEY ("mechanism_id") REFERENCES "mechanisms"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_detail_pen_part" ADD CONSTRAINT "product_detail_pen_part_id_product_id_fkey" FOREIGN KEY ("id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_detail_pen_tip" ADD CONSTRAINT "product_detail_pen_tip_id_product_id_fkey" FOREIGN KEY ("id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_detail_pen_tip" ADD CONSTRAINT "product_detail_pen_tip_id_product_detail_pen_part_id_fkey" FOREIGN KEY ("id") REFERENCES "product_detail_pen_part"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_detail_pen_top_cap" ADD CONSTRAINT "product_detail_pen_top_cap_id_product_id_fkey" FOREIGN KEY ("id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_detail_pen_top_cap" ADD CONSTRAINT "product_detail_pen_top_cap_id_product_detail_pen_part_id_fkey" FOREIGN KEY ("id") REFERENCES "product_detail_pen_part"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_detail_refill" ADD CONSTRAINT "product_detail_refill_id_product_id_fkey" FOREIGN KEY ("id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_detail_refill" ADD CONSTRAINT "product_detail_refill_product_maker_fk" FOREIGN KEY ("id","maker_id") REFERENCES "product"("id","maker_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_source_listing" ADD CONSTRAINT "product_source_listing_product_id_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "product_source_listing" ADD CONSTRAINT "product_source_listing_wCK2d07s7pgk_fkey" FOREIGN KEY ("listing_id") REFERENCES "catalog_source_listing"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_compatibility_assertion" ADD CONSTRAINT "refill_compatibility_assertion_dBwQXsNns32G_fkey" FOREIGN KEY ("pen_product_id") REFERENCES "product_detail_pen"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_compatibility_assertion" ADD CONSTRAINT "refill_compatibility_assertion_3E47qd1G38S0_fkey" FOREIGN KEY ("required_tip_product_id") REFERENCES "product_detail_pen_tip"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_compatibility_assertion" ADD CONSTRAINT "refill_compatibility_assertion_3utQCGns0JPy_fkey" FOREIGN KEY ("target_group_id") REFERENCES "refill_compatibility_group"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_compatibility_assertion" ADD CONSTRAINT "refill_compatibility_assertion_wMIBpVrNvTnw_fkey" FOREIGN KEY ("target_refill_product_id") REFERENCES "product_detail_refill"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_compatibility_assertion_evidence" ADD CONSTRAINT "refill_compatibility_assertion_evidence_ruf7NHvUYMai_fkey" FOREIGN KEY ("assertion_id") REFERENCES "refill_compatibility_assertion"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "refill_compatibility_assertion_evidence" ADD CONSTRAINT "refill_compatibility_assertion_evidence_Aw7D91U283kE_fkey" FOREIGN KEY ("evidence_id") REFERENCES "refill_compatibility_evidence"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_compatibility_evidence" ADD CONSTRAINT "refill_compatibility_evidence_fa4Gw2fELNwd_fkey" FOREIGN KEY ("pen_product_id") REFERENCES "product_detail_pen"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_compatibility_evidence" ADD CONSTRAINT "refill_compatibility_evidence_LJdv80MGi5aX_fkey" FOREIGN KEY ("required_tip_product_id") REFERENCES "product_detail_pen_tip"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_compatibility_evidence" ADD CONSTRAINT "refill_compatibility_evidence_bzMxDUffo6vF_fkey" FOREIGN KEY ("refill_product_id") REFERENCES "product_detail_refill"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_compatibility_group" ADD CONSTRAINT "refill_compatibility_group_concept_fk" FOREIGN KEY ("concept_id","namespace") REFERENCES "catalog_terminology_concept"("id","namespace") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_compatibility_group_membership" ADD CONSTRAINT "refill_compatibility_group_membership_9D7Q6pDzNEXk_fkey" FOREIGN KEY ("group_id") REFERENCES "refill_compatibility_group"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_compatibility_group_membership" ADD CONSTRAINT "refill_compatibility_group_membership_CVmATEHViOvi_fkey" FOREIGN KEY ("refill_product_id") REFERENCES "product_detail_refill"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_compatibility_group_membership_evidence" ADD CONSTRAINT "fNpGFpeBOuPI_fkey" FOREIGN KEY ("membership_id") REFERENCES "refill_compatibility_group_membership"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "refill_compatibility_group_membership_evidence" ADD CONSTRAINT "OGvbjU1PCvGY_fkey" FOREIGN KEY ("evidence_id") REFERENCES "refill_compatibility_evidence"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_offering" ADD CONSTRAINT "refill_offering_refill_product_id_product_detail_refill_id_fkey" FOREIGN KEY ("refill_product_id") REFERENCES "product_detail_refill"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_offering" ADD CONSTRAINT "refill_offering_tip_style_id_refill_tip_style_id_fkey" FOREIGN KEY ("tip_style_id") REFERENCES "refill_tip_style"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_offering" ADD CONSTRAINT "refill_offering_ink_color_id_refill_ink_color_id_fkey" FOREIGN KEY ("ink_color_id") REFERENCES "refill_ink_color"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_offering_evidence" ADD CONSTRAINT "refill_offering_evidence_offering_id_refill_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "refill_offering"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "refill_offering_evidence" ADD CONSTRAINT "refill_offering_evidence_UeK6pvEaFsjd_fkey" FOREIGN KEY ("evidence_id") REFERENCES "catalog_source_evidence"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_offering_identifier" ADD CONSTRAINT "refill_offering_identifier_offering_id_refill_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "refill_offering"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_offering_identifier" ADD CONSTRAINT "refill_offering_identifier_maker_id_makers_id_fkey" FOREIGN KEY ("maker_id") REFERENCES "makers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_offering_identifier" ADD CONSTRAINT "refill_offering_identifier_market_id_catalog_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "catalog_market"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_offering_identifier" ADD CONSTRAINT "refill_offering_identifier_nBae8XrbOsMQ_fkey" FOREIGN KEY ("successor_id") REFERENCES "refill_offering_identifier"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_offering_identifier_evidence" ADD CONSTRAINT "refill_offering_identifier_evidence_hQ5hDf9jAfaz_fkey" FOREIGN KEY ("identifier_id") REFERENCES "refill_offering_identifier"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "refill_offering_identifier_evidence" ADD CONSTRAINT "refill_offering_identifier_evidence_izciafi4Dv1z_fkey" FOREIGN KEY ("evidence_id") REFERENCES "catalog_source_evidence"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_offering_market_status" ADD CONSTRAINT "refill_offering_market_status_MLYIaDqRh54g_fkey" FOREIGN KEY ("offering_id") REFERENCES "refill_offering"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_offering_market_status" ADD CONSTRAINT "refill_offering_market_status_market_id_catalog_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "catalog_market"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_offering_market_status" ADD CONSTRAINT "refill_offering_market_status_iEfnb1oZff5e_fkey" FOREIGN KEY ("successor_id") REFERENCES "refill_offering_market_status"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refill_offering_market_status_evidence" ADD CONSTRAINT "refill_offering_market_status_evidence_xGlvl7xMDfnC_fkey" FOREIGN KEY ("status_id") REFERENCES "refill_offering_market_status"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "refill_offering_market_status_evidence" ADD CONSTRAINT "refill_offering_market_status_evidence_hwm8RnRFwyUl_fkey" FOREIGN KEY ("evidence_id") REFERENCES "catalog_source_evidence"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "catalog_terminology_alias" ADD CONSTRAINT "catalog_terminology_alias_preferred_scope_valid" CHECK (not "is_preferred" or "maker_id" is not null);--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_serial_number_valid" CHECK ("serial_number" is null or char_length(trim("serial_number")) between 1 and 200);
--> statement-breakpoint
CREATE FUNCTION validate_pens_product_detail() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_id bigint := COALESCE(NEW.id, OLD.id);
  target_type text;
  part_count integer;
  concrete_count integer;
BEGIN
  SELECT pt.slug INTO target_type
  FROM product p JOIN product_types pt ON pt.id = p.product_type_id
  WHERE p.id = target_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT
    (SELECT count(*) FROM product_detail_pen_part WHERE id = target_id),
    (SELECT count(*) FROM product_detail_pen_clip WHERE id = target_id) +
    (SELECT count(*) FROM product_detail_pen_tip WHERE id = target_id) +
    (SELECT count(*) FROM product_detail_pen_top_cap WHERE id = target_id) +
    (SELECT count(*) FROM product_detail_pen_mechanism WHERE id = target_id) +
    (SELECT count(*) FROM product_detail_pen_actuator WHERE id = target_id)
  INTO part_count, concrete_count;

  IF target_type = 'pen' AND NOT EXISTS (SELECT 1 FROM product_detail_pen WHERE id = target_id) THEN
    RAISE EXCEPTION 'Pen product % requires product_detail_pen', target_id;
  ELSIF target_type = 'refill' AND NOT EXISTS (SELECT 1 FROM product_detail_refill WHERE id = target_id) THEN
    RAISE EXCEPTION 'Refill product % requires product_detail_refill', target_id;
  ELSIF target_type IN ('pen-clip', 'pen-tip', 'pen-top-cap', 'pen-mechanism', 'pen-actuator') THEN
    IF part_count <> 1 OR concrete_count <> 1 OR
      (target_type = 'pen-clip' AND NOT EXISTS (SELECT 1 FROM product_detail_pen_clip WHERE id = target_id)) OR
      (target_type = 'pen-tip' AND NOT EXISTS (SELECT 1 FROM product_detail_pen_tip WHERE id = target_id)) OR
      (target_type = 'pen-top-cap' AND NOT EXISTS (SELECT 1 FROM product_detail_pen_top_cap WHERE id = target_id)) OR
      (target_type = 'pen-mechanism' AND NOT EXISTS (SELECT 1 FROM product_detail_pen_mechanism WHERE id = target_id)) OR
      (target_type = 'pen-actuator' AND NOT EXISTS (SELECT 1 FROM product_detail_pen_actuator WHERE id = target_id)) THEN
      RAISE EXCEPTION 'Pen part product % has an invalid concrete subtype', target_id;
    END IF;
  END IF;

  IF target_type <> 'pen' AND EXISTS (SELECT 1 FROM product_detail_pen WHERE id = target_id) THEN
    RAISE EXCEPTION 'Product % has a mismatched Pen subtype', target_id;
  END IF;
  IF target_type <> 'refill' AND EXISTS (SELECT 1 FROM product_detail_refill WHERE id = target_id) THEN
    RAISE EXCEPTION 'Product % has a mismatched refill subtype', target_id;
  END IF;
  IF target_type NOT IN ('pen-clip', 'pen-tip', 'pen-top-cap', 'pen-mechanism', 'pen-actuator') AND part_count > 0 THEN
    RAISE EXCEPTION 'Product % has a mismatched Pen-part subtype', target_id;
  END IF;
  RETURN NULL;
END $$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER product_pens_detail_consistent
AFTER INSERT OR UPDATE OF product_type_id ON product
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pens_product_detail();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER product_detail_pen_consistent AFTER INSERT OR UPDATE OR DELETE ON product_detail_pen DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pens_product_detail();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER product_detail_pen_part_consistent AFTER INSERT OR UPDATE OR DELETE ON product_detail_pen_part DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pens_product_detail();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER product_detail_pen_clip_consistent AFTER INSERT OR UPDATE OR DELETE ON product_detail_pen_clip DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pens_product_detail();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER product_detail_pen_tip_consistent AFTER INSERT OR UPDATE OR DELETE ON product_detail_pen_tip DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pens_product_detail();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER product_detail_pen_top_cap_consistent AFTER INSERT OR UPDATE OR DELETE ON product_detail_pen_top_cap DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pens_product_detail();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER product_detail_pen_mechanism_consistent AFTER INSERT OR UPDATE OR DELETE ON product_detail_pen_mechanism DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pens_product_detail();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER product_detail_pen_actuator_consistent AFTER INSERT OR UPDATE OR DELETE ON product_detail_pen_actuator DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pens_product_detail();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER product_detail_refill_consistent AFTER INSERT OR UPDATE OR DELETE ON product_detail_refill DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pens_product_detail();--> statement-breakpoint

CREATE FUNCTION validate_pens_collection_detail() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_id bigint := COALESCE(NEW.id, OLD.id);
  detail_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM collection_item WHERE id = target_id) THEN RETURN NULL; END IF;
  SELECT
    (SELECT count(*) FROM collection_detail_pen WHERE id = target_id) +
    (SELECT count(*) FROM collection_detail_pen_clip WHERE id = target_id) +
    (SELECT count(*) FROM collection_detail_pen_tip WHERE id = target_id) +
    (SELECT count(*) FROM collection_detail_pen_top_cap WHERE id = target_id) +
    (SELECT count(*) FROM collection_detail_pen_mechanism WHERE id = target_id) +
    (SELECT count(*) FROM collection_detail_pen_actuator WHERE id = target_id)
  INTO detail_count;
  IF detail_count <> 1 THEN
    RAISE EXCEPTION 'Collection item % must have exactly one Pens detail', target_id;
  END IF;
  RETURN NULL;
END $$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER collection_detail_pen_consistent AFTER INSERT OR UPDATE OR DELETE ON collection_detail_pen DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pens_collection_detail();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER collection_detail_pen_clip_consistent AFTER INSERT OR UPDATE OR DELETE ON collection_detail_pen_clip DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pens_collection_detail();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER collection_detail_pen_tip_consistent AFTER INSERT OR UPDATE OR DELETE ON collection_detail_pen_tip DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pens_collection_detail();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER collection_detail_pen_top_cap_consistent AFTER INSERT OR UPDATE OR DELETE ON collection_detail_pen_top_cap DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pens_collection_detail();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER collection_detail_pen_mechanism_consistent AFTER INSERT OR UPDATE OR DELETE ON collection_detail_pen_mechanism DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pens_collection_detail();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER collection_detail_pen_actuator_consistent AFTER INSERT OR UPDATE OR DELETE ON collection_detail_pen_actuator DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pens_collection_detail();--> statement-breakpoint

CREATE FUNCTION validate_pen_nose_profile_carrier() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pen_nose_profile_assignment a
    JOIN product p ON p.id = a.product_id
    JOIN product_types pt ON pt.id = p.product_type_id
    WHERE pt.slug NOT IN ('pen', 'pen-tip')
  ) THEN
    RAISE EXCEPTION 'Pen nose profiles may be assigned only to Pens and Pen tips';
  END IF;
  RETURN NULL;
END $$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER pen_nose_profile_carrier_consistent AFTER INSERT OR UPDATE ON pen_nose_profile_assignment DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pen_nose_profile_carrier();--> statement-breakpoint

CREATE FUNCTION validate_catalog_terminology_aliases() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM catalog_terminology_alias a
    JOIN catalog_terminology_concept own ON own.id = a.concept_id
    JOIN catalog_terminology_concept other
      ON other.namespace = a.canonical_namespace
     AND other.id <> a.concept_id
     AND a.normalized_value IN (lower(trim(other.key)), other.normalized_canonical_label)
  ) OR EXISTS (
    SELECT 1
    FROM catalog_terminology_alias a
    JOIN catalog_terminology_concept own ON own.id = a.concept_id
    WHERE a.normalized_value IN (lower(trim(own.key)), own.normalized_canonical_label)
  ) THEN
    RAISE EXCEPTION 'Terminology alias collides with a canonical term';
  END IF;
  RETURN NULL;
END $$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER catalog_terminology_alias_collision_free AFTER INSERT OR UPDATE ON catalog_terminology_alias DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_catalog_terminology_aliases();--> statement-breakpoint
CREATE FUNCTION keep_catalog_concept_key_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.namespace <> OLD.namespace OR NEW.key <> OLD.key THEN
    RAISE EXCEPTION 'Catalog terminology namespace and key are immutable';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER catalog_terminology_concept_key_immutable BEFORE UPDATE ON catalog_terminology_concept FOR EACH ROW EXECUTE FUNCTION keep_catalog_concept_key_immutable();--> statement-breakpoint

CREATE FUNCTION validate_product_configuration() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM product_configuration_choice choice
    JOIN product_configuration_slot slot ON slot.id = choice.slot_id
    JOIN configuration_slot_kind kind ON kind.id = slot.slot_kind_id
    WHERE (kind.slug = 'material' AND choice.product_material_id IS NULL)
       OR (kind.slug = 'appearance' AND choice.finish_option_id IS NULL)
       OR (kind.slug IN ('tip', 'top-cap', 'clip', 'mechanism', 'actuator') AND (
         choice.part_product_id IS NULL OR NOT EXISTS (
           SELECT 1 FROM pen_part_role_assignment role
           JOIN catalog_terminology_concept concept ON concept.id = role.concept_id
           WHERE role.part_product_id = choice.part_product_id AND concept.key = kind.slug
         )
       ))
  ) THEN
    RAISE EXCEPTION 'Configuration choice carrier does not match its slot kind';
  END IF;
  IF EXISTS (
    SELECT 1 FROM product_configuration_slot slot
    WHERE slot.required AND NOT EXISTS (
      SELECT 1 FROM product_configuration_choice choice WHERE choice.slot_id = slot.id
    )
  ) THEN
    RAISE EXCEPTION 'Required configuration slot must contain a choice';
  END IF;
  RETURN NULL;
END $$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER product_configuration_slot_valid AFTER INSERT OR UPDATE OR DELETE ON product_configuration_slot DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_product_configuration();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER product_configuration_choice_valid AFTER INSERT OR UPDATE OR DELETE ON product_configuration_choice DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_product_configuration();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER pen_part_role_configuration_valid AFTER INSERT OR UPDATE OR DELETE ON pen_part_role_assignment DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_product_configuration();--> statement-breakpoint

CREATE FUNCTION validate_product_configuration_rules() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM product_configuration_choice_rule rule
    WHERE NOT EXISTS (
      SELECT 1 FROM product_configuration_choice_requirement requirement
      WHERE requirement.rule_id = rule.id
    )
  ) THEN
    RAISE EXCEPTION 'Configuration rules must have at least one requirement';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM product_configuration_choice_requirement requirement
    JOIN product_configuration_choice_rule rule ON rule.id = requirement.rule_id
    JOIN product_configuration_choice target ON target.id = rule.target_choice_id
    JOIN product_configuration_slot target_slot ON target_slot.id = target.slot_id
    JOIN product_configuration_choice required ON required.id = requirement.required_choice_id
    JOIN product_configuration_slot required_slot ON required_slot.id = required.slot_id
    WHERE required.id = target.id OR required_slot.position >= target_slot.position
  ) THEN
    RAISE EXCEPTION 'Configuration requirements must reference an earlier slot';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (
      SELECT rule.target_choice_id, array_agg(requirement.required_choice_id ORDER BY requirement.required_choice_id) signature
      FROM product_configuration_choice_rule rule
      JOIN product_configuration_choice_requirement requirement ON requirement.rule_id = rule.id
      GROUP BY rule.id, rule.target_choice_id
    ) signatures
    GROUP BY target_choice_id, signature
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Configuration rules may not repeat a requirement set';
  END IF;
  RETURN NULL;
END $$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER product_configuration_rule_valid AFTER INSERT OR UPDATE OR DELETE ON product_configuration_choice_rule DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_product_configuration_rules();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER product_configuration_requirement_valid AFTER INSERT OR UPDATE OR DELETE ON product_configuration_choice_requirement DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_product_configuration_rules();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER product_configuration_slot_order_valid AFTER UPDATE OF position ON product_configuration_slot DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_product_configuration_rules();--> statement-breakpoint

CREATE FUNCTION collection_catalog_product(target_id bigint) RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT product_id FROM (
    SELECT product_pen_id AS product_id FROM collection_detail_pen WHERE id = target_id
    UNION ALL SELECT product_pen_clip_id FROM collection_detail_pen_clip WHERE id = target_id
    UNION ALL SELECT product_pen_tip_id FROM collection_detail_pen_tip WHERE id = target_id
    UNION ALL SELECT product_pen_top_cap_id FROM collection_detail_pen_top_cap WHERE id = target_id
    UNION ALL SELECT product_pen_mechanism_id FROM collection_detail_pen_mechanism WHERE id = target_id
    UNION ALL SELECT product_pen_actuator_id FROM collection_detail_pen_actuator WHERE id = target_id
    UNION ALL SELECT product_spinner_id FROM collection_detail_spinner WHERE id = target_id
    UNION ALL SELECT product_spinner_button_id FROM collection_detail_spinner_button WHERE id = target_id
    UNION ALL SELECT product_slider_id FROM collection_detail_slider WHERE id = target_id
    UNION ALL SELECT product_slider_plate_id FROM collection_detail_slider_plate WHERE id = target_id
    UNION ALL SELECT product_slider_insert_id FROM collection_detail_slider_insert WHERE id = target_id
  ) mapped LIMIT 1
$$;--> statement-breakpoint
CREATE FUNCTION validate_collection_configuration_selections() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM collection_item_configuration_selection selection
    JOIN product_configuration_slot slot ON slot.id = selection.slot_id
    WHERE collection_catalog_product(selection.collection_item_id) IS DISTINCT FROM slot.product_id
  ) THEN
    RAISE EXCEPTION 'Owned configuration slot does not belong to the selected product';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM collection_item_configuration_selection selection
    JOIN product_configuration_choice choice ON choice.id = selection.choice_id
    JOIN collection_item parent ON parent.id = selection.collection_item_id
    JOIN collection_item installed ON installed.id = selection.installed_part_collection_item_id
    WHERE selection.installed_part_collection_item_id IS NOT NULL
      AND (choice.part_product_id IS NULL
        OR parent.owner_id <> installed.owner_id
        OR collection_catalog_product(installed.id) IS DISTINCT FROM choice.part_product_id)
  ) THEN
    RAISE EXCEPTION 'Installed Pen part must match the choice and owner';
  END IF;
  IF EXISTS (
    SELECT installed_part_collection_item_id
    FROM collection_item_configuration_selection
    WHERE installed_part_collection_item_id IS NOT NULL
    GROUP BY installed_part_collection_item_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'An owned Pen part may be installed only once';
  END IF;
  RETURN NULL;
END $$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER collection_configuration_selection_valid AFTER INSERT OR UPDATE OR DELETE ON collection_item_configuration_selection DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_collection_configuration_selections();--> statement-breakpoint

CREATE FUNCTION validate_catalog_market_containment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM catalog_market_containment edge
    JOIN catalog_market parent ON parent.id = edge.parent_market_id
    WHERE parent.kind = 'country'
  ) THEN
    RAISE EXCEPTION 'A country cannot contain another catalog market';
  END IF;
  IF EXISTS (
    WITH RECURSIVE reach(parent_id, child_id) AS (
      SELECT parent_market_id, child_market_id FROM catalog_market_containment
      UNION
      SELECT reach.parent_id, edge.child_market_id
      FROM reach JOIN catalog_market_containment edge ON edge.parent_market_id = reach.child_id
    ) SELECT 1 FROM reach WHERE parent_id = child_id
  ) THEN
    RAISE EXCEPTION 'Catalog market containment may not contain a cycle';
  END IF;
  RETURN NULL;
END $$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER catalog_market_containment_valid AFTER INSERT OR UPDATE OR DELETE ON catalog_market_containment DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_catalog_market_containment();--> statement-breakpoint

CREATE FUNCTION validate_refill_successors() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM refill_offering_market_status current
    JOIN refill_offering_market_status successor ON successor.id = current.successor_id
    WHERE successor.offering_id <> current.offering_id OR successor.market_id <> current.market_id
  ) THEN
    RAISE EXCEPTION 'Offering-status successor must preserve offering and market';
  END IF;
  IF EXISTS (
    SELECT 1 FROM refill_offering_identifier current
    JOIN refill_offering_identifier successor ON successor.id = current.successor_id
    WHERE successor.maker_id <> current.maker_id OR successor.kind <> current.kind OR successor.market_id <> current.market_id
  ) THEN
    RAISE EXCEPTION 'Offering-identifier successor must preserve maker, kind, and market';
  END IF;
  RETURN NULL;
END $$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER refill_offering_market_status_successor_scope AFTER INSERT OR UPDATE ON refill_offering_market_status DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_refill_successors();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER refill_offering_identifier_successor_scope AFTER INSERT OR UPDATE ON refill_offering_identifier DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_refill_successors();--> statement-breakpoint

CREATE FUNCTION validate_refill_supporting_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM refill_offering offering
    WHERE offering.approved_at IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM refill_offering_evidence link
      WHERE link.offering_id = offering.id AND link.stance = 'supports'
    )
  ) OR EXISTS (
    SELECT 1 FROM refill_offering_market_status status
    WHERE status.approved_at IS NOT NULL AND status.superseded_at IS NULL AND NOT EXISTS (
      SELECT 1 FROM refill_offering_market_status_evidence link
      WHERE link.status_id = status.id AND link.stance = 'supports'
    )
  ) OR EXISTS (
    SELECT 1 FROM refill_offering_identifier identifier
    WHERE identifier.approved_at IS NOT NULL AND identifier.superseded_at IS NULL AND NOT EXISTS (
      SELECT 1 FROM refill_offering_identifier_evidence link
      WHERE link.identifier_id = identifier.id AND link.stance = 'supports'
    )
  ) OR EXISTS (
    SELECT 1 FROM refill_compatibility_group_membership membership
    WHERE membership.approved_at IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM refill_compatibility_group_membership_evidence link
      WHERE link.membership_id = membership.id AND link.stance = 'supports'
    )
  ) OR EXISTS (
    SELECT 1 FROM refill_compatibility_assertion assertion
    WHERE assertion.approved_at IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM refill_compatibility_assertion_evidence link
      WHERE link.assertion_id = assertion.id AND link.stance = 'supports'
    )
  ) THEN
    RAISE EXCEPTION 'Approved refill claims require supporting evidence';
  END IF;
  RETURN NULL;
END $$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER refill_offering_supported AFTER INSERT OR UPDATE ON refill_offering DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_refill_supporting_evidence();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER refill_offering_evidence_supported AFTER INSERT OR UPDATE OR DELETE ON refill_offering_evidence DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_refill_supporting_evidence();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER refill_market_status_supported AFTER INSERT OR UPDATE ON refill_offering_market_status DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_refill_supporting_evidence();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER refill_market_status_evidence_supported AFTER INSERT OR UPDATE OR DELETE ON refill_offering_market_status_evidence DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_refill_supporting_evidence();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER refill_identifier_supported AFTER INSERT OR UPDATE ON refill_offering_identifier DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_refill_supporting_evidence();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER refill_identifier_evidence_supported AFTER INSERT OR UPDATE OR DELETE ON refill_offering_identifier_evidence DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_refill_supporting_evidence();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER refill_group_membership_supported AFTER INSERT OR UPDATE ON refill_compatibility_group_membership DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_refill_supporting_evidence();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER refill_group_membership_evidence_supported AFTER INSERT OR UPDATE OR DELETE ON refill_compatibility_group_membership_evidence DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_refill_supporting_evidence();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER refill_compatibility_assertion_supported AFTER INSERT OR UPDATE ON refill_compatibility_assertion DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_refill_supporting_evidence();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER refill_compatibility_assertion_evidence_supported AFTER INSERT OR UPDATE OR DELETE ON refill_compatibility_assertion_evidence DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_refill_supporting_evidence();--> statement-breakpoint

CREATE FUNCTION keep_catalog_source_evidence_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Catalog source evidence is append-only';
END $$;--> statement-breakpoint
CREATE TRIGGER catalog_source_evidence_append_only BEFORE UPDATE OR DELETE ON catalog_source_evidence FOR EACH ROW EXECUTE FUNCTION keep_catalog_source_evidence_append_only();
--> statement-breakpoint
CREATE FUNCTION validate_refill_market_conflicts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE reach(ancestor_id, descendant_id) AS (
      SELECT id, id FROM catalog_market
      UNION
      SELECT reach.ancestor_id, edge.child_market_id
      FROM reach JOIN catalog_market_containment edge ON edge.parent_market_id = reach.descendant_id
    )
    SELECT 1
    FROM refill_offering_market_status left_status
    JOIN refill_offering_market_status right_status
      ON right_status.offering_id = left_status.offering_id
     AND right_status.id > left_status.id
     AND right_status.superseded_at IS NULL
     AND left_status.superseded_at IS NULL
     AND right_status.lifecycle <> left_status.lifecycle
    WHERE EXISTS (
      SELECT 1 FROM reach left_reach
      JOIN reach right_reach ON right_reach.descendant_id = left_reach.descendant_id
      WHERE left_reach.ancestor_id = left_status.market_id
        AND right_reach.ancestor_id = right_status.market_id
    )
      AND NOT EXISTS (
        SELECT 1 FROM reach
        WHERE (ancestor_id = left_status.market_id AND descendant_id = right_status.market_id)
           OR (ancestor_id = right_status.market_id AND descendant_id = left_status.market_id)
      )
  ) THEN
    RAISE EXCEPTION 'Active offering statuses conflict at overlapping incomparable markets';
  END IF;

  IF EXISTS (
    WITH RECURSIVE reach(ancestor_id, descendant_id) AS (
      SELECT id, id FROM catalog_market
      UNION
      SELECT reach.ancestor_id, edge.child_market_id
      FROM reach JOIN catalog_market_containment edge ON edge.parent_market_id = reach.descendant_id
    )
    SELECT 1
    FROM refill_offering_identifier left_identifier
    JOIN refill_offering_identifier right_identifier
      ON right_identifier.id > left_identifier.id
     AND right_identifier.maker_id = left_identifier.maker_id
     AND right_identifier.kind = left_identifier.kind
     AND right_identifier.comparison_value = left_identifier.comparison_value
     AND right_identifier.offering_id <> left_identifier.offering_id
     AND right_identifier.superseded_at IS NULL
     AND left_identifier.superseded_at IS NULL
    WHERE EXISTS (
      SELECT 1 FROM reach left_reach
      JOIN reach right_reach ON right_reach.descendant_id = left_reach.descendant_id
      WHERE left_reach.ancestor_id = left_identifier.market_id
        AND right_reach.ancestor_id = right_identifier.market_id
    )
      AND NOT EXISTS (
        SELECT 1 FROM reach
        WHERE (ancestor_id = left_identifier.market_id AND descendant_id = right_identifier.market_id)
           OR (ancestor_id = right_identifier.market_id AND descendant_id = left_identifier.market_id)
      )
  ) THEN
    RAISE EXCEPTION 'Active refill identifiers conflict at overlapping incomparable markets';
  END IF;
  RETURN NULL;
END $$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER refill_market_status_conflict_free AFTER INSERT OR UPDATE OR DELETE ON refill_offering_market_status DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_refill_market_conflicts();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER refill_identifier_market_conflict_free AFTER INSERT OR UPDATE OR DELETE ON refill_offering_identifier DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_refill_market_conflicts();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER catalog_market_graph_conflict_free AFTER INSERT OR UPDATE OR DELETE ON catalog_market_containment DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_refill_market_conflicts();
--> statement-breakpoint
CREATE INDEX "product_maker_id_idx" ON "product" ("maker_id");--> statement-breakpoint
CREATE INDEX "collection_detail_pen_actuator_product_idx" ON "collection_detail_pen_actuator" ("product_pen_actuator_id");--> statement-breakpoint
CREATE INDEX "collection_detail_pen_clip_product_idx" ON "collection_detail_pen_clip" ("product_pen_clip_id");--> statement-breakpoint
CREATE INDEX "collection_detail_pen_mechanism_product_idx" ON "collection_detail_pen_mechanism" ("product_pen_mechanism_id");--> statement-breakpoint
CREATE INDEX "collection_detail_pen_tip_product_idx" ON "collection_detail_pen_tip" ("product_pen_tip_id");--> statement-breakpoint
CREATE INDEX "collection_detail_pen_top_cap_product_idx" ON "collection_detail_pen_top_cap" ("product_pen_top_cap_id");--> statement-breakpoint
CREATE INDEX "refill_compatibility_assertion_required_tip_idx" ON "refill_compatibility_assertion" ("required_tip_product_id");--> statement-breakpoint
CREATE INDEX "refill_compatibility_assertion_target_group_idx" ON "refill_compatibility_assertion" ("target_group_id");--> statement-breakpoint
CREATE INDEX "refill_compatibility_assertion_target_refill_idx" ON "refill_compatibility_assertion" ("target_refill_product_id");--> statement-breakpoint
CREATE INDEX "refill_offering_identifier_successor_idx" ON "refill_offering_identifier" ("successor_id");--> statement-breakpoint
CREATE INDEX "refill_offering_market_status_successor_idx" ON "refill_offering_market_status" ("successor_id");
