import { useAuth } from "@clerk/tanstack-react-start";
import {
  faMagnifyingGlass,
  faPlus,
  faSpinnerScale,
} from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useForm, useStore } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  type ComponentProps,
  useCallback,
  useId,
  useReducer,
  useRef,
} from "react";
import { toast } from "sonner";
import { type EffectEntity, useEffectReducer } from "use-effect-reducer";
import { AppShell } from "@/components/app-shell";
import { FeedbackCard } from "@/components/feedback-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFeedbackAction } from "@/hooks/use-feedback-action";
import { updateVote, useFeedbackResults } from "@/hooks/use-feedback-results";
import {
  findDuplicateFeedback,
  type listActiveFeedback,
  type listCompletedFeedback,
  type listMyFeedback,
} from "@/lib/feedback";
import {
  feedbackCategories,
  feedbackCategoryKey,
  feedbackStatus,
  type VisibleFeedbackStatus,
} from "@/lib/feedback-shared";
import { useLocale } from "@/providers/locale-provider";

/** Active feedback item returned by the server. */
type ActiveFeedback = Awaited<ReturnType<typeof listActiveFeedback>>[number];
/** Completed feedback item returned by the server. */
type CompletedFeedback = Awaited<
  ReturnType<typeof listCompletedFeedback>
>[number];
/** One page of feedback submitted by the current user. */
type MyFeedbackPageData = Awaited<ReturnType<typeof listMyFeedback>>;
/** Feedback item submitted by the current user. */
type MyFeedback = MyFeedbackPageData["items"][number];
/** Values collected by the feedback submission form. */
type FeedbackFormInput = {
  /** Selected feedback category, or an empty string before selection. */
  category: string;
  /** Detailed feedback description. */
  description: string;
  /** Short feedback title. */
  title: string;
};
/** Duplicate lookup lifetime and current suggestions. */
type SubmissionState = {
  /** Current suggestions. */
  duplicates: ActiveFeedback[];
  /** Cancellable duplicate lookup. */
  request?: EffectEntity<SubmissionState, SubmissionEvent>;
};
/** Explicit submission lookup and persisted suggestion votes. */
type SubmissionEvent =
  | {
      /** Starts duplicate lookup. */
      type: "checkRequested";
      /** Captured form draft. */
      value: FeedbackFormInput;
    }
  | {
      /** Completes duplicate lookup. */
      type: "checked";
      /** Current suggestions. */
      duplicates: ActiveFeedback[];
    }
  | {
      /** Reconciles a persisted suggestion vote. */
      type: "votePersisted";
      /** Feedback identity. */
      id: number;
      /** Persisted vote. */
      hasVoted: boolean;
    };
/** Captured duplicate lookup. */
type SubmissionEffect = {
  /** Duplicate read implementation. */
  type: "duplicates";
  /** Captured form draft. */
  value: FeedbackFormInput;
};
/** Resets feedback drafts when the signed-in account changes.
 * @returns The current account's feedback submission flow. */
export function SubmitFeedbackPage() {
  const { userId } = useAuth();
  return <SubmitFeedbackPageContent key={userId} />;
}

/**
 * Renders the duplicate-aware feedback submission flow.
 *
 * @returns The feedback submission page.
 */
function SubmitFeedbackPageContent() {
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();
  const action = useFeedbackAction(async () => {
    await navigate({ to: "/feedback/my-requests" });
  });
  const form = useForm({
    defaultValues: { category: "", description: "", title: "" },
    /** Captures a validated feedback draft for duplicate lookup.
     * @param input - Current feedback draft.
     * @returns Nothing. */
    onSubmit: ({ value }) => dispatch({ type: "checkRequested", value }),
  });
  const fields = useStore(form.store, (state) => state.values);
  const [state, dispatch] = useEffectReducer<
    SubmissionState,
    SubmissionEvent,
    SubmissionEffect
  >(
    (state, event, exec) => {
      if (event.type === "checkRequested") {
        exec.stop(state.request);
        return {
          duplicates: [],
          request: exec({ type: "duplicates", value: event.value }),
        };
      }
      if (event.type === "votePersisted")
        return {
          ...state,
          duplicates: updateVote(state.duplicates, event.id, event.hasVoted),
        };
      exec.stop(state.request);
      return { ...state, request: undefined, duplicates: event.duplicates };
    },
    { duplicates: [] },
    {
      /** Loads duplicate suggestions only for the active submission attempt.
       * @param _state - Current duplicate suggestions.
       * @param effect - Captured draft.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current read lifetime. */
      duplicates: (_state, effect, dispatch, { signal }) => {
        void findDuplicateFeedback({
          data: { title: effect.value.title },
          signal,
        }).then(
          (duplicates) => {
            if (signal.aborted) return;
            dispatch({ type: "checked", duplicates });
            if (!duplicates.length)
              action.run({ kind: "submit", data: effect.value });
          },
          () => {
            if (!signal.aborted) {
              dispatch({ type: "checked", duplicates: [] });
              toast.error(t("web.feedback.new.failure"));
            }
          },
        );
      },
    },
  );
  const duplicates = state.duplicates;
  const submitting = Boolean(state.request) || action.pending;
  const t = useFeedbackCopy();

  return (
    <AppShell title={t("web.feedback.new.title")}>
      <main className="mx-auto w-full p-3 md:p-[18px_22px_22px] lg:max-w-[75%]">
        <form
          aria-busy={submitting}
          className="grid gap-6 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm md:p-7"
          ref={formRef}
          onSubmit={(event) => {
            event.preventDefault();
            if (!submitting) void form.handleSubmit();
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
              value={fields.title}
              onChange={(event) =>
                form.setFieldValue("title", event.target.value)
              }
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
              value={fields.description}
              onChange={(event) =>
                form.setFieldValue("description", event.target.value)
              }
              required
            />
          </Field>
          <CategoryField
            disabled={submitting}
            id="feedback-category"
            value={fields.category}
            onChange={(value) => form.setFieldValue("category", value)}
          />
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
                    dispatch({ type: "votePersisted", id: item.id, hasVoted })
                  }
                  voteLabel={t("web.feedback.duplicates.upvote")}
                />
              ))}
              <Button
                disabled={submitting}
                onClick={() => {
                  if (!submitting && formRef.current?.reportValidity())
                    action.run({ kind: "submit", data: form.state.values });
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
              <FontAwesomeIcon
                aria-hidden="true"
                className="animate-spin"
                icon={faSpinnerScale}
              />
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

/** Displays feedback only for the account that authorized its loader snapshot.
 * @param props - Existing initial feedback and its optional authenticated owner.
 * @returns The current account's feedback view. */
export function FeedbackBoardPage(
  props: ComponentProps<typeof FeedbackBoardPageContent> & {
    /** Account that authorized this loader result. */
    actorId?: string;
  },
) {
  const { userId } = useAuth();
  if (props.actorId !== undefined && props.actorId !== userId) return null;
  return <FeedbackBoardPageContent {...props} key={userId} />;
}

/**
 * Renders the active feedback board.
 *
 * @param props - Initial active feedback data.
 * @returns The active feedback board page.
 */
function FeedbackBoardPageContent({
  initialItems,
}: {
  /** Active feedback items loaded for the first render. */
  initialItems: ActiveFeedback[];
}) {
  const { searchForm, search, page, loading, error, load, votePersisted } =
    useFeedbackResults("active", initialItems);
  const items = page.items;
  const t = useFeedbackCopy();

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
            <FontAwesomeIcon aria-hidden="true" icon={faPlus} />
            {t("web.feedback.new.title")}
          </Button>
        </>
      }
      title={t("web.feedback.title")}
    >
      <main
        aria-busy={loading}
        className="mx-auto grid w-full gap-6 p-3 md:p-[18px_22px_22px] lg:max-w-[75%]"
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
              onChange={(event) =>
                searchForm.setFieldValue("search", event.target.value)
              }
              placeholder={t("web.feedback.board.searchPlaceholder")}
              type="search"
              value={search}
            />
            <Button disabled={loading} type="submit" variant="outline">
              <FontAwesomeIcon aria-hidden="true" icon={faMagnifyingGlass} />
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
                  onVote={(hasVoted) => votePersisted(item.id, hasVoted)}
                />
              ))}
            </section>
          );
        })}
      </main>
    </AppShell>
  );
}

/** Displays feedback only for the account that authorized its loader snapshot.
 * @param props - Existing initial feedback and its optional authenticated owner.
 * @returns The current account's feedback view. */
export function CompletedFeedbackPage(
  props: ComponentProps<typeof CompletedFeedbackPageContent> & {
    /** Account that authorized this loader result. */
    actorId?: string;
  },
) {
  const { userId } = useAuth();
  if (props.actorId !== undefined && props.actorId !== userId) return null;
  return <CompletedFeedbackPageContent {...props} key={userId} />;
}

/**
 * Renders completed feedback without voting controls.
 *
 * @param props - Initial completed feedback data.
 * @returns The completed feedback page.
 */
function CompletedFeedbackPageContent({
  initialItems,
}: {
  /** Initial completed feedback items. */
  initialItems: CompletedFeedback[];
}) {
  const { searchForm, search, page, loading, error, load } = useFeedbackResults(
    "completed",
    initialItems,
  );
  const items = page.items;
  const t = useFeedbackCopy();

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
            <FontAwesomeIcon aria-hidden="true" icon={faPlus} />
            {t("web.feedback.new.title")}
          </Button>
        </>
      }
      title={t("web.feedback.status.completed")}
    >
      <main
        aria-busy={loading}
        className="mx-auto grid w-full gap-4 p-3 md:p-[18px_22px_22px] lg:max-w-[75%]"
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
              onChange={(event) =>
                searchForm.setFieldValue("search", event.target.value)
              }
              placeholder={t("web.feedback.board.searchPlaceholder")}
              type="search"
              value={search}
            />
            <Button disabled={loading} type="submit" variant="outline">
              <FontAwesomeIcon aria-hidden="true" icon={faMagnifyingGlass} />
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

/** Displays feedback only for the account that authorized its loader snapshot.
 * @param props - Existing initial feedback and its optional authenticated owner.
 * @returns The current account's feedback view. */
export function MyFeedbackPage(
  props: ComponentProps<typeof MyFeedbackPageContent> & {
    /** Account that authorized this loader result. */
    actorId?: string;
  },
) {
  const { userId } = useAuth();
  if (props.actorId !== undefined && props.actorId !== userId) return null;
  return <MyFeedbackPageContent {...props} key={userId} />;
}

/**
 * Renders the current user's searchable, paginated feedback history.
 *
 * @param root0 - Initial feedback page.
 * @returns The user's feedback history page.
 */
function MyFeedbackPageContent({
  initialPage,
}: {
  /** Feedback page loaded for the first render. */
  initialPage: MyFeedbackPageData;
}) {
  const { searchForm, search, page, loading, error, load, offset } =
    useFeedbackResults("mine", initialPage);
  const t = useFeedbackCopy();

  return (
    <AppShell
      headerActions={
        <Button nativeButton={false} render={<Link to="/feedback/new" />}>
          <FontAwesomeIcon aria-hidden="true" icon={faPlus} />
          {t("web.feedback.new.title")}
        </Button>
      }
      title={t("web.feedback.myRequests.title")}
    >
      <main
        aria-busy={loading}
        className="mx-auto grid w-full gap-4 p-3 md:p-[18px_22px_22px] lg:max-w-[75%]"
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
              onChange={(event) =>
                searchForm.setFieldValue("search", event.target.value)
              }
              placeholder={t("web.feedback.myRequests.searchPlaceholder")}
              type="search"
              value={search}
            />
            <Button disabled={loading} type="submit" variant="outline">
              <FontAwesomeIcon aria-hidden="true" icon={faMagnifyingGlass} />
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

/**
 * Renders an active feedback card with details and voting controls.
 *
 * @param root0 - Feedback request properties.
 * @returns The interactive feedback request.
 */
function FeedbackRequest({
  item,
  onVote,
  voteLabel,
}: {
  /** Active feedback item to display. */
  item: ActiveFeedback;

  /**
   * Receives the persisted vote state after a vote change.
   *
   * @param hasVoted - Persisted vote state.
   */
  onVote: (hasVoted: boolean) => void;
  /** Optional label for adding a vote. */
  voteLabel?: string;
}) {
  const dialogId = useId();
  const [open, dispatch] = useReducer(
    (_open: boolean, event: "opened" | "dismissed") => event === "opened",
    false,
  );
  const dialogRef = useCallback((node: HTMLDialogElement | null) => {
    if (!node) return;
    node.showModal();
    return () => node.close();
  }, []);
  const opener = useRef<HTMLButtonElement>(null);
  const vote = useFeedbackAction((_action, outcome) => {
    if (outcome.hasVoted !== undefined) onVote(outcome.hasVoted);
  });
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
          ref={opener}
          onClick={() => dispatch("opened")}
          type="button"
          variant="outline"
        >
          {t("web.action.view")}
        </Button>
        <VoteButton
          item={item}
          label={voteLabel}
          saving={vote.pending}
          onVote={() =>
            vote.run({ kind: "vote", data: { feedbackId: item.id } })
          }
        />
      </FeedbackCard>
      {open ? (
        <dialog
          onCancel={(event) => {
            event.preventDefault();
            dispatch("dismissed");
            opener.current?.focus();
          }}
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
              <VoteButton
                item={item}
                label={voteLabel}
                saving={vote.pending}
                onVote={() =>
                  vote.run({ kind: "vote", data: { feedbackId: item.id } })
                }
              />
            </FeedbackCard>
            <Button
              className="justify-self-end"
              onClick={() => {
                dispatch("dismissed");
                opener.current?.focus();
              }}
              type="button"
              variant="outline"
            >
              {t("web.action.close")}
            </Button>
          </div>
        </dialog>
      ) : null}
    </>
  );
}

/**
 * Renders a feedback vote toggle unless the vote is permanent.
 *
 * @param root0 - Vote-control properties.
 * @returns The vote control, or nothing for a permanent vote.
 */
function VoteButton({
  item,
  label,
  saving,
  onVote,
}: {
  /** Feedback item whose vote is being changed. */
  item: ActiveFeedback;
  /** Optional label for adding a vote. */
  label?: string;

  /**
   * Receives the persisted vote state.
   *
   */
  onVote: () => void;
  /** Whether either vote control for this request is pending. */
  saving: boolean;
}) {
  const t = useFeedbackCopy();

  if (item.hasPermanentVote) return null;

  return (
    <Button
      aria-pressed={item.hasVoted}
      disabled={saving}
      onClick={onVote}
      type="button"
      variant={item.hasVoted ? "outline" : "default"}
    >
      {item.hasVoted
        ? t("web.feedback.vote.remove")
        : (label ?? t("web.feedback.vote.add"))}
    </Button>
  );
}

/**
 * Narrows a server feedback status to a user-visible status.
 *
 * @param status - Server feedback status.
 * @returns The user-visible status.
 * @throws When the status must remain hidden from submitters.
 */
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

/**
 * Renders the feedback category selector.
 *
 * @param root0 - Category field properties.
 * @returns The localized category field.
 */
function CategoryField({
  value,
  onChange,
  disabled,
  id,
}: {
  /** Form-owned selected category. */
  value: string;

  /** Updates the form category.
   * @param value - Selected category. */
  onChange: (value: string) => void;
  /** Whether category selection is unavailable. */
  disabled: boolean;
  /** Select element identifier. */
  id: string;
}) {
  const t = useFeedbackCopy();
  return (
    <Field htmlFor={id} label={t("web.feedback.new.categoryLabel")}>
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        value={value}
        onChange={(event) => onChange(event.target.value)}
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

/**
 * Renders a labeled feedback form field with optional help text.
 *
 * @param root0 - Field properties.
 * @returns The labeled form field.
 */
function Field({
  children,
  description,
  htmlFor,
  label,
}: {
  /** Form control rendered by the field. */
  children: React.ReactNode;
  /** Optional help text. */
  description?: string;
  /** Identifier of the labeled form control. */
  htmlFor: string;
  /** Visible field label. */
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

/**
 * Renders an empty-state message for a feedback list.
 *
 * @param root0 - Empty-state properties.
 * @returns The empty-state message.
 */
function EmptyState({
  children,
}: {
  /** Empty-state message content. */
  children: React.ReactNode;
}) {
  return (
    <p className="m-0 rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * Returns a formatter bound to the current feedback locale.
 *
 * @returns The localized feedback-copy formatter.
 */
function useFeedbackCopy() {
  const { locale } = useLocale();
  return (key: TranslationKey, params: Record<string, number | string> = {}) =>
    formatTranslation(key, params, locale);
}
