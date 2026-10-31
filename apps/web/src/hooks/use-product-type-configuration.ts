import { useAuth } from "@clerk/tanstack-react-start";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useRef } from "react";
import { toast } from "sonner";
import { type EffectEntity, useEffectReducer } from "use-effect-reducer";
import {
  setProductTypePartOrAccessory,
  setProductTypeTrendsInclusion,
} from "@/lib/catalog-api";
import { useLocale } from "@/providers/locale-provider";

/** Shared server identity and configurable product-type flags. */
type ProductTypeRow = {
  /** Stable product-type identity. */
  id: number;
  /** Existing display name. */
  name: string;
  /** Existing slug. */
  slug: string;
  /** Current classification. */
  isPartOrAccessory: boolean;
  /** Existing Trends inclusion, when this is a Trends configuration row. */
  includeInTrends?: boolean;
};
/** Actual product-type administration workflows sharing per-row lifetimes. */
type ConfigurationMode = "classification" | "trends";
/** Captured timer or committed write for one product-type row. */
type RowEffect = {
  /** Existing row identity. */
  rowId: number;
  /** Monotonic local request lifetime. */
  revision: number;
  /** Captured requested flag. */
  value: boolean;
} & (
  | { /** Debounce implementation. */ type: "debounce" }
  | { /** Server write implementation. */ type: "save" }
);
/** Current independently pending row.
 * @template T - Canonical product-type row shape. */
type PendingRow<T extends ProductTypeRow> = {
  /** Request lifetime guarding stale events. */
  revision: number;
  /** Current timer/write phase. */
  phase: "waiting" | "saving";
  /** Current timer or server observer. */
  request: EffectEntity<ConfigurationState<T>, RowEvent<T>>;
};
/** Optimistic rows, durable rollback values, and independent pending actions.
 * @template T - Canonical product-type row shape. */
type ConfigurationState<T extends ProductTypeRow> = {
  /** Last received server snapshot, including newly allocated equivalent DTO arrays. */
  sourceKey: string;
  /** Account whose observers own this state. */
  actorId: string | null | undefined;
  /** Current optimistic rows. */
  rows: T[];
  /** Last durable server rows for independent rollback. */
  persisted: ReadonlyMap<number, T>;
  /** Pending row timers/writes. */
  pending: ReadonlyMap<number, PendingRow<T>>;
  /** Monotonic request sequence. */
  sequence: number;
};
/** Account reconciliation, row intent, timer expiry, and terminal cleanup.
 * @template T - Canonical product-type row shape. */
type RowEvent<T extends ProductTypeRow> =
  | {
      /** Receives current Router loader rows without replacing pending intent. */
      type: "rowsReceived";
      /** Current canonical configuration rows. */
      rows: T[];
      /** Stable value fingerprint for equivalent loader DTO arrays. */
      sourceKey: string;
    }
  | {
      /** Replaces disposed account controls. */
      type: "actorChanged";
      /** Current account. */
      actorId: string | null | undefined;
    }
  | {
      /** Requests an optimistic flag change. */
      type: "changed";
      /** Current product-type identity. */
      rowId: number;
      /** Requested flag value. */
      value: boolean;
    }
  | {
      /** Commits the last debounced row change. */
      type: "ready";
      /** Captured debounce descriptor. */
      effect: RowEffect;
    }
  | {
      /** Stops a completed write and applies its canonical result or rollback. */
      type: "finished";
      /** Completed row identity. */
      rowId: number;
      /** Completed request lifetime. */
      revision: number;
      /** Canonical row, absent on failure. */
      saved?: T;
    };

/**
 * Owns the two product-type flag workflows with isolated debounce/write/rollback lifetimes.
 * @template T - Canonical product-type row shape.
 * @param initialRows - Initial server-loaded configuration rows.
 * @param mode - Existing configuration endpoint and debounce policy.
 * @returns Optimistic rows, current server-write eligibility, and a semantic row command.
 */
export function useProductTypeConfiguration<T extends ProductTypeRow>(
  initialRows: T[],
  mode: ConfigurationMode,
) {
  const { userId: actorId } = useAuth();
  const { locale } = useLocale();
  const sourceKey = JSON.stringify(initialRows);
  /**
   * Formats existing row-save feedback.
   * @param key - Existing localized feedback key.
   * @param name - Existing row display name.
   * @returns Localized success/failure feedback.
   */
  const t = (key: TranslationKey, name: string) =>
    formatTranslation(key, { name }, locale);
  const tasks = useRef(
    new Map<
      number,
      {
        /** Descriptor whose server write must not replay. */
        effect: RowEffect;
        /** Canonical row retained across Activity resumption. */
        promise: Promise<T | undefined>;
      }
    >(),
  );
  const [state, dispatch] = useEffectReducer<
    ConfigurationState<T>,
    RowEvent<T>,
    RowEffect
  >(
    (state, event, exec) => {
      if (event.type === "actorChanged") {
        for (const pending of state.pending.values())
          exec.stop(pending.request);
        return {
          actorId: event.actorId,
          sourceKey,
          rows: initialRows,
          persisted: new Map(initialRows.map((row) => [row.id, row])),
          pending: new Map(),
          sequence: state.sequence + 1,
        };
      }
      if (event.type === "rowsReceived") {
        const rowIds = new Set(event.rows.map(({ id }) => id));
        const pending = new Map(state.pending);
        for (const [id, request] of pending) {
          if (!rowIds.has(id)) {
            exec.stop(request.request);
            pending.delete(id);
          }
        }
        return {
          ...state,
          sourceKey: event.sourceKey,
          pending,
          persisted: new Map(event.rows.map((row) => [row.id, row])),
          rows: event.rows.map((row) =>
            pending.has(row.id)
              ? (state.rows.find(({ id }) => id === row.id) ?? row)
              : row,
          ),
        };
      }
      const rowId = event.type === "ready" ? event.effect.rowId : event.rowId;
      const current = state.pending.get(rowId);
      const pending = new Map(state.pending);
      if (event.type === "changed") {
        if (current?.phase === "saving") return state;
        const revision = state.sequence + 1;
        pending.set(rowId, {
          revision,
          phase: mode === "classification" ? "waiting" : "saving",
          request: exec.replace(current?.request, {
            type: mode === "classification" ? "debounce" : "save",
            rowId,
            revision,
            value: event.value,
          }),
        });
        return {
          ...state,
          pending,
          sequence: revision,
          rows: state.rows.map((row) =>
            row.id === rowId
              ? {
                  ...row,
                  [mode === "classification"
                    ? "isPartOrAccessory"
                    : "includeInTrends"]: event.value,
                }
              : row,
          ),
        };
      }
      const revision =
        event.type === "ready" ? event.effect.revision : event.revision;
      if (current?.revision !== revision) return state;
      if (event.type === "ready") {
        pending.set(rowId, {
          revision,
          phase: "saving",
          request: exec.replace(current.request, {
            ...event.effect,
            type: "save",
          }),
        });
        return { ...state, pending };
      }
      exec.stop(current.request);
      pending.delete(rowId);
      const persisted = new Map(state.persisted);
      if (event.saved) persisted.set(rowId, event.saved);
      const durable = persisted.get(rowId);
      return {
        ...state,
        pending,
        persisted,
        rows: state.rows.map((row) =>
          row.id === rowId && durable ? durable : row,
        ),
      };
    },
    {
      actorId,
      sourceKey,
      rows: initialRows,
      persisted: new Map(initialRows.map((row) => [row.id, row])),
      pending: new Map(),
      sequence: 0,
    },
    {
      /**
       * Debounces classification intent and cancels timers when replaced or disposed.
       * @param _state - Current optimistic rows.
       * @param effect - Captured row change.
       * @param dispatch - Timer-expiry dispatcher.
       * @param context - Current timer observer lifetime.
       * @returns Timer cleanup.
       */
      debounce: (_state, effect, dispatch, { signal }) => {
        const timer = window.setTimeout(() => {
          if (!signal.aborted) dispatch({ type: "ready", effect });
        }, 300);
        return () => window.clearTimeout(timer);
      },
      /**
       * Observes one row write without replaying it after lifecycle resumption.
       * @param current - Current optimistic row snapshot.
       * @param effect - Captured flag and request lifetime.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current account observer lifetime.
       */
      save: (current, effect, dispatch, { signal }) => {
        const row = current.rows.find(({ id }) => id === effect.rowId);
        if (!row) return;
        if (tasks.current.get(effect.rowId)?.effect !== effect)
          tasks.current.set(effect.rowId, {
            effect,
            promise: Promise.resolve()
              .then<ProductTypeRow>(() =>
                mode === "classification"
                  ? setProductTypePartOrAccessory({
                      data: {
                        isPartOrAccessory: effect.value,
                        productTypeId: effect.rowId,
                      },
                    })
                  : setProductTypeTrendsInclusion({
                      data: {
                        includeInTrends: effect.value,
                        productTypeId: effect.rowId,
                      },
                    }),
              )
              .then(
                (saved) => ({ ...row, ...saved }),
                () => undefined,
              ),
          });
        void tasks.current.get(effect.rowId)?.promise.then((saved) => {
          if (signal.aborted) return;
          tasks.current.delete(effect.rowId);
          dispatch({
            type: "finished",
            rowId: effect.rowId,
            revision: effect.revision,
            saved,
          });
          const key =
            mode === "classification"
              ? saved
                ? "web.admin.config.products.updated"
                : "web.admin.config.products.updateFailed"
              : saved
                ? "web.admin.config.trends.updated"
                : "web.admin.config.trends.updateFailed";
          toast[saved ? "success" : "error"](
            t(key as TranslationKey, saved?.name ?? row.name),
          );
        });
      },
    },
  );
  if (state.actorId !== actorId) dispatch({ type: "actorChanged", actorId });
  else if (state.sourceKey !== sourceKey)
    dispatch({ type: "rowsReceived", rows: initialRows, sourceKey });
  return {
    rows: state.rows,
    savingIds: new Set(
      [...state.pending]
        .filter(([, pending]) => pending.phase === "saving")
        .map(([id]) => id),
    ),
    /**
     * Requests one optimistic configuration flag change.
     * @param rowId - Existing product-type identity.
     * @param value - Requested flag value.
     */
    changeRow(rowId: number, value: boolean) {
      dispatch({ type: "changed", rowId, value });
    },
  };
}
