import { describe, expect, it } from "vitest";
import {
  hasPermission,
  hasStaffPermission,
  normalizeActor,
} from "./authorization.js";

describe("authorization", () => {
  it("maps Clerk roles to fixed permissions and fails closed", () => {
    const editor = normalizeActor("editor", { role: "editor" });
    const admin = normalizeActor("admin", { role: "admin" });
    const systemAdmin = normalizeActor("system", { role: "system_admin" });

    expect(hasPermission(editor, "collections.manage")).toBe(true);
    expect(hasPermission(editor, "feedback.manage")).toBe(false);
    expect(hasPermission(admin, "audit.export")).toBe(true);
    expect(hasPermission(admin, "accounts.erase")).toBe(false);
    expect(hasPermission(systemAdmin, "audit.delete")).toBe(true);
    expect(
      hasPermission(
        normalizeActor("unknown", { role: "owner" }),
        "products.manage",
      ),
    ).toBe(false);
    expect(
      hasPermission(normalizeActor("missing", {}), "products.manage"),
    ).toBe(false);
    expect(hasStaffPermission(editor)).toBe(true);
  });
});
