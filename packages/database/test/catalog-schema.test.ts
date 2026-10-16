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
    const productLink = getTableConfig(schema.productLink);
    const productMaterial = getTableConfig(schema.productMaterial);
    const productMaterialComponent = getTableConfig(
      schema.productMaterialComponent,
    );
    const collectionItemMaterial = getTableConfig(
      schema.collectionItemMaterial,
    );
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
      "is_private",
      "private_reason",
      "privated_at",
      "privated_by_clerk_id",
      "created_at",
      "updated_at",
    ]);
    expect(schema.productMaterial.id.primary).toBe(true);
    expect(productMaterial.columns.map(({ name }) => name)).toEqual([
      "id",
      "product_id",
      "weight_value",
      "weight_unit",
    ]);
    expect(productMaterial.checks.map(({ name }) => name)).toContain(
      "product_material_weight_consistent",
    );
    expect(
      productMaterialComponent.uniqueConstraints.map(({ name }) => name),
    ).toContain("product_material_component_unique");
    expect(
      productMaterialComponent.indexes.map(({ config }) => config.name),
    ).toEqual(
      expect.arrayContaining([
        "product_material_component_assignment_id_idx",
        "product_material_component_material_id_idx",
      ]),
    );
    expect(
      productMaterialComponent.foreignKeys.map(({ reference }) =>
        reference().columns.map(({ name }) => name),
      ),
    ).toEqual(
      expect.arrayContaining([
        ["product_material_id"],
        ["material_id"],
        ["material_id", "material_specific_id"],
      ]),
    );
    expect(
      collectionItemMaterial.uniqueConstraints.map(({ name }) => name),
    ).toContain("collection_item_material_unique");
    expect(
      collectionItemMaterial.indexes.map(({ config }) => config.name),
    ).toEqual(
      expect.arrayContaining([
        "collection_item_material_item_id_idx",
        "collection_item_material_material_id_idx",
      ]),
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
      "material_image_scope_position_idx",
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
    expect(collectionItem.columns.map(({ name }) => name)).not.toEqual(
      expect.arrayContaining(["material_id", "material_specific_id"]),
    );
    expect(maker.columns.find(({ name }) => name === "root_url")?.notNull).toBe(
      false,
    );
    expect(productType.columns.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["image_url", "image_alt"]),
    );
    expect(
      productType.columns.find(({ name }) => name === "image_url")?.notNull,
    ).toBe(true);
    expect(
      productType.columns.find(({ name }) => name === "image_alt")?.notNull,
    ).toBe(true);
    expect(productType.checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "product_types_image_alt_valid",
        "product_types_image_url_valid",
      ]),
    );
    const spinnerColumns = getTableConfig(
      schema.productDetailSpinner,
    ).columns.map(({ name }) => name);
    expect(spinnerColumns).toEqual(
      expect.arrayContaining([
        "bearing",
        "compatible_button_id",
        "spin_diameter_unit",
        "spin_diameter_value",
      ]),
    );
    expect(spinnerColumns).not.toEqual(
      expect.arrayContaining(["name", "slug", "maker_id"]),
    );
    expect(
      collectionItem.columns.find(({ name }) => name === "description")
        ?.notNull,
    ).toBe(false);
    expect(productLink.columns.map(({ name }) => name)).toEqual([
      "id",
      "product_id",
      "position",
      "url",
      "is_valid",
      "created_at",
      "updated_at",
    ]);
    expect(
      productLink.columns.find(({ name }) => name === "is_valid")?.hasDefault,
    ).toBe(true);
    expect(productLink.checks.map(({ name }) => name)).toContain(
      "product_link_position_valid",
    );
    expect(productLink.uniqueConstraints.map(({ name }) => name)).toContain(
      "product_link_product_url_unique",
    );
    expect(productLink.indexes.map(({ config }) => config.name)).toContain(
      "product_link_product_position_idx",
    );
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
      getTableConfig(schema.collectionDetailSpinner).columns.map(
        ({ name }) => name,
      ),
    ).toEqual(expect.arrayContaining(["bearing"]));
  });

  it("models slider subtypes and exact inclusion without compatibility metadata", () => {
    const slider = getTableConfig(schema.productDetailSlider);
    const plate = getTableConfig(schema.productDetailSliderPlate);
    const insert = getTableConfig(schema.productDetailSliderInsert);
    const collectionDetailSlider = getTableConfig(
      schema.collectionDetailSlider,
    );
    const preset = getTableConfig(schema.sliderMagnetPreset);

    expect(slider.columns.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "id",
        "uses_inserts",
        "weight_unit",
        "weight_value",
        "length_unit",
        "length_value",
        "width_unit",
        "width_value",
        "thickness_unit",
        "thickness_value",
        "magnet_layout",
        "magnet_configuration",
        "included_plate_product_id",
        "included_insert_product_id",
      ]),
    );
    expect(slider.columns.map(({ name }) => name)).not.toContain(
      "weight_basis",
    );
    expect(slider.checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "product_detail_slider_insert_choice_consistent",
        "product_detail_slider_magnet_layout_consistent",
        "product_detail_slider_magnet_layout_valid",
        "product_detail_slider_included_insert_distinct",
        "product_detail_slider_length_consistent",
        "product_detail_slider_thickness_consistent",
        "product_detail_slider_weight_consistent",
        "product_detail_slider_width_consistent",
      ]),
    );
    expect(slider.checks.map(({ name }) => name)).not.toContain(
      "product_slider_weight_basis_consistent",
    );
    expect(plate.columns.map(({ name }) => name)).toEqual([
      "id",
      "created_at",
      "updated_at",
    ]);
    expect(insert.columns.map(({ name }) => name)).toEqual([
      "id",
      "magnet_layout",
      "created_at",
      "updated_at",
    ]);
    expect(collectionDetailSlider.columns.map(({ name }) => name)).toContain(
      "magnet_configuration",
    );
    expect(preset.columns.map(({ name }) => name)).toEqual([
      "id",
      "name",
      "normalized_name",
      "magnet_layout",
      "configuration",
      "created_at",
      "updated_at",
    ]);
    expect(preset.uniqueConstraints.map(({ name }) => name)).toContain(
      "slider_magnet_preset_normalized_name_unique",
    );
  });

  it("models standalone slider items and unique installed assemblies", () => {
    for (const table of [
      schema.collectionDetailSliderPlate,
      schema.collectionDetailSliderInsert,
    ]) {
      const config = getTableConfig(table);
      expect(config.columns.map(({ name }) => name)).toEqual(
        table === schema.collectionDetailSliderInsert
          ? ["id", "product_slider_insert_id"]
          : ["id", "product_slider_plate_id"],
      );
      expect(config.foreignKeys).toHaveLength(2);
    }
    const slider = getTableConfig(schema.collectionDetailSlider);
    expect(slider.columns.map(({ name }) => name)).toEqual([
      "id",
      "product_slider_id",
      "installed_plate_id",
      "installed_insert_id",
      "magnet_configuration",
    ]);
    expect(slider.foreignKeys).toHaveLength(4);
    expect(slider.indexes.map(({ config }) => config.name)).toEqual([
      "collection_detail_slider_installed_plate_unique",
      "collection_detail_slider_installed_insert_unique",
    ]);
  });
});
