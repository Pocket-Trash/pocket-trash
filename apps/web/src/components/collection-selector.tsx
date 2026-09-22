import type { UserCollectionSummary } from "@package/services";
import { Button } from "@/components/ui/button";
import { CatalogCombobox } from "@/components/ui/combobox";

export function CollectionSelector({
  addLabel,
  collections,
  label,
  onAdd,
  onChange,
  placeholder,
  selectedId,
}: {
  addLabel: string;
  collections: UserCollectionSummary[];
  label: string;
  onAdd?(): void;
  onChange(collectionId: number | null): void;
  placeholder: string;
  selectedId: number | null;
}) {
  const selected = collections.find(({ id }) => id === selectedId) ?? null;
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <CatalogCombobox
          ariaLabel={label}
          items={collections}
          onValueChange={(value) => onChange(value ? Number(value.id) : null)}
          placeholder={placeholder}
          value={selected}
        />
        {onAdd ? (
          <Button onClick={onAdd} type="button" variant="outline">
            {addLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
