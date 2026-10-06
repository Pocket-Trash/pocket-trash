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
});
