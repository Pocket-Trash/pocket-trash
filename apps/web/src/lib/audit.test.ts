import { beforeEach, describe, expect, it, vi } from "vitest";

/** Permission-check spy controlling the actor authorized for an export. */
const requirePermission = vi.hoisted(() => vi.fn());
/** Export-creation spy used to verify requested audit ranges. */
const createExport = vi.hoisted(() => vi.fn());
/** Export-deletion spy used to verify confirmed administrator requests. */
const deleteExport = vi.hoisted(() => vi.fn());
/** Download spy supplying audit-export streams to the route. */
const downloadExport = vi.hoisted(() => vi.fn());

vi.mock("@/lib/authorization", () => ({
  getActor: vi.fn(),
  requirePermission,
}));
vi.mock("@/lib/services", () => ({
  s: {
    db: {
      audit: { createExport, deleteExport, downloadExport },
    },
  },
}));

import { handleAuditExportRequest } from "./audit";

/** Administrator fixture authorized to export audit events. */
const actor = { clerkId: "admin_123", role: "admin" } as const;

describe("audit export route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires export permission before creating a download", async () => {
    requirePermission.mockRejectedValueOnce(new Error("denied"));

    const response = await handleAuditExportRequest(
      request({ reason: "Incident review" }),
    );

    expect(response.status).toBe(400);
    expect(createExport).not.toHaveBeenCalled();
    expect(downloadExport).not.toHaveBeenCalled();
  });

  it("creates and returns a no-store attachment stream", async () => {
    requirePermission.mockResolvedValueOnce(actor);
    createExport.mockResolvedValueOnce({ id: "export-123" });
    downloadExport.mockResolvedValueOnce({
      body: new Blob(["exported"]).stream(),
      filename: "audit-export.json",
    });

    const response = await handleAuditExportRequest(
      request({ reason: "Incident review" }),
    );

    expect(createExport).toHaveBeenCalledWith({
      actor,
      reason: "Incident review",
    });
    expect(downloadExport).toHaveBeenCalledWith({
      actor,
      exportId: "export-123",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="audit-export.json"',
    );
    await expect(response.text()).resolves.toBe("exported");
  });

  it("repeats an existing export without creating a new range", async () => {
    requirePermission.mockResolvedValueOnce(actor);
    downloadExport.mockResolvedValueOnce({
      body: new Blob(["repeat"]).stream(),
      filename: "audit-export.json",
    });

    await handleAuditExportRequest(request({ exportId: "export-123" }));

    expect(createExport).not.toHaveBeenCalled();
    expect(downloadExport).toHaveBeenCalledWith({
      actor,
      exportId: "export-123",
    });
  });

  it("requires deletion permission and an explicit confirmation", async () => {
    const systemActor = {
      clerkId: "system-admin-123",
      role: "system_admin",
    } as const;
    requirePermission.mockResolvedValueOnce(systemActor);
    deleteExport.mockResolvedValueOnce(undefined);

    const response = await handleAuditExportRequest(
      request({
        confirmed: "true",
        exportId: "export-123",
        intent: "delete",
      }),
    );

    expect(requirePermission).toHaveBeenCalledWith("audit.delete");
    expect(deleteExport).toHaveBeenCalledWith({
      actor: systemActor,
      confirmed: true,
      exportId: "export-123",
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/admin/audit");
  });
});

/**
 * Builds an audit-export form request.
 *
 * @param fields - Form fields to include.
 * @returns A POST request containing the fields.
 */
function request(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new Request("https://example.com/admin/audit/export", {
    body: form,
    method: "POST",
  });
}
