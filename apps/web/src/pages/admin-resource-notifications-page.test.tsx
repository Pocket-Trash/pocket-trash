import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminResourceNotificationsPage } from "./admin-resource-notifications-page";

vi.mock("@/components/app-shell", () => ({
  /**
   * Renders a minimal application shell for tests.
   *
   * @param props - Shell properties.
   * @param props.children - Nested page content.
   * @param props.title - Page title.
   * @returns The test shell.
   */
  AppShell: ({
    children,
    title,
  }: {
    /** Nested page content. */
    children: ReactNode;
    /** Page title. */
    title: string;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns the fixed test locale.
   *
   * @returns Fixed English locale.
   */
  useLocale: () => ({ locale: "en-US" }),
}));

vi.mock("@clerk/tanstack-react-start", () => ({
  /**
   * Returns an authenticated administrator for tests.
   *
   * @returns Test authentication state.
   */
  useAuth: () => ({
    sessionClaims: { role: "admin" },
    userId: "user_admin",
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  /**
   * Renders router links as anchors for static markup tests.
   *
   * @param props - Link properties.
   * @param props.children - Linked content.
   * @param props.to - Route destination.
   * @returns A test anchor.
   */
  Link: ({
    children,
    to,
  }: {
    /** Linked content. */
    children: ReactNode;
    /** Route destination. */
    to: string;
  }) => <a href={to.replace("$resourceId", "1000")}>{children}</a>,
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
            readByUsername: null,
            resourceId: 1000,
            resourceName: "Pocket clip",
            type: "resource_created",
            uploaderUsername: "roy",
          },
          {
            categories: ["3D printing"],
            categoryName: "3D printing",
            createdAt,
            id: 1001,
            isPrivate: false,
            readAt: createdAt,
            readByUsername: "admin",
            resourceId: 1000,
            resourceName: "Pocket clip",
            type: "category_created",
            uploaderUsername: "roy",
          },
        ]}
      />,
    );

    expect(html).toContain("Resource created");
    expect(html).toContain("Category created");
    expect(html).toContain("Resource: Pocket clip");
    expect(html).toContain("Category: 3D printing");
    expect(html).toContain("Uploader: roy");
    expect(html).toContain("Mark private");
    expect(html).toContain("Reason for delisting");
    expect(html).toContain("Delist");
    expect(html).toContain('href="/resources/1000"');
    expect(html).toContain('href="/admin/trash/resources"');
  });
});
