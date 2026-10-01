import type { UserCollectionSummary } from "@package/services";
import { Button } from "@/components/ui/button";
import { CatalogCombobox } from "@/components/ui/combobox";

/**
 * Renders a collection combobox with an optional add-collection action.
 *
 * @param props - Collection selector properties.
 * @param props.addLabel - Label for the optional add-collection button.
 * @param props.collections - Collections available for selection.
 * @param props.label - Visible and accessible selector label.
 * @param props.onAdd - Opens the add-collection flow when provided.
 * @param props.onChange - Receives the selected collection ID or `null` when cleared.
 * @param props.placeholder - Prompt shown when the combobox has no selection.
 * @param props.selectedId - Currently selected collection ID, or `null` for none.
 * @returns The collection selector UI.
 */
export function CollectionSelector({
  addLabel,
  collections,
  label,
  onAdd,
  onChange,
  placeholder,
  selectedId,
}: {
  /**
   * Label for the optional add-collection button.
   */
  addLabel: string;
  /**
   * Collections available for selection.
   */
  collections: UserCollectionSummary[];
  /**
   * Visible and accessible selector label.
   */
  label: string;
  /** Opens the add-collection flow. */
  onAdd?(): void;
  /**
   * Reports collection selection changes.
   *
   * @param collectionId - Selected collection ID, or `null` when cleared.
   */
  onChange(collectionId: number | null): void;
  /**
   * Prompt shown when the combobox has no selection.
   */
  placeholder: string;
  /**
   * Currently selected collection ID, or `null` for none.
   */
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
