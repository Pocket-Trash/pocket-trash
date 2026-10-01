import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link, useNavigate } from "@tanstack/react-router";
import { LoaderCircle, Plus, Search } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { FeedbackCard } from "@/components/feedback-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  findDuplicateFeedback,
  listActiveFeedback,
  listCompletedFeedback,
  listMyFeedback,
  submitFeedback,
  toggleFeedbackVote,
} from "@/lib/feedback";
import {
  type FeedbackCategory,
  feedbackCategories,
  feedbackCategoryKey,
  feedbackStatus,
  type VisibleFeedbackStatus,
} from "@/lib/feedback-shared";
import { useLocale } from "@/providers/locale-provider";

type ActiveFeedback = Awaited<ReturnType<typeof listActiveFeedback>>[number];
/** Completed feedback item returned by the server. */
type CompletedFeedback = Awaited<
  ReturnType<typeof listCompletedFeedback>
>[number];
type MyFeedbackPageData = Awaited<ReturnType<typeof listMyFeedback>>;
type MyFeedback = MyFeedbackPageData["items"][number];
type FeedbackFormInput = {
  category: string;
  description: string;
  title: string;
};

export function SubmitFeedbackPage() {
  const { locale } = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();
  const [duplicates, setDuplicates] = useState<ActiveFeedback[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const t = useFeedbackCopy();

  async function save(data: FeedbackFormInput) {
    const result = await submitFeedback({ data });
    if (!result.ok) {
      toast.error(formatTranslation(result.error, {}, locale));
      return;
    }
    toast.success(t("web.feedback.new.success"));
    await navigate({ to: "/feedback/my-requests" });
  }

  return (
    <AppShell title={t("web.feedback.new.title")}>
      <main className="mx-auto w-full max-w-2xl px-4 py-8 md:px-6">
        <form
          aria-busy={submitting}
          className="grid gap-6 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm md:p-7"
          ref={formRef}
          onSubmit={async (event) => {
            event.preventDefault();
            const data = feedbackFormInput(event.currentTarget);
            setSubmitting(true);
            try {
              const matches = await findDuplicateFeedback({
                data: { title: data.title },
              });
              if (matches.length > 0) {
                setDuplicates(matches);
                return;
              }
              await save(data);
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
          {duplicates.length > 0 ? (
            <section
              aria-labelledby="feedback-duplicates-title"
              className="grid gap-4 rounded-lg border border-border bg-background p-4"
            >
              <div className="grid gap-1">
                <h2
                  className="m-0 text-lg font-semibold"
                  id="feedback-duplicates-title"
                >
                  {t("web.feedback.duplicates.title")}
                </h2>
                <p className="m-0 text-sm text-muted-foreground">
                  {t("web.feedback.duplicates.description")}
                </p>
              </div>
              {duplicates.map((item) => (
                <FeedbackRequest
                  item={item}
                  key={item.id}
                  onVote={(hasVoted) =>
                    setDuplicates((current) =>
                      updateVote(current, item.id, hasVoted),
                    )
                  }
                  voteLabel={t("web.feedback.duplicates.upvote")}
                />
              ))}
              <Button
                disabled={submitting}
                onClick={async () => {
                  if (!formRef.current?.reportValidity()) return;
                  setSubmitting(true);
                  try {
                    await save(feedbackFormInput(formRef.current));
                  } catch {
                    toast.error(t("web.feedback.new.failure"));
                  } finally {
                    setSubmitting(false);
                  }
                }}
                type="button"
                variant="outline"
              >
                {t("web.feedback.duplicates.submitAnyway")}
              </Button>
            </section>
          ) : null}
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

/**
 * Renders the active feedback board.
 *
 * @param props - Initial active feedback data.
 * @returns The active feedback board page.
 */
export function FeedbackBoardPage({
  initialItems,
}: {
  initialItems: ActiveFeedback[];
}) {
  const [error, setError] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const t = useFeedbackCopy();

  /**
   * Reloads active feedback using the current search.
   *
   * @returns A promise that resolves when loading finishes.
   */
  async function load() {
    setError(false);
    setLoading(true);
    try {
      setItems(await listActiveFeedback({ data: { offset: 0, search } }));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell
      headerActions={
        <>
          <Button
            nativeButton={false}
            render={<Link to="/feedback/completed" />}
            variant="outline"
          >
            {t("web.feedback.status.completed")}
          </Button>
          <Button nativeButton={false} render={<Link to="/feedback/new" />}>
            <Plus aria-hidden="true" />
            {t("web.feedback.new.title")}
          </Button>
        </>
      }
      title={t("web.feedback.title")}
    >
      <main
        aria-busy={loading}
        className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-6 md:px-6"
      >
        <search>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void load();
            }}
          >
            <label className="sr-only" htmlFor="feedback-search">
              {t("web.feedback.board.searchLabel")}
            </label>
            <Input
              id="feedback-search"
              maxLength={120}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("web.feedback.board.searchPlaceholder")}
              type="search"
              value={search}
            />
            <Button disabled={loading} type="submit" variant="outline">
              <Search aria-hidden="true" />
              {t("web.action.search")}
            </Button>
          </form>
        </search>
        {loading ? (
          <p aria-live="polite" className="m-0 text-sm text-muted-foreground">
            {t("web.feedback.board.loading")}
          </p>
        ) : null}
        {error ? (
          <p className="m-0 text-sm text-destructive" role="alert">
            {t("web.feedback.board.error")}
          </p>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <EmptyState>{t("web.feedback.board.empty")}</EmptyState>
        ) : null}
        {(["in_progress", "planned", "requested"] as const).map((status) => {
          const group = items.filter((item) => item.status === status);
          if (group.length === 0) return null;
          return (
            <section className="grid gap-4" key={status}>
              <h2 className="m-0 text-xl font-semibold">
                {t(feedbackStatus(status).key)}
              </h2>
              {group.map((item) => (
                <FeedbackRequest
                  item={item}
                  key={item.id}
                  onVote={(hasVoted) =>
                    setItems((current) =>
                      sortActiveFeedback(
                        updateVote(current, item.id, hasVoted),
                      ),
                    )
                  }
                />
              ))}
            </section>
          );
        })}
      </main>
    </AppShell>
  );
}

/**
 * Renders completed feedback without voting controls.
 *
 * @param props - Initial completed feedback data.
 * @returns The completed feedback page.
 */
export function CompletedFeedbackPage({
  initialItems,
}: {
  /** Initial completed feedback items. */
  initialItems: CompletedFeedback[];
}) {
  const [error, setError] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const t = useFeedbackCopy();

  /**
   * Reloads completed feedback using the current search.
   *
   * @returns A promise that resolves when loading finishes.
   */
  async function load() {
    setError(false);
    setLoading(true);
    try {
      setItems(await listCompletedFeedback({ data: { offset: 0, search } }));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell
      headerActions={
        <>
          <Button
            nativeButton={false}
            render={<Link to="/feedback" />}
            variant="outline"
          >
            {t("web.feedback.title")}
          </Button>
          <Button nativeButton={false} render={<Link to="/feedback/new" />}>
            <Plus aria-hidden="true" />
            {t("web.feedback.new.title")}
          </Button>
        </>
      }
      title={t("web.feedback.status.completed")}
    >
      <main
        aria-busy={loading}
        className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-6 md:px-6"
      >
        <search>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void load();
            }}
          >
            <label className="sr-only" htmlFor="completed-feedback-search">
              {t("web.feedback.board.searchLabel")}
            </label>
            <Input
              id="completed-feedback-search"
              maxLength={120}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("web.feedback.board.searchPlaceholder")}
              type="search"
              value={search}
            />
            <Button disabled={loading} type="submit" variant="outline">
              <Search aria-hidden="true" />
              {t("web.action.search")}
            </Button>
          </form>
        </search>
        {loading ? (
          <p aria-live="polite" className="m-0 text-sm text-muted-foreground">
            {t("web.feedback.board.loading")}
          </p>
        ) : null}
        {error ? (
          <p className="m-0 text-sm text-destructive" role="alert">
            {t("web.feedback.board.error")}
          </p>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <EmptyState>{t("web.feedback.board.empty")}</EmptyState>
        ) : null}
        {items.map((item) => (
          <FeedbackCard key={item.id} {...item} status="completed" />
        ))}
      </main>
    </AppShell>
  );
}

export function MyFeedbackPage({
  initialPage,
}: {
  initialPage: MyFeedbackPageData;
}) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [search, setSearch] = useState("");
  const t = useFeedbackCopy();

  async function load(nextOffset: number) {
    setError(false);
    setLoading(true);
    try {
      setPage(
        await listMyFeedback({
          data: { offset: nextOffset, search },
        }),
      );
      setOffset(nextOffset);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

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
      <main
        aria-busy={loading}
        className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-6 md:px-6"
      >
        <search>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void load(0);
            }}
          >
            <label className="sr-only" htmlFor="my-feedback-search">
              {t("web.feedback.myRequests.searchLabel")}
            </label>
            <Input
              id="my-feedback-search"
              maxLength={120}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("web.feedback.myRequests.searchPlaceholder")}
              type="search"
              value={search}
            />
            <Button disabled={loading} type="submit" variant="outline">
              <Search aria-hidden="true" />
              {t("web.action.search")}
            </Button>
          </form>
        </search>
        {loading ? (
          <p aria-live="polite" className="m-0 text-sm text-muted-foreground">
            {t("web.feedback.myRequests.loading")}
          </p>
        ) : null}
        {error ? (
          <p className="m-0 text-sm text-destructive" role="alert">
            {t("web.feedback.myRequests.error")}
          </p>
        ) : null}
        {!loading && !error && page.items.length === 0 ? (
          <EmptyState>
            {search
              ? t("web.feedback.myRequests.noResults")
              : t("web.feedback.myRequests.empty")}
          </EmptyState>
        ) : null}
        {page.items.map((item) => (
          <FeedbackCard
            key={item.id}
            {...item}
            status={visibleFeedbackStatus(item.status)}
          />
        ))}
        {offset > 0 || page.hasNext ? (
          <nav
            aria-label={t("web.feedback.myRequests.title")}
            className="flex justify-between gap-3"
          >
            <Button
              disabled={loading || offset === 0}
              onClick={() => void load(Math.max(0, offset - 30))}
              type="button"
              variant="outline"
            >
              {t("web.feedback.myRequests.previousPage")}
            </Button>
            <Button
              disabled={loading || !page.hasNext}
              onClick={() => void load(offset + 30)}
              type="button"
              variant="outline"
            >
              {t("web.feedback.myRequests.nextPage")}
            </Button>
          </nav>
        ) : null}
      </main>
    </AppShell>
  );
}

function FeedbackRequest({
  item,
  onVote,
  voteLabel,
}: {
  item: ActiveFeedback;
  onVote: (hasVoted: boolean) => void;
  voteLabel?: string;
}) {
  const dialogId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = useFeedbackCopy();
  const status = visibleFeedbackStatus(item.status);

  return (
    <>
      <FeedbackCard {...item} status={status}>
        <Button
          aria-controls={dialogId}
          aria-haspopup="dialog"
          aria-label={t("web.feedback.details.open", { title: item.title })}
          onClick={() => dialogRef.current?.showModal()}
          type="button"
          variant="outline"
        >
          {t("web.action.view")}
        </Button>
        <VoteButton item={item} label={voteLabel} onChanged={onVote} />
      </FeedbackCard>
      <dialog
        aria-labelledby={titleId}
        className="m-auto w-[min(42rem,calc(100%-2rem))] rounded-xl border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
        id={dialogId}
        ref={dialogRef}
      >
        <div className="grid gap-4 p-5 md:p-6">
          <h2 className="m-0 text-xl font-semibold" id={titleId}>
            {t("web.feedback.details.title")}
          </h2>
          <FeedbackCard {...item} status={status}>
            <VoteButton item={item} label={voteLabel} onChanged={onVote} />
          </FeedbackCard>
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
    </>
  );
}

function feedbackFormInput(form: HTMLFormElement): FeedbackFormInput {
  const data = new FormData(form);
  return {
    category: String(data.get("category") ?? ""),
    description: String(data.get("description") ?? ""),
    title: String(data.get("title") ?? ""),
  };
}

function VoteButton({
  item,
  label,
  onChanged,
}: {
  item: ActiveFeedback;
  label?: string;
  onChanged: (hasVoted: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const t = useFeedbackCopy();

  if (item.hasPermanentVote) return null;

  return (
    <Button
      aria-pressed={item.hasVoted}
      disabled={saving}
      onClick={async () => {
        setSaving(true);
        try {
          onChanged(
            await toggleFeedbackVote({ data: { feedbackId: item.id } }),
          );
        } catch {
          toast.error(t("web.feedback.vote.failure"));
        } finally {
          setSaving(false);
        }
      }}
      type="button"
      variant={item.hasVoted ? "outline" : "default"}
    >
      {item.hasVoted
        ? t("web.feedback.vote.remove")
        : (label ?? t("web.feedback.vote.add"))}
    </Button>
  );
}

function updateVote<T extends ActiveFeedback>(
  items: T[],
  feedbackId: number,
  hasVoted: boolean,
) {
  return items.map((item) => {
    if (item.id !== feedbackId || item.hasVoted === hasVoted) return item;
    return {
      ...item,
      hasVoted,
      voteCount: item.voteCount + (hasVoted ? 1 : -1),
    };
  });
}

function sortActiveFeedback(items: ActiveFeedback[]) {
  const statusOrder = { in_progress: 0, planned: 1, requested: 2 } as const;
  return [...items].sort((left, right) => {
    const statusDifference =
      statusOrder[visibleActiveStatus(left.status)] -
      statusOrder[visibleActiveStatus(right.status)];
    return (
      statusDifference ||
      right.voteCount - left.voteCount ||
      new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime() ||
      right.id - left.id
    );
  });
}

function visibleActiveStatus(status: ActiveFeedback["status"]) {
  if (
    status === "requested" ||
    status === "planned" ||
    status === "in_progress"
  ) {
    return status;
  }
  throw new Error(`Unexpected active feedback status: ${status}`);
}

function visibleFeedbackStatus(status: MyFeedback["status"]) {
  if (
    status === "pending" ||
    status === "requested" ||
    status === "planned" ||
    status === "in_progress" ||
    status === "completed"
  ) {
    return status satisfies VisibleFeedbackStatus;
  }
  throw new Error(`Unexpected visible feedback status: ${status}`);
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
