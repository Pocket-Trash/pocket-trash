import { useEffect, useMemo, useState } from "react";
import {
  CatalogMultiCombobox,
  type ComboboxOption,
} from "@/components/ui/combobox";
import { listResourceCategories } from "@/lib/resources";

/**
 * Resource category returned by category search.
 */
type Category = Awaited<ReturnType<typeof listResourceCategories>>[number];

/**
 * Renders a searchable category picker capped at ten case-insensitive unique names.
 * Searches are debounced by 150 ms, failures produce no options, and unmatched text becomes a selectable category.
 *
 * @param props - Resource category input properties.
 * @param props.disabled - Whether interaction is disabled.
 * @param props.label - Visible field label.
 * @param props.noResultsLabel - Message shown when search returns no categories.
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
   * Message shown when search returns no categories.
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void listResourceCategories({ data: { search: query } })
        .then(setCategories)
        .catch(() => setCategories([]));
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [query]);

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
        onInputValueChange={setQuery}
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
          setQuery("");
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
