import type { AuditDeliveryFailure, AuditEventPage } from "@package/services";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { AdminPageShell } from "@/components/admin-page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type AuditExportState,
  type AuditSearch,
  auditCursor,
} from "@/lib/audit";
import { cn } from "@/lib/utils";
import { useLocale } from "@/providers/locale-provider";

type AuditEvent = AuditEventPage["items"][number];
type AuditState = NonNullable<AuditEvent["beforeState"]>;

/**
 * Renders searchable audit events and export controls for administrators.
 *
 * @param props - Audit page data and search state.
 * @param props.exportState - Current audit export state.
 * @param props.page - Current page of audit events.
 * @param props.search - Active audit search filters.
 * @returns The admin audit page.
 */
export function AdminAuditPage({
  deliveryFailures = [],
  exportState,
  page,
  search,
}: {
  /** Terminal audit-delivery failures requiring operational attention. */
  deliveryFailures?: AuditDeliveryFailure[];
  /** Current audit export state. */
  exportState: AuditExportState;
  /** Current page of audit events. */
  page: AuditEventPage;
  /** Active audit search filters. */
  search: AuditSearch;
}) {
  const { locale } = useLocale();
  const t = (key: TranslationKey, values: Record<string, unknown> = {}) =>
    formatTranslation(key, values, locale);
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
  });

  return (
    <AdminPageShell
      breadcrumbItems={[{ label: t("web.navigation.admin"), to: "/admin" }]}
      section="audit"
      title={t("web.admin.audit.title")}
    >
      <main className="grid w-full max-w-7xl gap-5 px-4 py-6 md:px-6">
        <p className="m-0 text-sm text-muted-foreground">
          {t("web.admin.audit.description")}
        </p>
        {deliveryFailures.length ? (
          <section
            aria-labelledby="audit-delivery-failures-title"
            className="grid gap-3 rounded-lg border border-destructive bg-card p-4"
          >
            <h2
              className="text-sm font-semibold"
              id="audit-delivery-failures-title"
            >
              {t("web.admin.notifications.title")}
            </h2>
            <ul className="grid gap-3">
              {deliveryFailures.map((failure) => (
                <li
                  className="grid gap-2 border-t border-border pt-3 first:border-0 first:pt-0"
                  key={`${failure.action}:${failure.requestId ?? failure.correlationId ?? failure.targetId}`}
                >
                  <dl className="grid gap-1 text-sm">
                    <div className="grid grid-cols-[8rem_1fr] gap-2">
                      <dt className="font-semibold">
                        {t("web.admin.audit.action")}
                      </dt>
                      <dd className="font-mono text-xs">{failure.action}</dd>
                    </div>
                    <div className="grid grid-cols-[8rem_1fr] gap-2">
                      <dt className="font-semibold">
                        {t("web.admin.audit.targetId")}
                      </dt>
                      <dd className="font-mono text-xs">{failure.targetId}</dd>
                    </div>
                    <div className="grid grid-cols-[8rem_1fr] gap-2">
                      <dt className="font-semibold">
                        {t("web.admin.audit.metadata")}
                      </dt>
                      <dd>
                        <pre className="m-0 whitespace-pre-wrap break-words text-xs">
                          {JSON.stringify(
                            {
                              attempts: failure.attempts,
                              correlationId: failure.correlationId,
                              errorCode: failure.errorCode,
                              requestId: failure.requestId,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {exportState.canExport ? (
          <section
            aria-labelledby="audit-export-title"
            className="grid gap-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="grid gap-1">
              <h2 className="text-sm font-semibold" id="audit-export-title">
                {t("web.admin.audit.exportTitle")}
              </h2>
              <p className="m-0 text-sm text-muted-foreground">
                {t("web.admin.audit.exportDescription")}
              </p>
            </div>
            {exportState.activeExport ? (
              <div className="grid gap-2 text-sm">
                <p className="m-0">
                  {t("web.admin.audit.exportSummary", {
                    count: new Intl.NumberFormat(locale).format(
                      exportState.activeExport.eventCount,
                    ),
                    cutoff: dateTime.format(exportState.activeExport.cutoffAt),
                    date: dateTime.format(
                      exportState.activeExport.highWaterRecordedAt,
                    ),
                  })}
                </p>
                <p className="m-0 text-muted-foreground">
                  <strong>{t("web.admin.audit.reason")}:</strong>{" "}
                  {exportState.activeExport.reason}
                </p>
                {exportState.activeExport.sha256 ? (
                  <p className="m-0 break-all font-mono text-xs text-muted-foreground">
                    <strong>SHA-256:</strong> {exportState.activeExport.sha256}
                  </p>
                ) : null}
                <form action="/admin/audit/export" method="post">
                  <input
                    name="exportId"
                    type="hidden"
                    value={exportState.activeExport.id}
                  />
                  <button className={buttonVariants()} type="submit">
                    {t("web.admin.audit.exportAction")}
                  </button>
                </form>
                {exportState.canDelete &&
                exportState.activeExport.completedAt &&
                exportState.activeExport.sha256 ? (
                  <form
                    action="/admin/audit/export"
                    className="grid gap-3 border-t border-border pt-3"
                    method="post"
                  >
                    <input
                      name="exportId"
                      type="hidden"
                      value={exportState.activeExport.id}
                    />
                    <input name="intent" type="hidden" value="delete" />
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        className="mt-0.5 size-4"
                        name="confirmed"
                        required
                        type="checkbox"
                        value="true"
                      />
                      <span>{t("web.admin.audit.deleteConfirmation")}</span>
                    </label>
                    <button
                      className={cn(
                        buttonVariants({ variant: "destructive" }),
                        "w-fit",
                      )}
                      type="submit"
                    >
                      {t("web.admin.audit.deleteAction")}
                    </button>
                  </form>
                ) : null}
              </div>
            ) : (
              <form
                action="/admin/audit/export"
                className="grid gap-3"
                method="post"
              >
                <label
                  className="grid gap-1.5 text-sm font-medium"
                  htmlFor="audit-export-reason"
                >
                  {t("web.admin.audit.reason")}
                  <Input
                    id="audit-export-reason"
                    maxLength={500}
                    name="reason"
                    placeholder={t("web.admin.audit.exportReasonPlaceholder")}
                    required
                  />
                </label>
                <button className={cn(buttonVariants(), "w-fit")} type="submit">
                  {t("web.admin.audit.exportAction")}
                </button>
              </form>
            )}
          </section>
        ) : null}
        <search aria-labelledby="audit-filters-title">
          <form>
            <fieldset className="grid gap-3 rounded-lg border border-border bg-card p-4">
              <legend
                className="px-1 text-sm font-semibold"
                id="audit-filters-title"
              >
                {t("web.archive.filters")}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <AuditFilter
                  defaultValue={search.actor}
                  id="audit-actor"
                  label={t("web.admin.audit.actorId")}
                  min={1}
                  name="actor"
                  type="number"
                />
                <AuditFilter
                  defaultValue={search.action}
                  id="audit-action"
                  label={t("web.admin.audit.action")}
                  maxLength={120}
                  name="action"
                />
                <AuditFilter
                  defaultValue={search.targetType}
                  id="audit-target-type"
                  label={t("web.admin.audit.targetType")}
                  maxLength={120}
                  name="targetType"
                />
                <AuditFilter
                  defaultValue={search.target}
                  id="audit-target"
                  label={t("web.admin.audit.targetId")}
                  maxLength={200}
                  name="target"
                />
                <AuditFilter
                  defaultValue={search.from}
                  id="audit-from"
                  label={t("web.admin.audit.fromDate")}
                  name="from"
                  type="date"
                />
                <AuditFilter
                  defaultValue={search.to}
                  id="audit-to"
                  label={t("web.admin.audit.toDate")}
                  name="to"
                  type="date"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button className={buttonVariants()} type="submit">
                  {t("web.action.search")}
                </button>
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  search={{}}
                  to="/admin/audit"
                >
                  {t("web.action.clearAllFilters")}
                </Link>
              </div>
            </fieldset>
          </form>
        </search>
        <div>
          <p className="m-0 text-xs text-muted-foreground">
            {t("web.admin.audit.coverage", {
              date: page.coverageStartAt
                ? dateTime.format(page.coverageStartAt)
                : t("web.admin.audit.noValue"),
            })}
            {" · "}
            {t("web.admin.audit.coveredDomains", {
              domains:
                page.coveredDomains.join(", ") || t("web.admin.audit.noValue"),
            })}
          </p>
        </div>
        {page.items.length ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-5xl border-collapse text-left text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  {[
                    "actor",
                    "action",
                    "target",
                    "owner",
                    "occurred",
                    "reason",
                    "details",
                  ].map((key) => (
                    <th
                      className="px-3 py-2 font-semibold"
                      key={key}
                      scope="col"
                    >
                      {t(
                        key === "details"
                          ? "web.resources.action.details"
                          : (`web.admin.audit.${key}` as TranslationKey),
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {page.items.map((event) => (
                  <tr
                    className="border-t border-border align-top"
                    key={event.id}
                  >
                    <td className="px-3 py-3">
                      {event.actorUserId === null &&
                      event.actorUsername === "Deleted user"
                        ? t("web.admin.audit.deletedUser")
                        : (event.actorUsername ?? event.actorRole)}
                      {event.actorUserId ? ` (#${event.actorUserId})` : null}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">
                      {event.action}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">
                      {event.targetType}
                      <br />
                      {event.targetId}
                    </td>
                    <td className="px-3 py-3">
                      {event.ownerUserId
                        ? `#${event.ownerUserId}`
                        : t("web.admin.audit.noValue")}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <time dateTime={event.occurredAt.toISOString()}>
                        {dateTime.format(event.occurredAt)}
                      </time>
                    </td>
                    <td className="max-w-64 px-3 py-3 break-words">
                      {event.reason ?? t("web.admin.audit.noValue")}
                    </td>
                    <td className="px-3 py-3">
                      <AuditEventDetails event={event} t={t} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p
            className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
            role="status"
          >
            {t("web.admin.audit.noEvents")}
          </p>
        )}
        {page.nextCursor ? (
          <Link
            className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
            search={{
              ...search,
              cursor: auditCursor(
                page.nextCursor.recordedAt,
                page.nextCursor.id,
              ),
            }}
            to="/admin/audit"
          >
            {t("web.admin.audit.olderEvents")}
          </Link>
        ) : null}
      </main>
    </AdminPageShell>
  );
}

function AuditFilter({
  label,
  id,
  ...props
}: React.ComponentProps<typeof Input> & { label: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium" htmlFor={id}>
      {label}
      <Input id={id} {...props} />
    </label>
  );
}

function AuditEventDetails({
  event,
  t,
}: {
  event: AuditEvent;
  t: (key: TranslationKey) => string;
}) {
  const keys = [
    ...new Set([
      ...Object.keys(event.beforeState ?? {}),
      ...Object.keys(event.afterState ?? {}),
    ]),
  ].sort();

  return (
    <details
      aria-label={t("web.resources.action.details")}
      className="min-w-72"
    >
      <summary className="cursor-pointer underline-offset-4 hover:underline">
        {t("web.resources.action.details")}
      </summary>
      {keys.length ? (
        <table className="mt-2 w-full table-fixed text-xs">
          <thead>
            <tr>
              <td aria-hidden="true" className="w-1/4 p-1" />
              <th className="p-1 text-left" scope="col">
                {t("web.admin.audit.before")}
              </th>
              <th className="p-1 text-left" scope="col">
                {t("web.admin.audit.after")}
              </th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr className="border-t border-border" key={key}>
                <th className="p-1 align-top font-mono font-medium" scope="row">
                  {key}
                </th>
                <AuditValue value={event.beforeState?.[key]} />
                <AuditValue value={event.afterState?.[key]} />
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {event.metadata ? (
        <div className="mt-2 border-t border-border pt-2">
          <strong className="text-xs">{t("web.admin.audit.metadata")}</strong>
          {Object.entries(event.metadata).map(([key, value]) => (
            <div
              className="mt-1 grid grid-cols-[minmax(5rem,auto)_1fr] gap-2 text-xs"
              key={key}
            >
              <code>{key}</code>
              <pre className="m-0 overflow-auto whitespace-pre-wrap break-words">
                {JSON.stringify(value, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      ) : null}
    </details>
  );
}

function AuditValue({ value }: { value: AuditState[string] | undefined }) {
  return (
    <td className="p-1 align-top">
      <pre className="m-0 overflow-auto whitespace-pre-wrap break-words">
        {value === undefined ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </td>
  );
}
