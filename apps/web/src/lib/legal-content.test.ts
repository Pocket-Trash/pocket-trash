import { describe, expect, it } from "vitest";
import { getLegalDocument } from "./legal-content";

describe("legal content", () => {
  it("loads the English privacy policy with publication metadata", () => {
    const policy = getLegalDocument("privacy-policy");

    expect(policy.metadata).toMatchObject({
      effectiveDate: "2026-09-30",
      title: "Privacy Policy",
      version: "1.0",
    });
    expect(policy.body).toContain("complete account erasure");
    expect(policy.body).toContain("privacy@pocket-trash.app");
  });
});
