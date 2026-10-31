import { useForm, useStore } from "@tanstack/react-form";
import { type EffectEntity, useEffectReducer } from "use-effect-reducer";
import {
  listActiveFeedback,
  listCompletedFeedback,
  listMyFeedback,
} from "@/lib/feedback";

/** Existing feedback item shared by active, completed and personal boards. */
type ActiveFeedback = Awaited<ReturnType<typeof listActiveFeedback>>[number];
/** Existing feedback result page. */
type Page = Awaited<ReturnType<typeof listMyFeedback>>;
/** Canonical array or paginated loader snapshot. */
type Source = ActiveFeedback[] | Page;
/** Captured query and result offset. */
type Query = {
  /** Current submitted search. */
  search: string;
  /** Result offset. */
  offset: number;
};
/** Current feedback results and their query lifetime. */
type State = {
  /** Canonical loader identity. */
  source: Source;
  /** Current result page. */
  page: Page;
  /** Current committed query. */
  query: Query;
  /** Successfully loaded result offset. */
  offset: number;
  /** Existing query failure. */
  error: boolean;
  /** Current cancellable query. */
  request?: EffectEntity<State, Event>;
};
/** Feedback query intent, persisted votes, and terminal reconciliation. */
type Event =
  | ({
      /** Starts a current query. */
      type: "requested";
    } & Query)
  | {
      /** Reconciles route results. */
      type: "sourceReceived";
      /** Current canonical data. */
      source: Source;
    }
  | {
      /** Publishes current query results. */
      type: "loaded";
      /** Current result. */
      page: Page;
    }
  | {
      /** Stops a failed query. */
      type: "failed";
    }
  | {
      /** Reconciles a confirmed vote. */
      type: "votePersisted";
      /** Feedback identity. */
      id: number;
      /** Persisted vote. */
      hasVoted: boolean;
    };
/** Captured cancellable feedback read. */
type Effect = {
  /** Read implementation. */
  type: "load";
} & Query;

/**
 * Owns feedback board search, pagination, read replacement, and persisted-vote reconciliation.
 * @param mode - Existing feedback collection.
 * @param source - Current canonical loader snapshot.
 * @returns Form-owned search and semantic query/vote commands.
 */
export function useFeedbackResults(
  mode: "active" | "completed" | "mine",
  source: Source,
) {
  const searchForm = useForm({ defaultValues: { search: "" } });
  const search = useStore(searchForm.store, (state) => state.values.search);
  const initialPage = Array.isArray(source)
    ? { hasNext: false, items: source }
    : source;
  const [state, dispatch] = useEffectReducer<State, Event, Effect>(
    (state, event, exec) => {
      exec.stop(state.request);
      if (event.type === "sourceReceived")
        return {
          ...state,
          source: event.source,
          page: initialPage,
          offset: 0,
          query: { search: "", offset: 0 },
          error: false,
          request: undefined,
        };
      if (event.type === "requested")
        return {
          ...state,
          query: { search: event.search, offset: event.offset },
          error: false,
          request: exec({
            type: "load",
            search: event.search,
            offset: event.offset,
          }),
        };
      if (event.type === "votePersisted")
        return {
          ...state,
          page: {
            ...state.page,
            items: sortActiveFeedback(
              updateVote(state.page.items, event.id, event.hasVoted),
            ),
          },
          request: state.request
            ? exec({ type: "load", ...state.query })
            : undefined,
        };
      return {
        ...state,
        request: undefined,
        error: event.type === "failed",
        ...(event.type === "loaded"
          ? { page: event.page, offset: state.query.offset }
          : {}),
      };
    },
    {
      source,
      page: initialPage,
      offset: 0,
      query: { search: "", offset: 0 },
      error: false,
    },
    {
      /** Loads only the currently submitted query through its cancellable observer.
       * @param _state - Current result page.
       * @param effect - Captured query.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current read lifetime. */
      load: (_state, effect, dispatch, { signal }) => {
        void (async () => {
          try {
            const data = { search: effect.search, offset: effect.offset };
            const page =
              mode === "mine"
                ? await listMyFeedback({ data, signal })
                : {
                    hasNext: false,
                    items: await (mode === "active"
                      ? listActiveFeedback({ data, signal })
                      : listCompletedFeedback({ data, signal })),
                  };
            if (!signal.aborted) dispatch({ type: "loaded", page });
          } catch {
            if (!signal.aborted) dispatch({ type: "failed" });
          }
        })();
      },
    },
  );
  if (state.source !== source) dispatch({ type: "sourceReceived", source });
  return {
    searchForm,
    search,
    page: state.page,
    offset: state.offset,
    error: state.error,
    loading: Boolean(state.request),

    /** Requests the current form-owned query at a result offset.
     * @param offset - Requested result offset. */
    load(offset = 0) {
      dispatch({ type: "requested", search, offset });
    },

    /** Publishes a confirmed vote and replaces any older read snapshot.
     * @param id - Persisted feedback identity.
     * @param hasVoted - Confirmed vote state. */
    votePersisted(id: number, hasVoted: boolean) {
      dispatch({ type: "votePersisted", id, hasVoted });
    },
  };
}

/**
 * Applies a persisted vote state to one feedback item.
 *
 * @template T - Active feedback item shape retained in the result.
 * @param items - Feedback items to update.
 * @param feedbackId - Identifier of the changed feedback item.
 * @param hasVoted - Persisted vote state.
 * @returns A new list with the matching vote state and count updated.
 */
export function updateVote<T extends ActiveFeedback>(
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

/**
 * Sorts active feedback by workflow state, votes, recency, and identifier.
 *
 * @param items - Active feedback items.
 * @returns A sorted copy of the items.
 * @throws When an item has a status outside the active workflow states.
 */
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

/**
 * Narrows a server feedback status to an active board status.
 *
 * @param status - Server feedback status.
 * @returns The active status.
 * @throws When the status is not visible on the active board.
 */
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
