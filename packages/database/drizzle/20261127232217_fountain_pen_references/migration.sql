INSERT INTO product_types (name, slug, is_part_or_accessory) VALUES
  ('Fountain pen', 'fountain-pen', false), ('Nib', 'nib', true)
ON CONFLICT (slug) DO NOTHING;
--> statement-breakpoint
INSERT INTO fountain_pen_filling_mechanism (slug, name, description) VALUES
  ('cartridge-converter', 'Cartridge/converter', 'Ink supplied by a cartridge or compatible removable converter through the section fitting.'),
  ('screw-piston', 'Screw piston', 'A built-in screw-operated piston draws ink into the reservoir.'),
  ('button-piston', 'Button piston', 'A button operates a built-in piston filling system.'),
  ('spring-loaded-piston', 'Spring-loaded piston', 'A depressed plunger and returning spring operate a built-in piston.'),
  ('vacuum-plunger', 'Vacuum/plunger', 'A plunger creates the pressure change that fills the reservoir. Some models use a rear-operated valve to isolate the reservoir.'),
  ('eyedropper', 'Eyedropper', 'Ink is introduced directly into the barrel.'),
  ('bulkfiller', 'Bulkfiller', 'An engaging piston and detachable operating rod fill the reservoir.'),
  ('pneumatic', 'Pneumatic', 'Air pressure compresses an internal ink sac.'),
  ('lever', 'Lever', 'An external lever compresses an internal ink sac.'),
  ('crescent', 'Crescent', 'An external crescent compresses an internal ink sac.')
ON CONFLICT (slug) DO NOTHING;
--> statement-breakpoint
INSERT INTO nib_plating_style (slug, name) VALUES
  ('unplated', 'Unplated'), ('full', 'Full'), ('partial', 'Partial'),
  ('two-tone', 'Two-tone'), ('reverse-two-tone', 'Reverse two-tone')
ON CONFLICT (slug) DO NOTHING;
--> statement-breakpoint
INSERT INTO catalog_terminology_concept (namespace, key, canonical_label_key, canonical_label_fallback, normalized_canonical_label) VALUES
  ('fountain-pen-nib-construction', 'exposed', 'web.fountainPen.options.construction.exposed', 'Exposed', 'exposed'),
  ('fountain-pen-nib-construction', 'hooded', 'web.fountainPen.options.construction.hooded', 'Hooded', 'hooded'),
  ('fountain-pen-nib-construction', 'semi-hooded', 'web.fountainPen.options.construction.semiHooded', 'Semi-hooded', 'semi-hooded'),
  ('fountain-pen-nib-construction', 'inlaid', 'web.fountainPen.options.construction.inlaid', 'Inlaid', 'inlaid'),
  ('fountain-pen-nib-construction', 'integral', 'web.fountainPen.options.construction.integral', 'Integral', 'integral'),
  ('fountain-pen-body-silhouette', 'cylindrical', 'web.fountainPen.options.silhouette.cylindrical', 'Cylindrical', 'cylindrical'),
  ('fountain-pen-body-silhouette', 'cigar', 'web.fountainPen.options.silhouette.cigar', 'Cigar / rounded', 'cigar / rounded'),
  ('fountain-pen-body-silhouette', 'tapered', 'web.fountainPen.options.silhouette.tapered', 'Tapered / torpedo', 'tapered / torpedo'),
  ('fountain-pen-body-silhouette', 'reverse-tapered', 'web.fountainPen.options.silhouette.reverseTapered', 'Reverse-tapered', 'reverse-tapered'),
  ('fountain-pen-body-silhouette', 'other', 'web.trends.other', 'Other', 'other'),
  ('fountain-pen-cross-section', 'round', 'web.fountainPen.options.crossSection.round', 'Round', 'round'),
  ('fountain-pen-cross-section', 'faceted', 'web.fountainPen.options.crossSection.faceted', 'Faceted', 'faceted'),
  ('fountain-pen-cross-section', 'other', 'web.trends.other', 'Other', 'other'),
  ('fountain-pen-form-factor', 'standard', 'web.fountainPen.options.formFactor.standard', 'Standard', 'standard'),
  ('fountain-pen-form-factor', 'pocket', 'web.fountainPen.options.formFactor.pocket', 'Pocket', 'pocket'),
  ('fountain-pen-form-factor', 'desk', 'web.fountainPen.options.formFactor.desk', 'Desk', 'desk'),
  ('fountain-pen-cap-closure', 'screw', 'web.fountainPen.options.capClosure.screw', 'Screw', 'screw'),
  ('fountain-pen-cap-closure', 'snap', 'web.fountainPen.options.capClosure.snap', 'Slip / snap', 'slip / snap'),
  ('fountain-pen-cap-closure', 'magnetic', 'web.fountainPen.options.capClosure.magnetic', 'Magnetic', 'magnetic'),
  ('fountain-pen-cap-closure', 'bayonet', 'web.fountainPen.options.capClosure.bayonet', 'Bayonet', 'bayonet'),
  ('fountain-pen-cap-closure', 'capless', 'web.fountainPen.options.capClosure.capless', 'Capless', 'capless'),
  ('fountain-pen-nib-deployment', 'fixed', 'web.fountainPen.options.deployment.fixed', 'Fixed', 'fixed'),
  ('fountain-pen-nib-deployment', 'push-button', 'web.fountainPen.options.deployment.pushButton', 'Push-button', 'push-button'),
  ('fountain-pen-nib-deployment', 'twist', 'web.fountainPen.options.deployment.twist', 'Twist', 'twist'),
  ('fountain-pen-nib-deployment', 'bolt', 'web.fountainPen.options.deployment.bolt', 'Bolt', 'bolt'),
  ('fountain-pen-nib-deployment', 'hybrid', 'web.fountainPen.options.deployment.hybrid', 'Hybrid', 'hybrid')
ON CONFLICT (namespace, key) DO NOTHING;
