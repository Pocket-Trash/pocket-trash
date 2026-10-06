ALTER TABLE "makers" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "makers" ADD COLUMN "description" text;--> statement-breakpoint
DO $$
DECLARE
	record_row record;
	base_slug text;
	candidate_slug text;
	suffix integer;
	used_slugs text[] := ARRAY[]::text[];
BEGIN
	FOR record_row IN SELECT "id", "name" FROM "makers" ORDER BY "id" LOOP
		base_slug := trim(both '-' from regexp_replace(regexp_replace(normalize(lower(trim(record_row."name")), NFKD), U&'[\0300-\036f]', '', 'g'), '[^a-z0-9]+', '-', 'g'));
		IF base_slug = '' THEN
			base_slug := 'maker';
		END IF;
		candidate_slug := base_slug;
		suffix := 2;
		WHILE candidate_slug = ANY(used_slugs) LOOP
			candidate_slug := base_slug || '-' || suffix;
			suffix := suffix + 1;
		END LOOP;
		UPDATE "makers" SET "slug" = candidate_slug WHERE "id" = record_row."id";
		used_slugs := array_append(used_slugs, candidate_slug);
	END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "makers" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "makers_slug_unique" ON "makers" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "makers" ADD CONSTRAINT "makers_description_length_check" CHECK ("makers"."description" IS NULL OR char_length("makers"."description") <= 5000);
