INSERT INTO catalog_terminology_concept (namespace, key, canonical_label_key, canonical_label_fallback, normalized_canonical_label)
SELECT 'product-type', slug, 'catalog.productTypes.' || slug, name, lower(trim(name)) FROM product_types
WHERE slug IN ('fountain-pen', 'nib') ON CONFLICT (namespace, key) DO NOTHING;

--> statement-breakpoint
CREATE OR REPLACE VIEW collection_item_search_products AS
SELECT id AS collection_item_id, product_pen_id AS product_id FROM collection_detail_pen
UNION ALL SELECT id, product_pen_clip_id FROM collection_detail_pen_clip
UNION ALL SELECT id, product_pen_tip_id FROM collection_detail_pen_tip
UNION ALL SELECT id, product_pen_top_cap_id FROM collection_detail_pen_top_cap
UNION ALL SELECT id, product_pen_mechanism_id FROM collection_detail_pen_mechanism
UNION ALL SELECT id, product_pen_actuator_id FROM collection_detail_pen_actuator
UNION ALL SELECT id, product_spinner_button_id FROM collection_detail_spinner_button
UNION ALL SELECT id, product_spinner_id FROM collection_detail_spinner
UNION ALL SELECT id, product_slider_plate_id FROM collection_detail_slider_plate
UNION ALL SELECT id, product_slider_insert_id FROM collection_detail_slider_insert
UNION ALL SELECT id, product_slider_id FROM collection_detail_slider
UNION ALL SELECT id, product_fountain_pen_id FROM collection_detail_fountain_pen
UNION ALL SELECT id, product_nib_id FROM collection_detail_nib;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION collection_catalog_product(target_id bigint) RETURNS bigint LANGUAGE sql STABLE AS $$
 SELECT product_id FROM collection_item_search_products WHERE collection_item_id = target_id LIMIT 1
$$;
--> statement-breakpoint
CREATE FUNCTION fountain_pen_nib_publicly_available(target_id bigint) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT NOT EXISTS (
   SELECT 1 FROM collection_detail_fountain_pen pen
   LEFT JOIN collection_detail_nib nib ON nib.id = pen.installed_nib_collection_item_id
   LEFT JOIN collection_item item ON item.id = nib.id
   LEFT JOIN users owner ON owner.id = item.owner_id
   LEFT JOIN product model ON model.id = nib.product_nib_id
   WHERE pen.id = target_id AND pen.nib_mode = 'owned' AND (
     item.id IS NULL OR item.approval_status <> 'approved' OR NOT item.owned OR item.sold_at IS NOT NULL
     OR model.approval_status <> 'approved' OR model.is_private
     OR (item.is_private AND item.privated_by_clerk_id IS NOT NULL AND item.privated_by_clerk_id <> owner.clerk_id)
   )
 ) AND NOT EXISTS (
   SELECT 1 FROM collection_detail_fountain_pen pen
   JOIN product_detail_fountain_pen model ON model.id = pen.product_fountain_pen_id
   LEFT JOIN fountain_pen_section_option section ON section.id = pen.section_option_id
   LEFT JOIN product nib_model ON nib_model.id = CASE WHEN section.id IS NOT NULL THEN section.default_nib_product_id WHEN NOT EXISTS (SELECT 1 FROM fountain_pen_section_option available WHERE available.pen_product_id = model.id) THEN model.default_nib_product_id ELSE NULL END
   WHERE pen.id = target_id AND pen.nib_mode = 'default'
     AND (nib_model.id IS NULL OR nib_model.approval_status <> 'approved' OR nib_model.is_private)
 )
$$;
--> statement-breakpoint
CREATE FUNCTION validate_fountain_product_detail() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id bigint; target_type text; found_count integer;
BEGIN
 FOREACH target_id IN ARRAY ARRAY[NEW.id, OLD.id] LOOP
 SELECT pt.slug INTO target_type FROM product p JOIN product_types pt ON pt.id = p.product_type_id WHERE p.id = target_id;
 IF target_type IS NULL THEN CONTINUE; END IF;
 IF target_type NOT IN ('fountain-pen', 'nib') AND NOT EXISTS (SELECT 1 FROM product_detail_fountain_pen WHERE id = target_id) AND NOT EXISTS (SELECT 1 FROM product_detail_nib WHERE id = target_id) THEN CONTINUE; END IF;
 SELECT count(*) INTO found_count FROM (
   SELECT id FROM product_detail_fountain_pen WHERE id = target_id
   UNION ALL SELECT id FROM product_detail_nib WHERE id = target_id
   UNION ALL SELECT id FROM product_detail_pen WHERE id = target_id
   UNION ALL SELECT id FROM product_detail_pen_actuator WHERE id = target_id
   UNION ALL SELECT id FROM product_detail_pen_clip WHERE id = target_id
   UNION ALL SELECT id FROM product_detail_pen_mechanism WHERE id = target_id
   UNION ALL SELECT id FROM product_detail_pen_tip WHERE id = target_id
   UNION ALL SELECT id FROM product_detail_pen_top_cap WHERE id = target_id
   UNION ALL SELECT id FROM product_detail_refill WHERE id = target_id
   UNION ALL SELECT id FROM product_detail_spinner WHERE id = target_id
   UNION ALL SELECT id FROM product_detail_spinner_button WHERE id = target_id
   UNION ALL SELECT id FROM product_detail_slider WHERE id = target_id
   UNION ALL SELECT id FROM product_detail_slider_insert WHERE id = target_id
   UNION ALL SELECT id FROM product_detail_slider_plate WHERE id = target_id
 ) concrete;
 IF found_count <> 1 OR (target_type = 'fountain-pen' AND NOT EXISTS (SELECT 1 FROM product_detail_fountain_pen WHERE id = target_id)) OR (target_type = 'nib' AND NOT EXISTS (SELECT 1 FROM product_detail_nib WHERE id = target_id)) OR (target_type NOT IN ('fountain-pen', 'nib')) THEN RAISE EXCEPTION 'Product % requires exactly its fountain-pen or nib subtype', target_id; END IF;
 END LOOP;
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE FUNCTION validate_fountain_collection_detail() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id bigint; found_count integer; target_type text;
BEGIN
 FOREACH target_id IN ARRAY ARRAY[NEW.id, OLD.id] LOOP
 IF NOT EXISTS (SELECT 1 FROM collection_item WHERE id = target_id) THEN CONTINUE; END IF;
 IF NOT EXISTS (SELECT 1 FROM collection_detail_fountain_pen WHERE id = target_id) AND NOT EXISTS (SELECT 1 FROM collection_detail_nib WHERE id = target_id) THEN
   IF TG_TABLE_NAME IN ('collection_detail_fountain_pen', 'collection_detail_nib') THEN RAISE EXCEPTION 'Fountain-pen collection item requires its subtype'; END IF;
   CONTINUE;
 END IF;
 SELECT count(*) INTO found_count FROM collection_item_search_products WHERE collection_item_id = target_id;
 SELECT pt.slug INTO target_type FROM product p JOIN product_types pt ON pt.id = p.product_type_id WHERE p.id = collection_catalog_product(target_id);
 IF found_count <> 1 OR (EXISTS (SELECT 1 FROM collection_detail_fountain_pen WHERE id = target_id) AND target_type <> 'fountain-pen') OR (EXISTS (SELECT 1 FROM collection_detail_nib WHERE id = target_id) AND target_type <> 'nib') THEN RAISE EXCEPTION 'Collection item requires exactly its fountain-pen or nib subtype'; END IF;
 END LOOP;
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE FUNCTION validate_fountain_pen_facts() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id bigint; candidate_ids bigint[];
BEGIN
 IF TG_TABLE_NAME = 'fountain_pen_filling_mechanism_assignment' THEN
   candidate_ids := ARRAY[NEW.pen_product_id, OLD.pen_product_id];
 ELSIF TG_TABLE_NAME = 'fountain_pen_filling_mechanism' THEN
   SELECT array_agg(pen_product_id) INTO candidate_ids FROM fountain_pen_filling_mechanism_assignment WHERE mechanism_id IN (NEW.id, OLD.id);
 ELSE
   candidate_ids := ARRAY[NEW.id, OLD.id];
 END IF;
 FOREACH target_id IN ARRAY coalesce(candidate_ids, ARRAY[]::bigint[]) LOOP
 IF EXISTS (SELECT 1 FROM product_detail_fountain_pen p WHERE p.id = target_id AND (p.connector_family_id IS NOT NULL OR p.cartridge_converter_length IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM fountain_pen_filling_mechanism_assignment a JOIN fountain_pen_filling_mechanism m ON m.id = a.mechanism_id WHERE a.pen_product_id = p.id AND m.slug = 'cartridge-converter')) THEN RAISE EXCEPTION 'Connector and length require Cartridge/converter'; END IF;
 END LOOP;
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE FUNCTION validate_nib_material_selection() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE candidate_ids bigint[]; target_id bigint; material_count integer; component_count integer;
BEGIN
 IF TG_TABLE_NAME = 'product_detail_nib' THEN candidate_ids := ARRAY[NEW.id, OLD.id];
 ELSIF TG_TABLE_NAME = 'product_material' THEN candidate_ids := ARRAY[NEW.product_id, OLD.product_id];
 ELSIF TG_TABLE_NAME = 'product_material_component' THEN
   SELECT array_agg(product_id) INTO candidate_ids FROM product_material WHERE id IN (NEW.product_material_id, OLD.product_material_id);
 ELSIF TG_TABLE_NAME = 'collection_detail_nib' THEN candidate_ids := ARRAY[NEW.product_nib_id, OLD.product_nib_id];
 ELSE
   SELECT array_agg(product_nib_id) INTO candidate_ids FROM collection_detail_nib WHERE id IN (NEW.collection_item_id, OLD.collection_item_id);
 END IF;
 FOREACH target_id IN ARRAY coalesce(candidate_ids, ARRAY[]::bigint[]) LOOP
   IF target_id IS NULL OR NOT EXISTS (SELECT 1 FROM product_detail_nib WHERE id = target_id) THEN CONTINUE; END IF;
   SELECT count(*) INTO material_count FROM product_material WHERE product_id = target_id;
   SELECT count(*) INTO component_count FROM product_material_component c JOIN product_material m ON m.id = c.product_material_id WHERE m.product_id = target_id;
   IF material_count <> 1 OR component_count <> 1 THEN RAISE EXCEPTION 'Nib model requires one fixed base material'; END IF;
   IF EXISTS (
     SELECT 1 FROM collection_detail_nib n WHERE n.product_nib_id = target_id AND (
       (SELECT count(*) FROM collection_item_material WHERE collection_item_id = n.id) <> 1
       OR NOT EXISTS (SELECT 1 FROM collection_item_material actual
         JOIN product_material m ON m.product_id = target_id
         JOIN product_material_component expected ON expected.product_material_id = m.id
         WHERE actual.collection_item_id = n.id AND actual.material_id = expected.material_id
           AND actual.material_specific_id IS NOT DISTINCT FROM expected.material_specific_id)
     )
   ) THEN RAISE EXCEPTION 'Owned nib base material must match its material-specific model'; END IF;
 END LOOP;
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE FUNCTION validate_fountain_concepts() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id bigint := coalesce(NEW.id, OLD.id);
BEGIN
 IF EXISTS (
   SELECT 1 FROM product_detail_fountain_pen p
   CROSS JOIN LATERAL (VALUES
     (p.nib_construction_id, 'fountain-pen-nib-construction'),
     (p.body_silhouette_id, 'fountain-pen-body-silhouette'),
     (p.cross_section_id, 'fountain-pen-cross-section'),
     (p.form_factor_id, 'fountain-pen-form-factor'),
     (p.cap_closure_id, 'fountain-pen-cap-closure'),
     (p.nib_deployment_id, 'fountain-pen-nib-deployment')
   ) selected(concept_id, expected_namespace)
   JOIN catalog_terminology_concept c ON c.id = selected.concept_id
   WHERE (p.id = target_id OR (TG_TABLE_NAME = 'catalog_terminology_concept' AND c.id = target_id))
     AND c.namespace <> selected.expected_namespace
 ) OR EXISTS (SELECT 1 FROM product_detail_nib n JOIN catalog_terminology_concept c ON c.id = n.size_family_id
   WHERE (n.id = target_id OR (TG_TABLE_NAME = 'catalog_terminology_concept' AND c.id = target_id)) AND c.namespace <> 'nib-size-family'
 ) THEN RAISE EXCEPTION 'Fountain-pen classification must use its registered namespace'; END IF;
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE FUNCTION validate_fountain_pen_installations() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (
   SELECT 1 FROM collection_detail_fountain_pen pen
   JOIN collection_item pen_item ON pen_item.id = pen.id
   JOIN product_detail_fountain_pen model ON model.id = pen.product_fountain_pen_id
   LEFT JOIN fountain_pen_section_option section ON section.id = pen.section_option_id
   LEFT JOIN fountain_pen_finial_option finial ON finial.id = pen.finial_option_id
   LEFT JOIN collection_detail_nib nib ON nib.id = pen.installed_nib_collection_item_id
   LEFT JOIN collection_item nib_item ON nib_item.id = nib.id
   WHERE (pen.section_option_id IS NOT NULL AND section.pen_product_id IS DISTINCT FROM model.id)
      OR (pen.finial_option_id IS NOT NULL AND finial.pen_product_id IS DISTINCT FROM model.id)
      OR (pen.nib_mode = 'default' AND (
        CASE WHEN section.id IS NOT NULL THEN section.default_nib_product_id WHEN NOT EXISTS (SELECT 1 FROM fountain_pen_section_option available WHERE available.pen_product_id = model.id) THEN model.default_nib_product_id ELSE NULL END IS NULL
        OR (pen.default_nib_width_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM nib_width_offering w WHERE w.width_id = pen.default_nib_width_id
          AND w.nib_product_id = CASE WHEN section.id IS NOT NULL THEN section.default_nib_product_id WHEN NOT EXISTS (SELECT 1 FROM fountain_pen_section_option available WHERE available.pen_product_id = model.id) THEN model.default_nib_product_id ELSE NULL END
        ))
      ))
      OR (pen.nib_mode = 'owned' AND (
        nib_item.owner_id IS DISTINCT FROM pen_item.owner_id OR nib_item.collection_id IS DISTINCT FROM pen_item.collection_id
        OR NOT nib_item.owned OR nib_item.sold_at IS NOT NULL OR NOT pen_item.owned OR pen_item.sold_at IS NOT NULL
        OR (NOT pen.customized_nib AND (
          model.owner_replaceable_nib = false OR NOT (
            coalesce(nib.product_nib_id = CASE WHEN section.id IS NOT NULL THEN section.default_nib_product_id WHEN NOT EXISTS (SELECT 1 FROM fountain_pen_section_option available WHERE available.pen_product_id = model.id) THEN model.default_nib_product_id ELSE NULL END, false)
            OR EXISTS (SELECT 1 FROM nib_mount_compatibility m WHERE m.nib_product_id = nib.product_nib_id AND m.mount_id = section.mount_id)
            OR EXISTS (SELECT 1 FROM fountain_pen_section_compatible_nib fit WHERE fit.section_option_id = section.id AND fit.nib_product_id = nib.product_nib_id)
            OR (section.id IS NULL AND NOT EXISTS (SELECT 1 FROM fountain_pen_section_option available WHERE available.pen_product_id = model.id) AND EXISTS (SELECT 1 FROM fountain_pen_compatible_nib fit WHERE fit.pen_product_id = model.id AND fit.nib_product_id = nib.product_nib_id))
          )
        ))
      ))
 ) THEN RAISE EXCEPTION 'Installed nib requires same current owner, collection, and compatible mount or confirmed customization'; END IF;
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE FUNCTION detach_deleted_nib() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE collection_detail_fountain_pen SET nib_mode = 'none', installed_nib_collection_item_id = NULL, default_nib_width_id = NULL, customized_nib = false, updated_at = now() WHERE installed_nib_collection_item_id = OLD.id;
 RETURN OLD;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_subtype_product_valid AFTER INSERT OR UPDATE OR DELETE ON product DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_product_detail();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_subtype_product_detail_fountain_pen_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_fountain_pen DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_product_detail();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_subtype_product_detail_nib_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_nib DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_product_detail();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_subtype_product_detail_pen_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_pen DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_product_detail();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_subtype_product_detail_pen_part_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_pen_part DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_product_detail();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_subtype_product_detail_refill_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_refill DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_product_detail();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_subtype_product_detail_spinner_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_spinner DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_product_detail();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_subtype_product_detail_spinner_button_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_spinner_button DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_product_detail();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_subtype_product_detail_slider_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_slider DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_product_detail();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_subtype_product_detail_slider_insert_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_slider_insert DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_product_detail();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_subtype_product_detail_slider_plate_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_slider_plate DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_product_detail();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_collection_collection_item_valid AFTER INSERT OR UPDATE OR DELETE ON collection_item DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_collection_detail();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_collection_collection_detail_fountain_pen_valid AFTER INSERT OR UPDATE OR DELETE ON collection_detail_fountain_pen DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_collection_detail();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_collection_collection_detail_nib_valid AFTER INSERT OR UPDATE OR DELETE ON collection_detail_nib DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_collection_detail();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_cc_product_detail_fountain_pen_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_fountain_pen DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_pen_facts();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_cc_fountain_pen_filling_mechanism_assignment_valid AFTER INSERT OR UPDATE OR DELETE ON fountain_pen_filling_mechanism_assignment DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_pen_facts();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_installation_collection_item_valid AFTER INSERT OR UPDATE OR DELETE ON collection_item DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_pen_installations();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_installation_collection_detail_fountain_pen_valid AFTER INSERT OR UPDATE OR DELETE ON collection_detail_fountain_pen DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_pen_installations();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_installation_collection_detail_nib_valid AFTER INSERT OR UPDATE OR DELETE ON collection_detail_nib DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_pen_installations();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_installation_product_detail_fountain_pen_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_fountain_pen DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_pen_installations();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_installation_fountain_pen_section_option_valid AFTER INSERT OR UPDATE OR DELETE ON fountain_pen_section_option DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_pen_installations();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_installation_fountain_pen_finial_option_valid AFTER INSERT OR UPDATE OR DELETE ON fountain_pen_finial_option DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_pen_installations();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_installation_fountain_pen_section_compatible_nib_valid AFTER INSERT OR UPDATE OR DELETE ON fountain_pen_section_compatible_nib DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_pen_installations();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_installation_fountain_pen_compatible_nib_valid AFTER INSERT OR UPDATE OR DELETE ON fountain_pen_compatible_nib DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_pen_installations();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_installation_nib_mount_compatibility_valid AFTER INSERT OR UPDATE OR DELETE ON nib_mount_compatibility DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_pen_installations();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_installation_nib_width_offering_valid AFTER INSERT OR UPDATE OR DELETE ON nib_width_offering DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_pen_installations();
--> statement-breakpoint
CREATE TRIGGER fountain_nib_detach_before_delete BEFORE DELETE ON collection_detail_nib FOR EACH ROW EXECUTE FUNCTION detach_deleted_nib();
--> statement-breakpoint
CREATE OR REPLACE VIEW public_search_source_documents AS
WITH product_aliases AS (
	SELECT product_id, string_agg(label, ' ' ORDER BY id) AS labels
	FROM product_alias
	GROUP BY product_id
),
product_types_search AS (
	SELECT pt.id, pt.name, pt.slug,
		concat_ws(' ', pt.name, c.canonical_label_fallback, string_agg(a.label, ' ' ORDER BY a.id)) AS labels
	FROM product_types pt
	LEFT JOIN catalog_terminology_concept c
		ON c.namespace = 'product-type' AND c.key = pt.slug
	LEFT JOIN catalog_terminology_alias a
		ON a.canonical_namespace = c.namespace AND a.concept_id = c.id
	GROUP BY pt.id, pt.name, pt.slug, c.canonical_label_fallback
),
product_rows AS (
	SELECT 'product'::text AS kind, p.id AS source_id, 'products'::text AS search_group,
		NULL::bigint AS parent_id, p.name AS title,
		'/products/' || pt.slug || '/' || p.slug AS href,
		pi.url AS image_url, concat_ws(' · ', m.name, pt.name) AS context,
		p.description,
		concat_ws(' ', p.name, pa.labels) AS search_text_a,
		concat_ws(' ', m.name, pt.labels) AS search_text_b,
		coalesce(p.description, '') AS search_text_c
	FROM product p
	JOIN makers m ON m.id = p.maker_id
	JOIN product_types_search pt ON pt.id = p.product_type_id
	LEFT JOIN product_aliases pa ON pa.product_id = p.id
	LEFT JOIN LATERAL (
		SELECT url FROM product_image
		WHERE product_id = p.id AND deleted_at IS NULL
		ORDER BY position, id LIMIT 1
	) pi ON true
	WHERE p.approval_status = 'approved' AND NOT p.is_private
),
collection_rows AS (
	SELECT 'collection'::text AS kind, c.id AS source_id, 'collections'::text AS search_group,
		NULL::bigint AS parent_id, c.name AS title,
		'/collections/' || c.owner_id || '/' || c.id AS href,
		ci.url AS image_url,
		CASE WHEN coalesce(us.is_profile_public, false) THEN u.username END AS context,
		coalesce(c.summary, c.description) AS description,
		c.name AS search_text_a,
		concat_ws(' ', c.summary,
			CASE WHEN coalesce(us.is_profile_public, false) THEN u.username END) AS search_text_b,
		coalesce(c.description, '') AS search_text_c
	FROM user_collection c
	JOIN users u ON u.id = c.owner_id
	LEFT JOIN user_settings us ON us.user_id = u.id
	LEFT JOIN LATERAL (
		SELECT url FROM collection_image
		WHERE collection_id = c.id
		ORDER BY is_current DESC, position, id LIMIT 1
	) ci ON true
	WHERE NOT c.is_private
),
collection_item_rows AS (
	SELECT 'collection_item'::text AS kind, i.id AS source_id, 'collections'::text AS search_group,
		i.collection_id AS parent_id, coalesce(i.display_name, p.name) AS title,
		'/collections/' || i.owner_id || '/' || i.collection_id || '/' || i.id AS href,
		coalesce(ii.url, pi.url) AS image_url,
		concat_ws(' · ', c.name, m.name, pt.name,
			CASE WHEN coalesce(us.is_profile_public, false) THEN u.username END) AS context,
		coalesce(i.description, p.description) AS description,
		concat_ws(' ', i.display_name, p.name, pa.labels) AS search_text_a,
		concat_ws(' ', m.name, pt.labels, c.name,
			CASE WHEN coalesce(us.is_profile_public, false) THEN u.username END) AS search_text_b,
		coalesce(i.description, p.description, '') AS search_text_c
	FROM collection_item i
	JOIN user_collection c ON c.id = i.collection_id AND c.owner_id = i.owner_id
	JOIN users u ON u.id = i.owner_id
	LEFT JOIN user_settings us ON us.user_id = u.id
	JOIN collection_item_search_products ip ON ip.collection_item_id = i.id
	JOIN product p ON p.id = ip.product_id
	JOIN makers m ON m.id = p.maker_id
	JOIN product_types_search pt ON pt.id = p.product_type_id
	LEFT JOIN product_aliases pa ON pa.product_id = p.id
	LEFT JOIN LATERAL (
		SELECT url FROM collection_item_image
		WHERE collection_item_id = i.id AND deleted_at IS NULL
		ORDER BY position, id LIMIT 1
	) ii ON true
	LEFT JOIN LATERAL (
		SELECT url FROM product_image
		WHERE product_id = p.id AND deleted_at IS NULL
		ORDER BY position, id LIMIT 1
	) pi ON true
	WHERE i.owned AND i.sold_at IS NULL AND i.approval_status = 'approved' AND NOT c.is_private
		AND NOT (CASE
			WHEN i.is_private AND i.privated_by_clerk_id IS NOT NULL
				AND i.privated_by_clerk_id <> u.clerk_id THEN true
			ELSE coalesce(
				(SELECT parent.is_private FROM collection_detail_spinner assembly
					JOIN collection_item parent ON parent.id = assembly.id
					WHERE assembly.installed_button_id = i.id),
				(SELECT parent.is_private FROM collection_detail_slider assembly
					JOIN collection_item parent ON parent.id = assembly.id
					WHERE assembly.installed_plate_id = i.id),
				(SELECT parent.is_private FROM collection_detail_slider assembly
					JOIN collection_item parent ON parent.id = assembly.id
					WHERE assembly.installed_insert_id = i.id),
				(SELECT parent.is_private FROM collection_item_installed_pen_part installation
					JOIN collection_item parent ON parent.id = installation.pen_collection_item_id
					WHERE installation.part_collection_item_id = i.id),
				(SELECT parent.is_private FROM collection_detail_fountain_pen pen JOIN collection_item parent ON parent.id = pen.id WHERE pen.installed_nib_collection_item_id = i.id),
				i.is_private
			)
		END)
		AND p.approval_status = 'approved' AND NOT p.is_private
		AND fountain_pen_nib_publicly_available(i.id)
),
maker_rows AS (
	SELECT 'maker'::text AS kind, m.id AS source_id, 'makers'::text AS search_group,
		NULL::bigint AS parent_id, m.name AS title, '/makers/' || m.slug AS href,
		mi.url AS image_url, NULL::text AS context, m.description,
		m.name AS search_text_a, ''::text AS search_text_b,
		coalesce(m.description, '') AS search_text_c
	FROM makers m
	LEFT JOIN LATERAL (
		SELECT url FROM maker_image
		WHERE maker_id = m.id AND deleted_at IS NULL
		ORDER BY position, id LIMIT 1
	) mi ON true
),
person_rows AS (
	SELECT 'person'::text AS kind, u.id AS source_id, 'people'::text AS search_group,
		NULL::bigint AS parent_id, u.username AS title, '/users/' || u.username AS href,
		u.image_url, NULL::text AS context, NULL::text AS description,
		u.username AS search_text_a, ''::text AS search_text_b, ''::text AS search_text_c
	FROM users u
	JOIN user_settings us ON us.user_id = u.id AND us.is_profile_public
	WHERE nullif(trim(u.username), '') IS NOT NULL
),
material_rows AS (
	SELECT 'material'::text AS kind, m.id AS source_id, 'materials'::text AS search_group,
		NULL::bigint AS parent_id, m.name AS title, '/materials/' || m.slug AS href,
		mi.url AS image_url, NULL::text AS context, m.description,
		m.name AS search_text_a, ''::text AS search_text_b,
		coalesce(m.description, '') AS search_text_c
	FROM materials m
	LEFT JOIN LATERAL (
		SELECT url FROM material_image
		WHERE material_id = m.id AND material_specific_id IS NULL AND deleted_at IS NULL
		ORDER BY position, id LIMIT 1
	) mi ON true
),
material_detail_rows AS (
	SELECT 'material_detail'::text AS kind, s.id AS source_id, 'materials'::text AS search_group,
		s.material_id AS parent_id, s.name AS title,
		'/materials/' || m.slug || '/' || s.slug AS href,
		coalesce(si.url, mi.url) AS image_url, m.name AS context, s.description,
		s.name AS search_text_a, m.name AS search_text_b,
		coalesce(s.description, '') AS search_text_c
	FROM material_specific s
	JOIN materials m ON m.id = s.material_id
	LEFT JOIN LATERAL (
		SELECT url FROM material_image
		WHERE material_specific_id = s.id AND deleted_at IS NULL
		ORDER BY position, id LIMIT 1
	) si ON true
	LEFT JOIN LATERAL (
		SELECT url FROM material_image
		WHERE material_id = m.id AND material_specific_id IS NULL AND deleted_at IS NULL
		ORDER BY position, id LIMIT 1
	) mi ON true
),
resource_rows AS (
	SELECT 'resource'::text AS kind, r.id AS source_id, 'resources'::text AS search_group,
		NULL::bigint AS parent_id, r.name AS title, '/resources/' || r.id AS href,
		ri.url AS image_url, NULL::text AS context, r.description,
		r.name AS search_text_a, coalesce(rf.file_names, '') AS search_text_b,
		r.description AS search_text_c
	FROM resources r
	LEFT JOIN LATERAL (
		SELECT url FROM resource_images WHERE resource_id = r.id
		ORDER BY position, id LIMIT 1
	) ri ON true
	LEFT JOIN LATERAL (
		SELECT string_agg(f.file_name, ' ' ORDER BY f.id) AS file_names
		FROM resource_versions v JOIN resource_files f ON f.version_id = v.id
		WHERE v.resource_id = r.id
	) rf ON true
	WHERE NOT r.is_private AND r.deleted_at IS NULL
)
SELECT *,
	setweight(to_tsvector('simple', normalize_search_text(search_text_a)), 'A') ||
	setweight(to_tsvector('simple', normalize_search_text(search_text_b)), 'B') ||
	setweight(to_tsvector('simple', normalize_search_text(search_text_c)), 'C') AS search_vector
FROM (
	SELECT * FROM product_rows UNION ALL
	SELECT * FROM collection_rows UNION ALL
	SELECT * FROM collection_item_rows UNION ALL
	SELECT * FROM maker_rows UNION ALL
	SELECT * FROM person_rows UNION ALL
	SELECT * FROM material_rows UNION ALL
	SELECT * FROM material_detail_rows UNION ALL
	SELECT * FROM resource_rows
) rows;


--> statement-breakpoint
CREATE FUNCTION refresh_fountain_pen_search() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_id bigint := coalesce(NEW.id, OLD.id); before_nib bigint; after_nib bigint;
BEGIN
 IF TG_TABLE_NAME = 'collection_detail_fountain_pen' THEN
   IF TG_OP <> 'INSERT' THEN before_nib := OLD.installed_nib_collection_item_id; END IF;
   IF TG_OP <> 'DELETE' THEN after_nib := NEW.installed_nib_collection_item_id; END IF;
   IF before_nib IS NOT NULL THEN PERFORM refresh_public_search_document('collection_item', before_nib); END IF;
   IF after_nib IS NOT NULL THEN PERFORM refresh_public_search_document('collection_item', after_nib); END IF;
 END IF;
 PERFORM refresh_public_search_document('collection_item', row_id);
 PERFORM refresh_public_search_document('collection_item', pen.id) FROM collection_detail_fountain_pen pen WHERE pen.installed_nib_collection_item_id = row_id;
 PERFORM refresh_public_search_document('collection_item', pen.installed_nib_collection_item_id) FROM collection_detail_fountain_pen pen WHERE pen.id = row_id AND pen.installed_nib_collection_item_id IS NOT NULL;
 RETURN coalesce(NEW, OLD);
END $$;
--> statement-breakpoint
CREATE TRIGGER fountain_search_collection_item_sync AFTER INSERT OR UPDATE OR DELETE ON collection_item FOR EACH ROW EXECUTE FUNCTION refresh_fountain_pen_search();
--> statement-breakpoint
CREATE TRIGGER fountain_search_collection_detail_fountain_pen_sync AFTER INSERT OR UPDATE OR DELETE ON collection_detail_fountain_pen FOR EACH ROW EXECUTE FUNCTION refresh_fountain_pen_search();
--> statement-breakpoint
CREATE TRIGGER fountain_search_collection_detail_nib_sync AFTER INSERT OR UPDATE OR DELETE ON collection_detail_nib FOR EACH ROW EXECUTE FUNCTION refresh_fountain_pen_search();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER nib_material_product_detail_nib_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_nib DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_nib_material_selection();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER nib_material_product_material_valid AFTER INSERT OR UPDATE OR DELETE ON product_material DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_nib_material_selection();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER nib_material_product_material_component_valid AFTER INSERT OR UPDATE OR DELETE ON product_material_component DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_nib_material_selection();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER nib_material_collection_detail_nib_valid AFTER INSERT OR UPDATE OR DELETE ON collection_detail_nib DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_nib_material_selection();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER nib_material_collection_item_material_valid AFTER INSERT OR UPDATE OR DELETE ON collection_item_material DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_nib_material_selection();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_concepts_product_detail_fountain_pen_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_fountain_pen DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_concepts();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_concepts_product_detail_nib_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_nib DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_concepts();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_concepts_catalog_terminology_concept_valid AFTER INSERT OR UPDATE OR DELETE ON catalog_terminology_concept DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_concepts();

--> statement-breakpoint
CREATE FUNCTION refresh_fountain_catalog_search() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_id bigint := coalesce(NEW.id, OLD.id);
BEGIN
 IF TG_TABLE_NAME = 'product' THEN
   PERFORM refresh_public_search_document('collection_item', pen.id)
   FROM collection_detail_fountain_pen pen
   JOIN product_detail_fountain_pen model ON model.id = pen.product_fountain_pen_id
   LEFT JOIN collection_detail_nib nib ON nib.id = pen.installed_nib_collection_item_id
   LEFT JOIN fountain_pen_section_option section ON section.id = pen.section_option_id
   WHERE model.id = row_id OR nib.product_nib_id = row_id
     OR (pen.nib_mode = 'default' AND CASE WHEN section.id IS NOT NULL THEN section.default_nib_product_id WHEN NOT EXISTS (SELECT 1 FROM fountain_pen_section_option available WHERE available.pen_product_id = model.id) THEN model.default_nib_product_id ELSE NULL END = row_id);
 ELSIF TG_TABLE_NAME = 'fountain_pen_section_option' THEN
   PERFORM refresh_public_search_document('collection_item', pen.id) FROM collection_detail_fountain_pen pen WHERE pen.section_option_id = row_id;
 ELSE
   PERFORM refresh_public_search_document('collection_item', pen.id) FROM collection_detail_fountain_pen pen WHERE pen.product_fountain_pen_id = row_id;
 END IF;
 RETURN coalesce(NEW, OLD);
END $$;

--> statement-breakpoint
CREATE TRIGGER fountain_catalog_search_product_sync AFTER INSERT OR UPDATE OR DELETE ON product FOR EACH ROW EXECUTE FUNCTION refresh_fountain_catalog_search();

--> statement-breakpoint
CREATE TRIGGER fountain_catalog_search_product_detail_fountain_pen_sync AFTER INSERT OR UPDATE OR DELETE ON product_detail_fountain_pen FOR EACH ROW EXECUTE FUNCTION refresh_fountain_catalog_search();

--> statement-breakpoint
CREATE TRIGGER fountain_catalog_search_fountain_pen_section_option_sync AFTER INSERT OR UPDATE OR DELETE ON fountain_pen_section_option FOR EACH ROW EXECUTE FUNCTION refresh_fountain_catalog_search();

--> statement-breakpoint
CREATE FUNCTION validate_owned_nib_offerings() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE selected_metal_id bigint;
BEGIN
 IF NEW.width_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.width_id IS DISTINCT FROM OLD.width_id OR NEW.product_nib_id IS DISTINCT FROM OLD.product_nib_id) AND NOT EXISTS (
   SELECT 1 FROM nib_width_offering w WHERE w.nib_product_id = NEW.product_nib_id AND w.width_id = NEW.width_id
 ) THEN RAISE EXCEPTION 'Owned nib width must be offered by its model'; END IF;
 IF (TG_OP = 'INSERT' OR NEW.plating_style IS DISTINCT FROM OLD.plating_style OR NEW.product_nib_id IS DISTINCT FROM OLD.product_nib_id) AND NOT EXISTS (
   SELECT 1 FROM nib_plating_style_offering s WHERE s.nib_product_id = NEW.product_nib_id AND s.style = NEW.plating_style
 ) THEN RAISE EXCEPTION 'Owned nib plating style must be offered by its model'; END IF;
 FOREACH selected_metal_id IN ARRAY ARRAY[NEW.coating_metal_id, NEW.body_coating_metal_id, NEW.tines_coating_metal_id] LOOP
   IF selected_metal_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.product_nib_id IS DISTINCT FROM OLD.product_nib_id OR (selected_metal_id IS DISTINCT FROM OLD.coating_metal_id AND selected_metal_id IS DISTINCT FROM OLD.body_coating_metal_id AND selected_metal_id IS DISTINCT FROM OLD.tines_coating_metal_id)) AND NOT EXISTS (
     SELECT 1 FROM nib_plating_metal_offering m WHERE m.nib_product_id = NEW.product_nib_id AND m.metal_id = selected_metal_id
   ) THEN RAISE EXCEPTION 'Owned nib coating metal must be offered by its model'; END IF;
 END LOOP;
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER owned_nib_offerings_valid AFTER INSERT OR UPDATE ON collection_detail_nib DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_owned_nib_offerings();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_subtype_product_detail_pen_actuator_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_pen_actuator DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_product_detail();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_subtype_product_detail_pen_clip_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_pen_clip DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_product_detail();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_subtype_product_detail_pen_mechanism_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_pen_mechanism DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_product_detail();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_subtype_product_detail_pen_tip_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_pen_tip DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_product_detail();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_subtype_product_detail_pen_top_cap_valid AFTER INSERT OR UPDATE OR DELETE ON product_detail_pen_top_cap DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_product_detail();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_collection_collection_detail_pen_valid AFTER INSERT OR UPDATE OR DELETE ON collection_detail_pen DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_collection_detail();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_collection_collection_detail_pen_clip_valid AFTER INSERT OR UPDATE OR DELETE ON collection_detail_pen_clip DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_collection_detail();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_collection_collection_detail_pen_tip_valid AFTER INSERT OR UPDATE OR DELETE ON collection_detail_pen_tip DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_collection_detail();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_collection_collection_detail_pen_top_cap_valid AFTER INSERT OR UPDATE OR DELETE ON collection_detail_pen_top_cap DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_collection_detail();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_collection_collection_detail_pen_mechanism_valid AFTER INSERT OR UPDATE OR DELETE ON collection_detail_pen_mechanism DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_collection_detail();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_collection_collection_detail_pen_actuator_valid AFTER INSERT OR UPDATE OR DELETE ON collection_detail_pen_actuator DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_collection_detail();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_collection_collection_detail_spinner_button_valid AFTER INSERT OR UPDATE OR DELETE ON collection_detail_spinner_button DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_collection_detail();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_collection_collection_detail_spinner_valid AFTER INSERT OR UPDATE OR DELETE ON collection_detail_spinner DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_collection_detail();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_collection_collection_detail_slider_plate_valid AFTER INSERT OR UPDATE OR DELETE ON collection_detail_slider_plate DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_collection_detail();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_collection_collection_detail_slider_insert_valid AFTER INSERT OR UPDATE OR DELETE ON collection_detail_slider_insert DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_collection_detail();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_collection_collection_detail_slider_valid AFTER INSERT OR UPDATE OR DELETE ON collection_detail_slider DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_collection_detail();

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER fountain_cc_mechanism_valid AFTER UPDATE ON fountain_pen_filling_mechanism DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fountain_pen_facts();
