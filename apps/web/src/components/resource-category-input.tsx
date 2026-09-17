import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
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
      return [
        ...categories,
        { id: -1, name: normalizedQuery, slug: normalizedQuery },
      ];
    }
    return categories;
  }, [categories, normalizedQuery]);

  function addCategory(category: Category | null) {
    if (
      !category ||
      selected.length >= 10 ||
      selected.some(
        (name) =>
          name.toLocaleLowerCase() === category.name.toLocaleLowerCase(),
      )
    ) {
      return;
    }
    onChange([...selected, category.name]);
    setQuery("");
  }

  return (
    <div className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      <Combobox
        autoHighlight
        disabled={disabled || selected.length >= 10}
        filter={null}
        inputValue={query}
        items={options}
        itemToStringLabel={(category: Category) => category.name}
        onInputValueChange={setQuery}
        onValueChange={addCategory}
        value={null}
      >
        <ComboboxInput placeholder={placeholder} />
        <ComboboxContent>
          <ComboboxEmpty>{noResultsLabel}</ComboboxEmpty>
          <ComboboxList>
            {(category: Category) => (
              <ComboboxItem key={category.id} value={category}>
                {category.name}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <div className="flex flex-wrap gap-2">
        {selected.map((category) => (
          <Badge className="gap-1 pr-1" key={category} variant="secondary">
            {category}
            <button
              aria-label={removeLabel(category)}
              className="rounded-full p-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={disabled}
              onClick={() =>
                onChange(selected.filter((selected) => selected !== category))
              }
              type="button"
            >
              <X className="size-3" />
            </button>
            <input name="categories" type="hidden" value={category} />
          </Badge>
        ))}
      </div>
    </div>
  );
}
