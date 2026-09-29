import type {
  AdminFeedbackSort,
  ListAdminFeedbackOptions,
} from "@package/services";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  approveFeedback,
  denyFeedback,
  listAdminActiveFeedback,
  listArchivedFeedback,
  type listFeedbackArchiveStatuses,
  listFeedbackMergeTargets,
  listPendingFeedback,
  mergePendingFeedback,
  updateAdminFeedback,
} from "@/lib/feedback";
import { feedbackCategories, feedbackCategoryKey } from "@/lib/feedback-shared";
import { useLocale } from "@/providers/locale-provider";

type Scope = "active" | "archive" | "pending";
type Page = Awaited<ReturnType<typeof listPendingFeedback>>;
type Item = Page["items"][number];
type MergeTarget = Awaited<ReturnType<typeof listFeedbackMergeTargets>>[number];
type Sort = AdminFeedbackSort;
type SortField = Sort["field"];

const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, Item>();
type ArchiveStatus = NonNullable<ListAdminFeedbackOptions["statuses"]>[number];
type ArchiveStatuses = Awaited<ReturnType<typeof listFeedbackArchiveStatuses>>;

export function AdminFeedbackRequestsPage({
  initialPage,
  mergeTargets,
}: {
  initialPage: Page;
  mergeTargets: MergeTarget[];
}) {
  return (
    <AdminFeedbackPage
      initialPage={initialPage}
      mergeTargets={mergeTargets}
      scope="pending"
    />
  );
}

export function AdminActiveFeedbackPage({
  initialPage,
}: {
  initialPage: Page;
}) {
  return <AdminFeedbackPage initialPage={initialPage} scope="active" />;
}

export function AdminFeedbackArchivePage({
  archiveStatuses,
  initialPage,
}: {
  archiveStatuses: ArchiveStatuses;
  initialPage: Page;
}) {
  return (
    <AdminFeedbackPage
      archiveStatuses={archiveStatuses}
      initialPage={initialPage}
      scope="archive"
    />
  );
}

function AdminFeedbackPage({
  archiveStatuses = [],
  initialPage,
  mergeTargets = [],
  scope,
}: {
  archiveStatuses?: ArchiveStatuses;
  initialPage: Page;
  mergeTargets?: MergeTarget[];
  scope: Scope;
}) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [targets, setTargets] = useState(mergeTargets);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Item>();
  const [sort, setSort] = useState<Sort[]>([]);
  const [status, setStatus] = useState<ArchiveStatus | "">("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { locale } = useLocale();
  const t = useCopy();

  useEffect(() => {
    if (selected && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [selected]);

  useEffect(() => () => clearTimeout(searchTimerRef.current), []);

  async function load(
    nextOffset: number,
    nextSort = sort,
    nextStatus = status,
    nextSearch = search,
  ) {
    clearTimeout(searchTimerRef.current);
    setError(false);
    setLoading(true);
    try {
      const data = { offset: nextOffset, search: nextSearch, sort: nextSort };
      setPage(
        scope === "pending"
          ? await listPendingFeedback({ data })
          : scope === "active"
            ? await listAdminActiveFeedback({ data })
            : await listArchivedFeedback({
                data: {
                  ...data,
                  statuses: nextStatus ? [nextStatus] : [],
                },
              }),
      );
      setOffset(nextOffset);
      setSort(nextSort);
      setStatus(nextStatus);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function open(item: Item, opener: HTMLElement) {
    openerRef.current = opener;
    setSelected(item);
  }

  function changeSort(field: SortField) {
    const current = sort.find(
      ({ field: sortedField }) => sortedField === field,
    );
    const next: Sort[] = current
      ? current.direction === "asc"
        ? sort.map((entry) =>
            entry.field === field
              ? { ...entry, direction: "desc" as const }
              : entry,
          )
        : sort.filter(({ field: sortedField }) => sortedField !== field)
      : [
          ...(scope === "pending" ? [] : sort.slice(-1)),
          { direction: "asc" as const, field },
        ];
    void load(0, next);
  }

  const columns = useMemo(() => {
    const title = columnHelper.accessor("title", {
      cell: ({ row }) => (
        <button
          aria-label={t("web.feedback.admin.requests.detailsOpen", {
            title: row.original.title,
          })}
          className="text-left font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(event) => open(row.original, event.currentTarget)}
          type="button"
        >
          {row.original.title}
        </button>
      ),
      header: () => (
        <SortButton field="title" onChange={changeSort} sort={sort}>
          {t("web.feedback.admin.table.title")}
        </SortButton>
      ),
    });
    const category = columnHelper.accessor("category", {
      cell: ({ row }) =>
        row.original.category
          ? t(feedbackCategoryKey(row.original.category))
          : t("web.feedback.category.unset"),
      header: () => (
        <SortButton field="category" onChange={changeSort} sort={sort}>
          {t("web.feedback.admin.table.category")}
        </SortButton>
      ),
    });
    const submitter = columnHelper.accessor("submitterUsername", {
      cell: ({ row }) => row.original.submitterUsername ?? "",
      header: () => (
        <SortButton field="submitter" onChange={changeSort} sort={sort}>
          {t("web.feedback.admin.table.submitter")}
        </SortButton>
      ),
      id: "submitter",
    });
    if (scope === "pending") {
      return columnHelper.columns([
        title,
        category,
        submitter,
        columnHelper.accessor("createdAt", {
          cell: ({ row }) => formatDate(row.original.createdAt, locale),
          header: () => (
            <SortButton field="submitted" onChange={changeSort} sort={sort}>
              {t("web.feedback.admin.table.submitted")}
            </SortButton>
          ),
          id: "submitted",
        }),
      ]);
    }
    const statusColumn = columnHelper.accessor("status", {
      cell: ({ row }) => t(statusKey(row.original.status)),
      header: () => (
        <SortButton field="status" onChange={changeSort} sort={sort}>
          {t("web.feedback.admin.table.status")}
        </SortButton>
      ),
    });
    if (scope === "archive") {
      return columnHelper.columns([title, statusColumn, category, submitter]);
    }
    return columnHelper.columns([
      title,
      statusColumn,
      category,
      columnHelper.accessor("voteCount", {
        cell: ({ row }) => row.original.voteCount,
        header: () => (
          <SortButton field="votes" onChange={changeSort} sort={sort}>
            {t("web.feedback.admin.table.votes")}
          </SortButton>
        ),
        id: "votes",
      }),
      submitter,
      columnHelper.accessor("updatedAt", {
        cell: ({ row }) =>
          formatDate(row.original.updatedAt ?? row.original.createdAt, locale),
        header: () => (
          <SortButton field="updated" onChange={changeSort} sort={sort}>
            {t("web.feedback.admin.table.updated")}
          </SortButton>
        ),
        id: "updated",
      }),
    ]);
  }, [locale, scope, search, sort, status, t]);
  const table = useTable({ columns, data: page.items, features });
  const copyScope = scope === "pending" ? "requests" : scope;

  return (
    <AppShell title={t(`web.feedback.admin.${copyScope}.title`)}>
      <main
        aria-busy={loading}
        className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-6 md:px-6"
      >
        <AdminFeedbackNav />
        {scope !== "pending" ? (
          <search>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void load(0);
              }}
            >
              <label className="sr-only" htmlFor={`${scope}-feedback-search`}>
                {t(`web.feedback.admin.${scope}.searchLabel`)}
              </label>
              <Input
                className="min-w-56 flex-1"
                id={`${scope}-feedback-search`}
                maxLength={120}
                onChange={(event) => {
                  const nextSearch = event.target.value;
                  setSearch(nextSearch);
                  searchTimerRef.current = scheduleAdminSearch(
                    searchTimerRef.current,
                    () => void load(0, sort, status, nextSearch),
                  );
                }}
                placeholder={t(`web.feedback.admin.${scope}.searchPlaceholder`)}
                type="search"
                value={search}
              />
              {scope === "archive" ? (
                <select
                  aria-label={t("web.feedback.admin.archive.statusLabel")}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  onChange={(event) => {
                    const nextStatus = archiveStatuses.find(
                      (value) => value === event.target.value,
                    );
                    void load(0, sort, nextStatus ?? "");
                  }}
                  value={status}
                >
                  <option value="">
                    {t("web.feedback.admin.archive.allStatuses")}
                  </option>
                  {archiveStatuses.map((value) => (
                    <option key={value} value={value}>
                      {t(statusKey(value))}
                    </option>
                  ))}
                </select>
              ) : null}
              <Button disabled={loading} type="submit" variant="outline">
                <Search aria-hidden="true" />
                {t("web.action.search")}
              </Button>
            </form>
          </search>
        ) : null}
        {loading ? (
          <p aria-live="polite" className="m-0 text-sm text-muted-foreground">
            {t(`web.feedback.admin.${copyScope}.loading`)}
          </p>
        ) : null}
        {error ? (
          <p className="m-0 text-sm text-destructive" role="alert">
            {t(`web.feedback.admin.${copyScope}.error`)}
          </p>
        ) : null}
        {!loading && !error && page.items.length === 0 ? (
          <p className="m-0 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {t(
              scope === "archive" && (search || status)
                ? "web.feedback.admin.archive.noResults"
                : `web.feedback.admin.${copyScope}.empty`,
            )}
          </p>
        ) : null}
        {page.items.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-card text-card-foreground">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted/50">
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => (
                      <th
                        aria-sort={sortDirection(sort, header.column.id)}
                        className="whitespace-nowrap border-b border-border px-3 py-2 text-left font-medium"
                        key={header.id}
                        scope="col"
                      >
                        {header.isPlaceholder ? null : (
                          <table.FlexRender header={header} />
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    className="border-b border-border last:border-0"
                    key={row.id}
                  >
                    {row.getAllCells().map((cell) => (
                      <td className="px-3 py-3 align-top" key={cell.id}>
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {offset > 0 || page.hasNext ? (
          <nav
            aria-label={`${t(`web.feedback.admin.${copyScope}.title`)}: ${t(
              `web.feedback.admin.${copyScope}.nextPage`,
            )}`}
            className="flex justify-between gap-3"
          >
            <Button
              disabled={loading || offset === 0}
              onClick={() => void load(Math.max(0, offset - 30))}
              type="button"
              variant="outline"
            >
              {t(`web.feedback.admin.${copyScope}.previousPage`)}
            </Button>
            <Button
              disabled={loading || !page.hasNext}
              onClick={() => void load(offset + 30)}
              type="button"
              variant="outline"
            >
              {t(`web.feedback.admin.${copyScope}.nextPage`)}
            </Button>
          </nav>
        ) : null}
      </main>
      <AdminFeedbackDialog
        dialogRef={dialogRef}
        item={selected}
        mergeTargets={targets}
        onChanged={async () => {
          dialogRef.current?.close();
          const [, nextTargets] = await Promise.all([
            load(offset),
            scope === "pending"
              ? listFeedbackMergeTargets()
              : Promise.resolve(targets),
          ]);
          setTargets(nextTargets);
        }}
        onClosed={() => {
          setSelected(undefined);
          openerRef.current?.focus();
        }}
      />
    </AppShell>
  );
}

function AdminFeedbackDialog({
  dialogRef,
  item,
  mergeTargets,
  onChanged,
  onClosed,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  item?: Item;
  mergeTargets: MergeTarget[];
  onChanged: () => Promise<void>;
  onClosed: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const t = useCopy();
  if (!item) return <dialog ref={dialogRef} />;
  const current = item;
  const editable = !["merged", "denied", "canceled"].includes(current.status);

  async function act(
    action: "approve" | "deny" | "merge",
    form?: HTMLFormElement,
  ) {
    setSaving(true);
    try {
      if (action === "approve") {
        if (!current.category) {
          toast.error(t("web.feedback.admin.requests.categoryRequired"));
          setEditing(true);
          return;
        }
        await approveFeedback({ data: { feedbackId: current.id } });
        toast.success(t("web.feedback.admin.requests.approved"));
      } else if (action === "deny") {
        const result = await denyFeedback({ data: { feedbackId: current.id } });
        if (!result.ok) {
          toast.error(t(result.error));
          return;
        }
        toast.success(t("web.feedback.admin.requests.denied"));
      } else {
        const targetId = Number(new FormData(form).get("targetId"));
        await mergePendingFeedback({
          data: { feedbackId: current.id, targetId },
        });
        toast.success(t("web.feedback.admin.requests.merged"));
      }
      await onChanged();
    } catch {
      toast.error(t("web.feedback.admin.requests.actionFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      aria-labelledby="admin-feedback-dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-xl border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
      onClose={() => {
        setEditing(false);
        onClosed();
      }}
      ref={dialogRef}
    >
      <div className="grid gap-4 p-5 md:p-6">
        <h2
          className="m-0 text-xl font-semibold"
          id="admin-feedback-dialog-title"
        >
          {t("web.feedback.admin.requests.detailsTitle")}
        </h2>
        {editing ? (
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setSaving(true);
              try {
                await updateAdminFeedback({
                  data: {
                    category: String(data.get("category") ?? ""),
                    description: String(data.get("description") ?? ""),
                    feedbackId: item.id,
                    title: String(data.get("title") ?? ""),
                  },
                });
                toast.success(t("web.feedback.admin.requests.updated"));
                await onChanged();
              } catch {
                toast.error(t("web.feedback.admin.requests.actionFailed"));
              } finally {
                setSaving(false);
              }
            }}
          >
            <label
              className="grid gap-1 text-sm font-medium"
              htmlFor="admin-feedback-title"
            >
              {t("web.feedback.new.titleLabel")}
              <Input
                defaultValue={item.title}
                id="admin-feedback-title"
                maxLength={120}
                name="title"
                required
              />
            </label>
            <label
              className="grid gap-1 text-sm font-medium"
              htmlFor="admin-feedback-description"
            >
              {t("web.catalog.field.description")}
              <textarea
                className="min-h-32 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                defaultValue={item.description}
                id="admin-feedback-description"
                maxLength={5000}
                name="description"
                required
              />
            </label>
            <label
              className="grid gap-1 text-sm font-medium"
              htmlFor="admin-feedback-category"
            >
              {t("web.feedback.new.categoryLabel")}
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                defaultValue={item.category ?? ""}
                id="admin-feedback-category"
                name="category"
                required={current.status !== "pending"}
              >
                <option value="">
                  {t("web.feedback.new.categoryPlaceholder")}
                </option>
                {feedbackCategories.map((category) => (
                  <option key={category} value={category}>
                    {t(feedbackCategoryKey(category))}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <Button disabled={saving} type="submit">
                {t("action.save")}
              </Button>
              <Button
                onClick={() => setEditing(false)}
                type="button"
                variant="outline"
              >
                {t("action.cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="grid gap-2">
              <p className="m-0 font-semibold">{item.title}</p>
              <p className="m-0 whitespace-pre-wrap text-sm">
                {item.description}
              </p>
              <p className="m-0 text-sm text-muted-foreground">
                {t(statusKey(item.status))} ·{" "}
                {item.category
                  ? t(feedbackCategoryKey(item.category))
                  : t("web.feedback.category.unset")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {editable ? (
                <Button
                  onClick={() => setEditing(true)}
                  type="button"
                  variant="outline"
                >
                  {t("web.action.edit")}
                </Button>
              ) : null}
              {item.status === "pending" ? (
                <Button
                  disabled={saving}
                  onClick={() => void act("approve")}
                  type="button"
                >
                  {t("web.feedback.admin.requests.approve")}
                </Button>
              ) : null}
              {item.status === "pending" || item.status === "requested" ? (
                <Button
                  disabled={saving}
                  onClick={() => void act("deny")}
                  type="button"
                  variant="destructive"
                >
                  {t("web.feedback.admin.requests.deny")}
                </Button>
              ) : null}
            </div>
            {item.status === "pending" && mergeTargets.length > 0 ? (
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void act("merge", event.currentTarget);
                }}
              >
                <label className="sr-only" htmlFor="feedback-merge-target">
                  {t("web.feedback.admin.requests.mergeTargetLabel")}
                </label>
                <select
                  className="h-9 min-w-56 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  defaultValue=""
                  id="feedback-merge-target"
                  name="targetId"
                  required
                >
                  <option disabled value="">
                    {t("web.feedback.admin.requests.mergeTargetPlaceholder")}
                  </option>
                  {mergeTargets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.title}
                    </option>
                  ))}
                </select>
                <Button disabled={saving} type="submit" variant="outline">
                  {t("web.feedback.admin.requests.merge")}
                </Button>
              </form>
            ) : null}
          </>
        )}
        <Button
          className="justify-self-end"
          onClick={() => dialogRef.current?.close()}
          type="button"
          variant="outline"
        >
          {t("web.action.close")}
        </Button>
      </div>
    </dialog>
  );
}

function AdminFeedbackNav() {
  const t = useCopy();
  return (
    <nav
      aria-label={t("web.feedback.admin.requests.title")}
      className="flex gap-2"
    >
      <Button
        nativeButton={false}
        render={<Link to="/admin/feedback/requests" />}
        variant="outline"
      >
        {t("web.feedback.admin.navigation.requests")}
      </Button>
      <Button
        nativeButton={false}
        render={<Link to="/admin/feedback/active" />}
        variant="outline"
      >
        {t("web.feedback.admin.navigation.active")}
      </Button>
      <Button
        nativeButton={false}
        render={<Link to="/admin/feedback/archive" />}
        variant="outline"
      >
        {t("web.feedback.admin.navigation.archive")}
      </Button>
    </nav>
  );
}

function SortButton({
  children,
  field,
  onChange,
  sort,
}: {
  children: string;
  field: SortField;
  onChange: (field: SortField) => void;
  sort: Sort[];
}) {
  const current = sort.find(({ field: sortedField }) => sortedField === field);
  const t = useCopy();
  const action = !current
    ? "ascending"
    : current.direction === "asc"
      ? "descending"
      : "remove";
  return (
    <button
      aria-label={t(`web.feedback.admin.sort.${action}`, { column: children })}
      className="inline-flex items-center gap-1 hover:underline"
      onClick={() => onChange(field)}
      type="button"
    >
      {children}
      {current ? (current.direction === "asc" ? " ↑" : " ↓") : null}
    </button>
  );
}

function sortDirection(
  sort: Sort[],
  id: string,
): "ascending" | "descending" | "none" {
  const current = sort.find(({ field }) => field === id);
  return current?.direction === "asc"
    ? "ascending"
    : current?.direction === "desc"
      ? "descending"
      : "none";
}

function formatDate(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(value),
  );
}

export function scheduleAdminSearch(
  current: ReturnType<typeof setTimeout> | undefined,
  search: () => void,
) {
  clearTimeout(current);
  return setTimeout(search, 150);
}

function statusKey(status: Item["status"]): TranslationKey {
  return `web.feedback.status.${status === "in_progress" ? "inProgress" : status}`;
}

function useCopy() {
  const { locale } = useLocale();
  return useCallback(
    (key: TranslationKey, values: Record<string, string | number> = {}) =>
      formatTranslation(key, values, locale),
    [locale],
  );
}
