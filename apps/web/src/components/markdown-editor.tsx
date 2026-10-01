import { htmlToMarkdown, markdownToHtml } from "@package/markdown";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Strikethrough,
  TextQuote,
} from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { useOptionalLocale } from "@/providers/locale-provider";
import type {
  MarkdownVisualEditorHandle,
  MarkdownVisualEditorProps,
  MarkdownVisualFormat,
} from "./markdown-visual-editor";

/** Lazily loads the visual editor while preserving a Source fallback. */
const LazyMarkdownVisualEditor = React.lazy(async () => {
  try {
    const module = await import("./markdown-visual-editor");
    return { default: module.MarkdownVisualEditor };
  } catch {
    return { default: VisualLoadFailure };
  }
});

/** Counter configuration for editor content. */
type MarkdownCounter = Readonly<{
  /** Maximum valid count. */
  limit: number;
  /** Unit counted by the editor. */
  type: "characters" | "words";
  /** Count at which warning styling begins. */
  warningAt?: number;
}>;

/** Imperative editor operations needed by forms. */
export type MarkdownEditorHandle = Readonly<{
  /** Focuses the active editing surface. */
  focus(): void;
  /**
   * Reads current content synchronously.
   *
   * @returns The current normalized Markdown.
   */
  getValue(): string;
  /**
   * Reads the loading state synchronously.
   *
   * @returns Whether the visual editor is loading.
   */
  isLoading(): boolean;
}>;

/** Properties for the reusable Markdown editor. */
export type MarkdownEditorProps = Readonly<{
  /** Additional accessible description IDs. */
  "aria-describedby"?: string;
  /** Additional wrapper classes. */
  className?: string;
  /** Optional content counter. */
  counter?: MarkdownCounter;
  /** Initial Markdown value. */
  defaultValue?: string;
  /** Whether all editor controls are disabled. */
  disabled?: boolean;
  /** Validation error shown below the editor. */
  error?: string | null;
  /** Optional stable control ID. */
  id?: string;
  /** Accessible editor label. */
  label: string;
  /**
   * Receives content changes.
   *
   * @param value - Current Markdown after an edit.
   */
  onChange?: (value: string) => void;
  /**
   * Receives loading-state changes.
   *
   * @param loading - Whether the visual editor is loading.
   */
  onLoadingChange?: (loading: boolean) => void;
  /** Optional editing hint. */
  placeholder?: string;
  /** Whether content can be selected but not edited. */
  readOnly?: boolean;
}>;

/** Available editor surfaces. */
type Mode = "source" | "visual";

/** Shared toolbar action metadata. */
type ToolbarAction = Readonly<{
  /** Format applied by the action. */
  format: MarkdownVisualFormat;
  /** Icon displayed by the action. */
  icon: React.ComponentType<{
    /** Optional icon classes. */
    className?: string;
  }>;
  /** Localization key for its accessible label. */
  label: TranslationKey;
}>;

/** One prefix replacement used to restore a Source selection. */
type SourceLineEdit = Readonly<{
  /** Original source offset of the prefix. */
  at: number;
  /** Length of the inserted prefix. */
  insertLength: number;
  /** Length of the removed prefix. */
  removeLength: number;
}>;

/** Formatting actions shared by Visual and Source modes. */
const toolbarActions: readonly ToolbarAction[] = [
  {
    format: "heading1",
    icon: Heading1,
    label: "web.markdownEditor.toolbar.heading1",
  },
  {
    format: "heading2",
    icon: Heading2,
    label: "web.markdownEditor.toolbar.heading2",
  },
  {
    format: "heading3",
    icon: Heading3,
    label: "web.markdownEditor.toolbar.heading3",
  },
  {
    format: "bold",
    icon: Bold,
    label: "web.markdownEditor.toolbar.bold",
  },
  {
    format: "italic",
    icon: Italic,
    label: "web.markdownEditor.toolbar.italic",
  },
  {
    format: "strikethrough",
    icon: Strikethrough,
    label: "web.markdownEditor.toolbar.strikethrough",
  },
  {
    format: "unorderedList",
    icon: List,
    label: "web.markdownEditor.toolbar.unorderedList",
  },
  {
    format: "orderedList",
    icon: ListOrdered,
    label: "web.markdownEditor.toolbar.orderedList",
  },
  {
    format: "horizontalRule",
    icon: Minus,
    label: "web.markdownEditor.toolbar.horizontalRule",
  },
  {
    format: "blockquote",
    icon: TextQuote,
    label: "web.markdownEditor.toolbar.blockquote",
  },
];

/** Localized Visual and Source Markdown editor. */
export const MarkdownEditor = React.forwardRef<
  MarkdownEditorHandle,
  MarkdownEditorProps
>(function MarkdownEditor(
  {
    "aria-describedby": describedBy,
    className,
    counter,
    defaultValue = "",
    disabled = false,
    error,
    id,
    label,
    onChange,
    onLoadingChange,
    placeholder,
    readOnly = false,
  },
  forwardedRef,
) {
  const locale = useOptionalLocale();
  const generatedId = React.useId();
  const editorId = id ?? `markdown-editor-${generatedId}`;
  const labelId = `${editorId}-label`;
  const statusId = `${editorId}-status`;
  const errorId = `${editorId}-error`;
  const [mode, setMode] = React.useState<Mode>("visual");
  const [value, setValue] = React.useState(() => safeMarkdown(defaultValue));
  const [loading, setLoading] = React.useState(true);
  const [fallback, setFallback] = React.useState(false);
  const valueRef = React.useRef(value);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const visualRef = React.useRef<MarkdownVisualEditorHandle | null>(null);
  const pendingSelectionRef = React.useRef<[number, number] | null>(null);
  /** Formats one localized editor string. */
  const t = React.useCallback(
    (key: TranslationKey, values: Readonly<Record<string, unknown>> = {}) =>
      formatTranslation(key, values, locale),
    [locale],
  );
  const count = counter ? countValue(value, counter.type) : 0;
  const overLimit = Boolean(counter && count > counter.limit);
  const invalid = Boolean(error || overLimit);
  const editorDescribedBy = [
    describedBy,
    counter || fallback ? statusId : null,
    error ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ");

  React.useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  React.useLayoutEffect(() => {
    const selection = pendingSelectionRef.current;
    if (!selection || !textareaRef.current) return;
    pendingSelectionRef.current = null;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(...selection);
  }, [value]);

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      /**
       * Focuses the active editing surface.
       *
       * @returns The focus operation result.
       */
      focus: () =>
        mode === "visual"
          ? visualRef.current?.focus()
          : textareaRef.current?.focus(),
      /**
       * Reads current content.
       *
       * @returns The current normalized Markdown.
       */
      getValue: () => safeMarkdown(valueRef.current),
      /**
       * Reads current loading state.
       *
       * @returns Whether the visual editor is loading.
       */
      isLoading: () => loading,
    }),
    [loading, mode],
  );

  /** Stores and publishes the current Markdown value. */
  const updateValue = React.useCallback(
    (nextValue: string) => {
      valueRef.current = nextValue;
      setValue(nextValue);
      onChange?.(nextValue);
    },
    [onChange],
  );

  /**
   * Switches editing surfaces after normalizing the current value.
   *
   * @param nextMode - Requested toggle value.
   * @returns Nothing.
   */
  const changeMode = (nextMode: string) => {
    if (nextMode !== "source" && nextMode !== "visual") return;
    const nextValue = safeMarkdown(valueRef.current);
    updateValue(nextValue);
    setMode(nextMode);
    if (nextMode === "visual") {
      setFallback(false);
      setLoading(true);
    } else {
      setLoading(false);
    }
  };

  /** Switches to the value-preserving Source fallback. */
  const handleVisualError = React.useCallback(() => {
    setFallback(true);
    setMode("source");
    setLoading(false);
  }, []);

  /**
   * Applies a toolbar format to the current Source selection.
   *
   * @param format - Markdown format to toggle.
   * @returns Nothing.
   */
  const formatSource = (format: MarkdownVisualFormat) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const edit = sourceEdit(
      valueRef.current,
      textarea.selectionStart,
      textarea.selectionEnd,
      format,
    );
    pendingSelectionRef.current = [edit.selectionStart, edit.selectionEnd];
    updateValue(edit.value);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium" id={labelId}>
          {label}
        </span>
        <ToggleGroup
          aria-labelledby={labelId}
          className="w-auto"
          disabled={disabled}
          onValueChange={changeMode}
          value={mode}
        >
          <ToggleGroupItem value="visual">
            {t("web.markdownEditor.mode.visual")}
          </ToggleGroupItem>
          <ToggleGroupItem value="source">
            {t("web.markdownEditor.mode.source")}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
          invalid && "border-destructive",
          disabled && "opacity-50",
        )}
      >
        <div
          aria-labelledby={labelId}
          className="flex min-w-0 gap-0.5 overflow-x-auto border-b border-input p-1"
          role="toolbar"
        >
          {toolbarActions.map(({ format, icon: Icon, label: labelKey }) => (
            <Button
              aria-label={t(labelKey)}
              className="size-11"
              disabled={disabled || readOnly || loading}
              key={format}
              onClick={() =>
                mode === "visual"
                  ? visualRef.current?.format(format)
                  : formatSource(format)
              }
              size="icon"
              title={t(labelKey)}
              type="button"
              variant="ghost"
            >
              <Icon />
            </Button>
          ))}
        </div>
        {mode === "visual" ? (
          <div className="relative h-64">
            {loading ? (
              <span className="sr-only" role="status">
                {t("web.markdownEditor.status.loading")}
              </span>
            ) : null}
            <React.Suspense
              fallback={
                <EditorSkeleton
                  label={t("web.markdownEditor.status.loading")}
                />
              }
            >
              <LazyMarkdownVisualEditor
                ariaDescribedBy={editorDescribedBy || undefined}
                ariaInvalid={invalid}
                disabled={disabled}
                label={label}
                onChange={updateValue}
                onError={handleVisualError}
                onReady={(handle) => {
                  visualRef.current = handle;
                  setLoading(false);
                }}
                placeholder={placeholder}
                readOnly={readOnly}
                value={value}
              />
            </React.Suspense>
            {loading ? (
              <div className="absolute inset-0 bg-background">
                <EditorSkeleton
                  label={t("web.markdownEditor.status.loading")}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <textarea
            aria-describedby={editorDescribedBy || undefined}
            aria-invalid={invalid || undefined}
            aria-label={label}
            className="block h-64 w-full resize-none bg-transparent p-4 font-mono text-sm text-foreground outline-none disabled:cursor-not-allowed"
            disabled={disabled}
            id={editorId}
            onChange={(event) => updateValue(event.target.value)}
            placeholder={placeholder}
            readOnly={readOnly}
            ref={textareaRef}
            value={value}
          />
        )}
      </div>
      {counter || fallback ? (
        <p
          aria-live="polite"
          className={cn(
            "m-0 text-xs text-muted-foreground",
            overLimit && "text-destructive",
          )}
          id={statusId}
        >
          {fallback ? t("web.markdownEditor.status.fallback") : null}
          {fallback && counter ? " " : null}
          {counter ? counterText(t, counter, count) : null}
        </p>
      ) : null}
      {error ? (
        <p className="m-0 text-xs text-destructive" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
});

/**
 * Reports a failed visual-editor module load.
 *
 * @param props - Visual editor callbacks.
 * @returns An empty fallback element.
 */
function VisualLoadFailure(props: MarkdownVisualEditorProps) {
  React.useEffect(() => props.onError(), [props]);
  return <></>;
}

/**
 * Renders the fixed-height editor loading placeholder.
 *
 * @param props - Loading placeholder properties.
 * @param props.label - Localized loading label.
 * @returns The loading placeholder.
 */
function EditorSkeleton({
  label,
}: {
  /** Localized loading label. */
  label: string;
}) {
  return (
    <div aria-hidden="true" className="h-64 p-4" title={label}>
      <Skeleton className="h-full w-full" />
    </div>
  );
}

/**
 * Normalizes Markdown through the shared safe renderer.
 *
 * @param value - Markdown to normalize.
 * @returns Safe normalized Markdown.
 */
function safeMarkdown(value: string): string {
  return htmlToMarkdown(markdownToHtml(value)) ?? "";
}

/**
 * Counts content in the configured unit.
 *
 * @param value - Markdown content.
 * @param type - Unit to count.
 * @returns Content count.
 */
function countValue(value: string, type: MarkdownCounter["type"]): number {
  if (type === "characters") return value.length;
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

/**
 * Builds the localized counter status.
 *
 * @param t - Translation formatter.
 * @param counter - Counter configuration.
 * @param count - Current count.
 * @returns Localized counter status.
 */
function counterText(t: Translator, counter: MarkdownCounter, count: number) {
  const warningAt = counter.warningAt ?? Math.floor(counter.limit * 0.8);
  const state =
    count > counter.limit
      ? "overLimit"
      : count === counter.limit
        ? "limitReached"
        : count >= warningAt
          ? "warning"
          : "normal";
  return t(`web.markdownEditor.count.${counter.type}.${state}`, {
    current: count,
    limit: counter.limit,
    over: Math.max(0, count - counter.limit),
  } as never);
}

/**
 * Formats one translated editor message.
 *
 * @param key - Translation key.
 * @param values - Interpolation values.
 * @returns Localized text.
 */
type Translator = (
  key: TranslationKey,
  values?: Readonly<Record<string, unknown>>,
) => string;

/**
 * Applies one toolbar action to a Source selection.
 *
 * @param value - Current Markdown.
 * @param selectionStart - Selection start offset.
 * @param selectionEnd - Selection end offset.
 * @param format - Format to toggle.
 * @returns Updated value and selection.
 */
function sourceEdit(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  format: MarkdownVisualFormat,
) {
  if (format === "horizontalRule") {
    const marker = `${selectionEnd > 0 ? "\n" : ""}---\n`;
    return replaceSelection(
      value,
      selectionEnd,
      selectionEnd,
      marker,
      marker.length,
      0,
    );
  }

  const inlineMarker = (
    {
      bold: "**",
      italic: "_",
      strikethrough: "~~",
    } as Partial<Record<MarkdownVisualFormat, string>>
  )[format];
  if (inlineMarker) {
    const selected = value.slice(selectionStart, selectionEnd);
    const exact =
      selected.startsWith(inlineMarker) && selected.endsWith(inlineMarker);
    if (exact) {
      const unwrapped = selected.slice(
        inlineMarker.length,
        -inlineMarker.length,
      );
      return replaceSelection(
        value,
        selectionStart,
        selectionEnd,
        unwrapped,
        0,
        unwrapped.length,
      );
    }
    return replaceSelection(
      value,
      selectionStart,
      selectionEnd,
      `${inlineMarker}${selected}${inlineMarker}`,
      inlineMarker.length,
      selected.length,
    );
  }

  const prefix = (
    {
      blockquote: "> ",
      heading1: "# ",
      heading2: "## ",
      heading3: "### ",
      orderedList: "1. ",
      unorderedList: "- ",
    } as Partial<Record<MarkdownVisualFormat, string>>
  )[format];
  if (!prefix) return { selectionEnd, selectionStart, value };

  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const endsAfterNewline =
    selectionEnd > selectionStart && value[selectionEnd - 1] === "\n";
  const nextLine = value.indexOf("\n", selectionEnd);
  const lineEnd = endsAfterNewline
    ? selectionEnd - 1
    : nextLine === -1
      ? value.length
      : nextLine;
  const selectedLines = value.slice(lineStart, lineEnd).split("\n");
  const exact = selectedLines.every((line) =>
    format === "orderedList" ? /^\d+\.\s/u.test(line) : line.startsWith(prefix),
  );
  let lineOffset = lineStart;
  const edits: SourceLineEdit[] = [];
  const replacement = selectedLines.map((line, index) => {
    const matchedPrefix = exact
      ? format === "orderedList"
        ? /^\d+\.\s/u.exec(line)?.[0]
        : prefix
      : format.startsWith("heading")
        ? /^#{1,3}\s/u.exec(line)?.[0]
        : undefined;
    const insertedPrefix = exact
      ? ""
      : format === "orderedList"
        ? `${index + 1}. `
        : prefix;
    const removeLength = matchedPrefix?.length ?? 0;
    edits.push({
      at: lineOffset,
      insertLength: insertedPrefix.length,
      removeLength,
    });
    lineOffset += line.length + 1;
    return `${insertedPrefix}${line.slice(removeLength)}`;
  });
  return {
    selectionEnd: mapSourceOffset(selectionEnd, edits),
    selectionStart: mapSourceOffset(selectionStart, edits),
    value: `${value.slice(0, lineStart)}${replacement.join("\n")}${value.slice(lineEnd)}`,
  };
}

/**
 * Maps an original Source offset across prefix replacements.
 *
 * @param offset - Original source offset.
 * @param edits - Ordered prefix replacements.
 * @returns The corresponding offset after the replacements.
 */
function mapSourceOffset(
  offset: number,
  edits: readonly SourceLineEdit[],
): number {
  let delta = 0;
  for (const edit of edits) {
    if (offset < edit.at) break;
    if (offset < edit.at + edit.removeLength) {
      return edit.at + delta + edit.insertLength;
    }
    delta += edit.insertLength - edit.removeLength;
  }
  return offset + delta;
}

/**
 * Replaces a source range and describes the resulting selection.
 *
 * @param value - Current Markdown.
 * @param start - Replacement start offset.
 * @param end - Replacement end offset.
 * @param replacement - Replacement text.
 * @param selectionOffset - Selection start within the replacement.
 * @param selectionLength - Resulting selection length.
 * @returns Updated value and selection offsets.
 */
function replaceSelection(
  value: string,
  start: number,
  end: number,
  replacement: string,
  selectionOffset: number,
  selectionLength: number,
) {
  return {
    selectionEnd: start + selectionOffset + selectionLength,
    selectionStart: start + selectionOffset,
    value: `${value.slice(0, start)}${replacement}${value.slice(end)}`,
  };
}
