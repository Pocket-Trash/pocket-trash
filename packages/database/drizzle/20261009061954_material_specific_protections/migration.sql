-- Only catalog references are convertible; historical audit records remain untouched.
DO $$
DECLARE
  old_material materials%ROWTYPE;
  parent_material materials%ROWTYPE;
  specific_id bigint;
BEGIN
  SELECT * INTO old_material FROM materials
    WHERE slug = 'm390-steel' OR lower(btrim(name, E' \t\n\r\f\013\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff')) = 'm390 steel';
  IF NOT FOUND THEN RETURN; END IF;
  IF (SELECT count(*) FROM materials
      WHERE slug = 'm390-steel' OR lower(btrim(name, E' \t\n\r\f\013\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff')) = 'm390 steel') <> 1 THEN
    RAISE EXCEPTION 'Ambiguous M390 material';
  END IF;
  IF EXISTS (SELECT 1 FROM tmp_autmog_pen_materials WHERE material_id = old_material.id) THEN
    RAISE EXCEPTION 'Unsupported Autmog reference to M390';
  END IF;
  IF EXISTS (SELECT 1 FROM upload_session WHERE target_type = 'material'
      AND target_id = old_material.id AND completed_at IS NULL AND expires_at > now()) THEN
    RAISE EXCEPTION 'Live upload session targets M390';
  END IF;
  SELECT * INTO parent_material FROM materials
    WHERE slug = 'stainless-steel' OR lower(btrim(name, E' \t\n\r\f\013\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff')) = 'stainless steel';
  IF NOT FOUND THEN
    INSERT INTO materials (name, slug) VALUES ('Stainless Steel', 'stainless-steel')
      RETURNING * INTO parent_material;
  ELSIF (SELECT count(*) FROM materials
      WHERE slug = 'stainless-steel' OR lower(btrim(name, E' \t\n\r\f\013\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff')) = 'stainless steel') <> 1
      OR parent_material.slug <> 'stainless-steel'
      OR lower(btrim(parent_material.name, E' \t\n\r\f\013\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff')) <> 'stainless steel' THEN
    RAISE EXCEPTION 'Ambiguous Stainless Steel material';
  END IF;
  IF EXISTS (SELECT 1 FROM material_specific WHERE material_id = parent_material.id
      AND (slug = old_material.slug OR lower(btrim(name, E' \t\n\r\f\013\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff')) = lower(btrim(old_material.name, E' \t\n\r\f\013\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff')))) THEN
    RAISE EXCEPTION 'Conflicting M390 destination';
  END IF;
  INSERT INTO material_specific (material_id, name, slug, description, created_at, updated_at)
    VALUES (parent_material.id, old_material.name, old_material.slug,
      old_material.description, old_material.created_at, old_material.updated_at)
    RETURNING id INTO specific_id;
  UPDATE product_material SET material_id = parent_material.id, material_specific_id = specific_id
    WHERE material_id = old_material.id;
  UPDATE collection_item SET material_id = parent_material.id, material_specific_id = specific_id
    WHERE material_id = old_material.id;
  UPDATE material_image SET material_id = parent_material.id, material_specific_id = specific_id
    WHERE material_id = old_material.id;
  -- Remaining ordinary foreign keys reject unsupported durable references.
  DELETE FROM materials WHERE id = old_material.id;
END $$;
--> statement-breakpoint
CREATE FUNCTION protect_material_specific() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.material_id IS DISTINCT FROM OLD.material_id THEN
    RAISE EXCEPTION 'Material-specific parent is immutable' USING ERRCODE = '23514', CONSTRAINT = 'material_specific_immutable_parent';
  END IF;
  -- The parent row lock also serializes against a concurrent parent rename.
  SELECT name INTO parent_name FROM materials WHERE id = NEW.material_id FOR UPDATE;
  IF lower(btrim(NEW.name, E' \t\n\r\f\013\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff')) = lower(btrim(parent_name, E' \t\n\r\f\013\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff')) THEN
    RAISE EXCEPTION 'Material-specific name cannot equal its parent name' USING ERRCODE = '23514', CONSTRAINT = 'material_specific_parent_name_protection';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER material_specific_parent_protection
  BEFORE INSERT OR UPDATE ON material_specific
  FOR EACH ROW EXECUTE FUNCTION protect_material_specific();
--> statement-breakpoint
CREATE FUNCTION protect_material_parent_name() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM material_specific WHERE material_id = NEW.id
      AND lower(btrim(name, E' \t\n\r\f\013\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff')) = lower(btrim(NEW.name, E' \t\n\r\f\013\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff'))) THEN
    RAISE EXCEPTION 'Material-specific name cannot equal its parent name' USING ERRCODE = '23514', CONSTRAINT = 'material_specific_parent_name_protection';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER materials_specific_name_protection BEFORE UPDATE OF name ON materials
  FOR EACH ROW EXECUTE FUNCTION protect_material_parent_name();
