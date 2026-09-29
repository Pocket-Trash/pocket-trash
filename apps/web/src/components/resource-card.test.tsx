import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ResourceCard, type ResourceCardItem } from "./resource-card";

vi.mock("@/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en-US" }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));

const resource = {
  canEdit: false,
  categories: [],
  coverImageUrl: null,
  createdAt: new Date("2026-09-16T12:00:00Z"),
  currentVersion: {
    fileCount: 1,
    fileId: 1002,
    fileName: "clip.stl",
    id: 1001,
    version: 1,
  },
  downloadCount: 4,
  id: 1000,
  isPrivate: false,
  name: "Pocket clip",
  privateReason: null,
  uploaderUsername: "roy",
} satisfies ResourceCardItem;

describe("resource card", () => {
  it("downloads one file directly and labels multi-file versions as ZIPs", () => {
    const single = renderToStaticMarkup(<ResourceCard resource={resource} />);
    const multiple = renderToStaticMarkup(
      <ResourceCard
        resource={{
          ...resource,
          currentVersion: { ...resource.currentVersion, fileCount: 2 },
        }}
      />,
    );

    expect(single).toContain(">Download</button>");
    expect(single).not.toContain("Download ZIP");
    expect(multiple).toContain("Download ZIP");
    expect(multiple).toContain("Downloads: 4");
  });
});
