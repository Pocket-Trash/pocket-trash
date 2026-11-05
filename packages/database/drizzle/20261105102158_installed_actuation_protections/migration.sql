CREATE FUNCTION validate_installed_pen_actuation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM collection_item_installed_pen_part installed
    WHERE installed.actuated_mechanism_collection_item_id IS NOT NULL
      AND (
        NOT EXISTS (
          SELECT 1 FROM product_detail_pen_mechanism mechanism
          WHERE mechanism.id = collection_catalog_product(installed.actuated_mechanism_collection_item_id)
        )
        OR NOT (
          EXISTS (
            SELECT 1 FROM product_detail_pen_actuator intrinsic
            WHERE intrinsic.id = collection_catalog_product(installed.part_collection_item_id)
          )
          OR EXISTS (
            SELECT 1 FROM pen_part_role_assignment role
            JOIN catalog_terminology_concept concept ON concept.id = role.concept_id
            WHERE role.part_product_id = collection_catalog_product(installed.part_collection_item_id)
              AND concept.namespace = 'pen-part-role' AND concept.key = 'actuator'
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Installed actuation must connect an Actuator-role part to a physical mechanism on the same Pen';
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER installed_pen_actuation_valid
AFTER INSERT OR UPDATE OR DELETE ON collection_item_installed_pen_part
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_installed_pen_actuation();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER installed_pen_actuation_roles_retained
AFTER INSERT OR UPDATE OR DELETE ON pen_part_role_assignment
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_installed_pen_actuation();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER installed_pen_actuation_primary_retained
AFTER UPDATE OR DELETE ON product_detail_pen_actuator
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_installed_pen_actuation();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER installed_pen_actuation_mechanism_retained
AFTER UPDATE OR DELETE ON product_detail_pen_mechanism
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_installed_pen_actuation();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER installed_pen_actuation_concepts_retained
AFTER UPDATE OR DELETE ON catalog_terminology_concept
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_installed_pen_actuation();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER installed_pen_actuation_clip_snapshot_retained
AFTER UPDATE OR DELETE ON collection_detail_pen_clip
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_installed_pen_actuation();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER installed_pen_actuation_tip_snapshot_retained
AFTER UPDATE OR DELETE ON collection_detail_pen_tip
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_installed_pen_actuation();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER installed_pen_actuation_top_cap_snapshot_retained
AFTER UPDATE OR DELETE ON collection_detail_pen_top_cap
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_installed_pen_actuation();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER installed_pen_actuation_mechanism_snapshot_retained
AFTER UPDATE OR DELETE ON collection_detail_pen_mechanism
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_installed_pen_actuation();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER installed_pen_actuation_actuator_snapshot_retained
AFTER UPDATE OR DELETE ON collection_detail_pen_actuator
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_installed_pen_actuation();
