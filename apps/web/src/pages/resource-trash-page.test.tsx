import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  AdminResourceTrashPage,
  OwnerResourceTrashPage,
} from "./resource-trash-page";

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children, title }: { children: ReactNode; title: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/components/user-page-shell", () => ({
  UserPageShell: ({
    children,
    title,
  }: {
    children: ReactNode;
    title: string;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en-US" }),
}));

describe("resource trash", () => {
  const deletedResource = {
    deletedAt: new Date("2026-09-18T12:00:00Z"),
    deletedByClerkId: "admin_123",
    deletedByRole: "admin" as const,
    id: 1000,
    isPrivate: false,
    name: "Pocket clip",
    uploaderClerkId: "user_123",
  };

  it("shows owner restore controls and admin deletion attribution", () => {
    const ownerHtml = renderToStaticMarkup(
      <OwnerResourceTrashPage initialResources={[deletedResource]} />,
    );
    const adminHtml = renderToStaticMarkup(
      <AdminResourceTrashPage initialResources={[deletedResource]} />,
    );

    expect(ownerHtml).toContain("Your resource trash");
    expect(ownerHtml).toContain("Restore");
    expect(ownerHtml).not.toContain("Delete permanently");
    expect(ownerHtml).not.toContain("Deleted by admin_123");
    expect(adminHtml).toContain("Resource trash");
    expect(adminHtml).toContain("Deleted by admin_123");
    expect(adminHtml).toContain("Deleted by an admin");
    expect(adminHtml).toContain("Delete permanently");
    expect(adminHtml).toContain("Permanently delete resource");
    expect(adminHtml).toContain("This cannot be undone.");
  });
});
