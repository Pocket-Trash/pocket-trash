import { Pool } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";
import { createDb } from "./client.js";

describe("database client", () => {
  it("uses the transaction-capable Neon pool", async () => {
    const db = createDb({
      databaseUrl: "postgres://user:password@example.com/pocket_trash",
    });

    expect(db.$client).toBeInstanceOf(Pool);
    await db.$client.end();
  });
});
