import { describe, expect, it } from "vitest";
import { getLegalDocument } from "./legal-content";

describe("legal content", () => {
  it("loads the English privacy policy with publication metadata", () => {
    const policy = getLegalDocument("privacy-policy");

    expect(policy.metadata).toMatchObject({
      effectiveDate: "2026-10-01",
      title: "Privacy Policy",
      version: "1.1",
    });
    expect(policy.body).toContain("complete account erasure");
    expect(policy.body).toContain("privacy@pocket-trash.app");
    expect(policy.body).toContain("rights@pocket-trash.app");
  });

  it("loads the English Terms of Service with publication metadata", () => {
    const terms = getLegalDocument("terms-of-service");

    expect(terms.metadata).toMatchObject({
      effectiveDate: "2026-10-01",
      title: "Terms of Service",
      version: "1.1",
    });
    expect(terms.body).toContain("You must be at least 13");
    expect(terms.body).toContain("[Privacy Policy](/privacy)");
    expect(terms.body).toContain("privacy@pocket-trash.app");
    expect(terms.body).toContain("rights@pocket-trash.app");
    expect(terms.body).toContain("property of their respective owners");
  });
});
