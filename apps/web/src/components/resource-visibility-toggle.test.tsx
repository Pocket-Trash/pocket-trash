import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ResourceVisibilityToggle } from "./resource-visibility-toggle";

vi.mock("@/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en-US" }),
}));

describe("resource visibility toggle", () => {
  it("does not add conflicting form validation when rendered inside an edit form", () => {
    const html = renderToStaticMarkup(
      <form>
        <ResourceVisibilityToggle
          canAdminister
          isAdminPrivate={false}
          isOwner
          isPrivate={false}
          name="Test resource"
          resourceId={1001}
        />
      </form>,
    );

    expect(html).not.toMatch(/<form[\s\S]*<form/);
    expect(html).not.toContain("required");
  });
});
