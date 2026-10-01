import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
  editorViewOptionsCtx,
  rootCtx,
  serializerCtx,
} from "@milkdown/kit/core";
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
} from "@milkdown/kit/preset/commonmark";
import {
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
  tableRowSchema,
  tableSchema,
  toggleStrikethroughCommand,
} from "@milkdown/kit/preset/gfm";
import { textblockTypeInputRule } from "@milkdown/kit/prose/inputrules";
import { $inputRule, callCommand } from "@milkdown/kit/utils";
import { markdownToHtml } from "@package/markdown";
import * as React from "react";
import "@milkdown/kit/prose/view/style/prosemirror.css";

/** Formats supported by the restricted visual editor. */
export type MarkdownVisualFormat =
  | "blockquote"
  | "bold"
  | "heading1"
  | "heading2"
  | "heading3"
  | "horizontalRule"
  | "italic"
  | "orderedList"
  | "strikethrough"
  | "unorderedList";

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
    (match) => ({ level: match.groups?.hashes?.length ?? 1 }),
  ),
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
          dispatchTransaction(transaction) {
            const view = ctx.get(editorViewCtx);
            const state = view.state.apply(transaction);
            view.updateState(state);
            propsRef.current.onChange(ctx.get(serializerCtx)(state.doc));
          },
          /**
           * Reports visual editability.
           *
           * @returns Whether the visual surface is editable.
           */
          editable: () =>
            !propsRef.current.disabled && !propsRef.current.readOnly,
          /**
           * Inserts pasted input as readable plain text.
           *
           * @param view - Active editor view.
           * @param event - Clipboard event.
           * @returns Whether the paste was handled.
           */
          handlePaste(view, event) {
            const pasted = event.clipboardData?.getData("text/plain");
            if (!pasted) return false;
            view.dispatch(view.state.tr.insertText(pasteText(pasted)));
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
    case "unorderedList":
      editor.action(callCommand(wrapInBulletListCommand.key));
      break;
  }
  editor.action((ctx) => ctx.get(editorViewCtx).focus());
}

/**
 * Downgrades pasted code blocks to readable text.
 *
 * @param value - Plain clipboard text.
 * @returns Text safe for insertion into the restricted schema.
 */
function pasteText(value: string): string {
  if (!/(?:^|\n)(?: {0,3}(?:`{3,}|~{3,})| {4}|\t)/u.test(value)) {
    return value;
  }
  const document = new DOMParser().parseFromString(
    markdownToHtml(value) ?? "",
    "text/html",
  );
  return document.body.textContent ?? "";
}
