import { useMemo } from "react";
import {
  type EffectEntity,
  type EffectReducer,
  type EffectsMap,
  useEffectReducer,
} from "use-effect-reducer";
import {
  CatalogMultiCombobox,
  type ComboboxOption,
} from "@/components/ui/combobox";
import { listResourceCategories } from "@/lib/resources";

/**
 * Resource category returned by category search.
 */
type Category = Awaited<ReturnType<typeof listResourceCategories>>[number];

/** Search state and the cancellable lookup that owns its results. */
type CategorySearchState = {
  /** Most recently accepted category results. */
  categories: Category[];
  /** Current untrimmed search input. */
  query: string;
  /** Generation used to reject results queued before a newer query. */
  generation: number;
  /** Pending debounce or request, cleared on completion. */
  search: EffectEntity<CategorySearchState, CategorySearchEvent> | undefined;
};

/** User input and terminal category-search results. */
type CategorySearchEvent =
  | {
      /** Search input was edited or cleared after selection. */
      type: "queryChanged";
      /** Next untrimmed search input. */
      query: string;
    }
  | {
      /** A request succeeded or failed with empty results. */
      type: "searchSettled";
      /** Results returned by this request. */
      categories: Category[];
      /** Generation that initiated the request. */
      generation: number;
    };

/** Debounced lookup queued after a committed query transition. */
type CategorySearchEffect = {
  /** Lookup effect implementation. */
  type: "searchCategories";
  /** Search text sent to the existing server function. */
  query: string;
  /** Generation carried into the terminal event. */
  generation: number;
};

/**
 * Replaces superseded lookups and explicitly stops terminal work.
 *
 * @param state - Current category search.
 * @param event - Input change or request completion.
 * @param exec - Committed effect queue.
 * @returns The next query, results and active lookup.
 */
const categorySearchReducer: EffectReducer<
  CategorySearchState,
  CategorySearchEvent,
  CategorySearchEffect
> = (state, event, exec) => {
  if (event.type === "queryChanged") {
    if (event.query === state.query) return state;
    const generation = state.generation + 1;
    return {
      ...state,
      query: event.query,
      generation,
      search: exec.replace(state.search, {
        type: "searchCategories",
        query: event.query,
        generation,
      }),
    };
  }
  if (event.generation !== state.generation) return state;
  exec.stop(state.search);
  return { ...state, categories: event.categories, search: undefined };
};

/** Committed browser work for category lookup. */
const categorySearchEffects: EffectsMap<
  CategorySearchState,
  CategorySearchEvent,
  CategorySearchEffect
> = {
  /**
   * Debounces requests and ignores late responses after cancellation.
   *
   * @param _state - State that queued the lookup.
   * @param effect - Search text and request generation.
   * @param dispatch - Receives terminal search results.
   * @param context - Effect lifetime.
   * @param context.signal - Aborted on replacement, hiding or unmount.
   * @returns Cleanup for the pending debounce.
   */
  searchCategories: (_state, effect, dispatch, { signal }) => {
    /**
     * Accepts results only while this request still owns its lifetime.
     *
     * @param categories - Matching categories, or empty results on failure.
     */
    const settle = (categories: Category[]) => {
      if (!signal.aborted) {
        dispatch({
          type: "searchSettled",
          categories,
          generation: effect.generation,
        });
      }
    };
    const timeout = window.setTimeout(() => {
      void listResourceCategories({
        data: { search: effect.query },
        signal,
      }).then(settle, () => settle([]));
    }, 150);
    return () => window.clearTimeout(timeout);
  },
};

/**
 * Renders a searchable category picker that emits at most ten case-insensitive unique names.
 * Searches are debounced by 150 ms; failures clear fetched results, while a nonblank unmatched query remains selectable as a custom category.
 *
 * @param props - Resource category input properties.
 * @param props.disabled - Whether interaction is disabled.
 * @param props.label - Visible field label.
 * @param props.noResultsLabel - Message shown when there are no selectable options.
 * @param props.onChange - Receives the normalized selected category names.
 * @param props.placeholder - Prompt shown when the combobox has no selection.
 * @param props.removeLabel - Builds an accessible removal label for a category.
 * @param props.selected - Currently selected category names.
 * @returns The resource category picker UI.
 */
export function ResourceCategoryInput({
  disabled,
  label,
  noResultsLabel,
  onChange,
  placeholder,
  removeLabel,
  selected,
}: {
  /**
   * Whether interaction is disabled.
   */
  disabled?: boolean;
  /**
   * Visible field label.
   */
  label: string;
  /**
   * Message shown when there are no selectable options.
   */
  noResultsLabel: string;
  /**
   * Reports the normalized selected category names.
   *
   * @param categories - At most ten case-insensitive unique category names.
   */
  onChange(categories: string[]): void;
  /**
   * Prompt shown when the combobox has no selection.
   */
  placeholder: string;
  /**
   * Builds an accessible removal label for a category.
   *
   * @param category - Category name being removed.
   * @returns The accessible removal label.
   */
  removeLabel(category: string): string;
  /**
   * Currently selected category names.
   */
  selected: string[];
}) {
  const [{ categories, query }, dispatch] = useEffectReducer(
    categorySearchReducer,
    (exec) => ({
      categories: [],
      query: "",
      generation: 0,
      search: exec({ type: "searchCategories", query: "", generation: 0 }),
    }),
    categorySearchEffects,
  );
  const normalizedQuery = query.trim();

  const options = useMemo(() => {
    if (
      normalizedQuery &&
      !categories.some(
        ({ name }) =>
          name.toLocaleLowerCase() === normalizedQuery.toLocaleLowerCase(),
      )
    ) {
      return [...categories, { id: -1, name: normalizedQuery }];
    }
    return categories;
  }, [categories, normalizedQuery]).map(({ name }) => ({ id: name, name }));
  const selectedOptions: ComboboxOption[] = selected.map((name) => ({
    id: name,
    name,
  }));

  return (
    <div className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      <CatalogMultiCombobox
        ariaLabel={placeholder}
        disabled={disabled || selected.length >= 10}
        emptyLabel={noResultsLabel}
        filter={null}
        inputValue={query}
        items={options}
        onInputValueChange={(query) =>
          dispatch({ type: "queryChanged", query })
        }
        onValueChange={(values) => {
          onChange(
            values
              .map(({ name }) => name)
              .filter(
                (name, index, names) =>
                  names.findIndex(
                    (candidate) =>
                      candidate.toLocaleLowerCase() ===
                      name.toLocaleLowerCase(),
                  ) === index,
              )
              .slice(0, 10),
          );
          dispatch({ type: "queryChanged", query: "" });
        }}
        placeholder={placeholder}
        removeDisabled={disabled}
        removeLabel={removeLabel}
        value={selectedOptions}
      />
      {selected.map((category) => (
        <input
          key={category}
          name="categories"
          type="hidden"
          value={category}
        />
      ))}
    </div>
  );
}
