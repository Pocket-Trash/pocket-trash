CREATE FUNCTION validate_pen_actuation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pen_actuator_mechanism link
    WHERE NOT EXISTS (
      SELECT 1 FROM product_detail_pen_actuator intrinsic WHERE intrinsic.id = link.actuator_product_id
    ) AND NOT EXISTS (
      SELECT 1 FROM pen_part_role_assignment role
      JOIN catalog_terminology_concept concept ON concept.id = role.concept_id
      WHERE role.part_product_id = link.actuator_product_id
        AND concept.namespace = 'pen-part-role' AND concept.key = 'actuator'
    )
  ) THEN
    RAISE EXCEPTION 'Actuating parts must retain their Actuator role while mechanism associations exist';
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER pen_actuation_endpoints_valid
AFTER INSERT OR UPDATE OR DELETE ON pen_actuator_mechanism
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pen_actuation();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER pen_actuation_roles_retained
AFTER INSERT OR UPDATE OR DELETE ON pen_part_role_assignment
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pen_actuation();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER pen_actuation_primary_retained
AFTER UPDATE OR DELETE ON product_detail_pen_actuator
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pen_actuation();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER pen_actuation_concepts_retained
AFTER UPDATE OR DELETE ON catalog_terminology_concept
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_pen_actuation();
