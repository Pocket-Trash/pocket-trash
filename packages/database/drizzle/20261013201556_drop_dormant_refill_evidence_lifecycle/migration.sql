ALTER TABLE "catalog_market_containment" DROP CONSTRAINT "catalog_market_containment_Dw9PSoxWY7Xm_fkey";--> statement-breakpoint
ALTER TABLE "catalog_market_containment" DROP CONSTRAINT "catalog_market_containment_TKnmrKwRESdg_fkey";--> statement-breakpoint
ALTER TABLE "catalog_source_evidence" DROP CONSTRAINT "catalog_source_evidence_market_id_catalog_market_id_fkey";--> statement-breakpoint
ALTER TABLE "refill_compatibility_assertion_evidence" DROP CONSTRAINT "refill_compatibility_assertion_evidence_Aw7D91U283kE_fkey";--> statement-breakpoint
ALTER TABLE "refill_compatibility_group_membership_evidence" DROP CONSTRAINT "OGvbjU1PCvGY_fkey";--> statement-breakpoint
ALTER TABLE "refill_offering_evidence" DROP CONSTRAINT "refill_offering_evidence_UeK6pvEaFsjd_fkey";--> statement-breakpoint
ALTER TABLE "refill_offering_identifier" DROP CONSTRAINT "refill_offering_identifier_market_id_catalog_market_id_fkey";--> statement-breakpoint
ALTER TABLE "refill_offering_identifier" DROP CONSTRAINT "refill_offering_identifier_nBae8XrbOsMQ_fkey";--> statement-breakpoint
ALTER TABLE "refill_offering_identifier_evidence" DROP CONSTRAINT "refill_offering_identifier_evidence_izciafi4Dv1z_fkey";--> statement-breakpoint
ALTER TABLE "refill_offering_market_status" DROP CONSTRAINT "refill_offering_market_status_market_id_catalog_market_id_fkey";--> statement-breakpoint
ALTER TABLE "refill_offering_market_status_evidence" DROP CONSTRAINT "refill_offering_market_status_evidence_xGlvl7xMDfnC_fkey";--> statement-breakpoint
ALTER TABLE "refill_offering_market_status_evidence" DROP CONSTRAINT "refill_offering_market_status_evidence_hwm8RnRFwyUl_fkey";--> statement-breakpoint
-- ENG-459 is deployed and all compatibility writes now use direct positive
-- relationships. Remove the remaining lifecycle trigger hooks before their
-- backing tables and columns disappear.
DROP TRIGGER IF EXISTS refill_offering_identifier_successor_scope ON refill_offering_identifier;--> statement-breakpoint
DROP TRIGGER IF EXISTS refill_identifier_market_conflict_free ON refill_offering_identifier;--> statement-breakpoint
DROP TABLE "catalog_market";--> statement-breakpoint
DROP TABLE "catalog_market_containment";--> statement-breakpoint
DROP TABLE "catalog_source_evidence";--> statement-breakpoint
DROP TABLE "refill_compatibility_assertion_evidence";--> statement-breakpoint
DROP TABLE "refill_compatibility_evidence";--> statement-breakpoint
DROP TABLE "refill_compatibility_group_membership_evidence";--> statement-breakpoint
DROP TABLE "refill_offering_evidence";--> statement-breakpoint
DROP TABLE "refill_offering_identifier_evidence";--> statement-breakpoint
DROP TABLE "refill_offering_market_status";--> statement-breakpoint
DROP TABLE "refill_offering_market_status_evidence";--> statement-breakpoint
ALTER TABLE "refill_offering_identifier" DROP CONSTRAINT "refill_offering_identifier_id_scope_unique";--> statement-breakpoint
ALTER TABLE "refill_compatibility_assertion" DROP CONSTRAINT "refill_compatibility_assertion_outcome_valid";--> statement-breakpoint
ALTER TABLE "refill_compatibility_assertion" DROP CONSTRAINT "refill_compatibility_assertion_explanation_required";--> statement-breakpoint
ALTER TABLE "refill_compatibility_assertion" DROP CONSTRAINT "refill_compatibility_assertion_remedy_required";--> statement-breakpoint
ALTER TABLE "refill_compatibility_assertion" DROP CONSTRAINT "refill_compatibility_assertion_text_valid";--> statement-breakpoint
ALTER TABLE "refill_offering_identifier" DROP CONSTRAINT "refill_offering_identifier_successor_valid";--> statement-breakpoint
DROP INDEX "refill_offering_identifier_active_unique";--> statement-breakpoint
DROP INDEX "refill_offering_identifier_successor_idx";--> statement-breakpoint
DROP INDEX "refill_offering_identifier_market_value_idx";--> statement-breakpoint
ALTER TABLE "refill_compatibility_assertion" DROP COLUMN "outcome";--> statement-breakpoint
ALTER TABLE "refill_compatibility_assertion" DROP COLUMN "explanation";--> statement-breakpoint
ALTER TABLE "refill_compatibility_assertion" DROP COLUMN "remedy";--> statement-breakpoint
ALTER TABLE "refill_compatibility_assertion" DROP COLUMN "warning";--> statement-breakpoint
ALTER TABLE "refill_compatibility_assertion" DROP COLUMN "approved_at";--> statement-breakpoint
ALTER TABLE "refill_compatibility_group_membership" DROP COLUMN "approved_at";--> statement-breakpoint
ALTER TABLE "refill_offering" DROP COLUMN "approved_at";--> statement-breakpoint
ALTER TABLE "refill_offering_identifier" DROP COLUMN "market_id";--> statement-breakpoint
ALTER TABLE "refill_offering_identifier" DROP COLUMN "effective_date";--> statement-breakpoint
ALTER TABLE "refill_offering_identifier" DROP COLUMN "approved_at";--> statement-breakpoint
ALTER TABLE "refill_offering_identifier" DROP COLUMN "superseded_at";--> statement-breakpoint
ALTER TABLE "refill_offering_identifier" DROP COLUMN "successor_id";--> statement-breakpoint
ALTER TABLE "refill_offering_identifier" ADD CONSTRAINT "refill_offering_identifier_value_unique" UNIQUE("maker_id","kind","comparison_value");--> statement-breakpoint
DROP FUNCTION IF EXISTS validate_catalog_market_containment();--> statement-breakpoint
DROP FUNCTION IF EXISTS keep_catalog_source_evidence_append_only();--> statement-breakpoint
DROP FUNCTION IF EXISTS validate_refill_successors();--> statement-breakpoint
DROP FUNCTION IF EXISTS validate_refill_market_conflicts();
