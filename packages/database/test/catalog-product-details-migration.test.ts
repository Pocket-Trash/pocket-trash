import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("catalog product details migration", () => {
  const migration = readFileSync(
    new URL("../drizzle/0030_nifty_madelyne_pryor.sql", import.meta.url),
    "utf8",
  );

  it("defaults existing maker product URLs to valid", () => {
    expect(migration).toContain(
      'ADD COLUMN "maker_product_url_valid" boolean DEFAULT true NOT NULL',
    );
  });

  it("limits descriptions and bearings", () => {
    expect(migration).toContain("product_description_length_valid");
    expect(migration).toContain("collection_item_description_length_valid");
    expect(migration).toContain("product_spinner_bearing_length_valid");
    expect(migration).toContain("collection_spinner_bearing_length_valid");
    expect(migration.match(/char_length/g)).toHaveLength(4);
  });
});
