import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ResourceDetailPage } from "./resource-detail-page";

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children, title }: { children: ReactNode; title: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en-US" }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to.replace("$resourceId", "1000")}>{children}</a>
  ),
}));

describe("resource detail", () => {
  it("renders private state, reason, and owner/admin edit action", () => {
    const createdAt = new Date("2026-09-16T12:00:00Z");
    const version = {
      createdAt,
      downloadCount: 0,
      files: [
        {
          contentType: "model/stl",
          downloadCount: 0,
          fileName: "clip.stl",
          id: 1002,
          size: 42,
        },
      ],
      id: 1001,
      version: 1,
    };
    const html = renderToStaticMarkup(
      <ResourceDetailPage
        detail={{
          canAdminister: false,
          canEdit: true,
          categories: [{ id: 1002, name: "3D printing", slug: "3d-printing" }],
          createdAt,
          currentVersion: version,
          description: "A useful clip.",
          downloadCount: 0,
          id: 1000,
          isAdminPrivate: true,
          isPrivate: true,
          isOwner: true,
          name: "Pocket clip",
          privateReason: "Inappropriate content",
          privatedAt: createdAt,
          previewImageUrl: null,
          uploaderClerkId: "user_123",
          versions: [version],
        }}
      />,
    );

    expect(html).toContain("Delisted");
    expect(html).toContain("Reason: Inappropriate content");
    expect(html).toContain("Edit");
    expect(html).toContain('href="/resources/1000/edit"');
    expect(html).not.toContain("Upload new version");
    expect(html).not.toContain('href="/resources/1000/versions/new"');
    expect(html).toContain("clip.stl");
    expect(html).not.toContain("File: clip.stl");
  });
});
