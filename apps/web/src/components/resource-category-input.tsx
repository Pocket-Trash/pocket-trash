import { useEffect, useMemo, useState } from "react";
import {
  CatalogMultiCombobox,
  type ComboboxOption,
} from "@/components/ui/combobox";
import { listResourceCategories } from "@/lib/resources";

type Category = Awaited<ReturnType<typeof listResourceCategories>>[number];

export function ResourceCategoryInput({
  disabled,
  label,
  noResultsLabel,
  onChange,
  placeholder,
  removeLabel,
  selected,
}: {
  disabled?: boolean;
  label: string;
  noResultsLabel: string;
  onChange(categories: string[]): void;
  placeholder: string;
  removeLabel(category: string): string;
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
