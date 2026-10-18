-- Custom SQL migration file, put your code below! --
CREATE FUNCTION normalize_search_text(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
RETURN trim(regexp_replace(
	lower(translate(coalesce(value, ''),
		'áàâäãåāăąæçćčďđéèêëēĕėęěģíìîïīĭįķļľłñńņňóòôöõøŕřśšşťţúùûüūŭůűųýÿźżžœßðþ',
		'aaaaaaaaaacccddeeeeeeeeegiiiiiiiklllnnnnoooooorrsssttuuuuuuuuuyyzzzosdt')),
	'\s+', ' ', 'g'));
--> statement-breakpoint
CREATE INDEX "search_documents_vector_idx" ON "search_documents" USING gin ("search_vector");
--> statement-breakpoint
CREATE VIEW collection_item_search_products AS
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
UNION ALL SELECT id, product_slider_id FROM collection_detail_slider;
--> statement-breakpoint
CREATE VIEW public_search_source_documents AS
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
		ci.url AS image_url, u.username AS context,
		coalesce(c.summary, c.description) AS description,
		c.name AS search_text_a,
		concat_ws(' ', c.summary, u.username) AS search_text_b,
		coalesce(c.description, '') AS search_text_c
	FROM user_collection c
	JOIN users u ON u.id = c.owner_id
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
		concat_ws(' · ', c.name, m.name, pt.name, u.username) AS context,
		coalesce(i.description, p.description) AS description,
		concat_ws(' ', i.display_name, p.name, pa.labels) AS search_text_a,
		concat_ws(' ', m.name, pt.labels, c.name, u.username) AS search_text_b,
		coalesce(i.description, p.description, '') AS search_text_c
	FROM collection_item i
	JOIN user_collection c ON c.id = i.collection_id AND c.owner_id = i.owner_id
	JOIN users u ON u.id = i.owner_id
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
				i.is_private
			)
		END)
		AND p.approval_status = 'approved' AND NOT p.is_private
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
	FROM users u WHERE nullif(trim(u.username), '') IS NOT NULL
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
CREATE FUNCTION refresh_public_search_document(document_kind text, document_id bigint) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
	INSERT INTO search_documents (
		kind, source_id, search_group, parent_id, title, href, image_url, context,
		description, search_text_a, search_text_b, search_text_c, search_vector
	)
	SELECT kind, source_id, search_group, parent_id, title, href, image_url, context,
		description, search_text_a, search_text_b, search_text_c, search_vector
	FROM public_search_source_documents
	WHERE kind = document_kind AND source_id = document_id
	ON CONFLICT (kind, source_id) DO UPDATE SET
		search_group = excluded.search_group, parent_id = excluded.parent_id,
		title = excluded.title, href = excluded.href, image_url = excluded.image_url,
		context = excluded.context, description = excluded.description,
		search_text_a = excluded.search_text_a, search_text_b = excluded.search_text_b,
		search_text_c = excluded.search_text_c, search_vector = excluded.search_vector;

	IF NOT FOUND THEN
		DELETE FROM search_documents WHERE kind = document_kind AND source_id = document_id;
	END IF;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION reconcile_public_search_documents()
RETURNS TABLE (upserted integer, deleted integer)
LANGUAGE plpgsql AS $$
BEGIN
	INSERT INTO search_documents (
		kind, source_id, search_group, parent_id, title, href, image_url, context,
		description, search_text_a, search_text_b, search_text_c, search_vector
	)
	SELECT kind, source_id, search_group, parent_id, title, href, image_url, context,
		description, search_text_a, search_text_b, search_text_c, search_vector
	FROM public_search_source_documents
	ON CONFLICT (kind, source_id) DO UPDATE SET
		search_group = excluded.search_group, parent_id = excluded.parent_id,
		title = excluded.title, href = excluded.href, image_url = excluded.image_url,
		context = excluded.context, description = excluded.description,
		search_text_a = excluded.search_text_a, search_text_b = excluded.search_text_b,
		search_text_c = excluded.search_text_c, search_vector = excluded.search_vector
	WHERE (search_documents.search_group, search_documents.parent_id, search_documents.title,
		search_documents.href, search_documents.image_url, search_documents.context,
		search_documents.description, search_documents.search_text_a,
		search_documents.search_text_b, search_documents.search_text_c,
		search_documents.search_vector) IS DISTINCT FROM
		(excluded.search_group, excluded.parent_id, excluded.title, excluded.href,
		excluded.image_url, excluded.context, excluded.description, excluded.search_text_a,
		excluded.search_text_b, excluded.search_text_c, excluded.search_vector);
	GET DIAGNOSTICS upserted = ROW_COUNT;

	DELETE FROM search_documents d
	WHERE NOT EXISTS (
		SELECT 1 FROM public_search_source_documents s
		WHERE s.kind = d.kind AND s.source_id = d.source_id
	);
	GET DIAGNOSTICS deleted = ROW_COUNT;
	RETURN NEXT;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION refresh_public_search_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
	old_row jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
	new_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
	old_id bigint := nullif(old_row ->> TG_ARGV[1], '')::bigint;
	new_id bigint := nullif(new_row ->> TG_ARGV[1], '')::bigint;
BEGIN
	IF old_id IS NOT NULL THEN PERFORM refresh_public_search_document(TG_ARGV[0], old_id); END IF;
	IF new_id IS NOT NULL AND new_id IS DISTINCT FROM old_id THEN
		PERFORM refresh_public_search_document(TG_ARGV[0], new_id);
	ELSIF new_id IS NOT NULL THEN
		PERFORM refresh_public_search_document(TG_ARGV[0], new_id);
	END IF;

	IF TG_TABLE_NAME = 'product' THEN
		PERFORM refresh_public_search_document('collection_item', ip.collection_item_id)
		FROM collection_item_search_products ip WHERE ip.product_id IN (old_id, new_id);
	ELSIF TG_TABLE_NAME = 'makers' THEN
		PERFORM refresh_public_search_document('product', p.id)
		FROM product p WHERE p.maker_id IN (old_id, new_id);
		PERFORM refresh_public_search_document('collection_item', ip.collection_item_id)
		FROM collection_item_search_products ip JOIN product p ON p.id = ip.product_id
		WHERE p.maker_id IN (old_id, new_id);
	ELSIF TG_TABLE_NAME = 'users' THEN
		PERFORM refresh_public_search_document('collection', c.id)
		FROM user_collection c WHERE c.owner_id IN (old_id, new_id);
		PERFORM refresh_public_search_document('collection_item', i.id)
		FROM collection_item i WHERE i.owner_id IN (old_id, new_id);
	ELSIF TG_TABLE_NAME = 'user_collection' THEN
		PERFORM refresh_public_search_document('collection_item', i.id)
		FROM collection_item i WHERE i.collection_id IN (old_id, new_id);
	ELSIF TG_TABLE_NAME = 'collection_item' THEN
		PERFORM refresh_public_search_document('collection_item', s.installed_button_id)
		FROM collection_detail_spinner s
		WHERE s.id IN (old_id, new_id) AND s.installed_button_id IS NOT NULL;
		PERFORM refresh_public_search_document('collection_item', s.installed_plate_id)
		FROM collection_detail_slider s
		WHERE s.id IN (old_id, new_id) AND s.installed_plate_id IS NOT NULL;
		PERFORM refresh_public_search_document('collection_item', s.installed_insert_id)
		FROM collection_detail_slider s
		WHERE s.id IN (old_id, new_id) AND s.installed_insert_id IS NOT NULL;
		PERFORM refresh_public_search_document('collection_item', p.part_collection_item_id)
		FROM collection_item_installed_pen_part p
		WHERE p.pen_collection_item_id IN (old_id, new_id);
	ELSIF TG_TABLE_NAME = 'materials' THEN
		PERFORM refresh_public_search_document('material_detail', s.id)
		FROM material_specific s WHERE s.material_id IN (old_id, new_id);
	END IF;
	RETURN coalesce(NEW, OLD);
END;
$$;
--> statement-breakpoint
CREATE TRIGGER search_product_sync AFTER INSERT OR UPDATE OR DELETE ON product
FOR EACH ROW EXECUTE FUNCTION refresh_public_search_trigger('product', 'id');
--> statement-breakpoint
CREATE TRIGGER search_collection_sync AFTER INSERT OR UPDATE OR DELETE ON user_collection
FOR EACH ROW EXECUTE FUNCTION refresh_public_search_trigger('collection', 'id');
--> statement-breakpoint
CREATE TRIGGER search_collection_item_sync AFTER INSERT OR UPDATE OR DELETE ON collection_item
FOR EACH ROW EXECUTE FUNCTION refresh_public_search_trigger('collection_item', 'id');
--> statement-breakpoint
CREATE TRIGGER search_maker_sync AFTER INSERT OR UPDATE OR DELETE ON makers
FOR EACH ROW EXECUTE FUNCTION refresh_public_search_trigger('maker', 'id');
--> statement-breakpoint
CREATE TRIGGER search_person_sync AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION refresh_public_search_trigger('person', 'id');
--> statement-breakpoint
CREATE TRIGGER search_material_sync AFTER INSERT OR UPDATE OR DELETE ON materials
FOR EACH ROW EXECUTE FUNCTION refresh_public_search_trigger('material', 'id');
--> statement-breakpoint
CREATE TRIGGER search_material_detail_sync AFTER INSERT OR UPDATE OR DELETE ON material_specific
FOR EACH ROW EXECUTE FUNCTION refresh_public_search_trigger('material_detail', 'id');
--> statement-breakpoint
CREATE TRIGGER search_resource_sync AFTER INSERT OR UPDATE OR DELETE ON resources
FOR EACH ROW EXECUTE FUNCTION refresh_public_search_trigger('resource', 'id');
--> statement-breakpoint
CREATE FUNCTION refresh_public_search_dependencies() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE old_data jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
DECLARE new_data jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
DECLARE row_data jsonb := CASE WHEN TG_OP = 'DELETE' THEN old_data ELSE new_data END;
DECLARE target_id bigint;
BEGIN
	CASE TG_TABLE_NAME
		WHEN 'product_alias' THEN
			target_id := (row_data ->> 'product_id')::bigint;
			PERFORM refresh_public_search_document('product', target_id);
			PERFORM refresh_public_search_document('collection_item', ip.collection_item_id)
			FROM collection_item_search_products ip WHERE ip.product_id = target_id;
		WHEN 'product_image' THEN
			target_id := (row_data ->> 'product_id')::bigint;
			PERFORM refresh_public_search_document('product', target_id);
			PERFORM refresh_public_search_document('collection_item', ip.collection_item_id)
			FROM collection_item_search_products ip WHERE ip.product_id = target_id;
		WHEN 'collection_image' THEN
			PERFORM refresh_public_search_document('collection', (row_data ->> 'collection_id')::bigint);
		WHEN 'collection_item_image' THEN
			PERFORM refresh_public_search_document('collection_item', (row_data ->> 'collection_item_id')::bigint);
		WHEN 'maker_image' THEN
			PERFORM refresh_public_search_document('maker', (row_data ->> 'maker_id')::bigint);
		WHEN 'material_image' THEN
			PERFORM refresh_public_search_document('material', (row_data ->> 'material_id')::bigint);
			IF row_data ->> 'material_specific_id' IS NOT NULL THEN
				PERFORM refresh_public_search_document('material_detail', (row_data ->> 'material_specific_id')::bigint);
			ELSE
				PERFORM refresh_public_search_document('material_detail', s.id)
				FROM material_specific s WHERE s.material_id = (row_data ->> 'material_id')::bigint;
			END IF;
		WHEN 'resource_images' THEN
			PERFORM refresh_public_search_document('resource', (row_data ->> 'resource_id')::bigint);
		WHEN 'resource_versions' THEN
			PERFORM refresh_public_search_document('resource', (row_data ->> 'resource_id')::bigint);
		WHEN 'resource_files' THEN
			PERFORM refresh_public_search_document('resource', v.resource_id)
			FROM resource_versions v WHERE v.id = (row_data ->> 'version_id')::bigint;
		WHEN 'product_types' THEN
			target_id := (row_data ->> 'id')::bigint;
			PERFORM refresh_public_search_document('product', p.id) FROM product p WHERE p.product_type_id = target_id;
			PERFORM refresh_public_search_document('collection_item', ip.collection_item_id)
			FROM collection_item_search_products ip JOIN product p ON p.id = ip.product_id
			WHERE p.product_type_id = target_id;
		WHEN 'catalog_terminology_alias' THEN
			PERFORM refresh_public_search_document('product', p.id)
			FROM product p
			JOIN product_types pt ON pt.id = p.product_type_id
			JOIN catalog_terminology_concept c ON c.id = (row_data ->> 'concept_id')::bigint
			WHERE c.namespace = 'product-type' AND pt.slug = c.key
				AND ((row_data ->> 'maker_id') IS NULL OR p.maker_id = (row_data ->> 'maker_id')::bigint);
			PERFORM refresh_public_search_document('collection_item', ip.collection_item_id)
			FROM collection_item_search_products ip
			JOIN product p ON p.id = ip.product_id
			JOIN product_types pt ON pt.id = p.product_type_id
			JOIN catalog_terminology_concept c ON c.id = (row_data ->> 'concept_id')::bigint
			WHERE c.namespace = 'product-type' AND pt.slug = c.key
				AND ((row_data ->> 'maker_id') IS NULL OR p.maker_id = (row_data ->> 'maker_id')::bigint);
		WHEN 'catalog_terminology_concept' THEN
			PERFORM refresh_public_search_document('product', p.id)
			FROM product p JOIN product_types pt ON pt.id = p.product_type_id
			WHERE row_data ->> 'namespace' = 'product-type' AND pt.slug = row_data ->> 'key';
			PERFORM refresh_public_search_document('collection_item', ip.collection_item_id)
			FROM collection_item_search_products ip
			JOIN product p ON p.id = ip.product_id
			JOIN product_types pt ON pt.id = p.product_type_id
			WHERE row_data ->> 'namespace' = 'product-type' AND pt.slug = row_data ->> 'key';
		ELSE
			target_id := (row_data ->> 'id')::bigint;
			PERFORM refresh_public_search_document('collection_item', target_id);
	END CASE;

	IF TG_OP = 'UPDATE' THEN
		CASE TG_TABLE_NAME
			WHEN 'product_alias' THEN
				IF old_data ->> 'product_id' IS DISTINCT FROM new_data ->> 'product_id' THEN
					target_id := (old_data ->> 'product_id')::bigint;
					PERFORM refresh_public_search_document('product', target_id);
					PERFORM refresh_public_search_document('collection_item', ip.collection_item_id)
					FROM collection_item_search_products ip WHERE ip.product_id = target_id;
				END IF;
			WHEN 'product_image' THEN
				IF old_data ->> 'product_id' IS DISTINCT FROM new_data ->> 'product_id' THEN
					target_id := (old_data ->> 'product_id')::bigint;
					PERFORM refresh_public_search_document('product', target_id);
					PERFORM refresh_public_search_document('collection_item', ip.collection_item_id)
					FROM collection_item_search_products ip WHERE ip.product_id = target_id;
				END IF;
			WHEN 'collection_image' THEN
				IF old_data ->> 'collection_id' IS DISTINCT FROM new_data ->> 'collection_id' THEN
					PERFORM refresh_public_search_document('collection', (old_data ->> 'collection_id')::bigint);
				END IF;
			WHEN 'collection_item_image' THEN
				IF old_data ->> 'collection_item_id' IS DISTINCT FROM new_data ->> 'collection_item_id' THEN
					PERFORM refresh_public_search_document('collection_item', (old_data ->> 'collection_item_id')::bigint);
				END IF;
			WHEN 'maker_image' THEN
				IF old_data ->> 'maker_id' IS DISTINCT FROM new_data ->> 'maker_id' THEN
					PERFORM refresh_public_search_document('maker', (old_data ->> 'maker_id')::bigint);
				END IF;
			WHEN 'material_image' THEN
				IF old_data ->> 'material_id' IS DISTINCT FROM new_data ->> 'material_id'
					OR old_data ->> 'material_specific_id' IS DISTINCT FROM new_data ->> 'material_specific_id' THEN
					PERFORM refresh_public_search_document('material', (old_data ->> 'material_id')::bigint);
					IF old_data ->> 'material_specific_id' IS NOT NULL THEN
						PERFORM refresh_public_search_document('material_detail', (old_data ->> 'material_specific_id')::bigint);
					ELSE
						PERFORM refresh_public_search_document('material_detail', s.id)
						FROM material_specific s WHERE s.material_id = (old_data ->> 'material_id')::bigint;
					END IF;
				END IF;
			WHEN 'resource_images' THEN
				IF old_data ->> 'resource_id' IS DISTINCT FROM new_data ->> 'resource_id' THEN
					PERFORM refresh_public_search_document('resource', (old_data ->> 'resource_id')::bigint);
				END IF;
			WHEN 'resource_versions' THEN
				IF old_data ->> 'resource_id' IS DISTINCT FROM new_data ->> 'resource_id' THEN
					PERFORM refresh_public_search_document('resource', (old_data ->> 'resource_id')::bigint);
				END IF;
			WHEN 'resource_files' THEN
				IF old_data ->> 'version_id' IS DISTINCT FROM new_data ->> 'version_id' THEN
					PERFORM refresh_public_search_document('resource', v.resource_id)
					FROM resource_versions v WHERE v.id = (old_data ->> 'version_id')::bigint;
				END IF;
			WHEN 'product_types' THEN NULL;
			WHEN 'catalog_terminology_alias' THEN NULL;
			WHEN 'catalog_terminology_concept' THEN NULL;
			ELSE
				IF old_data ->> 'id' IS DISTINCT FROM new_data ->> 'id' THEN
					PERFORM refresh_public_search_document('collection_item', (old_data ->> 'id')::bigint);
				END IF;
		END CASE;

		IF TG_TABLE_NAME = 'catalog_terminology_alias'
			AND (old_data ->> 'concept_id', old_data ->> 'maker_id') IS DISTINCT FROM
				(new_data ->> 'concept_id', new_data ->> 'maker_id') THEN
			PERFORM refresh_public_search_document('product', p.id)
			FROM product p
			JOIN product_types pt ON pt.id = p.product_type_id
			JOIN catalog_terminology_concept c ON c.id = (old_data ->> 'concept_id')::bigint
			WHERE c.namespace = 'product-type' AND pt.slug = c.key
				AND ((old_data ->> 'maker_id') IS NULL OR p.maker_id = (old_data ->> 'maker_id')::bigint);
			PERFORM refresh_public_search_document('collection_item', ip.collection_item_id)
			FROM collection_item_search_products ip
			JOIN product p ON p.id = ip.product_id
			JOIN product_types pt ON pt.id = p.product_type_id
			JOIN catalog_terminology_concept c ON c.id = (old_data ->> 'concept_id')::bigint
			WHERE c.namespace = 'product-type' AND pt.slug = c.key
				AND ((old_data ->> 'maker_id') IS NULL OR p.maker_id = (old_data ->> 'maker_id')::bigint);
		ELSIF TG_TABLE_NAME = 'catalog_terminology_concept'
			AND (old_data ->> 'namespace', old_data ->> 'key') IS DISTINCT FROM
				(new_data ->> 'namespace', new_data ->> 'key') THEN
			PERFORM refresh_public_search_document('product', p.id)
			FROM product p JOIN product_types pt ON pt.id = p.product_type_id
			WHERE old_data ->> 'namespace' = 'product-type' AND pt.slug = old_data ->> 'key';
			PERFORM refresh_public_search_document('collection_item', ip.collection_item_id)
			FROM collection_item_search_products ip
			JOIN product p ON p.id = ip.product_id
			JOIN product_types pt ON pt.id = p.product_type_id
			WHERE old_data ->> 'namespace' = 'product-type' AND pt.slug = old_data ->> 'key';
		END IF;
	END IF;

	IF TG_TABLE_NAME = 'collection_detail_spinner' THEN
		IF old_data ->> 'installed_button_id' IS NOT NULL THEN
			PERFORM refresh_public_search_document('collection_item', (old_data ->> 'installed_button_id')::bigint);
		END IF;
		IF new_data ->> 'installed_button_id' IS NOT NULL THEN
			PERFORM refresh_public_search_document('collection_item', (new_data ->> 'installed_button_id')::bigint);
		END IF;
	ELSIF TG_TABLE_NAME = 'collection_detail_slider' THEN
		IF old_data ->> 'installed_plate_id' IS NOT NULL THEN
			PERFORM refresh_public_search_document('collection_item', (old_data ->> 'installed_plate_id')::bigint);
		END IF;
		IF new_data ->> 'installed_plate_id' IS NOT NULL THEN
			PERFORM refresh_public_search_document('collection_item', (new_data ->> 'installed_plate_id')::bigint);
		END IF;
		IF old_data ->> 'installed_insert_id' IS NOT NULL THEN
			PERFORM refresh_public_search_document('collection_item', (old_data ->> 'installed_insert_id')::bigint);
		END IF;
		IF new_data ->> 'installed_insert_id' IS NOT NULL THEN
			PERFORM refresh_public_search_document('collection_item', (new_data ->> 'installed_insert_id')::bigint);
		END IF;
	ELSIF TG_TABLE_NAME = 'collection_item_installed_pen_part' THEN
		IF old_data ->> 'part_collection_item_id' IS NOT NULL THEN
			PERFORM refresh_public_search_document('collection_item', (old_data ->> 'part_collection_item_id')::bigint);
		END IF;
		IF new_data ->> 'part_collection_item_id' IS NOT NULL THEN
			PERFORM refresh_public_search_document('collection_item', (new_data ->> 'part_collection_item_id')::bigint);
		END IF;
	END IF;
	RETURN coalesce(NEW, OLD);
END;
$$;
--> statement-breakpoint
CREATE TRIGGER search_product_alias_dependency AFTER INSERT OR UPDATE OR DELETE ON product_alias FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_product_image_dependency AFTER INSERT OR UPDATE OR DELETE ON product_image FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_collection_image_dependency AFTER INSERT OR UPDATE OR DELETE ON collection_image FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_collection_item_image_dependency AFTER INSERT OR UPDATE OR DELETE ON collection_item_image FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_maker_image_dependency AFTER INSERT OR UPDATE OR DELETE ON maker_image FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_material_image_dependency AFTER INSERT OR UPDATE OR DELETE ON material_image FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_resource_image_dependency AFTER INSERT OR UPDATE OR DELETE ON resource_images FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_resource_version_dependency AFTER INSERT OR DELETE OR UPDATE OF resource_id ON resource_versions FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_resource_file_dependency AFTER INSERT OR UPDATE OR DELETE ON resource_files FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_product_type_dependency AFTER INSERT OR UPDATE OR DELETE ON product_types FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_terminology_alias_dependency AFTER INSERT OR UPDATE OR DELETE ON catalog_terminology_alias FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_terminology_concept_dependency AFTER INSERT OR UPDATE OR DELETE ON catalog_terminology_concept FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_collection_detail_pen_dependency AFTER INSERT OR UPDATE OR DELETE ON collection_detail_pen FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_collection_detail_pen_clip_dependency AFTER INSERT OR UPDATE OR DELETE ON collection_detail_pen_clip FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_collection_detail_pen_tip_dependency AFTER INSERT OR UPDATE OR DELETE ON collection_detail_pen_tip FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_collection_detail_pen_top_cap_dependency AFTER INSERT OR UPDATE OR DELETE ON collection_detail_pen_top_cap FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_collection_detail_pen_mechanism_dependency AFTER INSERT OR UPDATE OR DELETE ON collection_detail_pen_mechanism FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_collection_detail_pen_actuator_dependency AFTER INSERT OR UPDATE OR DELETE ON collection_detail_pen_actuator FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_collection_detail_spinner_button_dependency AFTER INSERT OR UPDATE OR DELETE ON collection_detail_spinner_button FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_collection_detail_spinner_dependency AFTER INSERT OR UPDATE OR DELETE ON collection_detail_spinner FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_collection_detail_slider_plate_dependency AFTER INSERT OR UPDATE OR DELETE ON collection_detail_slider_plate FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_collection_detail_slider_insert_dependency AFTER INSERT OR UPDATE OR DELETE ON collection_detail_slider_insert FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_collection_detail_slider_dependency AFTER INSERT OR UPDATE OR DELETE ON collection_detail_slider FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
CREATE TRIGGER search_collection_item_installed_pen_part_dependency AFTER INSERT OR UPDATE OR DELETE ON collection_item_installed_pen_part FOR EACH ROW EXECUTE FUNCTION refresh_public_search_dependencies();
--> statement-breakpoint
SELECT * FROM reconcile_public_search_documents();
