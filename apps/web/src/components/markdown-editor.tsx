import {
  htmlToMarkdown,
  isSafeMarkdownLink,
  markdownToHtml,
} from "@package/markdown";
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
  Link2,
  List,
  ListOrdered,
  Minus,
  Strikethrough,
  Table2,
  TextQuote,
} from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { countWords } from "@/lib/text";
import { cn } from "@/lib/utils";
import { useOptionalLocale } from "@/providers/locale-provider";
import type {
  MarkdownLinkSelection,
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

/** Link form opened from the current editor selection. */
type LinkEditorState = Readonly<{
  /** Whether link text must be collected in a modal. */
  kind: "modal" | "popover";
  /** Whether the selection is exactly one existing link. */
  existing: boolean;
  /** Link display text. */
  text: string;
  /** Link destination. */
  url: string;
}>;

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
  const [activeFormats, setActiveFormats] = React.useState<
    readonly MarkdownVisualFormat[]
  >([]);
  const [linkEditor, setLinkEditor] = React.useState<LinkEditorState | null>(
    null,
  );
  const [linkError, setLinkError] = React.useState(false);
  const [statusAnnouncement, setStatusAnnouncement] = React.useState("");
  const valueRef = React.useRef(value);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const visualRef = React.useRef<MarkdownVisualEditorHandle | null>(null);
  const pendingSelectionRef = React.useRef<[number, number] | null>(null);
  const sourceLinkSelectionRef = React.useRef<[number, number] | null>(null);
  const linkDialogRef = React.useRef<HTMLDialogElement>(null);
  const linkTextRef = React.useRef<HTMLInputElement>(null);
  const linkUrlRef = React.useRef<HTMLInputElement>(null);
  const announcedStatusRef = React.useRef("");
  /** Formats one localized editor string. */
  const t = React.useCallback(
    (key: TranslationKey, values: Readonly<Record<string, unknown>> = {}) =>
      formatTranslation(key, values, locale),
    [locale],
  );
  const count = counter ? countValue(value, counter.type) : 0;
  const countStatus = counter ? counterState(counter, count) : null;
  const linkEditorKind = linkEditor?.kind;
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

  React.useEffect(() => {
    if (!linkEditorKind) return;
    if (linkEditorKind === "modal") linkDialogRef.current?.showModal?.();
    (linkEditorKind === "modal" ? linkTextRef : linkUrlRef).current?.focus();
  }, [linkEditorKind]);

  React.useEffect(() => {
    const key = `${fallback}:${countStatus ?? ""}`;
    if (announcedStatusRef.current === key) return;
    announcedStatusRef.current = key;
    setStatusAnnouncement(
      [
        fallback ? t("web.markdownEditor.status.fallback") : "",
        counter ? counterText(t, counter, count, locale) : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }, [count, countStatus, counter, fallback, locale, t]);

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
    setActiveFormats([]);
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

  /** Opens the contextual link form for the active editor selection. */
  const openLinkEditor = () => {
    const context =
      mode === "visual"
        ? visualRef.current?.getLinkSelection()
        : sourceLinkSelection(valueRef.current, textareaRef.current);
    if (!context) return;
    if (mode === "source" && textareaRef.current) {
      sourceLinkSelectionRef.current = [
        textareaRef.current.selectionStart,
        textareaRef.current.selectionEnd,
      ];
    }
    setLinkError(false);
    setLinkEditor({
      existing: Boolean(context.url),
      kind: context.text ? "popover" : "modal",
      text: context.text,
      url: context.url ?? "",
    });
  };

  /** Closes the link form and restores the active editing surface. */
  const closeLinkEditor = () => {
    linkDialogRef.current?.close?.();
    setLinkEditor(null);
    setLinkError(false);
    if (mode === "visual") visualRef.current?.focus();
    else textareaRef.current?.focus();
  };

  /** Applies the current validated link form. */
  const applyLink = () => {
    if (!linkEditor?.text || !isSafeMarkdownLink(linkEditor.url)) {
      setLinkError(Boolean(linkEditor?.url));
      return;
    }
    if (mode === "visual") {
      visualRef.current?.setLink(linkEditor.text, linkEditor.url);
    } else {
      updateSourceLink(linkEditor.text, linkEditor.url, false);
    }
    closeLinkEditor();
  };

  /** Removes the selected link while preserving its display text. */
  const removeLink = () => {
    if (!linkEditor?.existing) return;
    if (mode === "visual") visualRef.current?.removeLink();
    else updateSourceLink(linkEditor.text, "", true);
    closeLinkEditor();
  };

  /**
   * Applies one link edit to the saved Source selection.
   *
   * @param text - Link display text.
   * @param url - Validated destination, or empty when removing.
   * @param remove - Whether to unwrap the selected link.
   * @returns Nothing.
   */
  const updateSourceLink = (text: string, url: string, remove: boolean) => {
    const selection = sourceLinkSelectionRef.current;
    if (!selection) return;
    const [start, end] = selection;
    const replacement = remove ? text : sourceLink(text, url);
    const selectionOffset = remove ? 0 : 1;
    const edit = replaceSelection(
      valueRef.current,
      start,
      end,
      replacement,
      selectionOffset,
      text.length,
    );
    pendingSelectionRef.current = [edit.selectionStart, edit.selectionEnd];
    updateValue(edit.value);
  };

  /** Inserts the fixed product table shape at the active selection. */
  const insertTable = () => {
    if (mode === "visual") {
      visualRef.current?.format("table");
      return;
    }
    const textarea = textareaRef.current;
    if (!textarea) return;
    const table = "|  |  |  |\n| --- | --- | --- |\n|  |  |  |";
    const edit = replaceSelection(
      valueRef.current,
      textarea.selectionStart,
      textarea.selectionEnd,
      table,
      2,
      0,
    );
    pendingSelectionRef.current = [edit.selectionStart, edit.selectionEnd];
    updateValue(edit.value);
  };

  const linkForm = linkEditor ? (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        applyLink();
      }}
    >
      <h2 className="text-sm font-semibold" id={`${editorId}-link-title`}>
        {t(
          linkEditor.existing
            ? "web.markdownEditor.link.update"
            : "web.markdownEditor.link.insert",
        )}
      </h2>
      {linkEditor.kind === "modal" ? (
        <label className="grid gap-1 text-sm">
          {t("web.markdownEditor.link.text")}
          <Input
            onChange={(event) =>
              setLinkEditor((current) =>
                current ? { ...current, text: event.target.value } : current,
              )
            }
            required
            ref={linkTextRef}
            value={linkEditor.text}
          />
        </label>
      ) : null}
      <label className="grid gap-1 text-sm">
        {t("web.markdownEditor.link.url")}
        <Input
          aria-invalid={linkError || undefined}
          inputMode="url"
          onChange={(event) => {
            setLinkError(false);
            setLinkEditor((current) =>
              current ? { ...current, url: event.target.value } : current,
            );
          }}
          required
          ref={linkUrlRef}
          value={linkEditor.url}
        />
      </label>
      {linkError ? (
        <p className="m-0 text-xs text-destructive" role="alert">
          {t("web.markdownEditor.link.invalidUrl")}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {linkEditor.existing ? (
          <Button onClick={removeLink} type="button" variant="destructive">
            {t("web.markdownEditor.link.remove")}
          </Button>
        ) : null}
        <Button onClick={closeLinkEditor} type="button" variant="outline">
          {t("action.cancel")}
        </Button>
        <Button type="submit">
          {t(
            linkEditor.existing
              ? "web.markdownEditor.link.update"
              : "web.markdownEditor.link.insert",
          )}
        </Button>
      </div>
    </form>
  ) : null;

  return (
    <div className={cn("relative grid gap-2", className)}>
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
          aria-orientation="horizontal"
          className="flex min-w-0 flex-nowrap gap-0.5 overflow-x-auto border-b border-input p-1"
          role="toolbar"
        >
          {toolbarActions.map(({ format, icon: Icon, label: labelKey }) => (
            <Button
              aria-label={t(labelKey)}
              aria-pressed={
                format === "horizontalRule"
                  ? undefined
                  : activeFormats.includes(format)
              }
              className="size-[44px]"
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
          <Button
            aria-label={t("web.markdownEditor.toolbar.link")}
            aria-pressed={activeFormats.includes("link")}
            className="size-[44px]"
            disabled={disabled || readOnly || loading}
            onClick={openLinkEditor}
            size="icon"
            title={t("web.markdownEditor.toolbar.link")}
            type="button"
            variant="ghost"
          >
            <Link2 />
          </Button>
          <Button
            aria-label={t("web.markdownEditor.toolbar.table")}
            className="size-[44px]"
            disabled={disabled || readOnly || loading}
            onClick={insertTable}
            size="icon"
            title={t("web.markdownEditor.toolbar.table")}
            type="button"
            variant="ghost"
          >
            <Table2 />
          </Button>
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
                onSelectionChange={setActiveFormats}
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
            onSelect={(event) =>
              setActiveFormats(sourceActiveFormats(event.currentTarget))
            }
            placeholder={placeholder}
            readOnly={readOnly}
            ref={textareaRef}
            value={value}
          />
        )}
      </div>
      {linkEditor?.kind === "popover" ? (
        <div
          aria-labelledby={`${editorId}-link-title`}
          className="absolute top-14 right-2 z-20 w-[min(24rem,calc(100%-1rem))] rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-md"
          role="dialog"
        >
          {linkForm}
        </div>
      ) : null}
      <dialog
        aria-labelledby={`${editorId}-link-title`}
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl border border-border bg-card p-6 text-card-foreground backdrop:bg-black/60"
        onCancel={(event) => {
          event.preventDefault();
          closeLinkEditor();
        }}
        ref={linkDialogRef}
      >
        {linkEditor?.kind === "modal" ? linkForm : null}
      </dialog>
      {counter || fallback ? (
        <p
          className={cn(
            "m-0 text-xs text-muted-foreground",
            countStatus === "warning" && "text-primary",
            (countStatus === "limitReached" || countStatus === "overLimit") &&
              "text-destructive",
          )}
          id={statusId}
        >
          {fallback ? t("web.markdownEditor.status.fallback") : null}
          {fallback && counter ? " " : null}
          {counter ? counterText(t, counter, count, locale) : null}
        </p>
      ) : null}
      {statusAnnouncement ? (
        <span aria-live="polite" className="sr-only" role="status">
          {statusAnnouncement}
        </span>
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
  return countWords(value);
}

/**
 * Builds the localized counter status.
 *
 * @param t - Translation formatter.
 * @param counter - Counter configuration.
 * @param count - Current count.
 * @param locale - Locale used to format numeric values.
 * @returns Localized counter status.
 */
function counterText(
  t: Translator,
  counter: MarkdownCounter,
  count: number,
  locale: string | null | undefined,
) {
  const state = counterState(counter, count);
  const format = new Intl.NumberFormat(locale ?? undefined).format;
  return t(`web.markdownEditor.count.${counter.type}.${state}`, {
    current: format(count),
    limit: format(counter.limit),
    over: format(Math.max(0, count - counter.limit)),
  } as never);
}

/**
 * Classifies a counter value for styling and transition announcements.
 *
 * @param counter - Counter configuration.
 * @param count - Current content count.
 * @returns The counter's current accessibility state.
 */
function counterState(counter: MarkdownCounter, count: number) {
  const warningAt = counter.warningAt ?? Math.floor(counter.limit * 0.8);
  return count > counter.limit
    ? "overLimit"
    : count === counter.limit
      ? "limitReached"
      : count >= warningAt
        ? "warning"
        : "normal";
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
 * Reads an exact Markdown link or plain text from the Source selection.
 *
 * @param value - Current Source value.
 * @param textarea - Active Source control.
 * @returns Selected link metadata, plain text, or null without a control.
 */
function sourceLinkSelection(
  value: string,
  textarea: HTMLTextAreaElement | null,
): MarkdownLinkSelection | null {
  if (!textarea) return null;
  const selected = value.slice(textarea.selectionStart, textarea.selectionEnd);
  const link = /^\[([^\]\n]+)\]\(([^)\n]+)\)$/u.exec(selected);
  return link
    ? { text: link[1] ?? "", url: link[2] ?? "" }
    : { text: selected };
}

/**
 * Serializes a Source-mode link after destination validation.
 *
 * @param text - Link display text.
 * @param url - Validated destination.
 * @returns Escaped Markdown link source.
 */
function sourceLink(text: string, url: string): string {
  const escapedText = text.replaceAll("\\", "\\\\").replaceAll("]", "\\]");
  const escapedUrl = url.replaceAll("\\", "\\\\").replaceAll(")", "\\)");
  return `[${escapedText}](${escapedUrl})`;
}

/**
 * Reads toggleable formats from an exact Source selection.
 *
 * @param textarea - Active Source control.
 * @returns Formats exactly wrapping the current selection.
 */
function sourceActiveFormats(
  textarea: HTMLTextAreaElement,
): readonly MarkdownVisualFormat[] {
  const selected = textarea.value.slice(
    textarea.selectionStart,
    textarea.selectionEnd,
  );
  const formats: MarkdownVisualFormat[] = [];
  if (/^\*\*[\s\S]+\*\*$/u.test(selected)) formats.push("bold");
  if (/^_[\s\S]+_$/u.test(selected)) formats.push("italic");
  if (/^~~[\s\S]+~~$/u.test(selected)) formats.push("strikethrough");
  if (/^\[[^\]\n]+\]\([^)\n]+\)$/u.test(selected)) formats.push("link");
  if (/^#\s/u.test(selected)) formats.push("heading1");
  if (/^##\s/u.test(selected)) formats.push("heading2");
  if (/^###\s/u.test(selected)) formats.push("heading3");
  if (/^>\s/u.test(selected)) formats.push("blockquote");
  if (/^-\s/u.test(selected)) formats.push("unorderedList");
  if (/^\d+\.\s/u.test(selected)) formats.push("orderedList");
  return formats;
}

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
