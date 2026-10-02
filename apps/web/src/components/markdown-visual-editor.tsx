import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
  editorViewOptionsCtx,
  rootCtx,
  serializerCtx,
} from "@milkdown/core";
import { clipboard } from "@milkdown/plugin-clipboard";
import { history } from "@milkdown/plugin-history";
import {
  blockContainerTypes,
  blockquoteAttr,
  blockquoteKeymap,
  blockquoteSchema,
  bulletListAttr,
  bulletListKeymap,
  bulletListSchema,
  docSchema,
  emphasisAttr,
  emphasisKeymap,
  emphasisSchema,
  emphasisStarInputRule,
  emphasisUnderscoreInputRule,
  headingAttr,
  headingIdGenerator,
  headingSchema,
  hrAttr,
  hrSchema,
  insertHrCommand,
  insertHrInputRule,
  liftFirstListItemCommand,
  liftListItemCommand,
  linkAttr,
  linkSchema,
  listItemAttr,
  listItemKeymap,
  listItemSchema,
  orderedListAttr,
  orderedListKeymap,
  orderedListSchema,
  paragraphAttr,
  paragraphKeymap,
  paragraphSchema,
  remarkAddOrderInListPlugin,
  remarkInlineLinkPlugin,
  remarkMarker,
  remarkPreserveEmptyLinePlugin,
  sinkListItemCommand,
  splitListItemCommand,
  strongAttr,
  strongInputRule,
  strongKeymap,
  strongSchema,
  syncHeadingIdPlugin,
  syncListOrderPlugin,
  textSchema,
  toggleEmphasisCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
  wrapInBlockquoteCommand,
  wrapInBlockquoteInputRule,
  wrapInBulletListCommand,
  wrapInBulletListInputRule,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
  wrapInOrderedListInputRule,
} from "@milkdown/preset-commonmark";
import {
  insertTableCommand,
  keepTableAlignPlugin,
  remarkGFMPlugin,
  strikethroughAttr,
  strikethroughInputRule,
  strikethroughKeymap,
  strikethroughSchema,
  tableCellSchema,
  tableEditingPlugin,
  tableHeaderRowSchema,
  tableHeaderSchema,
  tablePasteRule,
  tableRowSchema,
  tableSchema,
  toggleStrikethroughCommand,
} from "@milkdown/preset-gfm";
import { textblockTypeInputRule } from "@milkdown/prose/inputrules";
import { keymap } from "@milkdown/prose/keymap";
import type { MarkType } from "@milkdown/prose/model";
import {
  type EditorState,
  TextSelection,
  type Transaction,
} from "@milkdown/prose/state";
import { addRowAfter, goToNextCell, isInTable } from "@milkdown/prose/tables";
import type { EditorView } from "@milkdown/prose/view";
import {
  $inputRule,
  $prose,
  callCommand,
  markdownToSlice,
} from "@milkdown/utils";
import {
  htmlToMarkdown,
  isSafeMarkdownLink,
  markdownToHtml,
} from "@package/markdown";
import * as React from "react";
import "@milkdown/prose/view/style/prosemirror.css";

/** Formats supported by the restricted visual editor. */
export type MarkdownVisualFormat =
  | "blockquote"
  | "bold"
  | "heading1"
  | "heading2"
  | "heading3"
  | "horizontalRule"
  | "italic"
  | "link"
  | "orderedList"
  | "strikethrough"
  | "table"
  | "unorderedList";

/** Link content at the current visual selection. */
export type MarkdownLinkSelection = Readonly<{
  /** Existing safe link destination, when selected inside a link. */
  url?: string;
  /** Selected or linked display text. */
  text: string;
}>;

/** Contiguous document range covered by one link destination. */
type LinkRange = {
  /** First document position in the link. */
  from: number;
  /** Document position immediately after the link. */
  to: number;
  /** Link destination shared by the range. */
  url: string;
};

/** Imperative visual editor operations. */
export type MarkdownVisualEditorHandle = Readonly<{
  /** Focuses the visual editing surface. */
  focus(): void;
  /**
   * Applies a supported format.
   *
   * @param format - Supported format to apply to the selection.
   */
  format(format: MarkdownVisualFormat): void;
  /**
   * Reads link content at the current selection.
   *
   * @returns Selected text and any existing link destination.
   */
  getLinkSelection(): MarkdownLinkSelection;
  /** Removes the link at the saved selection and restores focus. */
  removeLink(): void;
  /**
   * Inserts or updates a link at the saved selection.
   *
   * @param text - Display text for an empty selection.
   * @param url - Validated link destination.
   */
  setLink(text: string, url: string): void;
}>;

/** Properties for the restricted visual Markdown editor. */
export type MarkdownVisualEditorProps = Readonly<{
  /** IDs of elements that describe the editor. */
  ariaDescribedBy?: string;
  /** Whether the editor value is invalid. */
  ariaInvalid: boolean;
  /** Whether the editor cannot receive interaction. */
  disabled: boolean;
  /** Accessible editor label. */
  label: string;
  /**
   * Publishes content changes.
   *
   * @param value - Serialized Markdown after a transaction.
   */
  onChange(value: string): void;
  /** Reports visual editor initialization failure. */
  onError(): void;
  /**
   * Publishes active toolbar formats after selection changes.
   *
   * @param formats - Formats active at the current selection.
   */
  onSelectionChange(formats: readonly MarkdownVisualFormat[]): void;
  /**
   * Publishes successful initialization.
   *
   * @param handle - Initialized editor handle.
   */
  onReady(handle: MarkdownVisualEditorHandle): void;
  /** Optional editing hint. */
  placeholder?: string;
  /** Whether content is non-editable. */
  readOnly: boolean;
  /** Initial Markdown value. */
  value: string;
}>;

/** Heading input rule restricted to levels one through three. */
const limitedHeadingInputRule = $inputRule((ctx) =>
  textblockTypeInputRule(
    /^(?<hashes>#{1,3})\s$/,
    headingSchema.type(ctx),
    (match: RegExpMatchArray) => ({
      level: match.groups?.hashes?.length ?? 1,
    }),
  ),
);

/** Table Tab navigation that appends one row at the final cell. */
const tableNavigation = $prose(() =>
  keymap({
    "Shift-Tab": goToNextCell(-1),
    /**
     * Moves forward or appends a final table row.
     *
     * @param state - Current editor state.
     * @param dispatch - Optional transaction dispatcher.
     * @returns Whether table navigation handled the key.
     */
    Tab: (state, dispatch) => {
      if (!isInTable(state)) return false;
      if (goToNextCell(1)(state, dispatch)) return true;
      if (!dispatch) return true;
      return addRowAfter(state, (transaction) => {
        const nextState = state.apply(transaction);
        goToNextCell(1)(nextState, (navigation) =>
          transaction.setSelection(navigation.selection),
        );
        dispatch(transaction);
      });
    },
  }),
);

/** Minimal Milkdown schema and behavior allowed by the product editor. */
const restrictedMarkdown = [
  docSchema,
  paragraphAttr,
  paragraphSchema,
  headingIdGenerator,
  headingAttr,
  headingSchema,
  blockquoteAttr,
  blockquoteSchema,
  hrAttr,
  hrSchema,
  bulletListAttr,
  bulletListSchema,
  orderedListAttr,
  orderedListSchema,
  listItemAttr,
  listItemSchema,
  emphasisAttr,
  emphasisSchema,
  strongAttr,
  strongSchema,
  linkAttr,
  linkSchema,
  strikethroughAttr,
  strikethroughSchema,
  tableSchema,
  tableHeaderRowSchema,
  tableRowSchema,
  tableHeaderSchema,
  tableCellSchema,
  textSchema,
  blockContainerTypes,
  remarkAddOrderInListPlugin,
  remarkInlineLinkPlugin,
  remarkMarker,
  remarkPreserveEmptyLinePlugin,
  remarkGFMPlugin,
  syncHeadingIdPlugin,
  syncListOrderPlugin,
  keepTableAlignPlugin,
  tableEditingPlugin,
  insertTableCommand,
  tableNavigation,
  tablePasteRule,
  turnIntoTextCommand,
  wrapInBlockquoteCommand,
  wrapInHeadingCommand,
  insertHrCommand,
  wrapInOrderedListCommand,
  wrapInBulletListCommand,
  sinkListItemCommand,
  splitListItemCommand,
  liftListItemCommand,
  liftFirstListItemCommand,
  toggleEmphasisCommand,
  toggleStrongCommand,
  toggleStrikethroughCommand,
  wrapInBlockquoteInputRule,
  wrapInBulletListInputRule,
  wrapInOrderedListInputRule,
  insertHrInputRule,
  limitedHeadingInputRule,
  emphasisStarInputRule,
  emphasisUnderscoreInputRule,
  strongInputRule,
  strikethroughInputRule,
  blockquoteKeymap,
  bulletListKeymap,
  orderedListKeymap,
  listItemKeymap,
  paragraphKeymap,
  emphasisKeymap,
  strongKeymap,
  strikethroughKeymap,
  history,
  clipboard,
].flat();

/**
 * Renders the restricted Milkdown editing surface.
 *
 * @param props - Visual editor properties.
 * @returns The visual editor root.
 */
export function MarkdownVisualEditor(props: MarkdownVisualEditorProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const editorRef = React.useRef<Editor | null>(null);
  const createdRef = React.useRef(false);
  const propsRef = React.useRef(props);
  propsRef.current = props;

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let canceled = false;
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, propsRef.current.value);
        ctx.set(editorViewOptionsCtx, {
          attributes: editorAttributes(propsRef.current),
          /**
           * Applies and synchronously serializes an editor transaction.
           *
           * @param transaction - ProseMirror transaction to apply.
           * @returns Nothing.
           */
          dispatchTransaction(this: EditorView, transaction) {
            const result = this.state.applyTransaction(transaction);
            let state = result.state;
            const sanitized = sanitizeLinks(state, linkSchema.type(ctx));
            if (sanitized) state = state.apply(sanitized);
            this.updateState(state);
            propsRef.current.onSelectionChange(activeFormats(state));
            if (
              result.transactions.some((applied) => applied.docChanged) ||
              sanitized?.docChanged
            ) {
              propsRef.current.onChange(ctx.get(serializerCtx)(state.doc));
            }
          },
          /**
           * Reports visual editability.
           *
           * @returns Whether the visual surface is editable.
           */
          editable: () =>
            !propsRef.current.disabled && !propsRef.current.readOnly,
          /**
           * Prevents dropped files from becoming editor content.
           *
           * @param _view - Active editor view.
           * @param event - Drop event to inspect.
           * @returns Whether a dropped file was blocked.
           */
          handleDrop: (_view, event) =>
            Boolean(event.dataTransfer?.files.length),
          /**
           * Normalizes plain Markdown paste through the restricted schema.
           *
           * @param view - Active editor view.
           * @param event - Clipboard event to inspect.
           * @returns Whether the paste was handled.
           */
          handlePaste: (view, event) => {
            const data = event.clipboardData;
            if (data?.files.length) return true;
            if (!data || data.getData("text/html")) return false;
            const text = data.getData("text/plain");
            if (!text) return false;
            const safe = htmlToMarkdown(markdownToHtml(text)) ?? "";
            view.dispatch(
              view.state.tr.replaceSelection(markdownToSlice(safe)(ctx)),
            );
            return true;
          },
        });
      })
      .use(restrictedMarkdown);
    editorRef.current = editor;

    void editor
      .create()
      .then(() => {
        if (canceled) return;
        createdRef.current = true;
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const sanitized = sanitizeLinks(view.state, linkSchema.type(ctx));
          if (sanitized) view.dispatch(sanitized);
          propsRef.current.onSelectionChange(activeFormats(view.state));
        });
        propsRef.current.onReady({
          /**
           * Focuses the initialized visual editor.
           *
           * @returns The focus operation result.
           */
          focus: () =>
            editorRef.current?.action((ctx) => ctx.get(editorViewCtx).focus()),
          /**
           * Applies a supported format to the current selection.
           *
           * @param format - Format to apply.
           * @returns Nothing.
           */
          format: (format) => runFormat(editorRef.current, format),
          /**
           * Reads selected text and an existing link destination.
           *
           * @returns Current link selection metadata.
           */
          getLinkSelection: () =>
            editorRef.current?.action((ctx) =>
              currentLink(ctx.get(editorViewCtx).state, linkSchema.type(ctx)),
            ) ?? { text: "" },
          /**
           * Removes the selected link.
           *
           * @returns Nothing.
           */
          removeLink: () => updateLink(editorRef.current, "", ""),
          /**
           * Inserts or updates the selected link.
           *
           * @param text - Link display text.
           * @param url - Validated destination.
           * @returns Nothing.
           */
          setLink: (text, url) => updateLink(editorRef.current, text, url),
        });
      })
      .catch(() => {
        if (!canceled) propsRef.current.onError();
      });

    return () => {
      canceled = true;
      createdRef.current = false;
      editorRef.current = null;
      void editor.destroy();
    };
  }, []);

  React.useEffect(() => {
    if (!createdRef.current) return;
    editorRef.current?.action((ctx) => {
      ctx.get(editorViewCtx).setProps({
        attributes: editorAttributes(props),
        /**
         * Reports current editability.
         *
         * @returns Whether the current properties allow editing.
         */
        editable: () => !props.disabled && !props.readOnly,
      });
    });
  }, [props]);

  return <div className="h-64 overflow-y-auto" ref={rootRef} />;
}

/**
 * Builds accessible ProseMirror root attributes.
 *
 * @param props - Current visual editor properties.
 * @returns DOM attributes for the editor root.
 */
function editorAttributes(props: MarkdownVisualEditorProps) {
  return {
    ...(props.ariaDescribedBy
      ? { "aria-describedby": props.ariaDescribedBy }
      : {}),
    "aria-disabled": props.disabled ? "true" : "false",
    "aria-invalid": props.ariaInvalid ? "true" : "false",
    "aria-label": props.label,
    "aria-multiline": "true",
    "aria-placeholder": props.placeholder ?? "",
    "aria-readonly": props.readOnly ? "true" : "false",
    class:
      "h-64 overflow-y-auto p-4 text-sm text-foreground outline-none [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_hr]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_ul]:list-disc [&_ul]:pl-6",
    role: "textbox",
    tabindex: props.disabled ? "-1" : "0",
  };
}

/**
 * Runs a supported Milkdown formatting command.
 *
 * @param editor - Active Milkdown editor.
 * @param format - Format to apply.
 * @returns Nothing.
 */
function runFormat(editor: Editor | null, format: MarkdownVisualFormat) {
  if (!editor) return;
  switch (format) {
    case "blockquote":
      editor.action(callCommand(wrapInBlockquoteCommand.key));
      break;
    case "bold":
      editor.action(callCommand(toggleStrongCommand.key));
      break;
    case "heading1":
      editor.action(callCommand(wrapInHeadingCommand.key, 1));
      break;
    case "heading2":
      editor.action(callCommand(wrapInHeadingCommand.key, 2));
      break;
    case "heading3":
      editor.action(callCommand(wrapInHeadingCommand.key, 3));
      break;
    case "horizontalRule":
      editor.action(callCommand(insertHrCommand.key));
      break;
    case "italic":
      editor.action(callCommand(toggleEmphasisCommand.key));
      break;
    case "orderedList":
      editor.action(callCommand(wrapInOrderedListCommand.key));
      break;
    case "strikethrough":
      editor.action(callCommand(toggleStrikethroughCommand.key));
      break;
    case "table":
      editor.action(callCommand(insertTableCommand.key, { col: 3, row: 2 }));
      break;
    case "unorderedList":
      editor.action(callCommand(wrapInBulletListCommand.key));
      break;
  }
  editor.action((ctx) => ctx.get(editorViewCtx).focus());
}

/**
 * Removes link marks whose destinations are outside the product allowlist.
 *
 * @param state - Editor state to sanitize.
 * @param linkType - Restricted link mark type.
 * @returns A sanitizing transaction, or null when no links change.
 */
function sanitizeLinks(
  state: EditorState,
  linkType: MarkType,
): Transaction | null {
  const transaction = state.tr;
  let changed = false;
  state.doc.descendants((node, position) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type !== linkType || isSafeMarkdownLink(mark.attrs.href))
        continue;
      transaction.removeMark(position, position + node.nodeSize, mark);
      changed = true;
    }
  });
  return changed ? transaction : null;
}

/**
 * Reads toolbar formats active at the current visual selection.
 *
 * @param state - Current editor state.
 * @returns Active toolbar formats.
 */
function activeFormats(state: EditorState): readonly MarkdownVisualFormat[] {
  const formats: MarkdownVisualFormat[] = [];
  const { $from, from, empty, to } = state.selection;
  /**
   * Reports whether one named mark covers the current selection.
   *
   * @param name - ProseMirror mark name.
   * @returns Whether the mark covers the current selection.
   */
  const markActive = (name: string) => {
    const type = state.schema.marks[name];
    return Boolean(
      type &&
        (empty
          ? type.isInSet($from.marks())
          : state.doc.rangeHasMark(from, to, type)),
    );
  };
  if (markActive("strong")) formats.push("bold");
  if (markActive("emphasis")) formats.push("italic");
  if (markActive("link")) formats.push("link");
  if (markActive("strike_through")) formats.push("strikethrough");

  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "heading" && node.attrs.level <= 3) {
      formats.push(`heading${node.attrs.level}` as MarkdownVisualFormat);
    } else if (node.type.name === "blockquote") formats.push("blockquote");
    else if (node.type.name === "bullet_list") formats.push("unorderedList");
    else if (node.type.name === "ordered_list") formats.push("orderedList");
    else if (node.type.name === "table") formats.push("table");
  }
  return formats;
}

/**
 * Reads selected text and any link covering the visual selection.
 *
 * @param state - Current editor state.
 * @param linkType - Restricted link mark type.
 * @returns Current selection text and optional destination.
 */
function currentLink(
  state: EditorState,
  linkType: MarkType,
): MarkdownLinkSelection {
  const range = linkRange(state, linkType);
  if (range) {
    return {
      text: state.doc.textBetween(range.from, range.to),
      url: range.url,
    };
  }
  const { from, to } = state.selection;
  return { text: state.doc.textBetween(from, to, " ") };
}

/**
 * Inserts, updates, or removes a link and restores the visual selection.
 *
 * @param editor - Active Milkdown editor.
 * @param text - Link display text for an empty selection.
 * @param url - Validated destination, or empty when removing.
 * @returns Nothing.
 */
function updateLink(editor: Editor | null, text: string, url: string) {
  editor?.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const linkType = linkSchema.type(ctx);
    const existing = linkRange(view.state, linkType);
    const { from, to } = view.state.selection;
    const transaction = view.state.tr;
    const start = existing?.from ?? from;
    let end = existing?.to ?? to;

    if (existing) transaction.removeMark(start, end, linkType);
    if (!existing && from === to && text) {
      transaction.insertText(text, from, to);
      end = from + text.length;
    }
    if (url && end > start) {
      transaction.addMark(start, end, linkType.create({ href: url }));
    }
    transaction.setSelection(
      TextSelection.between(
        transaction.doc.resolve(start),
        transaction.doc.resolve(end),
      ),
    );
    view.dispatch(transaction.scrollIntoView());
    view.focus();
  });
}

/**
 * Finds the contiguous link range touching the current selection.
 *
 * @param state - Current editor state.
 * @param linkType - Restricted link mark type.
 * @returns The matching contiguous link range, when present.
 */
function linkRange(state: EditorState, linkType: MarkType) {
  const { from, to } = state.selection;
  const ranges: LinkRange[] = [];
  state.doc.descendants((node, position) => {
    if (!node.isText) return;
    const mark = linkType.isInSet(node.marks);
    if (!mark) return;
    const end = position + node.nodeSize;
    const previous = ranges.at(-1);
    if (previous?.to === position && previous.url === mark.attrs.href) {
      previous.to = end;
    } else {
      ranges.push({ from: position, to: end, url: mark.attrs.href });
    }
  });
  return ranges.find((range) =>
    from === to
      ? from >= range.from && from <= range.to
      : from < range.to && to > range.from,
  );
}
