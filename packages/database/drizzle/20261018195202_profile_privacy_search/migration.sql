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
CREATE FUNCTION refresh_public_search_user_settings() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
	old_user_id bigint := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.user_id END;
	new_user_id bigint := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.user_id END;
BEGIN
	IF old_user_id IS NOT NULL THEN
		PERFORM refresh_public_search_document('person', old_user_id);
		PERFORM refresh_public_search_document('collection', id)
		FROM user_collection WHERE owner_id = old_user_id;
		PERFORM refresh_public_search_document('collection_item', id)
		FROM collection_item WHERE owner_id = old_user_id;
	END IF;
	IF new_user_id IS NOT NULL AND new_user_id IS DISTINCT FROM old_user_id THEN
		PERFORM refresh_public_search_document('person', new_user_id);
		PERFORM refresh_public_search_document('collection', id)
		FROM user_collection WHERE owner_id = new_user_id;
		PERFORM refresh_public_search_document('collection_item', id)
		FROM collection_item WHERE owner_id = new_user_id;
	END IF;
	RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER search_user_settings_dependency
AFTER INSERT OR DELETE OR UPDATE OF is_profile_public, user_id ON user_settings
FOR EACH ROW EXECUTE FUNCTION refresh_public_search_user_settings();
--> statement-breakpoint
SELECT * FROM reconcile_public_search_documents();
