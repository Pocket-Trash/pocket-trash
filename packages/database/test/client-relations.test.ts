import { describe, expect, it } from "vitest";
import { createDb } from "../src/client.js";

describe("v1 database relation configuration", () => {
  it("keeps every schema table queryable and resolves collection ownership", () => {
    const db = createDb({
      databaseUrl: "postgresql://test:test@localhost/neondb",
    });
    expect(db.query.auditEvent).toBeDefined();
    expect(db.query.productDetailSpinner).toBeDefined();
    const query = db.query.user
      .findMany({ with: { collectionItems: { columns: { id: true } } } })
      .toSQL();
    expect(query.sql).toContain('"owner_id"');
    expect(query.sql).not.toContain('"purchased_from_user_id"');
    expect(query.sql).not.toContain('"sold_to_user_id"');
  });
});
