import type { AuditExportView } from "@package/services";
import { hasPermission } from "@package/services/authorization";
import { formatTranslation } from "@pocket-trash/localizations";
import { createServerFn } from "@tanstack/react-start";
import { getActor, requirePermission } from "@/lib/authorization";
import { localizedServerError } from "@/lib/server-errors";

export type AuditSearch = {
  action?: string;
  actor?: number;
  cursor?: string;
  from?: string;
  target?: string;
  targetType?: string;
  to?: string;
};

/** Audit-export state displayed on the admin audit page. */
export type AuditExportState = {
  /** The unconsumed export range, when one exists. */
  activeExport: AuditExportView | null;
  /** Whether the current actor may delete a completed export range. */
  canDelete: boolean;
  /** Whether the current actor may create or download exports. */
  canExport: boolean;
};

export const canReadAudit = createServerFn().handler(async () => {
  return hasPermission(await getActor(), "audit.read");
});

/** Lists filtered audit events for an authorized administrator. */
const listAdminAuditEvents = createServerFn({ method: "GET" })
  .validator(parseAuditListInput)
  .handler(async ({ data }) => {
    const actor = await requirePermission("audit.read");
    const { s } = await import("@/lib/services");
    return await s.db.audit.list({
      action: data.action,
      actor,
      actorUserId: data.actor,
      cursor: data.cursor,
      recordedFrom: data.from,
      recordedTo: data.to,
      targetId: data.target,
      targetType: data.targetType,
    });
  });

export { listAdminAuditEvents };

/** Loads the active audit export for an authorized administrator. */
const getAdminAuditExport = createServerFn({ method: "GET" }).handler(
  async () => {
    const actor = await requirePermission("audit.read");
    if (!hasPermission(actor, "audit.export")) {
      return {
        activeExport: null,
        canDelete: false,
        canExport: false,
      } as const;
    }
    const { s } = await import("@/lib/services");
    return {
      activeExport: await s.db.audit.getActiveExport(actor),
      canDelete: hasPermission(actor, "audit.delete"),
      canExport: true,
    } as const;
  },
);

export { getAdminAuditExport };

/**
 * Creates or repeats an audit export download.
 *
 * @param request - Export form request.
 * @returns Download response or a localized error response.
 */
export async function handleAuditExportRequest(request: Request) {
  try {
    const form = await request.formData();
    if (formString(form.get("intent")) === "delete") {
      const actor = await requirePermission("audit.delete");
      const { s } = await import("@/lib/services");
      await s.db.audit.deleteExport({
        actor,
        confirmed: formString(form.get("confirmed")) === "true",
        exportId: formString(form.get("exportId")),
      });
      return new Response(null, {
        headers: { Location: "/admin/audit" },
        status: 303,
      });
    }

    const actor = await requirePermission("audit.export");
    const exportId = formString(form.get("exportId"));
    const { s } = await import("@/lib/services");
    const record = exportId
      ? { id: exportId }
      : await s.db.audit.createExport({
          actor,
          reason: formString(form.get("reason")),
        });
    const download = await s.db.audit.downloadExport({
      actor,
      exportId: record.id,
    });
    return new Response(download.body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${download.filename}"`,
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(formatTranslation("error.generic"), { status: 400 });
  }
}

export function parseAuditSearch(search: Record<string, unknown>): AuditSearch {
  return {
    action: searchString(search.action, 120),
    actor: searchInteger(search.actor),
    cursor: searchCursor(search.cursor),
    from: searchDate(search.from),
    target: searchString(search.target, 200),
    targetType: searchString(search.targetType, 120),
    to: searchDate(search.to),
  };
}

export function auditCursor(recordedAt: Date, id: number) {
  return `${recordedAt.toISOString()}|${id}`;
}

function parseAuditListInput(input: unknown) {
  if (typeof input !== "object" || input === null) throw invalidAuditRequest();
  const value = input as Record<string, unknown>;
  const search = parseAuditSearch(value);
  for (const key of Object.keys(value)) {
    if (
      !(key in search) ||
      (value[key] !== undefined &&
        search[key as keyof AuditSearch] === undefined)
    ) {
      throw invalidAuditRequest();
    }
  }
  return {
    action: search.action,
    actor: search.actor,
    cursor: search.cursor ? parseCursor(search.cursor) : undefined,
    from: search.from ? new Date(`${search.from}T00:00:00.000Z`) : undefined,
    target: search.target,
    targetType: search.targetType,
    to: search.to ? new Date(`${search.to}T23:59:59.999Z`) : undefined,
  };
}

function searchString(value: unknown, maximum: number) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= maximum ? normalized : undefined;
}

function searchInteger(value: unknown) {
  if (typeof value === "string" && !/^[1-9]\d*$/u.test(value)) {
    return undefined;
  }
  const number = typeof value === "string" ? Number(value) : value;
  return Number.isSafeInteger(number) && Number(number) > 0
    ? Number(number)
    : undefined;
}

function searchDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return undefined;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
    ? value
    : undefined;
}

function searchCursor(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    parseCursor(value);
    return value;
  } catch {
    return undefined;
  }
}

/**
 * Parses a serialized audit pagination cursor.
 *
 * @param value - Serialized cursor value.
 * @returns Parsed cursor fields.
 * @throws When the cursor is malformed.
 */
function parseCursor(value: string) {
  const separator = value.lastIndexOf("|");
  const recordedAtText = value.slice(0, separator);
  const recordedAt = new Date(recordedAtText);
  const id = Number(value.slice(separator + 1));
  if (
    separator < 1 ||
    Number.isNaN(recordedAt.getTime()) ||
    recordedAt.toISOString() !== recordedAtText ||
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    throw invalidAuditRequest();
  }
  return { id, recordedAt };
}

function invalidAuditRequest() {
  return localizedServerError("error.generic");
}

/**
 * Reads a string form value.
 *
 * @param value - Form entry to normalize.
 * @returns The string value, or an empty string for files and missing entries.
 */
function formString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}
