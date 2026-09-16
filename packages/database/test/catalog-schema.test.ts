import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { schema } from "../src/index";

describe("catalog schema", () => {
  it("exports generic products, shared materials, and nullable lookup fields", () => {
    const product = getTableConfig(schema.product);
    const productMaterial = getTableConfig(schema.productMaterial);
    const maker = getTableConfig(schema.maker);
    const productType = getTableConfig(schema.productType);

    expect(product.columns.map(({ name }) => name)).toEqual([
      "id",
      "product_type_id",
      "maker_id",
      "name",
      "slug",
    ]);
    expect(productMaterial.primaryKeys).toHaveLength(1);
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
      expect.arrayContaining(["compatible_button_id"]),
    );
    expect(spinnerColumns).not.toEqual(
      expect.arrayContaining(["name", "slug", "maker_id"]),
    );
  });
});
