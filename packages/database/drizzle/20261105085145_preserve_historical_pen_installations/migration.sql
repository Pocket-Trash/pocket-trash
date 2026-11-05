CREATE OR REPLACE FUNCTION validate_installed_pen_parts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM collection_item_installed_pen_part installed
    JOIN collection_detail_pen pen ON pen.id = installed.pen_collection_item_id
    JOIN collection_item pen_item ON pen_item.id = installed.pen_collection_item_id
    JOIN collection_item part_item ON part_item.id = installed.part_collection_item_id
    LEFT JOIN product_detail_pen_part part ON part.id = collection_catalog_product(part_item.id)
    LEFT JOIN pen_compatible_part compatible
      ON compatible.pen_product_id = pen.product_pen_id
      AND compatible.part_product_id = part.id
    WHERE pen_item.owner_id <> part_item.owner_id
      OR part.id IS NULL
      OR (compatible.pen_product_id IS NULL AND NOT installed.requires_customization)
  ) THEN
    RAISE EXCEPTION 'Installed Pen parts must have the same owner and recorded compatibility or confirmed customization';
  END IF;
  RETURN NULL;
END $$;
