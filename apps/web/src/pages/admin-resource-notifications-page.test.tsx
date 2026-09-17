import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminResourceNotificationsPage } from "./admin-resource-notifications-page";

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
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/resources/1000">{children}</a>
  ),
}));

describe("admin resource notifications", () => {
  it("renders resource and category notification details", () => {
    const createdAt = new Date("2026-09-16T12:00:00Z");
    const html = renderToStaticMarkup(
      <AdminResourceNotificationsPage
        initialNotifications={[
          {
            categories: ["3D printing"],
            categoryName: null,
            createdAt,
            id: 1000,
            isPrivate: false,
            readAt: null,
            readByClerkId: null,
            resourceId: 1000,
            resourceName: "Pocket clip",
            type: "resource_created",
            uploaderClerkId: "user_123",
          },
          {
            categories: ["3D printing"],
            categoryName: "3D printing",
            createdAt,
            id: 1001,
            isPrivate: false,
            readAt: createdAt,
            readByClerkId: "admin_123",
            resourceId: 1000,
            resourceName: "Pocket clip",
            type: "category_created",
            uploaderClerkId: "user_123",
          },
        ]}
      />,
    );

    expect(html).toContain("Resource created");
    expect(html).toContain("Category created");
    expect(html).toContain("Resource: Pocket clip");
    expect(html).toContain("Category: 3D printing");
    expect(html).toContain("Uploader: user_123");
    expect(html).toContain("Mark private");
    expect(html).toContain("Reason for delisting");
    expect(html).toContain("Delist");
    expect(html).toContain('href="/resources/1000"');
  });
});
