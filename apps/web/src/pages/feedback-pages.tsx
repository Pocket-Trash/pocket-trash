import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link, useNavigate } from "@tanstack/react-router";
import { LoaderCircle, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { FeedbackCard } from "@/components/feedback-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  approveFeedback,
  denyFeedback,
  type listMyFeedback,
  listPendingFeedback,
  submitFeedback,
  updatePendingFeedback,
} from "@/lib/feedback";
import {
  type FeedbackCategory,
  feedbackCategories,
  feedbackCategoryKey,
} from "@/lib/feedback-shared";
import { useLocale } from "@/providers/locale-provider";

type MyFeedback = Awaited<ReturnType<typeof listMyFeedback>>[number];
type PendingPage = Awaited<ReturnType<typeof listPendingFeedback>>;
type PendingFeedback = PendingPage["items"][number];

export function SubmitFeedbackPage() {
  const { locale } = useLocale();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const t = useFeedbackCopy();

  return (
    <AppShell title={t("web.feedback.new.title")}>
      <main className="mx-auto w-full max-w-2xl px-4 py-8 md:px-6">
        <form
          aria-busy={submitting}
          className="grid gap-6 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm md:p-7"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setSubmitting(true);
            try {
              const result = await submitFeedback({
                data: {
                  category: String(form.get("category") ?? ""),
                  description: String(form.get("description") ?? ""),
                  title: String(form.get("title") ?? ""),
                },
              });
              if (!result.ok) {
                toast.error(formatTranslation(result.error, {}, locale));
                return;
              }
              toast.success(t("web.feedback.new.success"));
              await navigate({ to: "/feedback/my-requests" });
            } catch {
              toast.error(t("web.feedback.new.failure"));
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <p className="m-0 text-sm leading-6 text-muted-foreground">
            {t("web.feedback.new.description")}
          </p>
          <Field
            description={t("web.feedback.new.titleHelp")}
            htmlFor="feedback-title"
            label={t("web.feedback.new.titleLabel")}
          >
            <Input
              aria-describedby="feedback-title-help"
              disabled={submitting}
              id="feedback-title"
              maxLength={120}
              name="title"
              required
            />
          </Field>
          <Field
            description={t("web.feedback.new.descriptionHelp")}
            htmlFor="feedback-description"
            label={t("web.catalog.field.description")}
          >
            <textarea
              aria-describedby="feedback-description-help"
              className="min-h-40 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              disabled={submitting}
              id="feedback-description"
              maxLength={5000}
              name="description"
              required
            />
          </Field>
          <CategoryField disabled={submitting} id="feedback-category" />
          <Button disabled={submitting} type="submit">
            {submitting ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : null}
            {t(
              submitting
                ? "web.feedback.new.submitting"
                : "web.feedback.new.submit",
            )}
          </Button>
        </form>
      </main>
    </AppShell>
  );
}

export function MyFeedbackPage({ items }: { items: MyFeedback[] }) {
  const t = useFeedbackCopy();
  const visibleItems = items.filter(
    (item): item is MyFeedback & { status: "pending" | "requested" } =>
      item.status === "pending" || item.status === "requested",
  );

  return (
    <AppShell
      headerActions={
        <Button nativeButton={false} render={<Link to="/feedback/new" />}>
          <Plus aria-hidden="true" />
          {t("web.feedback.new.title")}
        </Button>
      }
      title={t("web.feedback.myRequests.title")}
    >
      <main className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-6 md:px-6">
        {visibleItems.length === 0 ? (
          <EmptyState>{t("web.feedback.myRequests.empty")}</EmptyState>
        ) : (
          visibleItems.map((item) => <FeedbackCard key={item.id} {...item} />)
        )}
      </main>
    </AppShell>
  );
}

export function AdminFeedbackRequestsPage({
  initialPage,
}: {
  initialPage: PendingPage;
}) {
  const [page, setPage] = useState(initialPage);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const t = useFeedbackCopy();

  async function load(nextOffset: number) {
    setLoading(true);
    try {
      setPage(await listPendingFeedback({ data: { offset: nextOffset } }));
      setOffset(nextOffset);
    } catch {
      toast.error(t("web.feedback.admin.requests.actionFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title={t("web.feedback.admin.requests.title")}>
      <main className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-6 md:px-6">
        {page.items.length === 0 ? (
          <EmptyState>{t("web.feedback.admin.requests.empty")}</EmptyState>
        ) : (
          page.items.map((item) => (
            <AdminFeedbackRequest
              item={item}
              key={item.id}
              onChanged={() => load(offset)}
            />
          ))
        )}
        {offset > 0 || page.hasNext ? (
          <nav
            aria-label={t("web.feedback.admin.requests.title")}
            className="flex justify-between gap-3"
          >
            <Button
              disabled={loading || offset === 0}
              onClick={() => void load(Math.max(0, offset - 30))}
              type="button"
              variant="outline"
            >
              {t("web.feedback.admin.requests.previousPage")}
            </Button>
            <Button
              disabled={loading || !page.hasNext}
              onClick={() => void load(offset + 30)}
              type="button"
              variant="outline"
            >
              {t("web.feedback.admin.requests.nextPage")}
            </Button>
          </nav>
        ) : null}
      </main>
    </AppShell>
  );
}

function AdminFeedbackRequest({
  item,
  onChanged,
}: {
  item: PendingFeedback;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const t = useFeedbackCopy();

  async function moderate(action: "approve" | "deny") {
    if (action === "approve" && !item.category) {
      toast.error(t("web.feedback.admin.requests.categoryRequired"));
      setEditing(true);
      return;
    }
    setSaving(true);
    try {
      await (action === "approve" ? approveFeedback : denyFeedback)({
        data: { feedbackId: item.id },
      });
      toast.success(
        t(
          action === "approve"
            ? "web.feedback.admin.requests.approved"
            : "web.feedback.admin.requests.denied",
        ),
      );
      await onChanged();
    } catch {
      toast.error(t("web.feedback.admin.requests.actionFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <form
        className="grid gap-4 rounded-xl border border-border bg-card p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setSaving(true);
          try {
            await updatePendingFeedback({
              data: {
                category: String(form.get("category") ?? ""),
                description: String(form.get("description") ?? ""),
                feedbackId: item.id,
                title: String(form.get("title") ?? ""),
              },
            });
            toast.success(t("web.feedback.admin.requests.updated"));
            setEditing(false);
            await onChanged();
          } catch {
            toast.error(t("web.feedback.admin.requests.actionFailed"));
          } finally {
            setSaving(false);
          }
        }}
      >
        <Field
          htmlFor={`feedback-title-${item.id}`}
          label={t("web.feedback.new.titleLabel")}
        >
          <Input
            defaultValue={item.title}
            disabled={saving}
            id={`feedback-title-${item.id}`}
            maxLength={120}
            name="title"
            required
          />
        </Field>
        <Field
          htmlFor={`feedback-description-${item.id}`}
          label={t("web.catalog.field.description")}
        >
          <textarea
            className="min-h-32 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            defaultValue={item.description}
            disabled={saving}
            id={`feedback-description-${item.id}`}
            maxLength={5000}
            name="description"
            required
          />
        </Field>
        <CategoryField
          defaultValue={item.category ?? ""}
          disabled={saving}
          id={`feedback-category-${item.id}`}
        />
        <div className="flex gap-2">
          <Button disabled={saving} type="submit">
            {t("action.save")}
          </Button>
          <Button
            disabled={saving}
            onClick={() => setEditing(false)}
            type="button"
            variant="outline"
          >
            {t("action.cancel")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <FeedbackCard {...item} status="pending" submitter={item.submitterUsername}>
      <Button
        disabled={saving}
        onClick={() => setEditing(true)}
        type="button"
        variant="outline"
      >
        {t("web.action.edit")}
      </Button>
      <Button
        disabled={saving}
        onClick={() => void moderate("approve")}
        type="button"
      >
        {t("web.feedback.admin.requests.approve")}
      </Button>
      <Button
        disabled={saving}
        onClick={() => void moderate("deny")}
        type="button"
        variant="destructive"
      >
        {t("web.feedback.admin.requests.deny")}
      </Button>
    </FeedbackCard>
  );
}

function CategoryField({
  defaultValue = "",
  disabled,
  id,
}: {
  defaultValue?: FeedbackCategory | "";
  disabled: boolean;
  id: string;
}) {
  const t = useFeedbackCopy();
  return (
    <Field htmlFor={id} label={t("web.feedback.new.categoryLabel")}>
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        defaultValue={defaultValue}
        disabled={disabled}
        id={id}
        name="category"
      >
        <option value="">{t("web.feedback.new.categoryPlaceholder")}</option>
        {feedbackCategories.map((category) => (
          <option key={category} value={category}>
            {t(feedbackCategoryKey(category))}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Field({
  children,
  description,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  description?: string;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="grid gap-2 text-sm font-medium">
      <label htmlFor={htmlFor}>{label}</label>
      {description ? (
        <span
          className="text-xs font-normal text-muted-foreground"
          id={`${htmlFor}-help`}
        >
          {description}
        </span>
      ) : null}
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function useFeedbackCopy() {
  const { locale } = useLocale();
  return (key: TranslationKey, params: Record<string, number | string> = {}) =>
    formatTranslation(key, params, locale);
}
