import * as React from "react";
import { MarkdownEditor, type MarkdownEditorHandle } from "./markdown-editor";

/** Properties for catalog description Markdown fields. */
export type CatalogMarkdownEditorProps = Readonly<{
  /** Initial Markdown content. */
  defaultValue?: string;
  /** Whether editing is disabled. */
  disabled?: boolean;
  /** Localized validation error. */
  error?: string;
  /** Localized help text. */
  help: string;
  /** Stable editor identifier. */
  id: string;
  /** Localized editor label. */
  label: string;
  /**
   * Receives normalized Markdown changes.
   *
   * @param value - Current catalog description Markdown.
   */
  onChange(value: string): void;
  /**
   * Receives editor loading-state changes.
   *
   * @param loading - Whether the visual editor is initializing.
   */
  onLoadingChange?(loading: boolean): void;
}>;

/** Catalog description editor with the shared 5,000-character contract. */
export const CatalogMarkdownEditor = React.forwardRef<
  MarkdownEditorHandle,
  CatalogMarkdownEditorProps
>(function CatalogMarkdownEditor(
  {
    defaultValue,
    disabled = false,
    error,
    help,
    id,
    label,
    onChange,
    onLoadingChange,
  },
  ref,
) {
  const helpId = `${id}-help`;

  return (
    <div className="grid gap-2">
      <MarkdownEditor
        aria-describedby={helpId}
        counter={{ limit: 5000, type: "characters", warningAt: 4800 }}
        defaultValue={defaultValue}
        disabled={disabled}
        error={error}
        id={id}
        label={label}
        onChange={onChange}
        onLoadingChange={onLoadingChange}
        ref={ref}
      />
      <p className="text-xs text-muted-foreground" id={helpId}>
        {help}
      </p>
    </div>
  );
});
