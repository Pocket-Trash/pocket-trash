import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PublicProfileAvatar,
  publicProfileImageUrl,
} from "./public-profile-avatar";

describe("public profile pictures", () => {
  it.each([
    ["sm", "45"],
    ["lg", "75"],
  ] as const)("requests a square 2x crop for %s avatars", (size, pixels) => {
    const url = publicProfileImageUrl(
      "https://img.clerk.com/picture?quality=90&width=999",
      size,
    );
    expect(url).toBe(
      `https://img.clerk.com/picture?quality=90&width=${pixels}&height=${pixels}&fit=crop`,
    );
  });
  it("preserves a decorative fallback when the picture is absent or invalid", () => {
    expect(publicProfileImageUrl(null, "sm")).toBeUndefined();
    expect(publicProfileImageUrl("invalid", "sm")).toBeUndefined();
    const html = renderToStaticMarkup(
      <PublicProfileAvatar imageUrl={null} username="collector" />,
    );
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-slot="avatar-fallback"');
    expect(html).toContain("C");
    expect(html).not.toContain("<img");
  });
});
