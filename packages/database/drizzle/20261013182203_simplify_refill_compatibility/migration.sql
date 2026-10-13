-- Compatibility is now a direct positive catalog fact. Remove the evidence
-- enforcement layer before new writes omit evidence and approval metadata.
DROP TRIGGER IF EXISTS refill_offering_supported ON refill_offering;
--> statement-breakpoint
DROP TRIGGER IF EXISTS refill_offering_evidence_supported ON refill_offering_evidence;
--> statement-breakpoint
DROP TRIGGER IF EXISTS refill_market_status_supported ON refill_offering_market_status;
--> statement-breakpoint
DROP TRIGGER IF EXISTS refill_market_status_evidence_supported ON refill_offering_market_status_evidence;
--> statement-breakpoint
DROP TRIGGER IF EXISTS refill_identifier_supported ON refill_offering_identifier;
--> statement-breakpoint
DROP TRIGGER IF EXISTS refill_identifier_evidence_supported ON refill_offering_identifier_evidence;
--> statement-breakpoint
DROP TRIGGER IF EXISTS refill_group_membership_supported ON refill_compatibility_group_membership;
--> statement-breakpoint
DROP TRIGGER IF EXISTS refill_group_membership_evidence_supported ON refill_compatibility_group_membership_evidence;
--> statement-breakpoint
DROP TRIGGER IF EXISTS refill_compatibility_assertion_supported ON refill_compatibility_assertion;
--> statement-breakpoint
DROP TRIGGER IF EXISTS refill_compatibility_assertion_evidence_supported ON refill_compatibility_assertion_evidence;
--> statement-breakpoint
DROP FUNCTION IF EXISTS validate_refill_supporting_evidence();
--> statement-breakpoint
ALTER TABLE refill_compatibility_assertion
ALTER COLUMN outcome SET DEFAULT 'compatible';
--> statement-breakpoint
-- Negative and indeterminate assertions become absence: unknown compatibility.
DELETE FROM refill_compatibility_assertion
WHERE outcome IN ('incompatible', 'variable');
--> statement-breakpoint
-- Compatible and conditional assertions are both positive compatibility facts.
-- Any required tip remains as the scope of the direct relationship.
UPDATE refill_compatibility_assertion
SET
  outcome = 'compatible',
  explanation = NULL,
  remedy = NULL,
  warning = NULL,
  approved_at = NULL,
  updated_at = now()
WHERE
  outcome = 'conditional'
  OR explanation IS NOT NULL
  OR remedy IS NOT NULL
  OR warning IS NOT NULL
  OR approved_at IS NOT NULL;
