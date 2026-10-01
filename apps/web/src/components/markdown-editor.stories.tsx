import type { Meta, StoryObj } from "@storybook/tanstack-react";
import * as React from "react";
import { expect, fireEvent, fn, mocked, waitFor } from "storybook/test";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { MarkdownEditor } from "./markdown-editor";
import type { MarkdownVisualEditorProps } from "./markdown-visual-editor";

/** Storybook metadata for the Markdown editor. */
const meta = {
  args: {
    label: "Description",
    onChange: fn(),
    onLoadingChange: fn(),
  },
  /** Resets the visual editor module mock before each story. */
  beforeEach: async () => {
    (await visualEditorMock()).mockReset();
  },
  component: MarkdownEditor,
  decorators: [
    (Story) => (
      <StoryProviders>
        <div className="w-[min(48rem,calc(100vw-2rem))]">
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
  title: "Components/MarkdownEditor",
} satisfies Meta<typeof MarkdownEditor>;

export default meta;
/** Markdown editor story type. */
type Story = StoryObj<typeof meta>;

/** Empty visual editor story. */
export const EmptyVisual: Story = {
  /**
   * Verifies the visual editor's accessible multiline surface.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("textbox", { name: "Description" }),
    ).toHaveAttribute("aria-multiline", "true");
  },
};

/** Populated visual editor story. */
export const PopulatedVisual: Story = {
  args: {
    defaultValue:
      "# Daily carry\n\nA **small** collection with:\n\n- Pens\n- Notebooks",
  },
};

/** Visual toolbar interaction story. */
export const VisualToolbar: Story = {
  /**
   * Verifies heading formatting from the visual toolbar.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole("textbox", {
      name: "Description",
    });
    await userEvent.click(canvas.getByRole("button", { name: "Heading 1" }));
    await expect(
      canvas.getByRole("button", { name: "Heading 1" }),
    ).toHaveAttribute("aria-pressed", "true");
    await userEvent.type(editor, "Toolbar heading");
    await expect(
      canvas.getByRole("heading", { level: 1, name: "Toolbar heading" }),
    ).toBeVisible();
  },
};

/** Visual typing shortcut story. */
export const TypingShortcut: Story = {
  /**
   * Verifies the supported heading typing shortcut.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole("textbox", {
      name: "Description",
    });
    await userEvent.type(editor, "# Typed heading");
    await expect(
      canvas.getByRole("heading", { level: 1, name: "Typed heading" }),
    ).toBeVisible();
  },
};

/** Visual input-method composition story. */
export const VisualComposition: Story = {
  /**
   * Verifies composed CJK input is neither dropped nor duplicated.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole("textbox", {
      name: "Description",
    });
    await userEvent.click(editor);
    fireEvent.compositionStart(editor);
    await userEvent.type(editor, "日本語入力");
    fireEvent.compositionEnd(editor, { data: "日本語入力" });
    await expect(editor).toHaveTextContent("日本語入力");
    await userEvent.click(canvas.getByRole("button", { name: "Source" }));
    await expect(
      canvas.getByRole("textbox", { name: "Description" }),
    ).toHaveValue("日本語入力");
  },
};

/** Unsupported initial code block story. */
export const UnsupportedCodeIsReadableText: Story = {
  args: { defaultValue: "```markdown\n# Not a real heading\n```" },
  /**
   * Verifies unsupported code renders as readable text.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    const editor = await canvas.findByRole("textbox", {
      name: "Description",
    });
    await expect(editor).toHaveTextContent("# Not a real heading");
    await expect(editor.querySelector("code")).toBeNull();
  },
};

/** Unsupported pasted code block story. */
export const PastedCodeIsReadableText: Story = {
  /**
   * Verifies pasted code is downgraded to readable text.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole("textbox", {
      name: "Description",
    });
    await userEvent.click(editor);
    await userEvent.paste("before\n\n```markdown\n# Pasted text\n```\n\nafter");
    await expect(editor).toHaveTextContent("# Pasted text");
    await expect(
      [...editor.querySelectorAll("p")].map(
        (paragraph) => paragraph.textContent,
      ),
    ).toEqual(["before", "# Pasted text", "after"]);
    await expect(editor.querySelector("code")).toBeNull();
  },
};

/** Visual undo and redo story. */
export const VisualHistory: Story = {
  /**
   * Verifies visual edits can be undone and redone.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole("textbox", {
      name: "Description",
    });
    await userEvent.type(editor, "Undo me");
    await expect(editor).toHaveTextContent("Undo me");
    const modifier = /Mac|iPhone|iPad/u.test(navigator.platform)
      ? "Meta"
      : "Control";
    await userEvent.keyboard(`{${modifier}>}z{/${modifier}}`);
    await expect(editor).not.toHaveTextContent("Undo me");
    await userEvent.keyboard(`{${modifier}>}{Shift>}z{/Shift}{/${modifier}}`);
    await expect(editor).toHaveTextContent("Undo me");
  },
};

/** Existing visual link editing story. */
export const VisualLinkEditing: Story = {
  args: { defaultValue: "[Pocket **Trash**](/old)" },
  /**
   * Verifies contextual link editing and focus restoration.
   *
   * @param root0 - Story context.
   * @param root0.canvas - Rendered story canvas.
   * @param root0.userEvent - Story interaction driver.
   * @returns A promise that resolves after assertions complete.
   * @rejects When the expected link is absent.
   */
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole("textbox", { name: "Description" });
    const link = editor.querySelector("a");
    if (!link) throw new globalThis.Error("Expected initial link");
    await userEvent.click(link);
    await expect(canvas.getByRole("button", { name: "Link" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Link" }));
    const dialog = canvas.getByRole("dialog");
    const url = canvas.getByLabelText("URL");
    await expect(dialog).toBeVisible();
    await userEvent.clear(url);
    await userEvent.type(url, "https://pocket-trash.app");
    await userEvent.click(canvas.getByRole("button", { name: "Update link" }));
    await expect(editor.querySelector("a")).toHaveAttribute(
      "href",
      "https://pocket-trash.app",
    );
    await expect(editor).toHaveFocus();
    const updatedLink = editor.querySelector("a");
    if (!updatedLink) throw new globalThis.Error("Expected updated link");
    await userEvent.click(updatedLink);
    await userEvent.click(canvas.getByRole("button", { name: "Link" }));
    await userEvent.click(canvas.getByRole("button", { name: "Remove link" }));
    await expect(editor.querySelector("a")).toBeNull();
    await expect(editor).toHaveTextContent("Pocket Trash");
    await expect(editor.querySelector("strong")).toHaveTextContent("Trash");
  },
};

/** Selected visual text link story. */
export const VisualSelectedTextLink: Story = {
  args: { defaultValue: "Pocket Trash" },
  /**
   * Verifies selected text asks only for a URL and becomes a link.
   *
   * @param root0 - Story context.
   * @param root0.canvas - Rendered story canvas.
   * @param root0.userEvent - Story interaction driver.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole("textbox", { name: "Description" });
    await userEvent.click(editor);
    const modifier = /Mac|iPhone|iPad/u.test(navigator.platform)
      ? "Meta"
      : "Control";
    await userEvent.keyboard(`{${modifier}>}a{/${modifier}}`);
    await userEvent.click(canvas.getByRole("button", { name: "Link" }));
    await expect(canvas.queryByLabelText("Link text")).toBeNull();
    await userEvent.type(canvas.getByLabelText("URL"), "/about");
    await userEvent.click(canvas.getByRole("button", { name: "Insert link" }));
    await expect(editor.querySelector("a")).toHaveTextContent("Pocket Trash");
    await expect(editor).toHaveFocus();
  },
};

/** Empty-selection visual link story. */
export const VisualLinkModal: Story = {
  /**
   * Verifies the modal requires link text and URL.
   *
   * @param root0 - Story context.
   * @param root0.canvas - Rendered story canvas.
   * @param root0.userEvent - Story interaction driver.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole("textbox", { name: "Description" });
    await userEvent.click(canvas.getByRole("button", { name: "Link" }));
    const dialog = canvas.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await userEvent.type(canvas.getByLabelText("Link text"), "Pocket Trash");
    await userEvent.type(canvas.getByLabelText("URL"), "/about");
    await userEvent.click(canvas.getByRole("button", { name: "Insert link" }));
    await expect(editor.querySelector("a")).toHaveTextContent("Pocket Trash");
    await expect(editor.querySelector("a")).toHaveAttribute("href", "/about");
    await expect(editor).toHaveFocus();
  },
};

/** Visual table insertion and navigation story. */
export const VisualTable: Story = {
  parameters: {
    a11y: {
      config: { rules: [{ enabled: false, id: "empty-table-header" }] },
    },
  },
  /**
   * Verifies the fixed table shape and last-cell Tab behavior.
   *
   * @param root0 - Story context.
   * @param root0.canvas - Rendered story canvas.
   * @param root0.userEvent - Story interaction driver.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole("textbox", { name: "Description" });
    await userEvent.click(canvas.getByRole("button", { name: "Table" }));
    const table = canvas.getByRole("table");
    await expect(table.querySelectorAll("tr")).toHaveLength(2);
    await expect(table.querySelectorAll("th")).toHaveLength(3);
    await expect(table.querySelectorAll("td")).toHaveLength(3);
    const lastCell = table.querySelectorAll("td").item(2);
    await userEvent.click(lastCell);
    await userEvent.keyboard("{Tab}");
    await expect(table.querySelectorAll("tr")).toHaveLength(3);
  },
};

/** Restricted Markdown clipboard story. */
export const VisualClipboard: Story = {
  /**
   * Verifies Markdown paste, unsupported image removal, and Markdown copy.
   *
   * @param root0 - Story context.
   * @param root0.canvas - Rendered story canvas.
   * @param root0.userEvent - Story interaction driver.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole("textbox", { name: "Description" });
    await userEvent.click(editor);
    await userEvent.paste(
      "**Bold** and [safe](https://example.com) and [mail](mailto:test@example.com)\n\n![Alt](https://example.com/a.png)",
    );
    await expect(editor.querySelector("strong")).toHaveTextContent("Bold");
    await expect(editor.querySelector("a")).toHaveAttribute(
      "href",
      "https://example.com",
    );
    await expect(editor.querySelector("img")).toBeNull();
    await expect(editor).toHaveTextContent("Alt");
    await expect(editor.querySelectorAll("a")).toHaveLength(1);

    const modifier = /Mac|iPhone|iPad/u.test(navigator.platform)
      ? "Meta"
      : "Control";
    await userEvent.keyboard(`{${modifier}>}a{/${modifier}}`);
    const copied = await userEvent.copy();
    await expect(copied?.getData("text/plain")).toContain(
      "**Bold** and [safe](https://example.com)",
    );
  },
};

/** GFM URL activation story. */
export const VisualBareUrl: Story = {
  /**
   * Verifies typed URLs stay plain until a parse cycle and mailto stays inert.
   *
   * @param root0 - Story context.
   * @param root0.canvas - Rendered story canvas.
   * @param root0.userEvent - Story interaction driver.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole("textbox", { name: "Description" });
    await userEvent.type(editor, "https://example.com");
    await expect(editor.querySelector("a")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Source" }));
    await userEvent.click(canvas.getByRole("button", { name: "Visual" }));
    const reparsed = await canvas.findByRole("textbox", {
      name: "Description",
    });
    await expect(reparsed.querySelector("a")).toHaveAttribute(
      "href",
      "https://example.com",
    );
  },
};

/** Unsafe initial link story. */
export const UnsafeLinkIsInert: Story = {
  args: { defaultValue: "[Email](mailto:test@example.com)" },
  /**
   * Verifies non-HTTP schemes never become active links.
   *
   * @param root0 - Story context.
   * @param root0.canvas - Rendered story canvas.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    const editor = await canvas.findByRole("textbox", { name: "Description" });
    await expect(editor).toHaveTextContent("Email");
    await expect(editor.querySelector("a")).toBeNull();
  },
};

/** Narrow visual toolbar story. */
export const NarrowToolbar: Story = {
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
  /**
   * Verifies one-row horizontal overflow and touch-sized controls.
   *
   * @param root0 - Story context.
   * @param root0.canvas - Rendered story canvas.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    await canvas.findByRole("textbox", { name: "Description" });
    const toolbar = canvas.getByRole("toolbar");
    await expect(toolbar.scrollWidth).toBeGreaterThan(toolbar.clientWidth);
    for (const button of toolbar.querySelectorAll("button")) {
      await expect(
        button.getBoundingClientRect().height,
      ).toBeGreaterThanOrEqual(44);
    }
  },
};

/** Source mode formatting story. */
export const Source: Story = {
  args: { defaultValue: "A **formatted** description." },
  /**
   * Verifies Source mode and exact formatting removal.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Source" }));
    const source = canvas.getByRole("textbox", {
      name: "Description",
    }) as HTMLTextAreaElement;
    await expect(source).toHaveValue("A **formatted** description.");
    source.setSelectionRange(2, 15);
    await userEvent.click(canvas.getByRole("button", { name: "Bold" }));
    await expect(source).toHaveValue("A formatted description.");
  },
};

/** Fixed-height loading state story. */
export const Loading: Story = {
  /** Leaves the mocked visual editor pending. */
  beforeEach: async () => {
    (await visualEditorMock()).mockImplementation(() => <></>);
  },
  /**
   * Verifies loading status and disabled toolbar controls.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Loading Markdown editor.",
    );
    await expect(canvas.getByRole("button", { name: "Bold" })).toBeDisabled();
  },
};

/** Value-preserving initialization fallback story. */
export const InitializationFallback: Story = {
  args: { defaultValue: "Keep **this** content." },
  /** Makes visual editor initialization fail. */
  beforeEach: async () => {
    (await visualEditorMock()).mockImplementation(FailingVisualEditor);
  },
  /**
   * Verifies fallback messaging and preserved Source content.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(
        canvas.getByText(/visual editor couldn't load/i, { selector: "p" }),
      ).toBeVisible(),
    );
    await expect(
      canvas.getByRole("textbox", { name: "Description" }),
    ).toHaveValue("Keep **this** content.");
  },
};

/** Disabled editor story. */
export const Disabled: Story = {
  args: { defaultValue: "This editor is disabled.", disabled: true },
  /**
   * Verifies the visual editor exposes disabled semantics.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("textbox", { name: "Description" }),
    ).toHaveAttribute("aria-disabled", "true");
  },
};

/** Read-only editor story. */
export const ReadOnly: Story = {
  args: { defaultValue: "This editor is read-only.", readOnly: true },
  /**
   * Verifies the visual editor exposes read-only semantics.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("textbox", { name: "Description" }),
    ).toHaveAttribute("aria-readonly", "true");
  },
};

/** Validation error story. */
export const Error: Story = {
  args: { error: "A description is required." },
  /**
   * Verifies error state is connected to the editing surface.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Source" }));
    await expect(
      canvas.getByRole("textbox", { name: "Description" }),
    ).toHaveAttribute("aria-invalid", "true");
  },
};

/** Normal character counter story. */
export const CharacterNormal: Story = {
  args: {
    counter: { limit: 20, type: "characters", warningAt: 15 },
    defaultValue: "Short",
  },
};

/** Warning character counter story. */
export const CharacterWarning: Story = {
  args: {
    counter: { limit: 20, type: "characters", warningAt: 15 },
    defaultValue: "123456789012345",
  },
};

/** Exact character limit story. */
export const CharacterLimitReached: Story = {
  args: {
    counter: { limit: 20, type: "characters", warningAt: 15 },
    defaultValue: "12345678901234567890",
  },
};

/** Over character limit story. */
export const CharacterOverLimit: Story = {
  args: {
    counter: { limit: 20, type: "characters", warningAt: 15 },
    defaultValue: "123456789012345678901",
  },
};

/** Normal word counter story. */
export const WordNormal: Story = {
  args: {
    counter: { limit: 5, type: "words", warningAt: 4 },
    defaultValue: "one two",
  },
};

/** Warning word counter story. */
export const WordWarning: Story = {
  args: {
    counter: { limit: 5, type: "words", warningAt: 4 },
    defaultValue: "one two three four",
  },
};

/** Exact word limit story. */
export const WordLimitReached: Story = {
  args: {
    counter: { limit: 5, type: "words", warningAt: 4 },
    defaultValue: "one two three four five",
  },
};

/** Over word limit story. */
export const WordOverLimit: Story = {
  args: {
    counter: { limit: 5, type: "words", warningAt: 4 },
    defaultValue: "one two three four five six",
  },
};

/**
 * Story-only visual editor that reports initialization failure.
 *
 * @param props - Visual editor properties.
 * @param props.onError - Failure callback.
 * @returns An empty visual editor element.
 */
function FailingVisualEditor({ onError }: MarkdownVisualEditorProps) {
  React.useEffect(onError, [onError]);
  return <></>;
}

/**
 * Loads the Storybook visual editor mock.
 *
 * @returns The typed visual editor mock.
 */
async function visualEditorMock() {
  const { MarkdownVisualEditor } = await import("./markdown-visual-editor");
  return mocked(MarkdownVisualEditor);
}
