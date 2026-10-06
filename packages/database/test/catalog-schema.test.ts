import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { schema } from "../src/index";

describe("catalog schema", () => {
  it("exports generic products, shared materials, optional appearances, and reusable patterns", () => {
    const collectionItem = getTableConfig(schema.collectionItem);
    expect(schema.collectionItem.approvalStatus.default).toBe("pending");
    expect(collectionItem.checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "collection_item_approval_status_valid",
        "collection_item_approval_decision_metadata_consistent",
        "collection_item_approval_reason_valid",
      ]),
    );
    const product = getTableConfig(schema.product);
    const productMaterial = getTableConfig(schema.productMaterial);
    const material = getTableConfig(schema.material);
    const materialImage = getTableConfig(schema.materialImage);
    const maker = getTableConfig(schema.maker);
    const productType = getTableConfig(schema.productType);
    const finishOption = getTableConfig(schema.finishOption);
    const color = getTableConfig(schema.color);
    const pattern = getTableConfig(schema.pattern);

    expect(product.columns.map(({ name }) => name)).toEqual([
      "id",
      "product_type_id",
      "maker_id",
      "owner_clerk_id",
      "name",
      "slug",
      "description",
      "approval_status",
      "approval_decision_reason",
      "approval_decided_at",
      "maker_product_url",
      "maker_product_url_valid",
      "is_private",
      "private_reason",
      "privated_at",
      "privated_by_clerk_id",
      "created_at",
      "updated_at",
    ]);
    expect(productMaterial.primaryKeys).toHaveLength(1);
    expect(productMaterial.indexes.map(({ config }) => config.name)).toContain(
      "product_material_material_id_idx",
    );
    expect(
      material.columns.find(({ name }) => name === "description")?.notNull,
    ).toBe(false);
    expect(material.checks.map(({ name }) => name)).toContain(
      "materials_description_length_valid",
    );
    expect(materialImage.columns.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "material_id",
        "position",
        "sha256",
        "object_path",
        "uploaded_by_clerk_id",
        "deleted_at",
        "deleted_by_clerk_id",
        "deleted_by_role",
      ]),
    );
    expect(materialImage.indexes.map(({ config }) => config.name)).toContain(
      "material_image_material_id_idx",
    );
    expect(color.columns.find(({ name }) => name === "hex")?.notNull).toBe(
      true,
    );
    expect(
      finishOption.foreignKeys.find(({ reference }) =>
        reference().columns.some(
          ({ name }) => name === "source_product_finish_option_id",
        ),
      )?.onDelete,
    ).toBe("set null");
    expect(
      finishOption.columns.find(({ name }) => name === "pattern_id")?.notNull,
    ).toBe(false);
    expect(
      finishOption.foreignKeys.find(({ reference }) =>
        reference().columns.some(({ name }) => name === "pattern_id"),
      )?.onDelete,
    ).toBe("restrict");
    expect(pattern.uniqueConstraints).toHaveLength(0);
    expect(pattern.indexes.map(({ config }) => config.name)).toEqual(
      expect.arrayContaining([
        "pattern_name_case_insensitive_unique",
        "pattern_slug_unique",
      ]),
    );
    expect(
      collectionItem.columns.find(({ name }) => name === "material_id")
        ?.notNull,
    ).toBe(false);
    expect(maker.columns.find(({ name }) => name === "root_url")?.notNull).toBe(
      false,
    );
    expect(productType.columns.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["image_url", "image_alt"]),
    );
    const spinnerColumns = getTableConfig(schema.productSpinner).columns.map(
      ({ name }) => name,
    );
    expect(spinnerColumns).toEqual(
      expect.arrayContaining([
        "bearing",
        "compatible_button_id",
        "spin_diameter_mm",
      ]),
    );
    expect(spinnerColumns).not.toEqual(
      expect.arrayContaining(["name", "slug", "maker_id"]),
    );
    expect(
      collectionItem.columns.find(({ name }) => name === "description")
        ?.notNull,
    ).toBe(false);
    expect(collectionItem.indexes.map(({ config }) => config.name)).toContain(
      "collection_item_material_public_idx",
    );
    expect(
      product.columns.find(({ name }) => name === "maker_product_url_valid")
        ?.hasDefault,
    ).toBe(true);
    expect(
      product.columns.find(({ name }) => name === "approval_status")
        ?.hasDefault,
    ).toBe(true);
    expect(product.checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "product_approval_status_valid",
        "product_approval_decision_metadata_consistent",
        "product_approval_reason_valid",
      ]),
    );
    expect(
      getTableConfig(schema.collectionSpinner).columns.map(({ name }) => name),
    ).toEqual(expect.arrayContaining(["bearing"]));
  });

  it("models slider subtypes, reviewed compatibility, and exact inclusion separately", () => {
    const slider = getTableConfig(schema.productSlider);
    const plate = getTableConfig(schema.productSliderPlate);
    const insert = getTableConfig(schema.productSliderInsert);
    const family = getTableConfig(schema.compatibilityFamily);
    const membership = getTableConfig(schema.productCompatibilityFamily);
    const advisory = getTableConfig(schema.productCompatibilityAdvisory);
    const inclusion = getTableConfig(schema.productIncludedComponent);
    const configuration = getTableConfig(schema.productMagnetConfiguration);
    const magnetGroup = getTableConfig(schema.productMagnetGroup);
    const magnetSlot = getTableConfig(schema.productMagnetSlot);
    const clickOption = getTableConfig(schema.productInsertClickOption);
    const insertOffer = getTableConfig(schema.productInsertMagnetOffer);
    const insertOfferGroup = getTableConfig(schema.productInsertMagnetGroup);
    const insertOfferSlot = getTableConfig(schema.productInsertMagnetSlot);
    const template = getTableConfig(schema.magnetConfigurationTemplate);
    const sliderOffer = getTableConfig(schema.productSliderInsertOffer);

    expect(slider.columns.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "id",
        "magnet_system",
        "weight_g",
        "weight_basis",
        "length_mm",
        "width_mm",
        "thickness_mm",
        "inherent_click_count",
        "magnet_setup_source_note",
      ]),
    );
    expect(slider.checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "product_slider_magnet_system_valid",
        "product_slider_weight_basis_consistent",
        "product_slider_measurements_positive",
      ]),
    );
    for (const subtype of [plate, insert]) {
      expect(subtype.columns.map(({ name }) => name)).toEqual(
        expect.arrayContaining([
          "id",
          "weight_g",
          "length_mm",
          "width_mm",
          "thickness_mm",
        ]),
      );
    }
    expect(family.columns.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["maker_id", "name", "slug"]),
    );
    expect(family.indexes.map(({ config }) => config.name)).toEqual(
      expect.arrayContaining([
        "compatibility_family_maker_name_unique",
        "compatibility_family_maker_slug_unique",
      ]),
    );
    expect(membership.primaryKeys).toHaveLength(1);
    expect(advisory.columns.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "product_id",
        "related_product_id",
        "text",
        "reviewed_at",
        "reviewed_by_clerk_id",
      ]),
    );
    expect(inclusion.primaryKeys).toHaveLength(1);
    expect(configuration.columns.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "product_id",
        "configuration_label_id",
        "source_label",
        "source_notes",
      ]),
    );
    expect(magnetGroup.columns.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "configuration_product_id",
        "group_key",
        "diameter_mm",
        "thickness_mm",
        "grade",
        "display_order",
      ]),
    );
    expect(magnetSlot.columns.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "configuration_product_id",
        "slot_key",
        "half",
        "state",
        "group_id",
        "documented_row",
        "documented_column",
        "display_order",
      ]),
    );
    expect(magnetSlot.columns.map(({ name }) => name)).not.toEqual(
      expect.arrayContaining(["polarity", "x", "y", "x_mm", "y_mm"]),
    );
    expect(clickOption.columns.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "id",
        "insert_product_id",
        "click_count",
        "insertion_position",
      ]),
    );
    expect(clickOption.checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "product_insert_click_option_click_count_positive",
        "product_insert_click_option_position_nonnegative",
      ]),
    );
    expect(insertOffer.columns.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "id",
        "insert_product_id",
        "configuration_label_id",
        "click_option_id",
        "is_advertised_default",
        "copied_from_template_id",
      ]),
    );
    expect(insertOffer.indexes.map(({ config }) => config.name)).toContain(
      "product_insert_magnet_offer_advertised_default_unique",
    );
    expect(insertOfferGroup.columns.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "offer_id",
        "group_key",
        "diameter_mm",
        "thickness_mm",
        "grade",
      ]),
    );
    expect(insertOfferSlot.columns.map(({ name }) => name)).not.toEqual(
      expect.arrayContaining(["polarity", "x", "y", "x_mm", "y_mm"]),
    );
    expect(template.columns.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "name",
        "scope",
        "maker_id",
        "compatibility_family_id",
        "configuration",
      ]),
    );
    expect(sliderOffer.columns.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "slider_product_id",
        "insert_offer_id",
        "insert_product_id",
        "is_advertised_default",
      ]),
    );
    expect(sliderOffer.indexes.map(({ config }) => config.name)).toContain(
      "product_slider_insert_offer_advertised_default_unique",
    );
    expect(
      inclusion.foreignKeys.map(
        ({ reference }) => reference().foreignColumns[0]?.name,
      ),
    ).toEqual(["id", "id"]);
  });

  it("models standalone slider items and unique installed assemblies", () => {
    for (const table of [
      schema.collectionSliderPlate,
      schema.collectionSliderInsert,
    ]) {
      const config = getTableConfig(table);
      expect(config.columns.map(({ name }) => name)).toEqual([
        "id",
        expect.stringMatching(/^product_slider(?:_plate|_insert)?_id$/u),
      ]);
      expect(config.foreignKeys).toHaveLength(2);
    }
    const slider = getTableConfig(schema.collectionSlider);
    expect(slider.columns.map(({ name }) => name)).toEqual([
      "id",
      "product_slider_id",
      "installed_plate_id",
      "installed_insert_id",
    ]);
    expect(slider.foreignKeys).toHaveLength(4);
    expect(slider.indexes.map(({ config }) => config.name)).toEqual([
      "collection_slider_installed_plate_unique",
      "collection_slider_installed_insert_unique",
    ]);
  });
});
