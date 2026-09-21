ALTER TABLE "color" ADD COLUMN "hex" text;--> statement-breakpoint
UPDATE "color" SET "hex" = CASE lower("slug")
  WHEN 'black' THEN '#000000'
  WHEN 'white' THEN '#FFFFFF'
  WHEN 'grey' THEN '#808080'
  WHEN 'silver' THEN '#C0C0C0'
  WHEN 'red' THEN '#DC2626'
  WHEN 'orange' THEN '#F97316'
  WHEN 'yellow' THEN '#EAB308'
  WHEN 'green' THEN '#16A34A'
  WHEN 'blue' THEN '#2563EB'
  WHEN 'purple' THEN '#9333EA'
  WHEN 'pink' THEN '#EC4899'
  WHEN 'brown' THEN '#92400E'
  WHEN 'bronze' THEN '#CD7F32'
  WHEN 'gold' THEN '#D4AF37'
  WHEN 'teal' THEN '#0D9488'
  WHEN 'cyan' THEN '#06B6D4'
  ELSE '#808080'
END;--> statement-breakpoint
ALTER TABLE "color" ALTER COLUMN "hex" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "color" ADD CONSTRAINT "color_hex_check" CHECK ("color"."hex" ~ '^#[0-9A-Fa-f]{6}$');
