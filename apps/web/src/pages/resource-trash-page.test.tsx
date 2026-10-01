import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  AdminResourceTrashPage,
  OwnerResourceTrashPage,
} from "./resource-trash-page";

vi.mock("@/components/admin-page-shell", () => ({
  /**
   * Renders a minimal admin shell for tests.
   *
   * @param props - Shell properties.
   * @param props.children - Nested page content.
   * @param props.title - Page title.
   * @returns The test shell.
   */
  AdminPageShell: ({
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

vi.mock("@/components/user-page-shell", () => ({
  /**
   * Renders a minimal user shell for tests.
   *
   * @param props - Shell properties.
   * @param props.children - Nested page content.
   * @param props.title - Page title.
   * @returns The test shell.
   */
  UserPageShell: ({
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
   * @returns Fixed English locale state.
   */
  useLocale: () => ({ locale: "en-US" }),
}));

describe("resource trash", () => {
  const deletedResource = {
    deletedAt: new Date("2026-09-18T12:00:00Z"),
    deletedByUsername: "admin",
    deletedByRole: "admin" as const,
    id: 1000,
    isPrivate: false,
    name: "Pocket clip",
    uploaderUsername: "roy",
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
    expect(ownerHtml).not.toContain("Deleted by admin");
    expect(adminHtml).toContain("Resource trash");
    expect(adminHtml).toContain("Deleted by admin");
    expect(adminHtml).toContain("Deleted by an admin");
    expect(adminHtml).toContain("Delete permanently");
    expect(adminHtml).toContain("Permanently delete resource");
    expect(adminHtml).toContain("This cannot be undone.");
  });
});
